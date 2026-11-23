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
| `bugs/` | One or more tests per bug fixed after 0.3.0. `guard` tests protect what the fix must not break. `upgrade-fixes.spec.ts` covers the bugs Lexical 0.53 fixed (U1-U4) |
| `hardening.spec.ts` | Crafted requests neither crash nor stall the server |
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

### Accepted differences

`support/accepted.ts` lists the few scenarios where 0.4.0 differs from 0.3.0 on purpose: bugs
that Lexical 0.53 fixed and the owner chose to keep, each named with its browsers and reason.
Those scenarios are compared with a reviewed recording of 0.4.0 in `expected/accepted/`, so any
further change still fails. Only add to the list with the owner's agreement, then record:

```bash
E2E_RECORD_ACCEPTED=1 pnpm test:e2e --project=chromium -g "<scenario name>"
```

An element's `textFormat` and `textStyle` are not compared where it holds text, as the owner
accepted (Lexical 0.53 works them out from the text). See `withoutDerivedTextFormat` in
`support/tree.ts`.

### Bug numbers

Tests and commits name the bugs fixed after 0.3.0 by number:

| # | Bug in 0.3.0 |
| --- | --- |
| B1 | A request could lock any document for good |
| B2 | A request could overwrite any document, even a locked one, through exposed server functions |
| B3 | A document holding only an empty table or code block vanished on reload |
| B4 | Edits made less than 2 s before leaving were lost |
| B5 | Typing without a pause was never saved, and failed saves were not shown |
| B6 | Two tabs editing one document overwrote each other |
| B7 | Read-only documents can be edited and are never saved. Kept on purpose: its tests are guards |
| B8 | Three backticks put the code block inside its paragraph, breaking shortcuts after it |
| B9 | Copying an equation with non-Latin characters threw |
| B10 | `costs $5 and $` became math |
| B11 | Pasting a sentence with a URL over a selection made a broken link |
| B12 | Pasting a very long word froze the page |
| B13 | Escape in the table size widget lost the caret, and the widget was saved |
| B14 | `/center` offered Block Equation before Align center |
| B15 | Strikethrough, H4 and H5 had no styling |
| B16 | `/100x3` did nothing, and the add-column button never showed from the bottom-right cell |
| B17 | Empty strings were saved as null |
| B18 | Links opened in a new tab could control the editor tab |

U1-U4 are bugs of 0.3.0 that Lexical 0.53 fixed, listed in `support/accepted.ts`.

