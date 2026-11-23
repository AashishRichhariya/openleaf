import 'server-only';

import { Config, adjectives, animals, colors, uniqueNamesGenerator } from 'unique-names-generator';

/**
 * Sanitize a string to be URL-friendly
 * Forces lowercase and removes anything that isn't a letter or hyphen
 */
export function sanitizeSlug(input: string): string {
  // Convert to lowercase first
  const lowercased = input.toLowerCase();

  // Replace any character that isn't a lowercase letter or hyphen
  return lowercased.replace(/[^a-z\-]/g, '');
}

/**
 * Generate a random slug
 */
export function generateRandomSlug(): string {
  const customConfig: Config = {
    dictionaries: [adjectives, colors, animals],
    separator: '-',
  };
  return sanitizeSlug(uniqueNamesGenerator(customConfig));
}
