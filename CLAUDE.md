# openleaf: rules for agents

Read first: [README.md](README.md), [CONTRIBUTING.md](CONTRIBUTING.md), [tests/e2e/README.md](tests/e2e/README.md).

## The project

- A minimal collaborative editor: Next.js 16 (App Router), React 19, Lexical 0.53, KaTeX, DynamoDB (AWS SDK v3). pnpm 12
  and Node 26 are pinned in `package.json`.
- The editor is in `app/components/editor`, and the server code in `server/`.
- **Anyone with a document's URL can edit it.** This is by design: do not add auth.
- The custom Lexical plugins, nodes and transformers in `app/components/editor` are the owner's overrides of Lexical
  playground code. Keep them on upgrades, unless a test proves stock Lexical now does exactly the same.
- `/api/legacy-save` is temporary; its removal steps are in its `route.ts`. Read-only pages staying editable and silent
  is deliberate.

## Commands

```bash
pnpm install          # dependencies
pnpm dev              # dev server: only with a local database (see Safety)
pnpm build            # production build, typecheck included
pnpm lint
pnpm test:e2e         # end-to-end tests in Docker, all 3 browsers; Playwright args pass through
pnpm test:e2e:update --grep "<name>"   # re-record chosen baselines (intended changes only)
pnpm test:perf        # perf against origin/main, for upgrades and editor-core changes
```

## Safety

- **Never run the app or the tests against production DynamoDB.** `.env.local`, output of `vercel env pull`, and every
  Vercel preview (feature branches and `develop` included) use the production table and keys. Typing in the editor
  autosaves, so treat them all as production, and ask before anything that could write there.
- Never print, copy or commit env files.
- Never scan the production table: its read capacity is low, and a scan throttles the live site.
- The e2e suite refuses non-loopback hosts and any table not named `openleaf-local*`. Keep it that way.

## Tests

The e2e suite in `tests/e2e/` is the regression suite: [tests/e2e/README.md](tests/e2e/README.md) says how to run it,
where each area lives, and how to add tests. It runs in Docker (`pnpm test:e2e`, any Playwright argument passes
through), and in CI on every PR. Its baselines are what `main` does today.

- **Every new feature and every bug fix comes with tests**, as the README describes:
  - **A new feature:** scenarios (`scenario()`) in its area file for what users do, plain `test()`s with explicit
    `expect`s for its rules, and a screenshot if it adds UI. Scenarios record behavior; `expect`s state rules. A new
    feature needs both.
  - **A bug fix:** a test in the area file, titled by the behavior it checks, that fails without the fix. Tag it with
    the issue (`{ tag: '@issue-42' }`) if there is one, and add tests for what the fix must not break.
- **Any feature you touch that has no tests gets tests in the same PR**, recorded before your change so that the change
  shows. When features or tests change, update `tests/e2e/README.md` too.
- **Run the related subset while working:** `pnpm test:e2e --grep "<title>"`, a file (`tests/e2e/editor/code.spec.ts`), a
  tag (`--grep "@B8\b"`) or a browser (`--project=chromium`). Run **the full suite locally before opening or updating a
  PR.** CI must also pass: its checks `lint`, `e2e (chromium)`, `e2e (firefox)` and `e2e (webkit)` are required to
  merge into `develop` or `main`, and must be green on `develop` before `main` is fast-forwarded.
- **Never skip, delete or weaken a test, add retries or raise a tolerance to get green.** A test for a fixed bug is
  ordinary expected behavior: it is never deleted because "it is fixed".
- **Baselines** (`tests/e2e/expected/`, `tests/e2e/screenshots/`) are re-recorded only for an intended change, explained
  in the PR and agreed with the owner:
  1. see the related tests fail, and read what changed in the report (`tests/e2e/playwright-report/`);
  2. `pnpm test:e2e:update --grep "<those tests>"` (a filter is required; `--all` re-records everything);
  3. look at every recorded entry and PNG in the diff before committing it.
  Never update a baseline to silence a failure you cannot explain.
- A new scenario or screenshot without a baseline fails with the exact update command to run.
- For dependency upgrades and editor-core changes, also run `pnpm test:perf` (this tree against `origin/main`; it
  fails if more than 10% and 0.5 ms slower).
- Native (non-Docker) runs are for debugging only: their fonts and pixels differ from the Linux baselines.

## Proof videos

Make a narrated proof video with the `/proof-video` skill:
- for every PR with a user-visible change;
- whenever the owner asks;
- as part of the outcome of every `/goal`.

Docs-only and CI-only PRs skip it. Videos stay local in `[META]/proof-videos/`.

## Goal prompts

When a task has been discussed and agreed (problem, decisions, outcome, stopping conditions), the owner asks for
`/create-goal-prompt <task-name>`. It writes `[META]/<task-name>/README.md` and `goal_prompt.md`, to paste into a fresh
chat. Every goal ends with tests passing, a proof video and a report.

## Long jobs and usage limits

A usage limit (5-hour or weekly) never ends a job. The keeper (`~/.claude/keeper/README.md`, user-level on the owner's
Mac) resumes any session it cut off, 2 minutes after the reset. For a long or unattended job:
- keep a progress file whose first line is `STATUS: RUNNING`, `DONE` or `BLOCKED`;
- run `keeper watch --this-session --progress <file>`.

## `[META]`

`[META]/` is the owner's local context folder: plans, goal prompts, evidence, videos. Git ignores it.
- **Nothing committed may read from or depend on anything in it.** No imports, no scripts, no docs that need it.
- Tools may only write their local output there.
- Never commit anything from it. Stage files by explicit path.

## Git

- Branch names follow CONTRIBUTING.md (`feature/...`, `bugfix/...`, `chore/...`, `test/...`).
- PRs go to `develop`, and are squash-merged by the owner.
- **Release:** fast-forward `main` to `develop`, never with a merge commit, once `develop`'s checks are green.
- Never force-push: the branch rules forbid it on every branch. Fix mistakes with new commits.
- Never push to `develop` or `main` directly, and never merge unless the owner says so.
