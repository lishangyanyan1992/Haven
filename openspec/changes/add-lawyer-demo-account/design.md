# Design

## Context

See proposal.md for motivation and problem statement. What exists in the codebase today:
- The firm dashboard (`src/app/firm/page.tsx`, `src/lib/firms/clients.ts`) reads client lists from `firm_clients` and urgency ranking from `rankUrgency(answers, now)`.
- Client documents are read from `user_documents` and `haven-vault` bucket via `firmDocumentUrl(firmId, firmClientId, documentId)`, which generates a 5-minute signed URL.
- `evals/firms/isolation.check.ts` enforces strict firm isolation: all firm data functions must take `firmId` and filter by `.eq("firm_id", firmId)`. Firm id must come strictly from `requireFirmMember()`.
- Client statuses (`email_sent`, `signed_up`, `in_progress`, `finished`) and urgency tiers (`urgent`, `soon`, `later`, `unknown`) are computed dynamically on each page load.

## Goals / Non-Goals

**Goals:**
- Provide a full 50-lead dataset that renders immediately with authentic legal details, correct urgency countdowns, and diverse visa types.
- Ensure all countdowns and days-left values stay fresh on demo day by anchoring dates relative to runtime/seeding time.
- Provide clickable sample PDFs on 6-8 showcase leads to demonstrate document vault integration.
- Ensure the in-app "Reset demo data" action is strictly gated to demo firms, passing firm isolation checks without risking production data.
- Display client full names on dashboard tables and client detail views.

**Non-Goals:**
- Creating 50 real auth.users records (only the 6-8 showcase leads need auth.users to support document vault FK relationships).
- Building an admin dashboard UI for managing demo accounts (CLI tooling via `firm-admin.ts` is sufficient).
- AI or dynamic lead generation (use deterministic, hand-crafted realistic personas for consistent storytelling).

## Decisions

### Decision 1: Database marker `firms.is_demo`
Add `is_demo boolean not null default false` to the `firms` table via migration `0037_demo_firm.sql`.
- *Rationale*: A database column allows `requireFirmMember()` to return `isDemo: boolean` directly from membership. Any reset action can enforce `if (!membership.isDemo) throw new Error(...)` alongside `.eq("firm_id", membership.firmId)`.
- *Alternative considered*: Environment variable listing demo firm IDs. Rejected because it introduces deployment synchronization friction and multi-environment fragility.

### Decision 2: Hybrid lead model (Showcase leads vs. Lightweight leads)
- For 6-8 showcase leads: create deterministic demo users (`demo-client-1@example.invalid` … `demo-client-8@example.invalid`) with `user_profiles` and uploaded specimen PDFs in `haven-vault`. Attach their `user_id` to `firm_clients`.
- For the remaining ~42 leads: leave `user_id = null`. Populate `firm_clients` with rich `shared_answers` JSON and timestamps.
- *Rationale*: Avoids polluting auth and storage tables with 50 phantom users while ensuring every key demo showcase scenario (e.g. reviewing an RFE notice or I-797) works seamlessly.

### Decision 3: Relative date offsets for deterministic urgency
Store dates in `src/lib/firms/demo.ts` as relative day offsets from a base date `T0`:
- e.g., `agencyDeadlineOffset: +6` (Urgent, RFE response due in 6 days)
- e.g., `lastWorkDayOffset: -48` (Urgent, laid off 48 days ago, grace period ends in 12 days)
- e.g., `statusEndDateOffset: +65` (Soon, status ends in 65 days)
- *Rationale*: Whenever the CLI seed command or in-app reset button executes, it computes `new Date(now.getTime() + offset * 86400000)` so countdowns are always crisp and meaningful on the day of the demo.

### Decision 4: Client names via `shared_answers.fullName`
Add `"fullName"` to `SHARED_ANSWER_KEYS` in `src/lib/firms/answers.ts`. Update `listFirmClients` to set `displayName = answers.fullName || row.normalized_email`.
- *Rationale*: `FirmDashboardPage` already supports rendering `client.displayName` with `client.email` underneath if they differ. This makes the lead table immediately look like a real law practice client book.

### Decision 5: Gated in-app reset action
Add `resetDemoFirmAction()` in `src/server/firm-actions.ts`.
- Calls `requireFirmMember()`, verifies `membership.isDemo`, and invokes `resetDemoFirm(membership.firmId, new Date())`.
- Re-anchors dates, resets `reviewed_at = null` on unreviewed finished leads, and calls `revalidatePath("/firm")`.
- *Rationale*: One click before a live pitch restores the dashboard to pristine demo condition without opening a terminal.

## Risks / Trade-offs

- **[Demo files in haven-vault bucket]** → Specimen files are stored under deterministic paths like `demo-firm/sample-rfe.pdf` and attached to demo users; cleanup script in firm-admin ensures they can be removed with the firm.
- **[Accidental reset on real firms]** → Both the UI button and server action enforce `is_demo === true`. The reset function strictly scopes updates to `firm_id = membership.firmId` and asserts the firm is marked demo.
- **[Isolation check compliance]** → All demo database functions take `firmId` and filter with `.eq("firm_id", firmId)`, satisfying `evals/firms/isolation.check.ts`.
