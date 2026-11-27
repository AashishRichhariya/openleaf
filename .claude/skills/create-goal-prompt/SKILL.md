---
name: create-goal-prompt
description: Turn a discussed and agreed task into a ready-to-paste /goal prompt plus its brief and a README, in [META]/<task-name>/. Use when the owner says "create a goal prompt", "/create-goal-prompt <task-name>", or asks to write up the agreed plan for a /goal run.
---

# /create-goal-prompt

Writes two files in the main checkout's `[META]/<task-name>/`. `[META]` is the owner's local context folder, ignored by
git. Nothing committed may read from it.

| File | For | Holds |
|---|---|---|
| `README.md` | The owner, later | The problem, the goal, every decision with its reason, the plan, and answers given in the chat |
| `goal_prompt.md` | A fresh chat running `/goal` | A paste block (the `/goal` line, hard rules, numbered DONE items, the BLOCKED rule), then the brief the agent reads |

The goal runs later, in a fresh chat, without this conversation. So **everything it needs must be in these files**.

## Steps

1. **Pick the task name:** short kebab-case, from the owner or from the task. Check whether `[META]/<task-name>/` exists,
   and if it does, ask before overwriting.
2. **Collect from this conversation:**
   - the problem and why it matters;
   - every decision, with its reason;
   - the outcome;
   - constraints;
   - what the agent may and may not do;
   - the stopping conditions;
   - the owner's answers to questions.
3. **Confirm facts in the code, git, `gh` and memory.** Paths, versions, branch state, rulesets, commands. Mark
   anything you could not check as UNTESTED. Use absolute paths, and quote every path containing `[META]`, because of
   the brackets.
4. **Ask before writing** about anything unresolved, contradictory or only implied. Never invent a decision. One short
   round of questions is better than a wrong brief.
5. **Write `README.md`,** with these sections:
   - Problem;
   - Goal;
   - Decisions: a table of #, decision and why;
   - Plan;
   - Answers given to the owner.
6. **Write `goal_prompt.md` from `template.md`.** Fill every section, and delete the template's guidance comments.
   - **DONE items:** each one is checkable, with printed evidence (commands, exit codes, counts, URLs).
   - **Order:** the "starting point is green" item comes before any change, and the final ones last.
   - **The paste block** stays short enough to paste. Detail goes in the brief.
7. **Always include these,** even if the chat did not mention them:
   - **DONE items:** the tests pass locally and in CI (with new tests for new behavior, per `CLAUDE.md`); a proof video
     made with `/proof-video`; a final report; `STATUS: DONE` in progress.md and the keeper unwatched.
   - **Hard rules:** never production data, previews or analytics; never print or copy env files; never skip, weaken or
     re-record tests to get a pass; nothing in `[META]` committed or depended on; stage files by explicit path; the
     git limits agreed (worktree, branch, push and PR or not, never merge unless agreed).
   - **The keep-going section:** `keeper status`, `keeper watch --this-session --progress ...`, the progress file with a
     `STATUS:` first line, what to do on every resume, and `keeper unwatch` at the end.
8. **Re-read both files** as the fresh agent would: could it do the job, with only them and the repo? Fix any gap.
9. **Tell the owner:**
   - the two paths;
   - the paste block, unchanged;
   - anything marked UNTESTED;
   - any judgment calls you made.

## Notes

- Do not start the work itself. This skill only writes the prompt.
- Do not copy secrets or personal data into the files. Do not put env file contents in them.
- If the task changes the repo, the goal works in its own worktree and branch, and the owner merges.
- Keep the owner's words for their decisions where you can. They are the source of truth.
