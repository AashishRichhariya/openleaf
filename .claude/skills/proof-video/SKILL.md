---
name: proof-video
description: Make a narrated ~2-minute proof video showing that a change works, from a storyboard, deterministically, in Docker (Playwright recording, Kokoro voice, Whisper captions and check, ffmpeg). Use for every PR with a user-visible change, whenever the owner asks for a proof video, and as the outcome of every /goal. Usage - /proof-video <what to show>.
---

# /proof-video

Makes `proof.mp4`, a narrated, captioned video, from a storyboard you write. Everything runs in a pinned Docker image:
- Playwright 1.65.1 Chromium for the recording;
- Kokoro v1.0 for the voice, `af_heart` by default;
- Whisper `base.en` for the captions and the transcript check;
- ffmpeg.

The only thing needed on the host is Docker. The same storyboard gives the same narration track, byte for byte.

## Steps

1. **Decide what to show,** from the request, the PR or the goal. Aim for about 2 minutes, in 5 to 9 steps:
   - what changed, and why;
   - the real evidence, such as counts from reports;
   - the change working in the real app;
   - what is not covered.
2. **Collect real numbers first.** Read them from reports and command output: Playwright JSON reports, `gh pr checks`,
   test counts. Never type a number from memory. Copy any page or report you want to show (a file step) into the
   storyboard's folder.
3. **Write the storyboard.** Keep it with the work, not in the repo: `[META]/<task>/video/storyboard.json`, or a scratch
   folder. Use the format below, and start from `example/storyboard.json`.
4. **Run it** from anywhere in the repo or a worktree of it:
   ```bash
   .claude/skills/proof-video/proof-video.sh path/to/storyboard.json            # PR number found with gh
   .claude/skills/proof-video/proof-video.sh path/to/storyboard.json --pr 34
   ```
   - The first run builds the image. It downloads about 2 GB and takes several minutes; later runs reuse it.
   - If Docker is not running, the script starts Docker Desktop.
   - If the storyboard uses the app, the app is built from the working tree. That takes a few minutes the first time
     and less after, thanks to cached volumes.
5. **Check the result.** The script prints `checks.txt`, and all three lines must say PASS:
   - video and audio streams;
   - duration;
   - the transcript matches the narration within 10% of its words.
6. **Look at `contact-sheet.png`,** which holds one frame from the middle of each step, in order. Confirm that each frame
   shows what its narration says. If not, fix the storyboard and run again.
7. **Report** the video's path, the checks and what you saw in the frames. On a PR, mention the path; the video itself
   stays local.

## Output

The video goes in the main checkout's `[META]/proof-videos/<YYYY-MM-DD>_<pr-N or branch>_<name>/`, also when run from a
worktree. `[META]` is the owner's local folder, ignored by git. If the folder exists, a `-2`, `-3`... suffix is added.

| File | What it is |
|---|---|
| `proof.mp4` | The video, H.264 and AAC, 1280x800, with captions burned in |
| `storyboard.json` | The storyboard it was made from |
| `captions.srt`, `transcript.json` | What Whisper heard, with times |
| `contact-sheet.png` | One frame per step |
| `run-info.json` | Commit, branch, PR, voice, the narration's sha256, step timings, word error rate (overall and per step), ffprobe |
| `checks.txt` | The PASS/FAIL lines |

On failure, the work files stay in `.work/` next to them. That includes `app-build.log` and `app.log`.

## Storyboard format

```json
{
  "title": "Shown in the footer of every card",
  "name": "short-feature-name",
  "voice": "af_heart",
  "speed": 1.0,
  "module": "steps.mjs",
  "steps": [
    { "say": "Narration for this step.", "card": { "kicker": "Optional", "title": "Big title",
      "stats": [{ "value": "1,507", "label": "tests per browser" }], "lines": ["A bullet", "Another"] } },
    { "say": "...", "app": [{ "goto": "/some-slug" }, { "click": ".editor-input" }, { "type": "# Heading" }],
      "min_seconds": 10 },
    { "say": "...", "file": "report/index.html", "do": [{ "scroll": 400 }] }
  ]
}
```

- **Each step** has `say` and exactly one of:
  - `card`: a slide in openleaf's colors, with `kicker`, `title`, `stats` and `lines`, all optional except `title`;
  - `app`: a list of actions on the app at `http://127.0.0.1:4200`;
  - `file`: a path inside the storyboard's folder, served on `127.0.0.1:4310`, with optional `do` actions.
- **Actions** (one key each):
  - `goto`: a path on the app, or a loopback URL;
  - `click`, `dblclick`, `hover`, `focus`: a selector;
  - `type`: text, typed at 60 ms per key;
  - `press`: a key such as `Enter` or `Shift+Tab`;
  - `scroll`: pixels;
  - `wait`: milliseconds;
  - `call`: `["functionName", ...args]`, which runs `export default { functionName(page, ...args) {} }` from `module`.
- **Timing:** a step lasts max(`min_seconds`, narration + 0.6 s), and starts at its planned time. If its actions take
  longer, the run fails and names the `min_seconds` to set. Typing takes 60 ms per character.
- **Content and network:**
  - The app starts with an empty database, so use fixed slugs (`/proof-<name>`) and type or paste the content in the
    storyboard.
  - Only loopback is reachable from the page.

## Rules

- **Never narrate what the recording does not show.** Every claim must be visible in its step's frames.
- **Numbers on cards come from real output** (reports, `gh`), copied when you write the storyboard.
- **Never record production, openleaf.xyz or a Vercel preview.** The script cannot reach them, and you must not add a way.
- **Keep it to about 2 minutes.** Speak plainly. Say what is not covered.
- **Voice:** Kokoro's model and voices are Apache-2.0, so the video may be published. Change the voice only if the
  owner asks.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `checks.txt` FAIL on the transcript | Read `words_not_heard` in `run-info.json`. Rephrase hard words: spell out symbols, write numbers as they are read |
| A step overran | Set the `min_seconds` it names |
| App build failed | `.work/app-build.log` |
| Selector not found | Check it against the app (`app/components/editor`) and add a `wait` before it |
