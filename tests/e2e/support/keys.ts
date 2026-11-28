/**
 * Editing keys that differ by platform, named by what they do. The baselines are recorded on Linux
 * (Docker); the macOS keys keep native debugging runs meaningful.
 *
 * Playwright's Chromium on macOS maps Home and End to scrolling, as macOS does, so line moves use
 * Cmd+Arrow there.
 */
const MAC = process.platform === 'darwin';

export const KEYS = {
  /** Deletes the word before the caret. */
  deleteWordBackward: MAC ? 'Alt+Backspace' : 'Control+Backspace',
  /** Deletes from the caret to the start of the line. Linux has no key for it: select, then delete. */
  deleteLineBackward: MAC ? ['Meta+Backspace'] : ['Shift+Home', 'Backspace'],
  /** Extends the selection by a word to the left. */
  selectWordBackward: MAC ? 'Alt+Shift+ArrowLeft' : 'Control+Shift+ArrowLeft',
  /** Moves the caret to the start of the line. */
  lineStart: MAC ? 'Meta+ArrowLeft' : 'Home',
  /** Moves the caret to the end of the line. */
  lineEnd: MAC ? 'Meta+ArrowRight' : 'End',
  /** Selects to the start of the line. */
  selectToLineStart: MAC ? 'Meta+Shift+ArrowLeft' : 'Shift+Home',
  /** Selects to the end of the line. */
  selectToLineEnd: MAC ? 'Meta+Shift+ArrowRight' : 'Shift+End',
};
