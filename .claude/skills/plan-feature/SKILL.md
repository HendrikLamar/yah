---
name: plan-feature
description: Use at the start of any non-trivial feature, bug fix, or refactor. Runs a pre-flight scan, front-loads ALL clarifying questions (especially critical design decisions), writes a plan to .claude/plans/<branch>.md, and hands off to /autopilot. Trigger word: /plan-feature.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - TodoWrite
---

# /plan-feature

The output of this skill is a concrete plan that `/autopilot` will execute end-to-end without further questions, except for unforeseen *critical* design decisions. Front-load every question that could change the implementation now — it is far cheaper than stopping mid-build.

## When to use

- New feature work
- Bug fixes that need investigation
- Refactors that touch multiple files or change interfaces
- Any task where the user said "implement X" without prior alignment

**Don't use for:** one-line edits, pure questions, exploration where the user is in the driver's seat.

## Process (must run in this order)

### 1. Pre-flight scan (silent — no questions yet)

Gather state *before* asking anything. Bundle the commands in parallel Bash calls.

```bash
# git state
git status --short
git rev-parse --abbrev-ref HEAD
git log --oneline -5
git rev-list --count origin/main..HEAD 2>/dev/null   # commits ahead of main
git fetch origin --quiet 2>/dev/null
git rev-list --count origin/main..main 2>/dev/null   # is local main itself unpushed?

# branch protection (PR-only for main is enforced)
gh api repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/rulesets --jq '.[] | select(.enforcement=="active") | .name' 2>/dev/null

# env shape (NEVER print values — only key names + placeholder check)
cut -d= -f1 .env.local 2>/dev/null | grep -v '^#' | grep -v '^$'
grep -cE 'YOUR-PROJECT|your-anon-key|your-service-role-key|replace-with' .env.local 2>/dev/null

# Supabase reachability + schema (using anon key only, read-only)
# (write a small node script if credentials are present; skip if not)

# Port conflicts — Docker often grabs 3000/3100; we use 5187 for dev
for p in 3000 3100 5187; do lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1 && echo "$p BUSY" || echo "$p free"; done

# Test infra present?
ls node_modules/.bin/vitest node_modules/.bin/playwright 2>/dev/null
test -f playwright.config.ts && echo "playwright configured"
```

Read the relevant existing code to understand current patterns. Use `Grep` / `Read` for targeted lookups; spawn the `Explore` agent if scope is genuinely unclear (3+ targeted queries needed).

Record blockers in a mental list — they go FIRST in the question batch:
- Missing or placeholder credentials in `.env.local`
- Unapplied schema migrations
- Local `main` diverged from `origin/main`
- Test infrastructure missing for the kind of change planned
- Dev port unavailable

### 2. One batch of questions

Use **one** `AskUserQuestion` call (multiple questions allowed) — no drip-feeding. Group by topic:

1. **Blockers first** — anything from pre-flight that needs the user's hand
2. **Critical design decisions** — anything that, if wrong, forces a rewrite later. Data model shape. Security boundary. UX flow forks. Backwards-compatibility scope.
3. **Scope** — what's in, what's out, what's explicitly deferred
4. **Success criteria** — what does "done" look like, concretely (specific assertions, not "it works")

Apply the *Confusion Protocol* (from gstack): only stop for high-stakes ambiguity. If the answer doesn't change the user-visible outcome, decide yourself in step 3 instead.

When you ask, follow the format:
- **Re-ground** in one sentence: project, branch, what you're about to plan
- **Recommend** the option you'd pick, in 1 line, with reason
- **Options** lettered, each with a concrete description (not jargon)

### 3. Write the plan

Write to `.claude/plans/<branch>.md`. Use this exact structure — `/autopilot` reads it on a **cold start** with no conversation history, so it MUST be fully self-contained. Every locked decision, file path, and constraint goes IN the file. Do not assume the next session remembers anything.

```markdown
# Plan: <one-line title>

## Handoff
<!-- /autopilot greps this block. Do not rename keys or sections. -->
status: draft
branch: <git-branch-name>
base: main
created: <YYYY-MM-DD>
plan_git_sha: <git rev-parse --short HEAD at plan time>

## Goal
One paragraph. What changes for the user, why now.

## Scope
- In: ...
- Out: ...
- Deferred: ...

## Decisions (locked — `/autopilot` will not re-ask)
- <decision>: <chosen option>. Reason: <why>.
- ...

## Files to create / modify
- `path/to/file.ts` — <what changes, one line>
- ...

## Data model changes (if any)
- Migration: `supabase/migrations/<NNNN>_<slug>.sql` — <what it does>
- RLS policies: <which tables, which `auth.uid()` scope>
- Backfill or seed needed? <yes/no, details>

## Test plan
- **Unit (vitest):** <list of test cases to write TDD-style>
- **Integration:** <if any, against live DB with throwaway user>
- **E2E (Playwright):** <UI flows to exercise — REQUIRED for any UI change>
- **Edge cases:** first-time user (zero state), error states, empty states

## Security checklist
- [ ] Server actions check auth at top
- [ ] Every account-scoped query has explicit `.eq('user_id', user.id)`
- [ ] New tables have RLS policy `auth.uid() = user_id`
- [ ] Inputs validated at boundary (size, type, shape)
- [ ] No secrets in code, tests, or fixtures

## Verification gates (must pass before PR)
- [ ] `npm test` — vitest green
- [ ] `npm run typecheck` — clean
- [ ] `npm run build` — clean
- [ ] `npm run test:e2e` — green (if UI changed)
- [ ] DB cleanup verified (no leftover test users via admin API)
- [ ] `git diff` — no secrets, no artifact dirs staged

## Autonomy notes for /autopilot
What `/autopilot` is allowed to decide silently:
- <e.g., test names, file org within existing patterns, commit messages, PR title>

What `/autopilot` MUST stop and ask about:
- <project-specific examples beyond the default Confusion Protocol>

## Pre-flight snapshot (recorded at plan time — /autopilot diffs against current state)
- Git: HEAD `<sha>`, branch `<branch>`, clean/dirty: <status>
- `.env.local` keys present: <comma-separated key names>, placeholders remaining: <count>
- Supabase schema state: tables present: <list>, missing: <list>
- Dev port 5187: <free/busy>
- Branch protection on main: <enforcement summary>
```

### 4. Plan review

Show the user the plan path and ask one question via `AskUserQuestion`: approve / refine / cancel. Iterate until approved.

Once they explicitly approve, **flip the status marker**:

```bash
sed -i '' 's/^status: draft$/status: approved/' .claude/plans/<branch>.md
git -C "$(git rev-parse --show-toplevel)" rev-parse --short HEAD  # confirm plan_git_sha is still current
```

The status flip is the contract: `/autopilot` will refuse to run on a `draft` plan. Don't flip it until the user actually says approve.

### 5. Handoff (designed to survive `/clear`)

Tell the user verbatim:

> "Plan approved and recorded at `.claude/plans/<branch>.md` (status: approved). The plan is fully self-contained — you can `/clear` to free context, then type `/autopilot` in a fresh session. Autopilot will cold-start: locate the plan by current branch (`<branch>`), validate the approval marker, re-run the pre-flight scan to detect any drift since planning, and execute end-to-end. You will not hear from me again until the PR is merged, unless a critical design decision surfaces."

Then stop. **Do not start implementing in this skill.**

If the user asks "should I clear?" — say yes if you've finished a substantial planning conversation (large context). A clear before autopilot gives the implementation phase a fresh, focused context window.

## The Confusion Protocol (when to stop and ask, even now)

Stop and ask the user during planning if you encounter:
- Two plausible data models for the same requirement with materially different long-term cost
- A request that contradicts an existing pattern and the right precedent isn't obvious
- A destructive remote operation in the plan's scope (force-push, history rewrite, dropping data)
- Missing context that would change your approach significantly

For routine choices (naming, minor file org, test structure within existing patterns), **decide** using the principles in `/autopilot`.

## Completion status

End with one of:
- **DONE** — plan written, approved, handoff message given
- **BLOCKED** — pre-flight surfaced a blocker the user must resolve; state what and what was tried
- **NEEDS_CONTEXT** — the user's prompt is too sparse to even draft questions; state what you need

## Anti-patterns

- Asking questions in two waves ("I'll get back to you with more questions")
- Skipping pre-flight and discovering blockers mid-plan
- Writing a plan with vague scope ("clean up auth")
- Starting to implement during planning
- Asking about decisions the existing codebase already resolves (read it first)
