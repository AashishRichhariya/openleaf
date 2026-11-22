import 'server-only';

// Server actions refused larger bodies as well
export const MAX_BODY_BYTES = 2 * 1024 * 1024;
// DynamoDB's limit for a partition key
const MAX_SLUG_BYTES = 2048;

/**
 * Whether a request comes from another site, as server actions check
 */
export function isCrossSite(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return true;
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  return !URL.canParse(origin) || new URL(origin).host !== host;
}

/**
 * Whether a value can be used as a document's slug
 */
export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && Buffer.byteLength(value) <= MAX_SLUG_BYTES;
}
