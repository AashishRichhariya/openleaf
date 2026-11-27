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
pnpm test:e2e         # end-to-end tests: see tests/e2e/README.md for setup and options
```

## Safety

- **Never run the app or the tests against production DynamoDB.** `.env.local`, output of `vercel env pull`, and every
  Vercel preview (feature branches and `develop` included) use the production table and keys. Typing in the editor
  autosaves, so treat them all as production, and ask before anything that could write there.
- Never print, copy or commit env files.
- Never scan the production table: its read capacity is low, and a scan throttles the live site.
- The e2e suite refuses non-loopback hosts and any table not named `openleaf-local*`. Keep it that way.

## Tests

- **Every new feature and every bug fix comes with tests.** A bug fix's test must fail without the fix.
- **Any feature you change that has no tests gets tests in the same PR.** When features or tests change, update
  `tests/e2e/README.md` too.
- **Run the related tests while working, and the full suite locally before opening or updating a PR.**
- **Never skip, delete or weaken a test, add retries or raise a tolerance to get green.** A test for a fixed bug is
  ordinary expected behavior: never delete it because "it is fixed".
- **Baselines** (`tests/e2e/expected/`, `tests/e2e/screenshots/`) change only for an intended change. Explain it in the
  PR, agree it with the owner, and look at every recorded file before committing it.

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
