import { DocumentContent } from '@/app/utils/storedDocument';

/*
 * When a tab closes, its last request may never arrive (offline, or too large for keepalive).
 * So it leaves the edit in localStorage until a save is confirmed, for the next tab that
 * opens the document.
 */

export interface UnsavedEdit {
  tab: string;
  seq: number;
  /** The revision the edit is based on */
  revision: string | null;
  /** That revision as the editor held it */
  localBase: DocumentContent | null;
  /** That revision as it was stored */
  remoteBase: DocumentContent | null;
  content: DocumentContent;
}

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

export function readUnsavedEdits(slug: string): UnsavedEdit[] {
  try {
    const prefix = getPrefix(slug);
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(prefix))
      .map((key) => JSON.parse(localStorage.getItem(key)!) as UnsavedEdit);
  } catch {
    return [];
  }
}
