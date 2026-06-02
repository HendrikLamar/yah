# yah — Claude routing

This project uses a strict two-phase workflow for non-trivial changes: plan-first, then autonomous execution.

## Workflow skills (project-local, in `.claude/skills/`)

When the user's request matches one of these, invoke it via the Skill tool. A false positive (running a workflow the user didn't strictly need) is cheaper than a false negative (going off-script on a feature build).

- **New feature, bug fix needing investigation, refactor across multiple files** → invoke `/plan-feature` (gathers all clarifying questions up front, writes a plan to `.claude/plans/<branch>.md`, hands off to `/autopilot`)
- **The user invokes `/autopilot`** or says "implement this", "go ahead", "build it" with an approved plan in `.claude/plans/<branch>.md` → invoke `/autopilot` (executes plan-critique → TDD → security review → browser E2E → PR → self-merge, no per-step approvals)

The handoff between the two is the plan file. The recommended flow is `/plan-feature` → `/clear` → `/autopilot`. Autopilot is designed for **cold start**: it locates the plan deterministically by current git branch, validates the `status: approved` marker, re-runs pre-flight to detect drift since planning, and proceeds — no conversation context required.

If the request is trivial (one-line edit, typo, comment tweak, pure question, exploration), answer directly — don't invoke the workflow skills.

## Autonomy contract

`/autopilot` is **strict autonomy** by design. It decides routine things (names, file org, commit messages, PR titles, test structure within existing patterns) without asking. It only stops the user for:

- Critical design decisions not anticipated in the plan
- Security/privacy boundary discoveries
- Destructive remote actions not implied by the plan
- Evidence the plan's premise is wrong

If the model is tempted to ask "is this OK?" mid-autopilot for anything else, that's a signal to re-read the autonomy contract in `.claude/skills/autopilot/SKILL.md` — not a signal to ask.

## Project conventions (the skills assume these)

- **Stack:** Next.js 14 App Router (TypeScript) + Supabase (Postgres + Auth + RLS) + Playwright + vitest
- **Money:** integer cents in DB and logic; only the view layer converts to EUR
- **Dev port:** 5187 (Docker holds 3000 and 3100 on this machine)
- **Test layout:**
  - Pure logic: `src/**/__tests__/*.test.ts` (vitest, env: node)
  - UI flows: `e2e/*.spec.ts` (Playwright)
- **Main branch:** the `protect main` ruleset requires a PR (0 approvals needed, model self-merges)
- **Frozen UI:** `public/dashboard-*.{js,css,html}` is the approved view — never modify without explicit user instruction
- **Defense-in-depth on data:** every account-scoped Supabase query has explicit `.eq('user_id', user.id)`, never relying solely on RLS
