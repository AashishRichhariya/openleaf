import { DocumentContent, isDocumentContent, isWithinLimits } from '@/app/utils/storedDocument';
import { isCrossSite, isValidSlug, readBody } from '@/server/request-utils';
import { saveDocument } from '@/server/save-document';
import { DocumentChanges, DocumentPatch, SaveRequest, SaveResult } from '@/types';

const isCount = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

// The root's own fields are few and plain: direction, format, indent, type, version...
const MAX_ROOT_FIELDS = 16;

function isPatch(value: DocumentPatch | undefined): boolean {
  return !!value
    && [value.start, value.end, value.count].every(isCount)
    && isDocumentContent({ root: { children: value.blocks } });
}

function isRootFields(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isObject(value) || 'children' in value) return false;
  const fields = Object.values(value);
  return fields.length <= MAX_ROOT_FIELDS
    && fields.every((field) => field === null || ['string', 'number', 'boolean'].includes(typeof field));
}

/**
 * Changes whose ranges are in order and apart, each within the revision's blocks and changing
 * something. Checked without building anything, as the request may be crafted.
 */
function isChanges(value: unknown): value is DocumentChanges {
  if (!isObject(value) || !isCount(value.count) || (value.count as number) < 1) return false;
  const { count, ranges } = value as unknown as DocumentChanges;
  // Apart, so at most one more than there are blocks
  if (!Array.isArray(ranges) || ranges.length > count + 1) return false;
  if (!isRootFields(value.root)) return false;
  let kept = -1;
  for (const range of ranges) {
    if (!isObject(range) || !isCount(range.start) || !isCount(range.deleteCount)) return false;
    const { start, deleteCount, blocks } = range as unknown as DocumentChanges['ranges'][number];
    if (start <= kept || start + deleteCount > count || !Array.isArray(blocks)) return false;
    if (!deleteCount && !blocks.length) return false;
    if (!blocks.every((block) => typeof block?.type === 'string')) return false;
    kept = start + deleteCount;
  }
  return true;
}

function parseSaveRequest(body: string): SaveRequest | null {
  let data: SaveRequest;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  let change = false;
  if (data?.changes !== undefined) {
    change = data.content === undefined && data.patch === undefined && isChanges(data.changes);
  } else if (data?.patch !== undefined) {
    change = isPatch(data.patch);
  } else {
    change = isDocumentContent(data?.content);
  }
  const valid = isValidSlug(data?.slug)
    && typeof data.tab === 'string'
    && data.tab.length > 0
    && data.tab.length <= 64
    && isCount(data.seq)
    && (data.revision === null || typeof data.revision === 'string')
    && change;
  return valid ? data : null;
}

/** The blocks a request sends, for the limits. Not flat(): ranges may be crafted */
function sentBlocks(save: SaveRequest): DocumentContent | undefined {
  if (save.changes) {
    const children = [];
    for (const range of save.changes.ranges) for (const block of range.blocks) children.push(block);
    return { root: { type: 'root', children } };
  }
  if (save.patch) return { root: { type: 'root', children: save.patch.blocks } };
  return save.content;
}

/**
 * Saves a document.
 *
 * This is a route handler rather than a server action: its URL survives deploys, and the page
 * can still call it with keepalive while it is being closed.
 */
export async function POST(request: Request): Promise<Response> {
  if (isCrossSite(request)) return new Response(null, { status: 403 });
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return new Response(null, { status: 415 });
  }

  const body = await readBody(request);
  let result: SaveResult;
  if (body === null) {
    result = { status: 'too-large' };
  } else {
    const save = parseSaveRequest(body);
    const content = save && sentBlocks(save);
    if (!save) result = { status: 'invalid' };
    // The tab then sends the whole document, which is refused as too large if it is
    else if (save.changes && !isWithinLimits(content!)) result = { status: 'invalid' };
    else if (content && !isWithinLimits(content)) result = { status: 'too-large' };
    else result = await saveDocument(save);
  }
  // A conflict is an answer the page handles, and browsers log every 4xx as an error
  return Response.json(result, { status: result.status === 'invalid' ? 400 : 200 });
}
