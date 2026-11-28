import { isDocumentContent, isWithinLimits } from '@/app/utils/storedDocument';
import { decodeActionArgs } from '@/server/decode-action-args';
import { isCrossSite, isValidSlug, readBody } from '@/server/request-utils';
import { saveFromOldTab } from '@/server/save-document';

/**
 * Keeps tabs that were opened on 0.3.0 saving. TEMPORARY: remove it once no such tab is left.
 *
 * Those tabs still run 0.3.0's code, which saves through a server action whose id changes with
 * every build, so next.config.ts sends their requests here. Without this, their saves would fail
 * without telling the user, and what they type after the deploy would be lost. The arguments are
 * (slug, content, readOnly, isNewDocument). readOnly is ignored, a locked document is never
 * changed, and a 204 makes the old client treat the save as done.
 *
 * TODO(remove after deploying 0.4.0): once the logs show no request to /api/legacy-save for a week
 * or so (a few weeks after the deploy is plenty), delete:
 *   - this folder, app/api/legacy-save/
 *   - server/decode-action-args.ts
 *   - saveFromOldTab in server/save-document.ts
 *   - the beforeFiles rewrite in next.config.ts
 *   - isOverMapLimit and its helpers in server/stored-content.ts (0.3.0 tabs keep the old limits)
 * Keep the tests that send old-tab requests (legacySave in tests/e2e/support/requests.ts): they
 * prove such requests can't change documents, which must stay true once they are simply refused.
 */
export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get('next-action') || isCrossSite(request)) {
    return new Response(null, { status: 403 });
  }

  const body = await readBody(request);
  if (body === null) return new Response(null, { status: 413 });

  const [slug, content, , isNewDocument] = decodeActionArgs(body) ?? [];
  if (!isValidSlug(slug) || !isDocumentContent(content)) {
    return new Response(null, { status: 400 });
  }
  if (!isWithinLimits(content)) return new Response(null, { status: 413 });

  const result = await saveFromOldTab(slug, content, isNewDocument !== false);
  // A locked document ignored saves silently
  const saved = result.status === 'saved' || result.status === 'read-only';
  return new Response(null, { status: saved ? 204 : 413 });
}
