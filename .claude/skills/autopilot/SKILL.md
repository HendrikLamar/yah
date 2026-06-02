---
name: autopilot
description: Execute a plan from /plan-feature end-to-end without per-step user approval. Designed for cold start — works after /clear with zero conversation context. Phase 0 locates the plan at .claude/plans/<branch>.md, validates the `status: approved` marker, re-runs pre-flight to detect drift, then runs multi-perspective plan critique → TDD implementation → self code review → security review → browser E2E (for UI) → PR creation → self-merge → summary. Stop only for critical design decisions. Trigger word: /autopilot.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - AskUserQuestion
  - TodoWrite
  - Agent
---

# /autopilot

Execute the plan at `.claude/plans/<current-branch>.md` (or the most recently modified plan if there is no per-branch one) without asking the user questions, except for critical unforeseen design decisions.

The user's mental model: "I approved a plan. I'll see you again at PR merge."

## The autonomy contract — read every time

**You decide silently (no question, just do):**
- Names within established patterns (tests, files, vars, branches)
- File organization within established patterns
- Commit messages and PR titles/bodies
- Minor refactor structure
- Test names and structure
- Error-handling style aligned with existing code
- Whether to run linters, install deps, run tests — just do it
- Choice between two equally-clean approaches when both satisfy the plan

**You stop and ask (use `AskUserQuestion`, ONE batch when possible):**
- A design decision that materially changes scope, data model, or security model not covered by the plan
- A security/privacy boundary discovery not anticipated
- A destructive remote action not implied by the plan (force-push, history rewrite, dropping schema, deleting a branch with unmerged work)
- Strong evidence the plan's premise is wrong (e.g., the data shape isn't what the plan assumed, a dependency doesn't exist)
- A choice between two approaches with significantly different *long-term* implications

**Tiebreaker:** if a question feels obvious in hindsight, stop and ask. If the answer doesn't change the user-visible outcome, decide and proceed.

## The 6 principles (auto-answer routine choices)

Adapted from gstack/autoplan for this project:

1. **Completeness — boil the lake.** AI makes completeness near-free. Ship the whole thing — all edge cases, all states, all the related cleanup. Don't half-build.
2. **Match existing patterns.** If the codebase resolves the question (file org, naming, error handling, query shape), match it. Forking conventions costs more than the gain.
3. **Explicit over clever.** A 10-line obvious fix beats a 50-line abstraction. Pick what a new contributor reads in 30 seconds. Skip abstractions until the third use.
4. **Defense-in-depth on auth/data.** RLS alone is not enough — every account-scoped query also gets explicit `.eq('user_id', user.id)`. Server actions check auth at the top. Trust nothing from the client.
5. **First-time user works.** Any UI path must work for a brand-new user with zero state. Empty states, missing data, no accounts — all real cases.
6. **Browser-verify UI.** Type-checking and unit tests do not verify UI. Any change to a route, form, or rendered component requires a passing Playwright test that exercises the actual flow before PR.

When two principles conflict on a routine choice: pick **completeness + explicit**. When in doubt about whether something IS a routine choice: re-read the autonomy contract above.

## Process — must execute in order

### Phase 0 — Cold-start context recovery

**Assume zero prior conversation context.** This skill is designed to run cleanly after `/clear`. Every fact you need lives in the plan file or the live repo state.

#### 0a. Locate and validate the plan

Run, in this order, and stop on the first failure with the exact remediation message:

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
PLAN=".claude/plans/${BRANCH}.md"
test -f "$PLAN" || { echo "STOP: no plan at $PLAN. Run /plan-feature first."; exit 1; }

# Parse the Handoff block (deterministic key:value lines written by /plan-feature)
STATUS=$(grep -m1 '^status:' "$PLAN" | awk '{print $2}')
PLAN_BRANCH=$(grep -m1 '^branch:' "$PLAN" | awk '{print $2}')
PLAN_SHA=$(grep -m1 '^plan_git_sha:' "$PLAN" | awk '{print $2}')

[ "$STATUS" = "approved" ] || { echo "STOP: plan status is '$STATUS', not 'approved'. Return to /plan-feature, complete review, and let the user approve."; exit 1; }
[ "$PLAN_BRANCH" = "$BRANCH" ] || { echo "STOP: plan was written for branch '$PLAN_BRANCH', currently on '$BRANCH'. Switch branches or re-plan."; exit 1; }

echo "PLAN_OK $PLAN (sha at plan time: $PLAN_SHA)"
```

If any check fails, surface the message verbatim to the user and stop. Do not try to "recover" by guessing.

#### 0b. Read the plan in full

`Read` the entire plan file. Internalize: Goal, Scope, Decisions, Files to create/modify, Data model changes, Test plan, Security checklist, Verification gates, Autonomy notes, Pre-flight snapshot.

The Decisions section is **locked** — do not re-litigate any item in it. The Autonomy notes tell you what to decide silently vs. what to stop on.

#### 0c. Re-run pre-flight and diff against the plan's snapshot

The repo state may have changed since planning (user added creds, ran a migration, another commit landed). Re-run the pre-flight scan and compare against the "Pre-flight snapshot" section in the plan:

```bash
# Current state
git rev-parse --short HEAD
git rev-list --count "$PLAN_SHA..HEAD" 2>/dev/null   # commits added since planning
cut -d= -f1 .env.local 2>/dev/null | grep -v '^#' | grep -v '^$'
grep -cE 'YOUR-PROJECT|your-anon-key|your-service-role-key|replace-with' .env.local 2>/dev/null
for p in 5187; do lsof -nP -iTCP:$p -sTCP:LISTEN >/dev/null 2>&1 && echo "$p BUSY" || echo "$p free"; done
```

If you find drift that affects the plan:
- **Benign drift** (extra commits unrelated to plan files, new env keys that don't matter, port now free): note it in the cold-start summary, proceed
- **Material drift** (plan-relevant files modified since `$PLAN_SHA`, a credential the plan assumed is now missing/changed, schema now applied that the plan expected to apply): STOP and surface to the user with a one-paragraph diff

#### 0d. Cold-start summary (post to user, then proceed)

One short message before the first phase:

> Picking up `<plan-title>` on branch `<branch>` (plan sha `<PLAN_SHA>`, current sha `<HEAD_SHA>`, drift: `<none|details>`). Starting Phase 1 (multi-perspective critique).

#### 0e. Tasks

Use `TodoWrite` to create one todo per major phase below (Phases 1-9). Mark each in_progress as you start it, completed as you finish. Don't batch.

#### 0f. Check for prior autopilot progress on this branch

If commits already exist on this branch beyond `$PLAN_SHA`, autopilot may have been interrupted. Read the commit messages:

```bash
git log --oneline "$PLAN_SHA..HEAD" 2>/dev/null
```

Don't redo work that's already committed. Treat existing commits as "Phase X partially complete" and pick up from the next unfinished phase. If existing commits contradict the plan, that's material drift — go back to 0c and STOP.

### Phase 1 — Multi-perspective plan critique (BEFORE writing code)

Re-read the plan from these perspectives in sequence. You can do this yourself or spawn focused agents (`feature-dev:code-reviewer`, `feature-dev:code-architect`) for the larger ones.

For each perspective, ask: *what would this reviewer flag?* Write findings to `.claude/plans/<branch>-critique.md`.

1. **Code architect** — interfaces clean? Hidden coupling? Over-engineered for current need? Does it match the project's existing patterns (Next.js App Router, server actions, Supabase SSR client, vitest test layout, slim view-data contract in `buildDashboardData`)?
2. **Security** — auth/RLS scoping explicit? user_id checks on every query? RLS policies created for new tables? Input validation at boundary? Secrets handled? No service-role client from client code?
3. **Simplifier** — abstractions justified by current need (not future)? Dead code? Premature generalization? Code-smell from earlier sessions?
4. **UX / first-time user** (only if UI changes) — empty state? Loading state? Error state? Brand-new user with zero accounts works? Mobile viewport not broken?
5. **Devex** — naming honest? Comments only where WHY is non-obvious? PR will be reviewable?

**Outcome:**
- If the critique surfaces only routine fixes: update the plan silently, log the changes in `<branch>-critique.md`, proceed.
- If it surfaces a *critical* gap (matches the autonomy contract's stop-and-ask list): STOP and ask the user.
- If it surfaces a *taste* call (two reasonable options with different long-term cost): pick using the 6 principles, note your reasoning in the critique file, proceed.

### Phase 2 — TDD implementation

Follow `superpowers:test-driven-development` strictly. For each unit of behavior in the plan:

1. **RED** — write the failing test first
2. **Verify RED** — run the test, confirm it fails for the expected reason
3. **GREEN** — minimum code to pass
4. **Verify GREEN** — run again, confirm pass + no regressions in the rest of the suite
5. **REFACTOR** — improve while green

Test placement (project conventions):
- **Pure logic / units**: `src/**/__tests__/*.test.ts` (vitest, env: node)
- **UI flows**: `e2e/*.spec.ts` (Playwright, port 5187)
- **Live-DB integration**: only ad-hoc, in a throwaway file you delete after — don't add network-dependent tests to the committed suite

Run vitest in watch only when iterating; for verification, use `npm test` (vitest run).

### Phase 3 — Browser E2E for UI changes (REQUIRED)

If the change touches any route, form, or rendered component:

- Write a Playwright test in `e2e/<feature>.spec.ts` exercising the actual user flow
- Use `port 5187` (Docker holds 3000/3100). `reuseExistingServer: false` in config — Docker on those ports causes silent test corruption
- Create a throwaway confirmed user via `admin.auth.admin.createUser({ email_confirm: true })`. Cascade-delete in `afterAll`
- Skip cleanly when creds are missing: `const t = hasCreds ? test : test.skip; t('...', ...)`
- **Always test the first-time-user path** (zero accounts, zero prior state) — this is where the import-mode bug hid in this project

Run `npm run test:e2e` and confirm green.

### Phase 4 — Self code review pass

Confidence-filtered review — only flag things you'd defend as real issues. Look for:

- **IDOR / RLS bypass** — every Supabase query against an account-scoped table has explicit `.eq('user_id', user.id)`, not relying solely on RLS
- **Injection at boundaries** — user input validated where it enters the system (size, type, shape)
- **Secrets** — no API keys, JWTs, DB passwords in code, tests, or fixtures
- **Dead code** — unused exports, vars, imports, files
- **Comments** — delete WHAT-comments and current-task-comments; keep only WHY-comments for non-obvious constraints
- **Premature abstraction** — if it's only used once, inline it
- **Backwards-compat shims** for code you control — delete the old thing instead

Fix what you find. If the fix changes the test surface, write the new test first (TDD applies to fixes too).

### Phase 5 — Security review pass

Explicit pass before PR. Use `feature-dev:code-reviewer` agent if the diff is large enough that focused review pays off.

Per change:
- Server actions: `db.auth.getUser()` at top? Returns early if no user? user_id scoping on all writes?
- New tables / columns: migration includes RLS policy? Policy uses `auth.uid() = user_id`?
- New endpoints: cron-secret or auth gate appropriate?
- `.env*` not in the diff? Test fixtures don't embed real secrets?
- Imports from `@/lib/supabase/server`: which export — `createClient` (anon SSR) or `createAdminClient` (service-role)? The latter must NEVER appear in client components or be reachable from a browser request without explicit gating.

### Phase 6 — Verification gates (all must pass)

Run in parallel:
- `npm test` — vitest green
- `npm run typecheck` — clean
- `npm run build` — clean (catches Next.js compile-time issues)
- `npm run test:e2e` — green (if UI changed)

Then:
- Verify DB cleanup: hit the admin users endpoint, expect 0 leftover test users
- `git status` clean apart from intended changes
- `git diff` reviewed for secrets, artifact dirs (`test-results/`, `playwright-report/`, `supabase/.temp/`)

If any gate fails: fix, re-run, do NOT move to PR.

### Phase 7 — PR creation

```bash
# new branch if you're somehow still on main (shouldn't be — plan put you on a feature branch)
git checkout -B feat/<short-slug>

# stage intentionally (no git add -A)
git add <specific files>

# commit with co-author trailer
git commit -m "$(cat <<'EOF'
<type>(<scope>): <short imperative>

<body — the why, 1-3 short paragraphs>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"

# push & open PR
git push -u origin HEAD
gh pr create --base main --title "..." --body "..."
```

PR body structure:
- **Summary** — 1-3 bullets, the *why*
- **Test plan** — what was verified (units, E2E, manual)
- 🤖 footer

Title under 70 chars, scoped, imperative.

### Phase 8 — Self-merge

The `main` branch on this repo has a "protect main" ruleset: no direct push, PR required, `required_approving_review_count: 0`. So you can self-merge:

```bash
gh pr merge <number> --merge --delete-branch
git checkout main && git pull
```

Confirm `origin/main` advanced and local main is in sync.

### Phase 9 — Final summary

One concise message to the user:

- PR link + merge commit SHA
- One-line of what landed
- Anything flagged-but-deferred (with rationale)
- Anything the user needs to do next (e.g., re-run migrations on staging)
- Status: **DONE** / **DONE_WITH_CONCERNS** / **BLOCKED**

Then stop. The next user message starts the next planning cycle.

## Project-specific stop-and-ask list

In addition to the autonomy contract's general rules, ALWAYS stop and ask before:

- Writing a new migration (`supabase/migrations/*.sql`) — confirm tables/columns/RLS scope
- Running `supabase db push` — confirm the user wants schema changes applied to the live project
- Touching `origin/main` outside of merging an open PR (advancing it via direct push, force-push, tag changes)
- Deleting any remote branch with unmerged commits
- Modifying `.env.local` in any way (you should never need to — flag if you think you do)
- Adding a new external dependency that materially expands attack surface (auth libraries, networking)
- Anything in `public/dashboard-*.{js,css,html}` — that view is FROZEN; changes there must be explicit

## Confusion Protocol (high-stakes ambiguity mid-flight)

If during implementation you discover:
- Two plausible architectures for the same requirement
- A pattern contradiction the plan didn't anticipate
- Missing context that would change your approach significantly

STOP. Name the ambiguity in one sentence. Present 2-3 options with concrete tradeoffs. Ask. Don't guess on architectural or data-model decisions.

## Completion status

- **DONE** — all phases passed, PR merged, summary delivered
- **DONE_WITH_CONCERNS** — merged but with non-blocking issues (list them)
- **BLOCKED** — could not complete; state what blocks and what was tried
- **NEEDS_CONTEXT** — discovered something requiring user input mid-flight; state exactly what

## Escalation

It is ALWAYS OK to say "this is too hard for me" or "I'm not confident in this result." Bad work is worse than no work.
- 3 attempts at the same problem without progress → escalate
- Uncertain about a security-sensitive change → escalate
- Scope of work exceeds what you can verify → escalate

## Anti-patterns (stop yourself)

- Asking the user about commit messages, PR titles, branch names — decide
- Asking for permission to run tests, install deps, run linters — just do it
- Asking which file structure to use when existing code makes it obvious
- Re-asking something the plan already settled
- Sliding into "let me just check with you first" mid-flow
- Skipping browser E2E for "small" UI changes — the first-import bug was a small UI change
- Skipping the multi-perspective critique because "the plan looks fine" — that's exactly when bugs hide
- Marking phases done in a batch at the end — mark each one in TodoWrite as you finish it
