'use server';

import { Config, adjectives, animals, colors, uniqueNamesGenerator } from 'unique-names-generator';

/**
 * Checks if a Lexical editor state is empty (contains no meaningful content)
 * 
 * @param content The editor state to check
 * @returns true if the content is empty or null, false otherwise
 */
export async function isDocumentContentEmpty(content: object | null | undefined): Promise<boolean> {
  if (!content) return true;
  
  try {
    const rootChildren = (content as any)?.root?.children || [];
    
    if (rootChildren.length === 0) {
      return true;
    }
    
    function hasContent(node: any): boolean {
      // Check for text nodes with content
      if (node?.type === 'text') {
        return node.text && node.text.trim().length > 0;
      }
      
      // Check children recursively for element nodes
      if (node?.children && Array.isArray(node.children)) {
        return node.children.some(hasContent);
      }
      
      // Any node with a type (non-text) counts as content
      return Boolean(node?.type);
    }
    
    return !rootChildren.some(hasContent);
    
  } catch (e) {
    console.error('Error checking editor content:', e);
    return true;
  }
}

/**
 * Sanitize a string to be URL-friendly
 * Forces lowercase and removes anything that isn't a letter or hyphen
 */
export async function sanitizeSlug(input: string): Promise<string> {
  // Convert to lowercase first
  const lowercased = input.toLowerCase();
  
  // Replace any character that isn't a lowercase letter or hyphen
  return lowercased.replace(/[^a-z\-]/g, '');
}

/**
 * Generate a random slug
 */
export async function generateRandomSlug(): Promise<string> {
  const customConfig: Config = {
    dictionaries: [adjectives, colors, animals],
    separator: '-',
  };
  return sanitizeSlug(uniqueNamesGenerator(customConfig));
}
