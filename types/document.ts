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
  content: object | null ;

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
   * Document version number
   */
  version: number;
}
