'use server';

import { Document } from '@/types';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createOrUpdateDocument,
  findAvailableSlug,
  getDocumentBySlug,
  slugExists
} from '../lib/document-service';



/**
 * Save a document - creates a new one or updates an existing one
 */
export async function saveDocument(slug: string, content: string, readOnly: boolean = false): Promise<Document> {
  const document: Document = {
    slug,
    content,
    read_only: readOnly,
    version: 1, // Default version
    updated_at: new Date().toISOString()
  };

  // Check if document already exists
  const existingDoc = await getDocumentBySlug(slug);
  if (existingDoc) {
    // Preserve creation date if document exists
    document.created_at = existingDoc.created_at;
  } else {
    document.created_at = document.updated_at;
  }

  const savedDoc = await createOrUpdateDocument(document);

  // Revalidate the page to update cached data
  revalidatePath(`/${slug}`);

  return savedDoc;
}

/**
 * Fetch a document by its slug
 */
export async function fetchDocument(slug: string): Promise<Document | null> {
  return await getDocumentBySlug(slug);
}

/**
 * Check if a slug exists and is already in use
 */
export async function checkSlugExists(slug: string): Promise<boolean> {
  return await slugExists(slug);
}

/**
 * Create a new document with a random slug and redirect to it
 */
export async function createRandomDocument() {
  const newSlug = await findAvailableSlug();

  // Create an empty document
  await saveDocument(newSlug, {}, false);

  // Redirect to the new document
  redirect(`/${newSlug}`);
}
