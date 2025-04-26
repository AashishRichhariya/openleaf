/**
 * URL handling utilities for consistent link behavior
 * across the application.
 */

import { AUTO_DETECTION_EMAIL_REGEX, PHONE_NUMBER_REGEX, URL_VALIDATION_REGEX } from '@/app/utils';

// Set of supported URL protocols
export const SUPPORTED_URL_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
  'sms:',
  'tel:',
]);

/**
 * Sanitizes a URL to prevent security issues
 * 
 * @param url - URL to sanitize
 * @returns Sanitized URL or 'about:blank' if unsupported protocol
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    if (!SUPPORTED_URL_PROTOCOLS.has(parsedUrl.protocol)) {
      return 'about:blank';
    }
  } catch {
    return url;
  }
  return url;
}

/**
 * Validates a URL string
 * 
 * @param url - URL to validate
 * @returns Boolean indicating if URL is valid
 */
export function validateUrl(url: string): boolean {
  const sanitizedURL = sanitizeUrl(url);
  
  // Check if URL starts with a supported protocol prefix for user starting to type a URL
  const isStartingWithProtocol = Array.from(SUPPORTED_URL_PROTOCOLS)
    .some(protocol => {
      // For http and https, check with the double slashes
      if (protocol === 'http:' || protocol === 'https:') {
        return sanitizedURL.startsWith(`${protocol}//`);
      }
      // For other protocols like mailto: and tel:, check without slashes
      return sanitizedURL.startsWith(protocol);
    });
    
  // Use a more permissive check when user is typing
  return isStartingWithProtocol || URL_VALIDATION_REGEX.test(sanitizedURL);
}

/**
 * Formats a URL string by adding appropriate protocol if missing
 * 
 * @param url - URL to format
 * @returns Formatted URL with appropriate protocol
 */
export function formatUrl(url: string): string {
  // Check if URL already has a protocol
  if (url.match(/^[a-z]+:/i)) {
    // URL already has a protocol, leave it as is
    return url;
  }
  // Check if it's a relative path
  else if (url.startsWith('/')) {
    // Relative path, leave it as is
    return url;
  }
  // Check for email address
  else if (AUTO_DETECTION_EMAIL_REGEX.test(url)) {
    return `mailto:${url}`;
  }
  // Check for phone number
  else if (PHONE_NUMBER_REGEX.test(url)) {
    return `tel:${url}`;
  }
  // For everything else, including standard URLs, add https:// prefix
  return `https://${url}`;

}