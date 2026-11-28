import 'server-only';

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { Document } from '@/types';

import { docClient, DOCUMENTS_TABLE_NAME } from './aws-config';
import { generateRandomSlug } from './document-utils';
import { ContentWrite, isStoredContentEmpty } from './stored-content';

/** The document was changed, created or locked since it was read */
export class StaleDocumentError extends Error {}

function rethrow(error: unknown, action: string): never {
  if ((error as Error).name === 'ConditionalCheckFailedException') throw new StaleDocumentError();
  console.error(`Error ${action}:`, error);
  throw error;
}

/**
 * Create a document. Never overwrites one. Its content is written as given, so it comes from
 * writeContent
 */
export async function createDocument(
  document: Omit<Document, 'content' | 'content_gz'> & ContentWrite,
): Promise<void> {
  try {
    await docClient.send(new PutCommand({
      TableName: DOCUMENTS_TABLE_NAME,
      Item: document,
      ConditionExpression: 'attribute_not_exists(slug)',
    }));
  } catch (error) {
    rethrow(error, 'creating document');
  }
}

/**
 * Update a document's content, if it is unlocked and still as it was read. The content is
 * written in one format and the other one removed
 */
export async function updateDocumentContent(
  previous: Document,
  updates: Required<Pick<Document, 'updated_at' | 'save_log'>> & { content: ContentWrite },
): Promise<void> {
  const unchanged = previous.updated_at
    ? '#updatedAt = :previous'
    : '(attribute_not_exists(#updatedAt) OR attribute_type(#updatedAt, :nullType))';
  const compressed = 'content_gz' in updates.content;

  try {
    await docClient.send(new UpdateCommand({
      TableName: DOCUMENTS_TABLE_NAME,
      Key: { slug: previous.slug, version: previous.version },
      UpdateExpression: compressed
        ? 'SET #gz = :content, #updatedAt = :updatedAt, #log = :log REMOVE #content'
        : 'SET #content = :content, #updatedAt = :updatedAt, #log = :log REMOVE #gz',
      ConditionExpression:
        `attribute_exists(slug) AND ${unchanged} AND `
        + '(attribute_not_exists(#readOnly) OR #readOnly <> :locked)',
      ExpressionAttributeNames: {
        '#content': 'content',
        '#gz': 'content_gz',
        '#updatedAt': 'updated_at',
        '#log': 'save_log',
        '#readOnly': 'read_only',
      },
      ExpressionAttributeValues: {
        ':content': 'content_gz' in updates.content ? updates.content.content_gz : null,
        ':updatedAt': updates.updated_at,
        ':log': updates.save_log,
        ':locked': true,
        ...(previous.updated_at ? { ':previous': previous.updated_at } : { ':nullType': 'NULL' }),
      },
    }));
  } catch (error) {
    rethrow(error, 'updating document');
  }
}

/**
 * Get a document by slug
 */
export async function getDocumentBySlug(
  slug: string,
  { consistent = true }: { consistent?: boolean } = {},
): Promise<Document | null> {
  const params = {
    TableName: DOCUMENTS_TABLE_NAME,
    Key: {
      slug,
      version: 1, // Default version
    },
    // A reload right after a save must see that save
    ConsistentRead: consistent,
  };

  try {
    const { Item } = await docClient.send(new GetCommand(params));
    return Item as Document || null;
  } catch (error) {
    console.error('Error fetching document:', error);
    throw error;
  }
}

/**
 * Check if a slug document is empty or doesn't exist
 *
 * @param slug The slug to check
 * @returns true if document doesn't exist or is empty, false otherwise
 */
async function isSlugDocumentEmpty(slug: string): Promise<boolean> {
  try {
    // Picking a random name for a new document needs no consistent read, which costs double
    const document = await getDocumentBySlug(slug, { consistent: false });

    // Return true if document is null or content is empty. Content that can't be read isn't
    return !document || isStoredContentEmpty(document);
  } catch (error) {
    console.error(`Error checking if slug document is empty: ${error}`);
    return true; // Consider non-existent or error as empty
  }
}

/**
 * Find an available (unused) slug
 */
export async function findAvailableSlug(
  maxAttempts: number = 20,
): Promise<string> {
  let attempts = 0;
  let lastSlug = '';

  while (attempts < maxAttempts) {
    const slug = generateRandomSlug();
    lastSlug = slug;

    const isEmpty = await isSlugDocumentEmpty(slug);
    if (isEmpty) {
      return slug;
    }
    attempts++;
  }

  console.warn(`Warning: Could not find empty slug after ${maxAttempts} attempts. Using last generated slug.`);
  return lastSlug;
}
