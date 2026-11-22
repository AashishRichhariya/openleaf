# End-to-end tests

These run against a production build on DynamoDB Local. They refuse any other host or any table
that is not called `openleaf-local*`, and block every request that would leave the machine.

## Run

Start DynamoDB Local on 127.0.0.1:8000 and the app against it:

```bash
export AWS_ENDPOINT_URL_DYNAMODB=http://127.0.0.1:8000 AWS_REGION=ap-south-1 \
  AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local DOCUMENTS_TABLE=openleaf-local-upgrade \
  NEXT_PUBLIC_UMAMI_WEBSITE_ID= NEXT_PUBLIC_UMAMI_SCRIPT_URL=
pnpm build && pnpm start -H 127.0.0.1 -p 4200
```

`next build` and `next start` read `.env.local`. Variables exported like this take precedence over
it. The table needs `slug` (string, hash key) and `version` (number, range key).

In a second terminal:

```bash
pnpm test:e2e --project=chromium --project=firefox
pnpm test:e2e --project=webkit       # macOS 15 and later, Linux
tests/e2e/webkit-mac14.sh            # WebKit on macOS 14
```

`E2E_BASE_URL`, `E2E_DB_URL` and `E2E_TABLE` change the targets.

## What is here

| Path | What it proves |
| --- | --- |
| `parity/` | Each scenario must give the document, caret, look, floating UI, saved row and reload recorded on 0.3.0 |
| `bugs/` | One or more tests per bug fixed after 0.3.0. `guard` tests protect what the fix must not break |
| `app.spec.ts` | URLs, keys, autosave, metadata, widths |
| `compat.spec.ts` | Documents and clipboard contents saved by 0.3.0 open, edit and save without loss |
| `visual.spec.ts` | Screenshots recorded on 0.3.0 |
| `perf.mjs` | Typing latency and page load against a reference build |

## Recordings

`expected/`, `screenshots/` and `fixtures/` were recorded on the untouched 0.3.0 build. Do not
record them again on a newer build to get a pass. To add a scenario, record it on a build of 0.3.0:

```bash
E2E_RECORD=1 E2E_BASE_URL=<0.3.0 build> pnpm test:e2e --project=chromium -g "<scenario name>"
node tests/e2e/merge-recording.mjs
```
