# <Project>: <task title>

<!-- One or two lines: when to paste this, from which checkout, and what must be true first (for example "after PR #N is merged"). -->
Paste the block below into a fresh chat, opened in the main checkout. Everything after the block is the brief that the
goal tells the agent to read. Problem, decisions and plan: `README.md` next to this file.

```text
/goal <One sentence: the outcome, and how it is proven.>

FIRST read all of "<absolute path to this goal_prompt.md>" and follow its brief. BEFORE any other work, do its "Keep going" section: check the preconditions, register this session with the keeper, and create the progress file. Usage limits never end this job: the keeper resumes it after each reset. Use subagents where useful; you own every commit and check their results yourself.

HARD RULES, for you and every subagent:
- <Production and data safety: what must never be contacted or written. Env files are never printed, copied or mounted.>
- <Git: the worktree and branch; whether pushing and one PR are allowed; never merge, push to protected branches, force-push or deploy, unless agreed.>
- <Scope: what must not change, for example app behavior in a test-only task.>
- Never skip, delete or weaken a test, raise a tolerance, add retries or re-record a baseline to get a pass.
- Nothing committed may read from or depend on [META]. Never commit anything in [META] or any env file. Stage files by explicit path.

DONE only when ALL are true, with evidence printed in this conversation (commands, exit codes, counts) and saved under "<[META]/task>/evidence/":
1. Preconditions hold (Keep going section), the keeper is watching this session, and progress.md exists.
2. Starting point: <the checks that prove the current state before any change, for example the full suite green>.
<3 to N-4. One checkable item each, in the order of work. Each says what is proven and how.>
N-3. The full test suite passes locally and in CI, and new behavior has new tests as CLAUDE.md requires.
N-2. A proof video made with the /proof-video skill. Print its path and the skill's checks: ffprobe, the transcript match, and a frame-by-narration review.
N-1. "<[META]/task>/REPORT.md" covers what changed, evidence, known limits, the owner's steps, and commands.
N. Only after 1 to N-1: progress.md says STATUS: DONE, the keeper no longer watches this session, and keeper status proves it.

Usage limits, expired sessions, errors and long runtime are never reasons to finish: the keeper resumes you, so keep progress.md current and continue. Only if a decision or access truly needs me: finish all other work, revert any local setup, set STATUS: BLOCKED in progress.md, unwatch, print "BLOCKED" with evidence and the exact question or command for me, and stop. Never present that as done.
```

---

# Brief

## 1. Context

<!-- Repo path, branches and their state (with the date), stack and versions, the machine, rules and rulesets, how
releases work, what exists today (with paths and counts), and earlier work to reuse. Facts the agent cannot see in the
code go here. Mark unchecked facts UNTESTED. -->

## 2. What you may and may not do

Allowed without asking:
- <...>

Not allowed:
- <...>

## 3. <Design and steps: one section per part of the work>

<!-- Exact files, commands, names and settings agreed in the chat. Where the agent must choose, say what to optimize
for. Where something could go wrong, say what to check. -->

## <n>. Proof

<!-- How each DONE item is proven: commands, comparisons, evidence files. Include the proof video's storyboard outline
(about 2 minutes): what changed, the real evidence (numbers read from reports), the change working in the real app,
and what is not covered. -->

## <n+1>. Order of work

0. Keep going section: preconditions, keeper watch, progress file.
1. <...>
<last>. Independent review of the diff by a subagent, the proof video, the report, STATUS: DONE and unwatch.

Make small commits, one per step. Update progress.md after every step.

### REPORT.md must include

- <What changed, evidence, known limits, the owner's steps (review, merge, release), commands.>

## <n+2>. Keep going until done: do this before anything else

The keeper (`~/.claude/keeper/README.md`) resumes any session that a usage limit (5-hour or weekly) cut off. It wakes 2
minutes after the reset and reschedules itself if the limit is still active. It runs from a background job, costs no
tokens, and works even when yours are used up.

### At the start

1. **Preconditions.** Stop with BLOCKED if any fails:
   - `keeper status` shows the job loaded and the daemon running;
   - <task-specific preconditions, for example a PR merged or a tool present on develop>.
2. **Watch this session:** `keeper watch --this-session --progress "<absolute path to progress.md>"`. The keeper then also
   resumes this session after a crash or a closed window, until progress.md says DONE or BLOCKED. Print `keeper status`.
3. **Progress file.** Create `<[META]/task>/progress.md`, or resume from it. Its first line is `STATUS: RUNNING`,
   `STATUS: DONE` or `STATUS: BLOCKED`. Keep in it:
   - the DONE items, with status and evidence paths;
   - the current step and the exact next action;
   - worktrees, commits, PR and CI URLs, running processes and containers.
   Update it after every step.

### On every resume

1. If progress.md says DONE or BLOCKED, make sure the keeper no longer watches this session, then stop.
2. Otherwise compare progress.md with reality (git, worktrees, `gh`, `docker ps`). Trust reality. Never redo finished work
   or discard uncommitted work.
3. Restore what died, then continue from the next action. The rules and DONE items still apply if `/goal` was cleared.
   Tell the owner in one line that it can be pasted again.
4. Don't wait idle for more than 20 minutes: check long jobs periodically instead.
5. If the same problem has survived three resumes, change approach. Declare BLOCKED only if it truly needs the owner.

### Limits

Never run `/clear` or start a new conversation. Never try to get around a limit or a login: no other accounts, no
reading or editing credentials, no buying credits.

### At the end

Set `STATUS: DONE` (or `BLOCKED`) in progress.md, run `keeper unwatch --this-session`, and print `keeper status`.

## <n+3>. Left for the owner

<!-- What the owner must do after: review and merge, release steps, settings only they can change, follow-ups. -->
