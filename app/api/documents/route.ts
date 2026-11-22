import { isDocumentContent } from '@/app/utils/storedDocument';
import { isCrossSite, isValidSlug, MAX_BODY_BYTES } from '@/server/request-utils';
import { saveDocument } from '@/server/save-document';
import { DocumentPatch, SaveRequest, SaveResult } from '@/types';

const isCount = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;

function isPatch(value: DocumentPatch | undefined): boolean {
  return !!value
    && [value.start, value.end, value.count].every(isCount)
    && isDocumentContent({ root: { children: value.blocks } });
}

function parseSaveRequest(body: string): SaveRequest | null {
  let data: SaveRequest;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  const valid = isValidSlug(data?.slug)
    && typeof data.tab === 'string'
    && data.tab.length > 0
    && data.tab.length <= 64
    && isCount(data.seq)
    && (data.revision === null || typeof data.revision === 'string')
    && (data.patch === undefined ? isDocumentContent(data.content) : isPatch(data.patch));
  return valid ? data : null;
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

  const body = await request.text();
  let result: SaveResult;
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
    result = { status: 'too-large' };
  } else {
    const save = parseSaveRequest(body);
    result = save ? await saveDocument(save) : { status: 'invalid' };
  }
  // A conflict is an answer the page handles, and browsers log every 4xx as an error
  return Response.json(result, { status: result.status === 'invalid' ? 400 : 200 });
}
