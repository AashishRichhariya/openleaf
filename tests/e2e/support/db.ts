import { randomUUID } from 'node:crypto';

import { ENV } from './env';

type Attribute =
  | { S: string }
  | { N: string }
  | { BOOL: boolean }
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

export async function getRow(slug: string): Promise<Row | null> {
  const { Item } = await call('GetItem', {
    TableName: ENV.table,
    ConsistentRead: true,
    Key: { slug: { S: slug }, version: { N: '1' } },
  });
  return Item ? unmarshall({ M: Item }) : null;
}

/** Writes a row exactly as given: empty strings stay empty strings, nulls stay NULL. */
export async function putRow(row: Partial<Row> & { slug: string }): Promise<void> {
  const full = {
    version: 1,
    content: null,
    read_only: false,
    created_at: '2025-05-19T10:00:00.000Z',
    updated_at: '2025-05-19T10:00:00.000Z',
    ...row,
  };
  await call('PutItem', { TableName: ENV.table, Item: (marshall(full) as any).M });
}

/** What the 0.3.0 marshalling stored: every empty string became NULL. */
export function asStoredByV030<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, child) => (child === '' ? null : child)));
}
