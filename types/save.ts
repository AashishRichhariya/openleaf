import { DocumentContent, SerializedBlock } from '@/app/utils/storedDocument';

/**
 * One entry of a document's save log, so that a tab can recognize its own saves
 */
export interface SaveLogEntry {
  /** A random id of the tab that saved */
  tab: string;
  /** Increases with each save of that tab */
  seq: number;
  /** The document's updated_at after that save */
  at: string;
}

/**
 * A change to the top-level blocks of a known revision. It keeps saves on page unload
 * below the 64 KB that keepalive requests may carry.
 */
export interface DocumentPatch {
  /** Unchanged blocks at the start */
  start: number;
  /** Unchanged blocks at the end */
  end: number;
  /** Number of blocks in the revision being patched */
  count: number;
  /** The blocks between those */
  blocks: SerializedBlock[];
}

/**
 * The body of a save request
 */
export interface SaveRequest {
  slug: string;
  tab: string;
  seq: number;
  /** updated_at of the revision this edit is based on, or null if there was none */
  revision: string | null;
  content?: DocumentContent;
  patch?: DocumentPatch;
}

/**
 * The outcome of a save
 */
export type SaveResult =
  | { status: 'saved'; revision: string | null }
  | { status: 'conflict'; revision: string | null; content: DocumentContent | null }
  | { status: 'read-only' }
  | { status: 'invalid' }
  | { status: 'too-large' };
