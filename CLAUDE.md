# CLAUDE.md — MediCore Project Constitution

This file is the constitution for this repository. Every Claude Code session
working in this repo must read and follow it before doing any work.


# Session Startup Checklist

Every new session MUST execute these steps before changing code.

1. Read CLAUDE.md

2. Read every file under .ai/

3. Read only the files required for the current task.

4. Verify NEXT.md.

5. Continue exactly from the last checkpoint.

Never restart a completed milestone.

Never ask architectural questions already answered in DECISIONS.md.


---

## Mission

This repository is a production-grade, AI-powered Hospital Management System
(MediCore) — a multi-tenant SaaS platform for hospitals, clinics, and
diagnostic centers.

Code quality, architecture, documentation, testing, and maintainability are
more important than development speed.

- Never implement demo-quality code.
- Never generate placeholder implementations unless explicitly requested.
- Never fake or stub clinical, billing, or auth logic to "make it work" —
  correctness matters more than a green checkmark in a domain where bugs
  affect patient care and money.

---

## Required Startup Workflow

Before making ANY code changes in this repository, read, in order:

1. `CLAUDE.md` (this file)
2. `.ai/PROJECT_CONTEXT.md`
3. `.ai/PROGRESS.md`
4. `.ai/NEXT.md`
5. `.ai/DECISIONS.md`
6. `.ai/TECH_DEBT.md`

Do NOT scan the entire repository unless absolutely necessary — these six
files are the project's source of truth for "what is this, what's done, what's
next, why did we decide that, and what's owed."

---

## Project Memory — `.ai/`

Maintain the `.ai/` directory containing:

- `PROJECT_CONTEXT.md` — what the system is, architecture, modules, stack
- `PROGRESS.md` — what has been built, module by module
- `NEXT.md` — the next logical task(s) to pick up
- `DECISIONS.md` — architectural decision log (ADR-style)
- `TECH_DEBT.md` — deferred work, known shortcuts, follow-ups
- `SESSION_LOG.md` — a running handoff log, newest entry on top
- `MODULE_STATUS.md` — per-module status and completion percentage
- `CHANGELOG.md` — human-readable log of notable changes

These files must always remain synchronized with reality. If code and a
`.ai/` file disagree, treat the code as ground truth and fix the file.


---

## Milestone Completion Checklist

A milestone is COMPLETE only if

✅ Backend implemented

✅ Frontend implemented

✅ Tests written

✅ Unit tests passing

✅ Integration tests passing

✅ Lint passing

✅ Typecheck passing

✅ Build passing

✅ Documentation updated

✅ CHANGELOG updated

✅ PROGRESS updated

✅ SESSION_LOG updated

✅ MODULE_STATUS updated

✅ NEXT updated

✅ Screenshot saved under docs/screens/

Only then may the milestone be marked complete.

---

## Repository Reading Policy

Never scan the entire repository.

Read only

CLAUDE.md

.ai/*

Files directly related to the requested task.

If a task affects Patients,

only inspect

Patients

Database

Shared Types

Relevant APIs

Do not repeatedly inspect unchanged modules.

Minimize token usage.


---

## After Every Completed Task

Update, in the same commit/session as the work:

- `PROGRESS.md`
- `CHANGELOG.md`
- `MODULE_STATUS.md`
- `SESSION_LOG.md`

If the task completes a milestone:

- Update `PROJECT_CONTEXT.md`
- Replace `NEXT.md` with the next logical task

---

## Documentation Rules

- Every architectural decision must be written into `DECISIONS.md`.
- Every deferred feature or shortcut must be written into `TECH_DEBT.md`.
- Every bug discovered (even if not fixed immediately) must be recorded in
  `TECH_DEBT.md` or `SESSION_LOG.md`.
- Every milestone must have a completion summary in `PROGRESS.md`.

---

## Session Handoff

At the end of every session, update `SESSION_LOG.md` with a new entry at the
top containing:

- What was completed
- Files modified
- Architectural decisions made
- Known issues
- Recommended next task
- Estimated project completion percentage (overall + affected modules)

This file must allow a fresh Claude Code session to continue immediately
without re-reading the whole codebase.

---

## Cost Optimization

Never spawn Explore agents unless explicitly requested.

Never spawn more than one subagent.

Prefer direct implementation over repository-wide research.

Reuse .ai documentation instead of rediscovering architecture.

Avoid long planning phases for small tasks.


---

Maximum implementation session:

45–60 minutes

or

One checkpoint

Then stop.

---

## Never Forget

Never re-ask an architecture question that has already been answered.

Before asking the user to make an architectural choice, check
`DECISIONS.md` first. If a decision already exists, follow it — do not ask
again. Only raise it again if new information directly contradicts the
recorded decision, and if so, propose updating `DECISIONS.md` rather than
silently overriding it.

---

## Screenshots

Whenever a user-facing milestone is completed (a working UI flow/feature):

- Take screenshots of the completed feature
- Store them under `docs/screens/`
- Update `PROJECT_CONTEXT.md` with links to the relevant screenshots

---

## Testing — Definition of Done

No task is considered complete until all of the following pass:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (and `pnpm test:e2e` where relevant)
- `pnpm build`
- Documentation updated (`.ai/` files as above)
- `PROGRESS.md` updated
- `SESSION_LOG.md` updated

If any step cannot be run (e.g. no browser available for a UI check), say so
explicitly instead of claiming the feature works.

---

## Project Completion Tracking

Maintain, at all times, in `MODULE_STATUS.md` and `PROJECT_CONTEXT.md`:

- An overall project completion percentage
- A completion percentage for every module
- Each module's state: **Completed / In Progress / Blocked / Deferred / Planned**

Never lose project state between sessions — if in doubt, over-document in
`.ai/` rather than relying on memory of a previous conversation.
