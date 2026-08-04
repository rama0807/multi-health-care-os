# NEXT.md

> The next logical task(s) to pick up. Replaced (not appended) whenever a
> milestone completes — this file always describes "start here," not history.

## Immediate Next Task

**Milestone 15 — AI Features**, per `docs/roadmap.md`. Milestone 14
(Staff & Attendance) is now fully complete — backend, frontend, tests,
docs all done, all verification green. Do not re-implement or
re-verify anything from Milestone 14.

### Scope, per `docs/roadmap.md`

- Provider abstraction layer (OpenAI + Anthropic adapters)
- Prompt management system (DB-stored, versioned)
- Lab report PDF → text extraction → AI summarization
- Prescription image OCR → structured data extraction
- Voice recording → Whisper transcription → SOAP note extraction
- Appointment scheduling chatbot (streaming)
- AI usage tracking per org
- Frontend: AI features in context (summary panel, OCR review, chatbot
  widget)

### What's already in the repo — verify before assuming either way

A quick look (not a full audit — do that first) found:
- `apps/api/src/modules/ai/` already exists (controller/service/module)
  — check whether it's a no-op scaffold (the standing precedent in this
  repo before every AI-adjacent milestone) or something real.
- **This milestone is genuinely credential-blocked** in this
  environment: no `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` (real values —
  `apps/api/.env` currently holds placeholder `sk-xxxxxxxxxxxx`-style
  strings), and prior sessions have consistently disclosed rather than
  faked AI features for exactly this reason (see TECH_DEBT TD-0015
  SMS, TD-0018 lab-report AI summarization, TD-0019 image
  interpretation/PACS). Read `TECH_DEBT.md` for the full list before
  starting, and raise the credential question with the user rather
  than fabricating provider responses.
- Every prior milestone in this repo found an unaudited pre-existing
  scaffold that shaped the actual design (`Medication`→`Drug`,
  `MedicalRecord`→`Encounter`, `Ward`/`Bed`/`Admission`, `Staff`) —
  check whether any AI-related schema/enum already exists
  unaudited before designing new models.
- Lab report PDFs (`laboratory` module), prescription images
  (`StorageService`-backed uploads on `Prescription`/encounter
  attachments), and voice recordings (no existing upload path — would
  be new) are the three real input sources named above; read each
  relevant module's existing PDF/attachment generation before deciding
  how AI summarization/OCR would plug in, rather than inventing a
  parallel storage path.

### Process reminders (from `CLAUDE.md`)

- Per the repository reading policy: this task touches a new `ai`
  module plus read-only integration points into Laboratory,
  Prescriptions, Appointments, and Organizations (for per-org usage
  tracking). Do not re-scan Staff/Attendance/Inventory/IPD/Billing
  beyond reading one page as a UI-pattern reference if needed.
- Run full verification before calling any task done: `pnpm lint &&
  pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build`. The test
  DB containers are named `medicore-postgres`/`medicore-redis` (mapped
  to host ports 5434/6381 per `apps/api/.env`) — start them with
  `docker start medicore-postgres medicore-redis`, not `docker compose
  up`, which creates a *different*, unmapped container pair.
- If real AI provider credentials are genuinely unavailable, disclose
  the gap explicitly (mirroring TD-0015/TD-0018/TD-0019/TD-0027)
  rather than fabricating a response — ask the user whether to build
  the full pipeline against a real key they'll provide, stub the
  provider-adapter interface only, or defer the feature entirely.
