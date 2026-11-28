import 'server-only';

import { gunzipSync, gzipSync } from 'node:zlib';

import {
  DocumentContent,
  isContentEmpty,
  isDocumentContent,
  readStoredContent,
  withoutTransientNodes,
} from '@/app/utils/storedDocument';

/*
 * How a document's content is stored. Everything that reads or writes content goes through here.
 *
 * - content_gz (binary): the gzip of JSON.stringify(content). Written since 0.5.0. When it is
 *   there, it is the content, and `content` is absent.
 * - content (map): the content as 0.3.0 to 0.4.1 stored it. Read as before, and replaced by
 *   content_gz on the next save.
 * - An empty document is stored as `content: null`, without content_gz, as it always was.
 */

/** Beyond this, stored bytes are not decompressed: no save writes more */
export const MAX_CONTENT_BYTES = 5 * 1024 * 1024;
/**
 * The deepest content DynamoDB stores as a map, which it was until 0.4.1. Compressed content has
 * no such limit, but deeper content is refused as before, so that nothing changes for users.
 */
const MAX_STORED_DEPTH = 31;

/** Stored content that can't be read. It is never treated as empty, so never overwritten */
export class UnreadableContentError extends Error {}

/** Content that can't be stored: too large, or nested too deeply */
export class ContentTooLargeError extends Error {}

/** The attributes of a document's item that hold its content */
export interface StoredContent {
  content?: unknown;
  content_gz?: Uint8Array;
}

/** What to write: compressed content, or none for an empty document */
export type ContentWrite = { content: null } | { content_gz: Uint8Array };

function decompress(bytes: unknown): string {
  if (!(bytes instanceof Uint8Array)) throw new UnreadableContentError('content_gz is not binary');
  try {
    return gunzipSync(bytes, { maxOutputLength: MAX_CONTENT_BYTES }).toString('utf8');
  } catch (error) {
    throw new UnreadableContentError(`content_gz can't be decompressed: ${(error as Error).message}`);
  }
}

/**
 * A document's content as the editor should get it, whichever version stored it, or null if it
 * has none.
 *
 * @throws UnreadableContentError if content_gz is damaged, too large, or not a document
 */
export function readContent(item: StoredContent | null | undefined): DocumentContent | null {
  if (!item) return null;
  if (item.content_gz === undefined) return readStoredContent(item.content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(decompress(item.content_gz));
  } catch (error) {
    if (error instanceof UnreadableContentError) throw error;
    throw new UnreadableContentError('content_gz is not JSON');
  }
  if (!isDocumentContent(parsed)) throw new UnreadableContentError('content_gz is not a document');
  return readStoredContent(parsed);
}

/** Whether a document has no content. Content that can't be read is not empty */
export function isStoredContentEmpty(item: StoredContent | null | undefined): boolean {
  if (item?.content_gz === undefined) return isContentEmpty(item?.content as DocumentContent);
  try {
    return isContentEmpty(readContent(item));
  } catch (error) {
    if (error instanceof UnreadableContentError) return false;
    throw error;
  }
}

/** How deeply content nests, counting objects and arrays, as DynamoDB counts maps and lists */
function depthOf(value: unknown): number {
  let deepest = 0;
  // Without recursion, like isWithinLimits
  const pending: Array<[unknown, number]> = [[value, 1]];
  while (pending.length) {
    const [node, depth] = pending.pop()!;
    if (!node || typeof node !== 'object') continue;
    deepest = Math.max(deepest, depth);
    for (const child of Object.values(node)) pending.push([child, depth + 1]);
  }
  return deepest;
}

// DynamoDB's limit for an item, which held the content map until 0.4.1
const MAX_ITEM_BYTES = 400 * 1024;
// Room for an item's other attributes: slug, dates, flags and the save log
const OTHER_ATTRIBUTES_BYTES = 2048;

/** Bytes DynamoDB counts for a value, by its documented rules */
function storedSize(value: unknown): number {
  let size = 0;
  const pending: unknown[] = [value];
  while (pending.length) {
    const node = pending.pop();
    if (typeof node === 'string') size += Buffer.byteLength(node);
    else if (typeof node === 'number') size += Math.ceil(String(Math.abs(node)).replace(/\D/g, '').length / 2) + 1;
    else if (Array.isArray(node)) {
      size += 3 + node.length;
      for (const child of node) pending.push(child);
    } else if (node && typeof node === 'object') {
      const entries = Object.entries(node);
      size += 3 + entries.length;
      for (const [key, child] of entries) {
        size += Buffer.byteLength(key);
        pending.push(child);
      }
    } else {
      size += 1;
    }
  }
  return size;
}

/**
 * Whether content is larger than DynamoDB could store as a map, as 0.3.0 to 0.4.1 stored it.
 * Tabs still running 0.3.0 keep that limit (see saveFromOldTab).
 */
export function isOverMapLimit(content: DocumentContent): boolean {
  return storedSize(content) + OTHER_ATTRIBUTES_BYTES > MAX_ITEM_BYTES;
}

/**
 * The attributes to write for content. Checks its own output: the compressed bytes are
 * decompressed and compared with the original before anything is written.
 *
 * @throws ContentTooLargeError if the content can't be stored
 * @throws Error if the compressed bytes don't read back, so nothing is written
 */
export function writeContent(content: DocumentContent | null): ContentWrite {
  const stored = content && withoutTransientNodes(content);
  if (!stored || isContentEmpty(stored)) return { content: null };
  if (depthOf(stored) > MAX_STORED_DEPTH) throw new ContentTooLargeError('content nests too deeply');

  const json = JSON.stringify(stored);
  if (Buffer.byteLength(json) > MAX_CONTENT_BYTES) throw new ContentTooLargeError('content too large');
  const compressed = gzipSync(json);
  if (decompress(compressed) !== json) throw new Error('Compressed content did not read back the same');
  return { content_gz: compressed };
}
