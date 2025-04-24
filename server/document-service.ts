'use server';


import {
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { Document } from '@/types';

import { docClient, DOCUMENTS_TABLE_NAME } from './aws-config';
import { fetchDocument } from './document-actions';
import { generateRandomSlug, isDocumentContentEmpty } from './document-utils';


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
  const existingDocument = await getDocumentBySlug(slug);
  
  // If document doesn't exist, throw an error
  if (!existingDocument) {
    throw new Error(`Document with slug ${slug} not found`);
  }
   
  // return silently if the document is read-only
  if (existingDocument.read_only === true) {
    return existingDocument;
  }
  
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
      slug,
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
 * Check if a slug document is empty or doesn't exist
 * 
 * @param slug The slug to check
 * @returns true if document doesn't exist or is empty, false otherwise
 */
export async function isSlugDocumentEmpty(slug: string): Promise<boolean> {
  try {
    const document = await fetchDocument(slug);
    
    // Return true if document is null or content is empty
    return !document || await isDocumentContentEmpty(document.content);
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
    const slug = await generateRandomSlug();
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
