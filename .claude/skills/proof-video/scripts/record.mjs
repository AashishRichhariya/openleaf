// Records the storyboard in one continuous Chromium video, starting each step at its planned time.
//   node record.mjs <plan.json> <work dir>
// Only loopback is reachable: the app on :4200 and the storyboard folder on :4310.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { chromium } from 'playwright';

const [planPath, work] = process.argv.slice(2);
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const APP = 'http://127.0.0.1:4200';
const FILES = 'http://127.0.0.1:4310';
const SLACK_MS = 250;

const loopback = (href) => {
  try {
    const url = new URL(href);
    return ['data:', 'blob:', 'about:'].includes(url.protocol) || ['127.0.0.1', 'localhost'].includes(url.hostname);
  } catch {
    return false;
  }
};

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function cardHtml(card, step) {
  const lines = (card.lines ?? []).map((line) => `<li>${escape(line)}</li>`).join('');
  const stats = (card.stats ?? []).map((stat) =>
    `<div class="stat"><b>${escape(stat.value)}</b><span>${escape(stat.label)}</span></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:#1e2d24;color:#e6ebe8;font-family:"Liberation Sans",Arial,sans-serif}
    main{box-sizing:border-box;height:100%;padding:72px 96px;display:flex;flex-direction:column;justify-content:center;gap:28px}
    .kicker{color:#68d391;font-size:20px;letter-spacing:.08em;text-transform:uppercase}
    h1{margin:0;font-size:52px;line-height:1.15;font-weight:700}
    ul{margin:0;padding-left:28px;font-size:28px;line-height:1.5;color:#cdd8d1}
    .stats{display:flex;gap:20px;flex-wrap:wrap}
    .stat{background:#2f3c33;border:1px solid #2f855a;border-radius:12px;padding:18px 24px;min-width:170px}
    .stat b{display:block;font-size:40px;color:#e6ebe8}.stat span{font-size:18px;color:#a7b5ac}
    footer{position:fixed;bottom:28px;left:96px;right:96px;display:flex;justify-content:space-between;color:#7d8c83;font-size:16px}
  </style></head><body><main>
    ${card.kicker ? `<div class="kicker">${escape(card.kicker)}</div>` : ''}
    <h1>${escape(card.title ?? '')}</h1>
    ${stats ? `<div class="stats">${stats}</div>` : ''}
    ${lines ? `<ul>${lines}</ul>` : ''}
  </main><footer><span>${escape(plan.title)}</span><span>${step.index + 1} / ${plan.steps.length}</span></footer></body></html>`;
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  colorScheme: 'dark',
  recordVideo: { dir: work, size: { width: 1280, height: 800 } },
});
await context.route((url) => !loopback(url.href), (route) => route.abort());
const page = await context.newPage();
const t0 = Date.now();
const custom = plan.module ? (await import(pathToFileURL(path.join('/story', plan.module)).href)).default : {};

const ACTIONS = {
  goto: (value) => page.goto(value.startsWith('http') ? value : APP + value, { waitUntil: 'networkidle' }),
  click: (value) => page.click(value),
  dblclick: (value) => page.dblclick(value),
  hover: (value) => page.hover(value),
  focus: (value) => page.focus(value),
  type: (value) => page.keyboard.type(value, { delay: 60 }),
  press: (value) => page.keyboard.press(value),
  scroll: (value) => page.mouse.wheel(0, value),
  wait: (value) => page.waitForTimeout(value),
  call: (value) => {
    const [name, ...args] = Array.isArray(value) ? value : [value];
    if (typeof custom[name] !== 'function') throw new Error(`no function "${name}" in ${plan.module}`);
    return custom[name](page, ...args);
  },
};

async function act(list = []) {
  for (const action of list) {
    const [kind, ...extra] = Object.keys(action);
    if (!ACTIONS[kind] || extra.length) throw new Error(`unknown action ${JSON.stringify(action)}`);
    await ACTIONS[kind](action[kind]);
  }
}

const timings = [];
const problems = [];
for (const step of plan.steps) {
  const start = t0 + step.start * 1000;
  if (Date.now() < start) await page.waitForTimeout(start - Date.now());
  const began = Date.now();
  if (step.card) await page.setContent(cardHtml(step.card, step), { waitUntil: 'load' });
  if (step.file) {
    await page.goto(`${FILES}/${step.file.split('/').map(encodeURIComponent).join('/')}`, { waitUntil: 'load' });
  }
  await act(step.app ?? step.do);
  const done = Date.now();
  const end = start + step.duration * 1000;
  const overrun = done - end;
  timings.push({ index: step.index, planned: step.start, began: (began - t0) / 1000, done: (done - t0) / 1000, overrun_ms: Math.max(0, overrun) });
  if (overrun > SLACK_MS) {
    problems.push(`step ${step.index + 1}: actions took ${((done - start) / 1000).toFixed(1)} s, planned ${step.duration} s. `
      + `Set "min_seconds": ${Math.ceil((done - start) / 1000) + 1} on it.`);
  }
}
const finish = t0 + plan.total * 1000;
if (Date.now() < finish) await page.waitForTimeout(finish - Date.now());
const video = page.video();
await context.close();
await browser.close();
fs.renameSync(await video.path(), path.join(work, 'video.webm'));
fs.writeFileSync(path.join(work, 'timings.json'), JSON.stringify(timings, null, 1));
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`recorded ${plan.steps.length} steps, ${plan.total} s`);
