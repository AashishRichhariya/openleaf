/**
 * Runs `callback` once the browser has nothing more urgent to do, such as showing the document.
 * @returns A function that cancels it, if it has not run yet
 */
export function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    // Waits no longer than this when the page stays busy
    const id = window.requestIdleCallback(callback, { timeout: 1000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 1);
  return () => window.clearTimeout(id);
}
