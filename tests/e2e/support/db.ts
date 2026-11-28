import { randomUUID } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

import { ENV } from './env';
import { plainText } from './tree';

type Attribute =
  | { S: string }
  | { N: string }
  | { BOOL: boolean }
  | { B: string }
  | { NULL: true }
  | { L: Attribute[] }
  | { M: Record<string, Attribute> };

export interface Row {
  slug: string;
  version: number;
  content: any;
  read_only: boolean;
  created_at?: string;
  updated_at?: string;
  [extra: string]: unknown;
}

function marshall(value: unknown): Attribute {
  if (value === null || value === undefined) return { NULL: true };
  if (value instanceof Uint8Array) return { B: Buffer.from(value).toString('base64') };
  if (typeof value === 'string') return { S: value };
  if (typeof value === 'number') return { N: String(value) };
  if (typeof value === 'boolean') return { BOOL: value };
  if (Array.isArray(value)) return { L: value.map(marshall) };
  return {
    M: Object.fromEntries(
      Object.entries(value as object)
        .filter(([, child]) => child !== undefined)
        .map(([key, child]) => [key, marshall(child)]),
    ),
  };
}

function unmarshall(value: any): any {
  if ('S' in value) return value.S;
  if ('N' in value) return Number(value.N);
  if ('BOOL' in value) return value.BOOL;
  if ('B' in value) return Buffer.from(value.B, 'base64');
  if ('NULL' in value) return null;
  if ('L' in value) return value.L.map(unmarshall);
  return Object.fromEntries(
    Object.entries(value.M).map(([key, child]) => [key, unmarshall(child)]),
  );
}

async function call(operation: string, body: object): Promise<any> {
  const response = await fetch(ENV.dbURL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-amz-json-1.0',
      'x-amz-target': `DynamoDB_20120810.${operation}`,
      authorization: 'AWS4-HMAC-SHA256 Credential=local/20260101/ap-south-1/dynamodb/aws4_request'
        + ', SignedHeaders=host, Signature=0',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${operation}: ${JSON.stringify(data)}`);
  return data;
}

export function newSlug(): string {
  return `e2e-${randomUUID()}`;
}

/**
 * The row exactly as stored, with every attribute: content_gz (since 0.5.0) is a Buffer.
 */
export async function getStoredItem(slug: string): Promise<Record<string, any> | null> {
  const { Item } = await call('GetItem', {
    TableName: ENV.table,
    ConsistentRead: true,
    Key: { slug: { S: slug }, version: { N: '1' } },
  });
  return Item ? unmarshall({ M: Item }) : null;
}

/**
 * The row, with its content whichever format stored it: content_gz is decoded into `content`, and
 * left out. So rows compare and record the same in both formats. getStoredItem has the raw row.
 */
export async function getRow(slug: string): Promise<Row | null> {
  const item = await getStoredItem(slug);
  if (!item) return null;
  if (!('content_gz' in item)) return item as Row;
  const { content_gz: compressed, ...row } = item;
  return { ...row, content: JSON.parse(gunzipSync(compressed).toString('utf8')) } as Row;
}

/** The gzip of content's JSON, as 0.5.0 stores it in content_gz. */
export function compress(content: unknown): Buffer {
  return gzipSync(JSON.stringify(content));
}

/** All the text stored for a document, '' when there is no row. See plainText. */
export async function storedText(slug: string): Promise<string> {
  return plainText((await getRow(slug))?.content ?? null);
}

/**
 * Writes a row exactly as given: empty strings stay empty strings, nulls stay NULL. Content is
 * stored as 0.3.0 to 0.4.1 stored it (a map), or with `compressed` as 0.5.0 does (content_gz).
 * A Buffer is stored as binary, so `content_gz` can also be given as it is.
 */
export async function putRow(
  row: Partial<Row> & { slug: string },
  { compressed = false }: { compressed?: boolean } = {},
): Promise<void> {
  const full: Record<string, unknown> = {
    version: 1,
    content: null,
    read_only: false,
    created_at: '2025-05-19T10:00:00.000Z',
    updated_at: '2025-05-19T10:00:00.000Z',
    ...row,
  };
  if (compressed && full.content !== null && full.content !== undefined) {
    full.content_gz = compress(full.content);
    delete full.content;
  }
  await call('PutItem', { TableName: ENV.table, Item: (marshall(full) as any).M });
}

/** What the 0.3.0 marshalling stored: every empty string became NULL. */
export function asStoredByV030<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, child) => (child === '' ? null : child)));
}
