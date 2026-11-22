import { DocumentContent } from '@/app/utils/storedDocument';

import { SaveLogEntry } from './save';

/**
 * Represents a document stored in DynamoDB
 */
export interface Document {
  /**
   * Unique identifier for the document (URL slug)
   */
  slug: string;

  /**
   * The document's content
   */
  content: DocumentContent | null;

  /**
   * Whether the document is read-only
   */
  read_only: boolean;

  /**
   * ISO string of when the document was created
   */
  created_at?: string;

  /**
   * ISO string of when the document was last updated
   */
  updated_at?: string;

  /**
   * The latest saves, so that a tab can recognize its own
   */
  save_log?: SaveLogEntry[];

  /**
   * Document version number
   */
  version: number;
}
