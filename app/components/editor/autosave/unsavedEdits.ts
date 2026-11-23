import { DocumentContent } from '@/app/utils/storedDocument';

/*
 * When a tab closes, its last request may never arrive (offline, or too large for keepalive).
 * So it leaves the edit in localStorage until a save is confirmed, for the next tab that
 * opens the document.
 */

export interface UnsavedEdit {
  tab: string;
  seq: number;
  /** Whether the tab was closed, rather than only hidden */
  left: boolean;
  /** When this was stored */
  storedAt: number;
  /** The revision the edit is based on */
  revision: string | null;
  /** That revision as the editor held it */
  localBase: DocumentContent | null;
  /** That revision as it was stored */
  remoteBase: DocumentContent | null;
  content: DocumentContent;
}

// Older ones are more likely to undo what others did since than to save anything
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const getPrefix = (slug: string) => `openleaf:unsaved:${slug.toLowerCase()}:`;

export function storeUnsavedEdit(slug: string, edit: UnsavedEdit): void {
  try {
    localStorage.setItem(getPrefix(slug) + edit.tab, JSON.stringify(edit));
  } catch {
    // Storage is full or unavailable: the save request is all there is
  }
}

export function clearUnsavedEdit(slug: string, tab: string): void {
  try {
    localStorage.removeItem(getPrefix(slug) + tab);
  } catch {
    // Storage is unavailable, so there was nothing to clear
  }
}

/** The unsaved edits left for this document. Those of closed tabs are taken, so no other tab
 * takes them too */
export function claimUnsavedEdits(slug: string): UnsavedEdit[] {
  try {
    const prefix = getPrefix(slug);
    const claimed: UnsavedEdit[] = [];
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(prefix)) continue;
      const edit = JSON.parse(localStorage.getItem(key) ?? 'null') as UnsavedEdit | null;
      // A hidden tab may still be open and save it itself, so its copy stays where it is
      if (!edit || (!edit.left && Date.now() - edit.storedAt < MAX_AGE)) {
        if (edit) claimed.push(edit);
        continue;
      }
      localStorage.removeItem(key);
      if (Date.now() - edit.storedAt < MAX_AGE) claimed.push(edit);
    }
    return claimed;
  } catch {
    return [];
  }
}
