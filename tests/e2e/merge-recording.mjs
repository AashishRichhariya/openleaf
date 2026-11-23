// Merges what E2E_RECORD=1 wrote into expected/<browser>.json, one scenario per line.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const recording = path.join(here, '.recording');

for (const project of fs.readdirSync(recording)) {
  const folder = path.join(recording, project);
  const target = path.join(here, 'expected', `${project}.json`);
  const merged = new Map();
  if (fs.existsSync(target)) {
    const { styles, scenarios } = JSON.parse(fs.readFileSync(target, 'utf8'));
    const expand = (box) => ({ ...box, style: styles[box.style] });
    for (const [name, value] of Object.entries(scenarios)) {
      merged.set(name, {
        ...value, boxes: value.boxes.map(expand), floating: value.floating.map(expand),
      });
    }
  }
  for (const file of fs.readdirSync(folder)) {
    const [name, value] = JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8'));
    merged.set(name, value);
  }
  const entries = [...merged].sort(([a], [b]) => a.localeCompare(b));
  const styles = new Map();
  const intern = (box) => {
    if (!styles.has(box.style)) styles.set(box.style, styles.size);
    return { ...box, style: styles.get(box.style) };
  };
  const lines = entries.map(([name, value]) => {
    const compact = { ...value, boxes: value.boxes.map(intern), floating: value.floating.map(intern) };
    return `${JSON.stringify(name)}: ${JSON.stringify(compact)}`;
  });
  const list = [...styles.keys()].map((style) => JSON.stringify(style)).join(',\n');
  fs.writeFileSync(
    target,
    `{"styles": [\n${list}\n],\n"scenarios": {\n${lines.join(',\n')}\n}}\n`,
  );
  console.log(`${project}: ${entries.length} scenarios`);
}
