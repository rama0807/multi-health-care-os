# MODULE_STATUS.md

> Per-module status and completion percentage. Status values: **Completed /
> In Progress / Blocked / Deferred / Planned**. Update after every completed
> task; percentages are estimates of real implementation depth (code +
> tests + docs), not just "folder exists."

## Overall Project Completion: unaudited (folders scaffolded for full domain surface; depth not yet verified — see TECH_DEBT TD-0001)

## Backend (`apps/api/src/modules/`)

| Module | Status | Completion | Notes |
|---|---|---|---|
| auth | In Progress | Unaudited | JWT guard, CSRF guard, permissions guard present |
| users | In Progress | Unaudited | |
| roles | In Progress | Unaudited | Superseded in part by permissions module (ADR-0003) |
| organizations | In Progress | Unaudited | Multi-tenancy root entity likely |
| hospitals | In Progress | Unaudited | |
| departments | In Progress | Unaudited | |
| staff | In Progress | Unaudited | |
| doctors | **Completed** | **100% for Checkpoint 4.1** | CRUD, professional profile, linked-user onboarding, search/filters, dashboard stats (now includes availability stats), `/me`, per-doctor audit timeline (`GET /doctors/:id/audit-timeline`). Unit + e2e tests passing. |
| scheduling | **Completed** | **100% for Checkpoint 4.2** | Weekly schedules, leave management, availability engine, dashboard availability stats, doctor documents (upload/list/delete) — all implemented, tested (unit + e2e), and browser-verified 2026-07-31. Milestone 4 is now fully complete — see `NEXT.md` for Milestone 5. |
| patients | In Progress | Unaudited | |
| appointments | **Completed** | **100% for Milestone 5** | Conflict-aware booking, full status state machine, available-slots endpoint (reuses `AvailabilityService`), email confirmation, own-scope permission for doctors, audit integration, walk-in flow, recurring appointments. Unit + e2e tests passing, browser-verified 2026-08-01. SMS confirmations explicitly deferred (credential-blocked, not faked) — see `TECH_DEBT.md`. Milestone 5 is now fully complete — see `NEXT.md` for Milestone 6. |
| medical-records | **Completed** | **100% for Checkpoint 6.1** | Encounter (OPD/Teleconsultation/Follow-up/Emergency/Walk-in, status state machine), append-only versioned Clinical Notes, Vitals (with server-computed BMI + cross-encounter trend query), Diagnoses (primary/secondary/differential + ICD-10 placeholder), Procedures, Attachments (reuses `StorageService`). REST + Swagger + RBAC (own/all-scope) + audit integration + pagination/filtering on the list endpoint. Unit + e2e tests passing, browser-verified 2026-08-01. |
| prescriptions | **Completed** | **100% for Checkpoint 6.2** | Prescription CRUD from an encounter (reuses the pre-existing `Prescription`/`PrescriptionItem` models, `status` converted to a proper enum), basic bundled drug-interaction check (non-blocking, see TECH_DEBT TD-0016), PDF generation (`pdfkit`), own/all-scope RBAC, audit integration. Unit + e2e tests passing, browser-verified 2026-08-01. **Milestone 6 (Clinical: Medical Records) is now fully complete** — see `NEXT.md` for Milestone 7. |
| laboratory | **Completed** | **100% for Milestone 7** | Lab test catalog (numeric + text reference ranges), lab order creation from an encounter, sample collection tracking, structured per-item result entry with server-computed abnormal flagging, external report upload + structured system-generated PDF, own/all-scope RBAC, audit integration. Unit + e2e tests passing, browser-verified 2026-08-02. AI-powered lab report summarization explicitly deferred (credential-blocked, not faked) — see `TECH_DEBT.md` TD-0018. **Milestone 7 is now fully complete** — see `NEXT.md` for Milestone 8. |
| radiology | **Completed** | **100% for Milestone 8** | Radiology catalog (name/code/category/modality/body part/contrast/price/duration), order creation from an encounter, scheduling (date/time/room/machine/technician/radiologist/duration), versioned reports (clinical indication/technique/findings/impression/recommendations) with verify → release workflow, image/external/DICOM-placeholder attachments, structured system-generated PDF, own/all-scope RBAC (Doctor own-scoped, new Radiology Technician role all-scoped), dashboard stats, audit integration. Unit + e2e tests passing, browser-verified 2026-08-02. AI image interpretation and real PACS/DICOM integration explicitly out of scope by instruction (see `TECH_DEBT.md` TD-0019). **Milestone 8 is now fully complete** — see `NEXT.md` for Milestone 9. |
| pharmacy | **Completed** | **100% for Milestone 9** | Drug catalog (one row per batch — generic/brand name, strength, dosage form, manufacturer, batch, expiry, price, tax, active, current/reserved/available stock, min stock, reorder level), dispensing workflow (Pending → Preparing → Ready → Dispensed, plus Cancelled/Returned) with dispense/partial-dispense/complete-dispense/reject/cancel actions, medicine returns (restocks + audits), all-scope RBAC (`pharmacy.*`, staff-facing like billing), pagination/filtering/sorting, audit integration, dashboard stats. Completing a dispense reuses `PrescriptionsService.updateStatus` to mark the source prescription `COMPLETED`. Unit + e2e tests passing, browser-verified 2026-08-02. **Milestone 9 is now fully complete** — see `NEXT.md` for Milestone 10. |
| inventory | In Progress | Unaudited | General (non-drug) inventory — now its own Milestone 12, deferred |
| billing | **Completed** | **100% for Milestone 10** | Charge Engine (reusable `Charge` entity, any clinical module can bill via `sourceModule`/`sourceId`), service catalog with pricing, invoice creation (manual line items and/or sweeping pending charges), discount workflow (flat/percentage, `billing.manage`-gated approval), GST tax calculation, multi-mode payments (cash/card/UPI/NEFT/RTGS/cheque) with split/partial support, refunds (partial/full, same approval workflow as discounts), invoice/receipt PDFs (QR disclosed as a placeholder — no payment gateway configured), auto-invoice generation from a completed appointment, revenue dashboard. All-scope RBAC on `billing.*`, audit integration, pagination/filtering. Unit + e2e tests passing, browser-verified 2026-08-03. **Milestone 10 is now fully complete** — see `NEXT.md` for Milestone 11 (Insurance Management). |
| insurance | In Progress | Unaudited | Explicitly out of scope for Milestone 10 — now Milestone 11, deferred |
| notifications | In Progress | Unaudited | |
| audit | In Progress | Unaudited | Listener + service present |
| ai | In Progress | Unaudited | Controller/service/module present |
| health | In Progress | Unaudited | Likely health-check endpoint |

## Backend — Common (`apps/api/src/common/`)

| Component | Status | Notes |
|---|---|---|
| JWT auth guard | In Progress | `guards/jwt-auth.guard.ts` |
| Permissions guard/service | In Progress | Has spec tests (`permissions.guard.spec.ts`, `permissions.service.spec.ts`) |
| CSRF guard | In Progress | Has spec test (`csrf.guard.spec.ts`) |
| Email module/service/templates | In Progress | |
| Redis module/service | In Progress | |
| Audit (decorators/filters/interceptors) | In Progress | |
| Staff onboarding (`common/onboarding/`) | **Completed** | Generic `StaffOnboardingService` — creates/links a `User` + role in a caller-owned transaction; role-agnostic by design so Nurse/Pharmacist/Lab Tech/Receptionist modules reuse it as-is. Has unit tests. |

## Frontend (`apps/web`)

| Area | Status | Notes |
|---|---|---|
| Doctors pages (`dashboard/doctors/*`) | **Completed** | List (search/filter/sort/bulk-deactivate/stats), multi-step registration form w/ draft recovery, profile page (editable + live stats) with 5 additional tabs: Schedule, Leave, Availability, Documents, Audit. Browser-verified 2026-07-31 — screenshots in `docs/screens/`. |
| Appointments page (`dashboard/appointments`) | **Completed** | Day-view queue (date nav, doctor/status filters, inline status actions, Walk-in/Recurring badges) + booking dialog (patient search, live available-slot chips, recurring-booking toggle) + walk-in quick-book dialog. Browser-verified 2026-08-01 — screenshots in `docs/screens/`. |
| Medical records pages (`dashboard/medical-records/*`) | **Completed** | List/"Patient Timeline" page (patient/doctor/status filters, weight-trend chart, recent-prescriptions panel, recent-lab-orders panel, new-encounter dialog) + encounter detail page (SOAP-style tabs: Subjective/clinical-notes-with-autosave-and-version-history, Objective/vitals-with-BMI-trend, Assessment/diagnoses, Plan/procedures, Prescriptions/multi-item-form-with-interaction-warnings-and-PDF-download, Lab Orders/catalog-or-ad-hoc-order-form-with-result-entry, Attachments). Browser-verified 2026-08-02 — screenshots in `docs/screens/`. |
| Laboratory page (`dashboard/laboratory`) | **Completed** | Org-wide lab order queue (doctor/status/priority filters, inline sample-collection and result-entry actions) + a catalog-management dialog (add/deactivate catalog tests, numeric and/or text reference range). Browser-verified 2026-08-02 — screenshots in `docs/screens/`. |
| Radiology pages (`dashboard/radiology/*`) | **Completed** | Dashboard (today's/pending-reporting/completed/cancelled/urgent stat tiles + recent urgent studies), Orders queue (doctor/status/priority filters, inline start/complete actions), Catalog management page, Order detail page (Scheduling/Report/Attachments tabs — schedule/reschedule, start/complete study, versioned report editor with verify/release, image + external/DICOM-placeholder attachment upload, PDF download). Plus a Radiology tab on the encounter detail page and a "Recent imaging" panel on the patient timeline. Browser-verified 2026-08-02 — screenshots in `docs/screens/`. |
| Pharmacy pages (`dashboard/pharmacy/*`) | **Completed** | Dashboard (pending/ready/dispensed-today/low-stock/expiring-medicines tiles + pending-prescriptions panel), Catalog page (add-batch form, low-stock/expiring badges, activate/deactivate), Dispensing queue (status filter, New-dispense dialog picking an active prescription, inline complete action), Dispense detail page (batch selection per item, prepare → ready → partial/complete-dispense actions, reject/cancel with reason, returns section), Stock page (search/low-stock/expiring filters, inline stock adjustment). Plus a "Dispense" button on the encounter's Prescriptions tab. Browser-verified 2026-08-02 — screenshots in `docs/screens/`. |
| Billing pages (`dashboard/billing/*`) | **Completed** | Dashboard (today's revenue/pending invoices/outstanding balance/refunds-today tiles, pending-approval banner, 7-day collection-trend bar chart), Invoices list + New-invoice dialog (patient search, pending-charge sweep checklist, manual line-item builder) + detail page (line items, discount request/approve/reject, finalize/cancel, payment/refund actions, PDF download), Payments list (receipt download), Refunds list (approve/reject for `billing.manage` holders). Browser-verified 2026-08-03 — screenshots in `docs/screens/`. |
| App Router structure (`app/`) | In Progress | Unaudited (excluding doctors, above) |
| Shared components (`components/`) | In Progress | Unaudited |
| Providers / middleware | In Progress | `middleware.ts` present |
| Design system (`packages/ui`) | In Progress | Unaudited |

## Shared Packages

| Package | Status | Notes |
|---|---|---|
| `@medicore/database` | In Progress | Prisma-based, has db:generate/migrate/push/seed/studio scripts |
| `@medicore/types` | In Progress | Unaudited |
| `@medicore/config` | In Progress | Unaudited |
| `@medicore/ui` | In Progress | Unaudited |

## Infra / Ops

| Item | Status | Notes |
|---|---|---|
| CI (`.github/workflows/ci.yml`) | In Progress | Not yet verified end-to-end (TD-0002) |
| Docker (dev + prod compose) | In Progress | Unaudited |
| `infra/` | Planned/In Progress | Unaudited |

---

**Next step:** Run the audit described in `NEXT.md` and replace every
"Unaudited" cell above with a verified status and real completion percentage.
