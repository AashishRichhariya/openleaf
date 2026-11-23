import { SerializedBlock, toComparable } from './storedDocument';

/*
 * A three-way merge of top-level blocks, for two tabs editing one document. Edits to different
 * blocks are combined. Edits to the same block are both kept, so nothing is lost.
 */

/** A block that is already in the editor, or one that has to be inserted. */
export type MergedBlock = { keep: number } | { insert: SerializedBlock };

export interface MergeResult {
  blocks: MergedBlock[];
  /** Both sides changed the same block. */
  conflict: boolean;
}

interface Change {
  /** Blocks added before base block i. The last entry is the end of the document. */
  inserted: number[][];
  /** What became of base block i: null is unchanged, an empty list is deleted. */
  replaced: Array<number[] | null>;
}

// Beyond this the changed stretch is treated as one edit instead of being diffed.
const MAX_DIFF_CELLS = 4_000_000;

function getChange(base: string[], next: string[]): Change {
  const change: Change = {
    inserted: Array.from({ length: base.length + 1 }, () => []),
    replaced: base.map(() => null),
  };

  let head = 0;
  while (head < base.length && head < next.length && base[head] === next[head]) head += 1;
  let baseEnd = base.length;
  let nextEnd = next.length;
  while (baseEnd > head && nextEnd > head && base[baseEnd - 1] === next[nextEnd - 1]) {
    baseEnd -= 1;
    nextEnd -= 1;
  }

  const addHunk = (from: number, to: number, start: number, end: number) => {
    const added = Array.from({ length: end - start }, (_, offset) => start + offset);
    if (from === to) {
      // Not push(...added): too many arguments overflow the stack
      for (const block of added) change.inserted[from].push(block);
      return;
    }
    // Pair edited blocks by position if none were added or removed, else replace the stretch.
    for (let index = from; index < to; index += 1) {
      if (to - from === added.length) change.replaced[index] = [added[index - from]];
      else change.replaced[index] = index === from ? added : [];
    }
  };

  const rows = baseEnd - head;
  const columns = nextEnd - head;
  if (!rows || !columns || rows * columns > MAX_DIFF_CELLS) {
    if (rows || columns) addHunk(head, baseEnd, head, nextEnd);
    return change;
  }

  // Longest common subsequence, from the end.
  const width = columns + 1;
  const common = new Uint16Array((rows + 1) * width);
  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      const at = row * width + column;
      common[at] = base[head + row] === next[head + column]
        ? common[at + width + 1] + 1
        : Math.max(common[at + width], common[at + 1]);
    }
  }

  let row = 0;
  let column = 0;
  let changedRow = 0;
  let changedColumn = 0;
  while (row < rows && column < columns) {
    const at = row * width + column;
    if (base[head + row] === next[head + column]) {
      if (row > changedRow || column > changedColumn) {
        addHunk(head + changedRow, head + row, head + changedColumn, head + column);
      }
      row += 1;
      column += 1;
      changedRow = row;
      changedColumn = column;
    } else if (common[at + width] >= common[at + 1]) {
      row += 1;
    } else {
      column += 1;
    }
  }
  if (changedRow < rows || changedColumn < columns) {
    addHunk(head + changedRow, baseEnd, head + changedColumn, nextEnd);
  }
  return change;
}

/**
 * @param localBase What the local blocks were edited from
 * @param local What is in the editor
 * @param remoteBase The same version as localBase, in the form it was stored
 * @param remote What is stored now
 */
export function mergeBlocks(
  localBase: SerializedBlock[],
  local: SerializedBlock[],
  remoteBase: SerializedBlock[],
  remote: SerializedBlock[],
): MergeResult {
  // Each side is compared in its own form, as Lexical may normalize what was stored.
  const aligned = localBase.length === remoteBase.length;
  const ours = local.map(toComparable);
  const theirs = remote.map(toComparable);
  const oursBase = localBase.map(toComparable);
  const mine = getChange(oursBase, ours);
  const other = getChange(aligned ? remoteBase.map(toComparable) : oursBase, theirs);

  const blocks: MergedBlock[] = [];
  let conflict = false;
  const keep = (indexes: number[]) => indexes.forEach((index) => blocks.push({ keep: index }));
  const insert = (indexes: number[]) =>
    indexes.forEach((index) => blocks.push({ insert: remote[index] }));
  const same = (a: number[], b: number[]) =>
    a.length === b.length && a.every((index, i) => ours[index] === theirs[b[i]]);

  // Where an unchanged base block is in the editor.
  let position = 0;
  for (let index = 0; index <= localBase.length; index += 1) {
    const [added, addedThere] = [mine.inserted[index], other.inserted[index]];
    if (!same(added, addedThere)) insert(addedThere);
    keep(added);
    position += added.length;
    if (index === localBase.length) break;

    const [changed, changedThere] = [mine.replaced[index], other.replaced[index]];
    const own = changed ?? [position];
    if (changedThere === null) {
      keep(own);
    } else if (changed === null) {
      insert(changedThere);
    } else if (same(changed, changedThere)) {
      keep(changed);
    } else {
      // An edit outlives a deletion, and two edits are both kept.
      conflict = true;
      insert(changedThere);
      keep(changed);
    }
    position += own.length;
  }

  return { blocks, conflict };
}
