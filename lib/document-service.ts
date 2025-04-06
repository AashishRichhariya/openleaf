'use server';


import { Document } from '@/types';
import {
  GetCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";
import { docClient, DOCUMENTS_TABLE_NAME } from "./aws-config";


/**
 * Create or update a document in DynamoDB
 */
export async function createOrUpdateDocument(document: Document): Promise<Document> {
  const now = new Date().toISOString();

  // Set timestamps
  if (!document.created_at) {
    document.created_at = now;
  }
  document.updated_at = now;

  // Set default version if not provided
  if (!document.version) {
    document.version = 1;
  }

  const params = {
    TableName: DOCUMENTS_TABLE_NAME,
    Item: document,
  };

  try {
    await docClient.send(new PutCommand(params));
    return document;
  } catch (error) {
    console.error("Error creating/updating document:", error);
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
    console.error("Error fetching document:", error);
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
    console.error("Error checking slug existence:", error);
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
export async function findAvailableSlug(length: number = 8, maxAttempts: number = 5): Promise<string> {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const slug = generateRandomSlug(length);
    const exists = await slugExists(slug);
    if (!exists) {
      return slug;
    }
    attempts++;
  }
  throw new Error("Failed to find an available slug after multiple attempts");
}
