import 'server-only';

import { createHash } from 'node:crypto';

import { mergeBlocks } from '@/app/utils/mergeDocuments';
import {
  DocumentContent,
  getBlocks,
  isContentEmpty,
  readStoredContent,
  withoutTransientNodes,
} from '@/app/utils/storedDocument';
import { Document, DocumentPatch, SaveLogEntry, SaveRequest, SaveResult } from '@/types';

import {
  createDocument,
  getDocumentBySlug,
  StaleDocumentError,
  updateDocumentContent,
} from './document-service';

// The tabs whose saves the log can recognize: each tab's latest save, of the most recent tabs.
// A tab's latest save is all that matters, as a save landing means its earlier ones did too.
export const SAVE_LOG_TABS = 10;

/** The log after a save: one entry per tab, the latest last */
export function withSave(log: SaveLogEntry[], entry: SaveLogEntry): SaveLogEntry[] {
  return [...log.filter((saved) => saved.tab !== entry.tab), entry].slice(-SAVE_LOG_TABS);
}

/**
 * What the log keeps of a tab id. The log is sent to everyone who opens the document, and a tab id
 * is what a save is accepted under, so only a hash of it is kept.
 */
export function hashTabId(tab: string): string {
  return createHash('sha256').update(tab).digest('hex').slice(0, 32);
}
const MAX_ATTEMPTS = 6;

type Decision = { content: DocumentContent } | SaveResult;

/**
 * The client never decides whether a document is created, updated or locked. The stored
 * document does, and every write is conditional on it being unchanged since it was read.
 */
async function save(
  slug: string,
  tab: string,
  seq: number,
  decide: (stored: Document | null) => Decision,
): Promise<SaveResult> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const stored = await getDocumentBySlug(slug);
    // Up to 0.3.0 anyone could store any value here, and the page treats every truthy one as locked
    if (stored?.read_only) return { status: 'read-only' };

    const decision = decide(stored);
    if ('status' in decision) return decision;

    // Strictly increasing, as it identifies the revision
    const previous = Date.parse(stored?.updated_at ?? '') || 0;
    const now = new Date(Math.max(Date.now(), previous + 1)).toISOString();
    const entry: SaveLogEntry = { tab, seq, at: now };

    try {
      const content = withoutTransientNodes(decision.content);
      const processedContent = isContentEmpty(content) ? null : content;
      if (stored) {
        await updateDocumentContent(stored, {
          content: processedContent,
          updated_at: now,
          save_log: withSave(stored.save_log ?? [], entry),
        });
      } else {
        await createDocument({
          slug,
          content: processedContent,
          read_only: false,
          version: 1, // Default version
          created_at: now,
          updated_at: now,
          save_log: [entry],
        });
      }
      return { status: 'saved', revision: now };
    } catch (error) {
      if (error instanceof StaleDocumentError) continue;
      const { name, message } = error as Error;
      // DynamoDB's limits of 400 KB and 32 levels of nesting, and nesting too deep to marshal
      const overLimit = name === 'ValidationException' && /size|nest/i.test(message);
      if (overLimit || error instanceof RangeError) {
        return { status: 'too-large' };
      }
      throw error;
    }
  }
  throw new Error(`Document ${slug} kept changing while it was being saved`);
}

function applyPatch(stored: Document | null, patch: DocumentPatch): DocumentContent | null {
  const content = readStoredContent(stored?.content);
  const blocks = getBlocks(content);
  if (blocks.length !== patch.count || patch.start + patch.end > blocks.length) return null;
  const children = [
    ...blocks.slice(0, patch.start),
    ...patch.blocks,
    ...blocks.slice(blocks.length - patch.end),
  ];
  return {
    root: {
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
      ...content?.root,
      children,
    },
  };
}

/**
 * Save an edit made on a known revision of a document
 */
export function saveDocument(request: SaveRequest): Promise<SaveResult> {
  const { tab, seq, revision } = request;

  const tabHash = hashTabId(tab);
  return save(request.slug.toLowerCase(), tabHash, seq, (stored) => {
    const current = stored?.updated_at ?? null;
    const log = stored?.save_log ?? [];
    const last = log.at(-1);
    // An older save of the same tab that arrived late
    if (log.some((entry) => entry.tab === tabHash && entry.seq >= seq)) {
      return { status: 'saved', revision: current };
    }

    const basedOnCurrent = revision === current;
    if (request.patch) {
      const patched = basedOnCurrent ? applyPatch(stored, request.patch) : null;
      if (patched) return { content: patched };
    } else if (request.content) {
      // Or on this tab's previous save, whose response it hasn't seen yet
      const basedOnOwnSave = !!stored && last?.tab === tabHash && last.at === stored.updated_at;
      if (basedOnCurrent || basedOnOwnSave) return { content: request.content };
    }
    return {
      status: 'conflict',
      revision: current,
      content: readStoredContent(stored?.content),
    };
  });
}

/**
 * Save from a tab that was loaded on 0.3.0. It knows no revision, so its later saves replace
 * the content as they used to. Its first save, though, can't wipe out an existing document.
 * TEMPORARY: only app/api/legacy-save uses it, and goes with it (see its route.ts).
 */
export function saveFromOldTab(
  slug: string,
  content: DocumentContent,
  claimsNewDocument: boolean,
): Promise<SaveResult> {
  return save(slug.toLowerCase(), 'old-tab', 0, (stored) => {
    const existing = readStoredContent(stored?.content);
    if (!claimsNewDocument || !existing || isContentEmpty(existing)) return { content };

    const local = getBlocks(content);
    const empty = getBlocks(null);
    const { blocks } = mergeBlocks(empty, local, empty, getBlocks(existing));
    return {
      content: {
        root: {
          ...existing.root,
          children: blocks.map((block) => ('keep' in block ? local[block.keep] : block.insert)),
        },
      },
    };
  });
}
