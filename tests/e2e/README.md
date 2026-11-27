# End-to-end tests

The suite drives a production build of openleaf in Chromium, Firefox and WebKit, against DynamoDB Local. It proves that
what users do keeps working: typing, formatting, markdown, lists, links, code, equations, tables, the slash menu, the
clipboard, history, saving, read-only documents, URLs, the server's defenses, documents saved by 0.3.0, and the look.

**The rule: the baselines are what `main` does today.** A change that alters any recorded behavior fails until it is
re-recorded on purpose, reviewed, and explained in the PR.

## Run

You need Docker (Docker Desktop on a Mac) and bash. Nothing else is installed or started by hand.

```bash
pnpm test:e2e                                  # everything, all 3 browsers (about 45 minutes on 8 CPUs)
pnpm test:e2e --project=chromium               # one browser
pnpm test:e2e --grep "table"                   # tests whose title matches
pnpm test:e2e tests/e2e/editor/code.spec.ts    # one file
pnpm test:e2e --grep @B8                       # one tag
```

Any `playwright test` argument passes through. Write `--grep`, not `-g`: Volta's `pnpm` refuses any command with `-g`. The command builds a runner image (the first time downloads about
2 GB), copies the working tree into a container (tracked and new files, never ignored ones or env files), installs,
builds, starts DynamoDB Local and the app, runs Playwright, and returns its exit code. Uncommitted changes are tested.

Results:
- `tests/e2e/playwright-report/index.html`: the HTML report. Open it with `npx playwright show-report tests/e2e/playwright-report`.
- `tests/e2e/test-results/`: the JSON report, failure screenshots and diffs, and `logs/` (install, build, app).

`E2E_WORKERS` changes the number of workers (default 6, measured on 8 CPUs and 8 GB: memory peaks near 5 GB).

Native runs, for debugging only: start a local build on 127.0.0.1:4200 against DynamoDB Local and run
`E2E_BASE_URL=http://127.0.0.1:4200 npx playwright test -c tests/e2e/playwright.config.ts`. Fonts and pixels differ
from Linux, so screenshots and element boxes fail there; only Docker results count.

## What is where

| Path | What it is for | What may change it |
| --- | --- | --- |
| `editor/` | Typing, formatting, markdown, lists, links, code, equations, tables, slash menu, clipboard, history, blocks | Any editor change: add tests with it |
| `saving/` | Autosave, reload, two tabs, read-only documents, empty values | Changes to saving or the documents API |
| `server/` | Forged requests (`security`) and crafted requests that must not crash or stall (`hardening`) | Server changes |
| `app/` | URLs and slugs, the page around the editor, metadata, widths | Page and routing changes |
| `compat/` | Documents and clipboard contents saved by 0.3.0, which must keep opening and pasting | Only new old-format cases |
| `visual/` | Screenshots of the editor | Intended look changes |
| `support/` | `test.ts` (fixtures), `editor.ts` (`ed`), `doc.ts` (document builders), `db.ts` (rows), `scenario.ts`, `env.ts` (guards) | Test infrastructure |
| `expected/<browser>.json` | Scenario baselines | Only `pnpm test:e2e:update` |
| `screenshots/<browser>/` | Screenshot baselines | Only `pnpm test:e2e:update` |
| `fixtures/` | Documents and clipboard data saved by 0.3.0 | Never: they are history |
| `docker/` | The runner: image, compose file, `run.sh` (host) and `inner.sh` (container) | Runner changes |
| `perf.mjs` | Typing latency and page load against a reference build | Perf method changes |

Each area file holds `scenario()`s, which record behavior, and plain `test()`s, which state rules with `expect`.
Steps that need platform-specific editing keys use `support/keys.ts` (delete a word, go to the line start...).

A scenario performs a user's steps, then records everything observable: the text, focus, caret, scroll, every element's
box and style, floating UI, the document tree, the saved row, what a reload shows, and console errors. Every run must
reproduce `expected/<browser>.json`. Element boxes allow 1 px; styles and everything else must match exactly. A
paragraph's `textFormat` and `textStyle` are left out where it holds text (Lexical works them out from the text; see
`withoutDerivedTextFormat` in `support/tree.ts`).

## Adding tests

**A new feature:**
1. Add scenarios for what users do with it, in its area file (or a new file in its area).
2. Add plain `test()`s with explicit `expect`s for its rules, such as "a table never has more than 500 rows".
3. If it adds UI, add a screenshot in `visual/screenshots.spec.ts`.
4. Record: `pnpm test:e2e:update --grep "<new test names>"`. Look at every recorded entry and PNG, then commit them.

A new scenario or screenshot without a baseline fails with the command that records it.

**An existing feature you change that has no tests:** add tests for today's behavior first, on `main`'s behavior, and
record them. Then make the change, so that the tests show what it changed.

**A bug fix:** add a test in the area file, titled by the behavior it checks, that fails without the fix. Tag it with
the GitHub issue if there is one: `test('pasting a URL over a word links the word', { tag: '@issue-42' }, ...)`. Add
tests for what the fix must not break.

**Helpers:**
- `ed` (`support/editor.ts`): `open`, `type`, `press`, `select`, `caretAfter`, `paste`, `copy`, `pick` (slash menu),
  `cell`, `tree`, `row`, `saved`...
- `doc` builders (`support/doc.ts`): `doc(p('text'), heading(2, 'Title'), table([['a', 'b']]))`.
- `getRow`, `putRow`, `storedText` (`support/db.ts`): read and seed the local table.

```ts
import { doc, p } from '../support/doc';
import { scenario } from '../support/scenario';
import { expect, test } from '../support/test';

// Records everything the steps lead to; compared with expected/<browser>.json on every run.
scenario('lists: Tab indents a bullet', async (ed) => {
  await ed.type('- one');
  await ed.press('Tab');
});

// States one rule explicitly.
test('a pasted URL over a word links the word', { tag: '@issue-42' }, async ({ ed }) => {
  await ed.open({ content: doc(p('read the docs')) });
  await ed.select('docs');
  await ed.paste({ 'text/plain': 'https://example.com' });
  expect(await ed.tree()).toContain('url="https://example.com"');
});
```

## Changing behavior on purpose

1. Run the related tests and see them fail. The report shows what changed, field by field.
2. Re-record exactly those: `pnpm test:e2e:update --grep "<their names>"` (a `--grep` or file filter is required; `--all`
   re-records everything).
3. Review the diff of `expected/*.json` and look at every changed PNG.
4. Explain every difference in the PR.

Never update a baseline to silence a failure you cannot explain. Update mode records Linux results from Docker, so
baselines are the same on every machine and in CI.

## CI

`.github/workflows/ci.yml` runs on every pull request and push to `develop` and `main`. Its 4 checks, `lint`,
`e2e (chromium)`, `e2e (firefox)` and `e2e (webkit)`, are required by the `required-checks` ruleset before anything
merges into `develop` or `main`, and before `main` is fast-forwarded: wait for the `develop` push run to be green.

- **A failure:** open the run, download the `e2e-report-<browser>` artifact, unzip it, and run
  `npx playwright show-report <folder>/playwright-report`.
- **Baselines from CI:** if GitHub's runners ever render differently from local Docker, run the workflow by hand with
  `update_baselines` set. It records everything and uploads `e2e-baselines-<browser>`. Diff that against the local
  recording and explain the difference before committing it.
- PRs that touch `.github/`, `tests/e2e/expected/` or `tests/e2e/screenshots/` deserve the closest review: they change
  what is checked.

## perf

For dependency upgrades and editor-core changes:

```bash
pnpm test:perf               # this working tree against origin/main
pnpm test:perf v0.4.1        # against any ref
```

It builds and serves both in Docker, each with its own table, measures page load and typing latency in interleaved
rounds, and prints both sets of numbers. It exits 1 if this tree is more than 10% slower. It is not run in CI.

## Safety

- The suite refuses any URL that is not loopback and any table not named `openleaf-local*` (`support/env.ts`). Every
  other request is answered locally, and a dead proxy catches anything that slips through.
- No env file reaches Docker: `run.sh` leaves them out of the copied tree, and the container refuses to start if one
  is there. The app gets only a local endpoint, dummy credentials and an `openleaf-local-*` table.
- Never point the suite at production, `.env.local`, or a Vercel preview: they all use the production table.

## Limits

- Linux Chromium, Firefox and WebKit, not macOS Safari or Chrome, and no real mobile IME or touch keyboard.
- Baselines are ARM64 Linux (Apple Silicon Docker and GitHub's `ubuntu-24.04-arm`). On an x86 machine, Docker
  emulates ARM slowly; rely on CI there.
- Timing tests (autosave, B12's under-a-second) assume an unloaded machine.

## Bug history

Tests of bugs fixed after 0.3.0 carry their number as a tag, so `pnpm test:e2e --grep @B8` runs them.

| Tag | Bug in 0.3.0 |
| --- | --- |
| `@B1` | A request could lock any document for good |
| `@B2` | A request could overwrite any document, even a locked one, through exposed server functions |
| `@B3` | A document holding only an empty table or code block vanished on reload |
| `@B4` | Edits made less than 2 s before leaving were lost |
| `@B5` | Typing without a pause was never saved, and failed saves were not shown |
| `@B6` | Two tabs editing one document overwrote each other |
| `@B7` | Read-only documents can be edited and are never saved. Kept on purpose: its tests pin that |
| `@B8` | Three backticks put the code block inside its paragraph, breaking shortcuts after it |
| `@B9` | Copying an equation with non-Latin characters threw |
| `@B10` | `costs $5 and $` became math |
| `@B11` | Pasting a sentence with a URL over a selection made a broken link |
| `@B12` | Pasting a very long word froze the page |
| `@B13` | Escape in the table size widget lost the caret, and the widget was saved |
| `@B14` | `/center` offered Block Equation before Align center |
| `@B15` | Strikethrough, H4 and H5 had no styling |
| `@B16` | `/100x3` did nothing, and the add-column button never showed from the bottom-right cell |
| `@B17` | Empty strings were saved as null |
| `@B18` | Links opened in a new tab could control the editor tab |
| `@U1` | Clicking away from an equation being edited kept neither the edit nor the caret (fixed by Lexical 0.53) |
| `@U2` | After pasting several blocks, the caret stayed in an earlier block (fixed by Lexical 0.53) |
| `@U3` | ArrowDown on the last line of code showed the caret below, but typing stayed in the code (fixed by Lexical 0.53) |
| `@U4` | In Firefox, Enter that closes an equation also added a line break after it (fixed by Lexical 0.53) |
| U5 | Not a bug: Chrome drew a word typed into a heading 2 px wider than when loaded. No tag; the baselines now hold 0.4.x |
