import { debounce } from 'lodash-es';

import { getBlockRanges } from '@/app/utils/blockChanges';
import { mergeBlocks } from '@/app/utils/mergeDocuments';
import {
  DocumentContent,
  getBlocks,
  isContentEmpty,
  SerializedBlock,
  toComparable,
  withoutTransientNodes,
} from '@/app/utils/storedDocument';
import { DocumentChanges, SaveLogEntry, SaveRequest, SaveResult } from '@/types';

import { applyMerge } from './applyMerge';
import { claimUnsavedEdits, clearUnsavedEdit, storeUnsavedEdit, UnsavedEdit } from './unsavedEdits';

import type { EditorState, LexicalEditor } from 'lexical';

const SAVE_DELAY = 2000;
// So that typing without a pause is saved too
const MAX_SAVE_DELAY = 5000;
const FIRST_RETRY_DELAY = 3000;
const MAX_RETRY_DELAY = 30_000;
// Browsers refuse keepalive requests over 64 KB
const MAX_KEEPALIVE_BYTES = 60_000;

export type SaveProblem = 'failed' | 'too-large';

export interface SaveStatus {
  problem: SaveProblem | null;
  /** The document was also edited elsewhere, and both edits were kept */
  conflict: boolean;
}

export interface SavedDocument {
  slug: string;
  content: DocumentContent | null;
  revision: string | null;
  log: SaveLogEntry[];
}

interface Base {
  revision: string | null;
  /** The revision as the editor held it */
  local: DocumentContent | null;
  /** The revision as it was stored */
  remote: DocumentContent | null;
}

/** Empty documents are stored without content */
function toStored(content: DocumentContent | null): DocumentContent | null {
  return isContentEmpty(content) ? null : content;
}

function isSameContent(a: DocumentContent | null, b: DocumentContent | null): boolean {
  return toComparable(toStored(a)?.root.children ?? null)
    === toComparable(toStored(b)?.root.children ?? null);
}

/** Stricter: an emptied heading is an edit, though it is stored like an empty document */
function isUnedited(content: DocumentContent, base: DocumentContent | null): boolean {
  return toComparable(getBlocks(content)) === toComparable(getBlocks(base));
}

/** A code block as its text, however highlighting has split it into tokens */
function withoutHighlighting(node: SerializedBlock): SerializedBlock {
  if (node.type === 'code') {
    const text = (node.children ?? [])
      .map((child) => (child.type === 'linebreak' ? '\n' : String(child.text ?? '')))
      .join('');
    return { ...node, children: undefined, text };
  }
  return node.children ? { ...node, children: node.children.map(withoutHighlighting) } : node;
}

/**
 * Whether content differs from the base at most in how code is highlighted. Highlighting loads
 * after the page, so it can arrive with an update that is not marked as Lexical's own.
 */
function isOnlyHighlighted(content: DocumentContent, base: DocumentContent | null): boolean {
  return toComparable(getBlocks(content).map(withoutHighlighting))
    === toComparable(getBlocks(base).map(withoutHighlighting));
}

/** The hash the server keeps of a tab id, or null where the browser can't compute it */
async function hashTabId(tab: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tab));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

// crypto.randomUUID needs a secure context, which a dev server on the LAN is not
function createTabId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

type Change = Pick<SaveRequest, 'content' | 'changes'>;

/**
 * What changed since the confirmed revision, as ranges of its blocks as stored. Compared with the
 * stored form, so that what the server ends up with is what the whole document would give.
 */
function createChanges(base: Base, content: DocumentContent): DocumentChanges | null {
  const stored = getBlocks(base.remote);
  // Positions must mean the same in the editor and in the database
  if (getBlocks(base.local).length !== stored.length) return null;
  const { children: _children, ...root } = content.root;
  return {
    count: stored.length,
    root: root as DocumentChanges['root'],
    ranges: getBlockRanges(stored, getBlocks(content)),
  };
}

/** The changes if they are smaller than the whole document, else the whole document */
function createChange(base: Base, content: DocumentContent): Change {
  const changes = createChanges(base, content);
  if (!changes) return { content };
  return JSON.stringify(changes).length < JSON.stringify(content).length
    ? { changes }
    : { content };
}

/**
 * Saves the editor's content, one request at a time, without losing edits to a slow network, a
 * closing tab or another tab.
 */
export class DocumentSaver {
  private base: Base;
  private tab = createTabId();
  private seq = 0;
  private saving = false;
  private saveAgain = false;
  // The server asked for the whole document, or refused the changes
  private sendWhole = false;
  // Until the first edit, changes are Lexical normalizing what was loaded
  private edited = false;
  private leaving = false;
  private disposed = false;
  private locked = false;
  private recovered: string[] = [];
  private retryDelay = FIRST_RETRY_DELAY;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private status: SaveStatus = { problem: null, conflict: false };
  private scheduleSave = debounce(() => void this.save(), SAVE_DELAY, { maxWait: MAX_SAVE_DELAY });

  constructor(
    private readonly editor: LexicalEditor,
    private readonly document: SavedDocument,
    private readonly onStatus: (status: SaveStatus) => void,
  ) {
    this.base = {
      revision: document.revision,
      local: document.content,
      remote: document.content,
    };
  }

  /** @returns A function that undoes this */
  start(): () => void {
    this.disposed = false;
    this.base.local = this.read();
    void this.recover();

    const onHidden = () => {
      if (document.visibilityState !== 'hidden' || this.leaving) return;
      // A hidden tab may be closed without warning, mostly on phones
      this.storeDraft(false);
      this.saveNow();
    };
    const onPageHide = () => this.leave();
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      // Back from the back/forward cache, still holding the edit itself
      this.leaving = false;
      clearUnsavedEdit(this.document.slug, this.tab);
      this.saveNow();
    };
    const onOnline = () => this.saveNow();

    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('online', onOnline);
      if (!this.leaving) this.leave();
      this.leaving = false;
      this.disposed = true;
      this.scheduleSave.cancel();
      clearTimeout(this.retryTimer);
    };
  }

  onChange(editorState: EditorState, tags: Set<string>): void {
    if (!this.edited) {
      const content = withoutTransientNodes(editorState.toJSON() as unknown as DocumentContent);
      if (tags.has('history-merge') || isOnlyHighlighted(content, this.base.local)) {
        this.base.local = content;
        return;
      }
    }
    this.edited = true;
    if (!this.locked) this.scheduleSave();
  }

  dismissConflict(): void {
    this.report({ conflict: false });
  }

  private report(update: Partial<SaveStatus>): void {
    const next = { ...this.status, ...update };
    if (next.problem === this.status.problem && next.conflict === this.status.conflict) return;
    this.status = next;
    this.onStatus(next);
  }

  private read(): DocumentContent {
    return withoutTransientNodes(
      this.editor.getEditorState().toJSON() as unknown as DocumentContent,
    );
  }

  /** Content in the form the editor would hold it */
  private normalize(content: DocumentContent | null): DocumentContent | null {
    if (!content) return null;
    const state = this.editor.parseEditorState(JSON.stringify(content));
    return withoutTransientNodes(state.toJSON() as unknown as DocumentContent);
  }

  private saveNow(): void {
    this.scheduleSave.cancel();
    if (this.saving) this.saveAgain = true;
    else void this.save();
  }

  private async save(): Promise<void> {
    if (this.disposed || this.locked) return;
    if (this.saving) {
      this.saveAgain = true;
      return;
    }
    clearTimeout(this.retryTimer);

    const content = this.read();
    if (isUnedited(content, this.base.local)) {
      this.confirmed();
      return;
    }

    this.saving = true;
    this.saveAgain = false;
    const change = this.sendWhole ? { content } : createChange(this.base, content);
    this.sendWhole = false;
    const body = JSON.stringify(this.createRequest(change));
    let result: SaveResult | null = null;
    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        // A tab that went to the background may be killed at any moment
        keepalive: document.visibilityState === 'hidden' && this.fitsKeepalive(body),
      });
      if (response.status === 413) result = { status: 'too-large' };
      else result = (await response.json()) as SaveResult;
    } catch (error) {
      if (!this.leaving) console.warn('Could not save the document:', error);
    }
    this.saving = false;
    // Leaving has sent its own request, and left a copy in storage
    if (this.disposed || this.leaving) return;
    try {
      this.handleResult(result, content, !!change.changes);
    } catch (error) {
      // Such as content from another tab that this editor can't take in
      console.error('Could not handle the save:', error);
      this.report({ problem: 'failed' });
    }
  }

  private handleResult(
    result: SaveResult | null,
    content: DocumentContent,
    sentChanges: boolean,
  ): void {
    // The changes didn't fit the stored revision, or were refused: the whole document, at once
    if (sentChanges && (result?.status === 'resend' || result?.status === 'invalid')) {
      this.sendWhole = true;
      void this.save();
      return;
    }
    switch (result?.status) {
    case 'saved':
      this.base = { revision: result.revision, local: content, remote: toStored(content) };
      this.confirmed();
      if (this.saveAgain) void this.save();
      break;
    case 'conflict':
      this.resolveConflict(result.revision, result.content);
      break;
    case 'read-only':
      // Locked while open: like a document that loads read-only, it can still be edited, quietly
      // and without saving
      this.locked = true;
      this.scheduleSave.cancel();
      break;
    case 'too-large':
      // Retrying can't help, but the next edit may
      this.report({ problem: 'too-large' });
      break;
    case 'invalid':
      // Retrying the same request can't help either
      this.report({ problem: 'failed' });
      break;
    default:
      // Until a save is confirmed, the edit is also kept in the browser, in case the tab never
      // gets to save it: it may crash, or be closed while offline
      this.storeDraft(false, content);
      this.report({ problem: 'failed' });
      this.retryTimer = setTimeout(() => void this.save(), this.retryDelay);
      this.retryDelay = Math.min(this.retryDelay * 2, MAX_RETRY_DELAY);
    }
  }

  private confirmed(): void {
    this.retryDelay = FIRST_RETRY_DELAY;
    for (const tab of [this.tab, ...this.recovered]) clearUnsavedEdit(this.document.slug, tab);
    this.recovered = [];
    this.report({ problem: null });
  }

  private resolveConflict(revision: string | null, remote: DocumentContent | null): void {
    if (this.editor.isComposing()) {
      // Changing nodes would break the IME. Save again, and merge then
      this.retryTimer = setTimeout(() => void this.save(), 1000);
      return;
    }

    const local = this.read();
    // Our own save whose response was lost needs no merge
    if (isSameContent(local, remote)) {
      this.base = { revision, local, remote };
      this.confirmed();
      return;
    }

    const { blocks, conflict } = mergeBlocks(
      getBlocks(this.base.local),
      getBlocks(local),
      getBlocks(this.base.remote),
      getBlocks(remote),
    );
    this.base = { revision, local: this.normalize(remote), remote };
    this.edited = true;
    applyMerge(this.editor, blocks);
    if (conflict) this.report({ conflict: true });
    this.saveNow();
  }

  /** Put back what an earlier tab couldn't save before it closed */
  private async recover(): Promise<void> {
    const { slug, log, revision } = this.document;
    const edits = claimUnsavedEdits(slug);
    if (!edits.length) return;
    const hashes = await Promise.all(edits.map((edit) => hashTabId(edit.tab)));
    if (this.disposed) return;

    edits.forEach((edit, index) => {
      const hash = hashes[index];
      const alreadySaved = !!hash
        && log.some((entry) => entry.tab === hash && entry.seq >= edit.seq);
      const local = this.read();
      if (alreadySaved || isSameContent(edit.content, local)) return;
      const last = log.at(-1);
      const onlyOurs = edit.revision === revision
        || (!!hash && last?.tab === hash && last.at === revision);
      this.applyUnsavedEdit(edit, local, onlyOurs);
    });
    if (this.recovered.length) this.saveNow();
  }

  private applyUnsavedEdit(edit: UnsavedEdit, local: DocumentContent, onlyOurs: boolean): void {
    const isFirst = !this.recovered.length;

    let blocks;
    // Only the edit of a closed tab, which no other tab can have taken
    if (isFirst && onlyOurs && edit.left && !this.edited) {
      // Nobody else edited since. Continue as that tab, so its late request can't conflict
      const loaded = getBlocks(local);
      ({ blocks } = mergeBlocks(loaded, loaded, loaded, getBlocks(edit.content)));
      this.tab = edit.tab;
      this.seq = edit.seq;
    } else {
      const merged = mergeBlocks(
        getBlocks(edit.remoteBase),
        getBlocks(local),
        getBlocks(edit.localBase),
        getBlocks(edit.content),
      );
      blocks = merged.blocks;
      if (merged.conflict) this.report({ conflict: true });
    }
    this.recovered.push(edit.tab);
    this.edited = true;
    applyMerge(this.editor, blocks);
  }

  private createRequest(change: Change): SaveRequest {
    this.seq += 1;
    return {
      slug: this.document.slug,
      tab: this.tab,
      seq: this.seq,
      revision: this.base.revision,
      ...change,
    };
  }

  private fitsKeepalive(body: string): boolean {
    return new Blob([body]).size <= MAX_KEEPALIVE_BYTES;
  }

  private storeDraft(left: boolean, content = this.read()): void {
    if (!left && !this.saving && isUnedited(content, this.base.local)) return;
    storeUnsavedEdit(this.document.slug, {
      tab: this.tab,
      seq: this.seq,
      left,
      storedAt: Date.now(),
      revision: this.base.revision,
      localBase: this.base.local,
      remoteBase: this.base.remote,
      content,
    });
  }

  private leave(): void {
    this.leaving = true;
    this.scheduleSave.cancel();
    if (this.locked) return;

    const content = this.read();
    if (!this.saving && isUnedited(content, this.base.local)) return;

    // A save still on its way may change the revision before this arrives, and then only the whole
    // document can be taken (as this tab's own save). Otherwise the smaller of the two
    const change = this.saving ? { content } : createChange(this.base, content);
    const request = this.createRequest(change);
    let body = JSON.stringify(request);
    if (this.saving && !this.fitsKeepalive(body)) {
      // Browsers refuse keepalive requests over 64 KB
      const changes = createChanges(this.base, content);
      if (changes) body = JSON.stringify({ ...request, content: undefined, changes });
    }

    this.storeDraft(true, content);
    // The page is going away, so nothing can wait for the response
    fetch('/api/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: this.fitsKeepalive(body),
    }).catch(() => undefined);
  }
}
