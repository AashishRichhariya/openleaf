import { AutoLinkPlugin, createLinkMatcherWithRegExp } from '@lexical/react/LexicalAutoLinkPlugin';
import { ClickableLinkPlugin } from '@lexical/react/LexicalClickableLinkPlugin';
import { LinkPlugin as LexicalLinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import * as React from 'react';

// Auto-detection patterns (stricter, used when identifying URLs in text)
const AUTO_DETECTION_URL_REGEX =
  /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)(?<![-.+():%])/;

const AUTO_DETECTION_EMAIL_REGEX =
  /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/;

// Validation pattern (more permissive, used when checking manually entered URLs)
const URL_VALIDATION_REGEX = /((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=+$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=+$,\w]+@)[A-Za-z0-9.-]+)((?:\/[+~%/.\w-_]*)?\??(?:[-+=&;%@.\w_]*)#?(?:[\w]*))?)/;

// Set of supported URL protocols
const SUPPORTED_URL_PROTOCOLS = new Set([
  'http:',
  'https:',
  'mailto:',
  'sms:',
  'tel:',
]);

// Sanitize URLs to prevent security issues
function sanitizeUrl(url: string): string {
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

// Validate URL function
function validateUrl(url: string): boolean {
  const sanitizedURL = sanitizeUrl(url);
  // Allow "https://" as it could be a user starting to type a URL
  return sanitizedURL === 'https://' || URL_VALIDATION_REGEX.test(sanitizedURL);
}

const MATCHERS = [
  createLinkMatcherWithRegExp(AUTO_DETECTION_URL_REGEX, (text: string) => {
    return text.startsWith('http') ? text : `https://${text}`;
  }),
  createLinkMatcherWithRegExp(AUTO_DETECTION_EMAIL_REGEX, (text: string) => {
    return `mailto:${text}`;
  }),
];

export function LinksPlugin(): React.ReactElement {
  return (
    <>
      <LexicalLinkPlugin
        validateUrl={validateUrl}
        attributes={{
          rel: 'noopener',
          target: '_blank',
        }}
      />
      
      {/* Auto-link detection */}
      <AutoLinkPlugin matchers={MATCHERS} />
      <ClickableLinkPlugin />
    </>
  );
}

export default LinksPlugin;