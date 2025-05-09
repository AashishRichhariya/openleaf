'use server';

import { revalidatePath } from 'next/cache';

import { Document } from '@/types';

import {
  createDocument,
  findAvailableSlug,
  getDocumentBySlug,
  slugExists,
  updateDocument,
} from './document-service';

import { isDocumentContentEmpty } from './document-utils';

/**
 * Save a document - creates a new one or updates an existing one
 */
export async function saveDocument(
  slug: string, 
  content: object, 
  readOnly: boolean = false, 
  isNewDocument: boolean = true,
): Promise<Document> {
  const processedContent = await isDocumentContentEmpty(content) ? null : content;
  const now = new Date().toISOString();
  const normalisedSlug = slug.toLowerCase();

  let savedDoc = null;
  if (isNewDocument) {
    const document: Document = {
      slug: normalisedSlug,
      content: processedContent,
      read_only: readOnly,
      version: 1, // Default version
      created_at: now,
      updated_at: now,
    };
    savedDoc = await createDocument(document);
  } else {
    const updates: Partial<Document> = {
      content: processedContent,
      read_only: readOnly,
      updated_at: now,
    };
    savedDoc = await updateDocument(normalisedSlug, updates, 1);
  }

  // Revalidate the page to update cached data
  revalidatePath(`/${normalisedSlug}`);

  return savedDoc;
}

/**
 * Fetch a document by its slug
 */
export async function fetchDocument(slug: string): Promise<Document | null> {
  return await getDocumentBySlug(slug.toLowerCase());
}

/**
 * Check if a slug exists and is already in use
 */
export async function checkSlugExists(slug: string): Promise<boolean> {
  return await slugExists(slug.toLowerCase());
}

/**
 * Create a new document with a random slug and redirect to it
 */
export async function getRandomAvailableSlug(): Promise<string> {
  return await findAvailableSlug();
}

