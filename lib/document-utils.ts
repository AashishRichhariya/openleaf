'use server';

/**
 * Checks if a Lexical editor state is empty (contains no meaningful content)
 * 
 * @param content The editor state to check
 * @returns true if the content is empty or null, false otherwise
 */
export async function isDocumentContentEmpty(content: object | null | undefined): Promise<boolean> {
  if (!content) {
    return true;
  }
  
  try {
    // Check if there's a root with children
    const rootChildren = (content as any)?.root?.children || [];
    
    if (rootChildren.length === 0) {
      return true;
    }
    
    // Check ALL paragraphs for content
    const hasContent = rootChildren.some((block: any) => {
      // Get children of the block
      const blockChildren = block?.children || [];
      
      // Skip empty blocks
      if (blockChildren.length === 0) {
        return false; // This block is empty, keep looking
      }
      
      // Check if any child has actual text content
      return blockChildren.some((child: any) => {
        return child?.text && child.text.trim().length > 0;
      });
    });
    
    // If no blocks have content, it's empty
    return !hasContent;
    
  } catch (e) {
    console.error('Error checking editor content:', e);
    return true; // Default to true if parsing fails
  }
}

/**
 * Generate a random slug of specified length
 */
export async function generateRandomSlug(length: number = 12): Promise<string> {
  const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}