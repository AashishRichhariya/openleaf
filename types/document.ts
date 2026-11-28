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
   * The document's content as 0.3.0 to 0.4.1 stored it, or null for an empty document. Read it
   * through server/stored-content.ts, which also reads content_gz
   */
  content?: DocumentContent | null;

  /**
   * The gzip of the content's JSON, as 0.5.0 stores it. When it is there, `content` is absent
   */
  content_gz?: Uint8Array;

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
