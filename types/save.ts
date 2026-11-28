import { BlockRange } from '@/app/utils/blockChanges';
import { DocumentContent, SerializedBlock } from '@/app/utils/storedDocument';

/**
 * One entry of a document's save log, so that a tab can recognize its own saves
 */
export interface SaveLogEntry {
  /** A hash of the random id of the tab that saved */
  tab: string;
  /** Increases with each save of that tab */
  seq: number;
  /** The document's updated_at after that save */
  at: string;
}

/**
 * A change to the top-level blocks of a known revision, as 0.4.x tabs send it when they close
 * with a document over 64 KB. Still accepted from tabs opened before 0.5.0.
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
 * The changes to the top-level blocks of a known revision, as 0.5.0 sends them on every save
 */
export interface DocumentChanges {
  /** Number of blocks in the revision being changed */
  count: number;
  /** The root's own fields, without its children */
  root?: Record<string, string | number | boolean | null>;
  /** Positions in that revision, ascending and apart */
  ranges: BlockRange[];
}

/**
 * The body of a save request: one of content (the whole document), changes (since 0.5.0) or patch
 * (0.4.x tabs, on closing)
 */
export interface SaveRequest {
  slug: string;
  tab: string;
  seq: number;
  /** updated_at of the revision this edit is based on, or null if there was none */
  revision: string | null;
  content?: DocumentContent;
  changes?: DocumentChanges;
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
  | { status: 'too-large' }
  /** Changes made on the stored revision that don't fit it: the whole document is needed */
  | { status: 'resend' };
