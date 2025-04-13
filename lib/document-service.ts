'use server';


import {
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { Document } from '@/types';

import { docClient, DOCUMENTS_TABLE_NAME } from './aws-config';


/**
 * Create or update a document in DynamoDB
 */
export async function createDocument(document: Document): Promise<Document> {
  const params = {
    TableName: DOCUMENTS_TABLE_NAME,
    Item: document,
  };

  try {
    await docClient.send(new PutCommand(params));
    return document;
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
}

/**
 * Update specific fields of a document in DynamoDB
 */
export async function updateDocument(
  slug: string,
  updates: Partial<Document>,
  version: number = 1,
): Promise<Document> {
  // Build the update expression and attribute values
  let updateExpression = 'SET ';
  const expressionAttributeValues: { [key: string]: any } = {};
  const expressionAttributeNames: { [key: string]: string } = {};

  Object.keys(updates).forEach((key, index) => {
    const valueKey = `:val${index}`;
    const nameKey = `#attr${index}`;

    updateExpression += index === 0 ? '' : ', ';
    updateExpression += `${nameKey} = ${valueKey}`;

    expressionAttributeValues[valueKey] = (updates as Record<string, any>)[key];
    expressionAttributeNames[nameKey] = key;
  });

  const params = {
    TableName: DOCUMENTS_TABLE_NAME,
    Key: {
      slug,
      version,
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
    ReturnValues: 'ALL_NEW' as const,
  };

  try {
    const response = await docClient.send(new UpdateCommand(params));
    return response.Attributes as Document;
  } catch (error) {
    console.error('Error updating document fields:', error);
    throw error;
  }
}

/**
 * Get a document by slug
 */
export async function getDocumentBySlug(slug: string): Promise<Document | null> {
  const params = {
    TableName: DOCUMENTS_TABLE_NAME,
    Key: {
      slug: slug,
      version: 1, // Default version
    },
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
 * Check if a slug exists
 */
export async function slugExists(slug: string): Promise<boolean> {
  try {
    const document = await getDocumentBySlug(slug);
    return !!document;
  } catch (error) {
    console.error('Error checking slug existence:', error);
    throw error;
  }
}

/**
 * Generate a random slug of specified length
 */
export async function generateRandomSlug(length: number = 8): Promise<string> {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Find an available (unused) slug
 */
export async function findAvailableSlug(
  length: number = 8, 
  maxAttempts: number = 5,
): Promise<string> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const slug = generateRandomSlug(length);
    const exists = await slugExists(slug);
    if (!exists) {
      return slug;
    }
    attempts++;
  }
  throw new Error('Failed to find an available slug after multiple attempts');
}
