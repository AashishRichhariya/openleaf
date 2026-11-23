/**
 * Scenarios where 0.4.0 does not do what 0.3.0 recorded, and the owner accepted that (2026-11-23:
 * "a Lexical upgrade that fixes a known bug with bad UX should be kept"). Each is compared with a
 * recording of 0.4.0 instead, kept in expected/accepted/<browser>/, so that any further change
 * still fails. Each fix also has a test of its own in bugs/upgrade-fixes.spec.ts.
 *
 * Record them, on the branch only, with E2E_RECORD_ACCEPTED=1 and a --grep for these names.
 */
export interface Accepted {
  browsers: string[];
  why: string;
}

const ALL = ['chromium', 'firefox', 'webkit'];

const U1 = 'U1: clicking away from an equation being edited kept neither the edit nor the caret';
const U2 = 'U2: after pasting several blocks, the caret stayed in an earlier block';
const U3 = 'U3: ArrowDown on the last line of code showed the caret below, but typing stayed in the code';
const U4 = 'U4: in Firefox, Enter that closes an equation also added a line break after it';
const U5 = 'U5: not a change: Chrome draws "xquoted", typed into a heading, 2px wider than when it is '
  + 'loaded. 0.3.0 happened to redraw it, 0.4.0 does not; loaded, both are identical';

export const ACCEPTED: Record<string, Accepted> = {
  'equation inline: clicking away saves': { browsers: ['chromium'], why: U1 },
  'equation block: clicking away saves': { browsers: ['chromium'], why: U1 },
  'copy, then paste as HTML only': { browsers: ALL, why: U2 },
  'code: arrows leave at the bottom': { browsers: ALL, why: U3 },
  'code: ArrowDown at the last line': { browsers: ALL, why: U3 },
  'equation inline: created with Enter': { browsers: ['firefox'], why: U4 },
  'equation block: created with Enter': { browsers: ['firefox'], why: U4 },
  'equation inline: left empty': { browsers: ['firefox'], why: U4 },
  'equation block: left empty': { browsers: ['firefox'], why: U4 },
  'equation inline: arrows move inside the input': { browsers: ['firefox'], why: U4 },
  'equation block: arrows move inside the input': { browsers: ['firefox'], why: U4 },
  'equation inline: Enter edits, Enter saves': { browsers: ['firefox'], why: U4 },
  'equation block: Enter edits, Enter saves': { browsers: ['firefox'], why: U4 },
  'markdown: heading inside a quote': { browsers: ['chromium'], why: U5 },
};

export function isAccepted(name: string, browser: string): boolean {
  return ACCEPTED[name]?.browsers.includes(browser) ?? false;
}
