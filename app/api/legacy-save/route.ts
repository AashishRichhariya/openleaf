import { isDocumentContent } from '@/app/utils/storedDocument';
import { decodeActionArgs } from '@/server/decode-action-args';
import { isCrossSite, isValidSlug, MAX_BODY_BYTES } from '@/server/request-utils';
import { saveFromOldTab } from '@/server/save-document';

/**
 * Keeps tabs that were opened on 0.3.0 saving.
 *
 * Those tabs call a server action whose id changes with every build, so next.config.ts sends
 * their requests here. The arguments are (slug, content, readOnly, isNewDocument). readOnly is
 * ignored, and a 204 makes the old client treat the save as done. This can be removed once no
 * such tab can still be open.
 */
export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get('next-action') || isCrossSite(request)) {
    return new Response(null, { status: 403 });
  }

  const body = await request.text();
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  const [slug, content, , isNewDocument] = decodeActionArgs(body) ?? [];
  if (!isValidSlug(slug) || !isDocumentContent(content)) {
    return new Response(null, { status: 400 });
  }

  const result = await saveFromOldTab(slug, content, isNewDocument !== false);
  // A locked document ignored saves silently
  const saved = result.status === 'saved' || result.status === 'read-only';
  return new Response(null, { status: saved ? 204 : 413 });
}
