import type { KatexOptions } from 'katex';

type Katex = typeof import('katex').default;

/*
 * KaTeX is the largest part of the editor's code and only equations need it, so it loads after the
 * page is ready instead of before. A document with equations starts loading it at once.
 */

let katex: Katex | null = null;
let loading: Promise<Katex> | null = null;

export const KATEX_OPTIONS: KatexOptions = {
  errorColor: '#cc0000',
  output: 'html',
  strict: 'warn',
  throwOnError: false,
  trust: false,
};

export function loadKatex(): Promise<Katex> {
  loading ??= import('katex').then((module) => (katex = module.default));
  return loading;
}

/** KaTeX if it has loaded, else null */
export function getKatex(): Katex | null {
  return katex;
}
