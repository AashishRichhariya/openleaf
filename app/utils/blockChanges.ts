import { SerializedBlock, toComparable } from './storedDocument';

/*
 * The changes between two versions of a document, as ranges of top-level blocks, so that a save
 * sends only what changed. Shared by client and server, so no Lexical or server-only imports.
 */

/** Replaces `deleteCount` blocks from `start` of a version with `blocks` */
export interface BlockRange {
  start: number;
  deleteCount: number;
  blocks: SerializedBlock[];
}

// A save that changes more blocks than this sends the stretch around them as one range
const MAX_EDITS = 1000;

type Hunk = [baseStart: number, baseEnd: number, nextStart: number, nextEnd: number];

/**
 * The hunks of a shortest edit script from a to b (Myers' O(ND) diff), or null if it takes
 * more than maxEdits insertions and deletions. Its cost grows with the size of the edit, not of
 * the document, so two edits far apart in a long document are found as two.
 */
function diff(a: string[], b: string[], maxEdits: number): Hunk[] | null {
  const n = a.length;
  const m = b.length;
  const limit = Math.min(maxEdits, n + m);
  const offset = limit + 1;
  const v = new Int32Array(2 * limit + 3);
  // v as it was before each step, for walking the path back
  const trace: Int32Array[] = [];
  let found = -1;
  for (let d = 0; d <= limit && found < 0; d += 1) {
    trace.push(v.slice(offset - d - 1, offset + d + 2));
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])
        ? v[offset + k + 1]
        : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
  }
  if (found < 0) return null;

  // Back from the end: each step is one insertion or deletion after a run of equal blocks
  const edits: Array<[x: number, y: number, deleted: boolean]> = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d -= 1) {
    const before = trace[d];
    const at = (k: number) => before[k + d + 1];
    const k = x - y;
    const previous = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const previousX = at(previous);
    const previousY = previousX - previous;
    edits.push([previousX, previousY, previous === k - 1]);
    x = previousX;
    y = previousY;
  }

  const hunks: Hunk[] = [];
  for (let index = edits.length - 1; index >= 0; index -= 1) {
    const [editX, editY, deleted] = edits[index];
    const last = hunks.at(-1);
    const hunk: Hunk = last && last[1] === editX && last[3] === editY
      ? last
      : [editX, editX, editY, editY];
    if (hunk !== last) hunks.push(hunk);
    if (deleted) hunk[1] += 1;
    else hunk[3] += 1;
  }
  return hunks;
}

/**
 * Replaces the ranges, which must be ascending and apart, in blocks. Null if they don't fit.
 */
export function applyRanges<T>(
  blocks: T[],
  ranges: Array<{ start: number; deleteCount: number; blocks: T[] }>,
): T[] | null {
  const result: T[] = [];
  let kept = 0;
  for (const range of ranges) {
    if (range.start < kept || range.start + range.deleteCount > blocks.length) return null;
    // Not push(...): too many arguments overflow the stack
    for (let index = kept; index < range.start; index += 1) result.push(blocks[index]);
    for (const block of range.blocks) result.push(block);
    kept = range.start + range.deleteCount;
  }
  for (let index = kept; index < blocks.length; index += 1) result.push(blocks[index]);
  return result;
}

/**
 * The ranges that turn base into next, ascending and apart. Blocks equal by toComparable are
 * left as they are in base.
 */
export function getBlockRanges(base: SerializedBlock[], next: SerializedBlock[]): BlockRange[] {
  const from = base.map(toComparable);
  const to = next.map(toComparable);
  let head = 0;
  while (head < from.length && head < to.length && from[head] === to[head]) head += 1;
  let tail = 0;
  while (
    tail < from.length - head
    && tail < to.length - head
    && from[from.length - 1 - tail] === to[to.length - 1 - tail]
  ) {
    tail += 1;
  }
  const baseEnd = from.length - tail;
  const nextEnd = to.length - tail;
  if (head === baseEnd && head === nextEnd) return [];

  const whole: BlockRange[] = [
    { start: head, deleteCount: baseEnd - head, blocks: next.slice(head, nextEnd) },
  ];
  const hunks = diff(from.slice(head, baseEnd), to.slice(head, nextEnd), MAX_EDITS);
  if (!hunks) return whole;
  const ranges = hunks.map(([baseStart, hunkBaseEnd, nextStart, hunkNextEnd]) => ({
    start: head + baseStart,
    deleteCount: hunkBaseEnd - baseStart,
    blocks: next.slice(head + nextStart, head + hunkNextEnd),
  }));
  // Checked, as a wrong change would be stored: the ranges must rebuild next exactly
  const keys = new Map<SerializedBlock, string>();
  next.forEach((block, index) => keys.set(block, to[index]));
  const rebuilt = applyRanges(
    from,
    ranges.map((range) => ({ ...range, blocks: range.blocks.map((block) => keys.get(block)!) })),
  );
  const same = !!rebuilt
    && rebuilt.length === to.length
    && rebuilt.every((key, index) => key === to[index]);
  return same ? ranges : whole;
}
