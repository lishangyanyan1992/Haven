# Proposal

## Why

Today `/settings` mixes system preferences (email notifications) with case intake fields, shows two redundant green card editors on the same page ("Green card journey" single-card fields and the multi-petition "Green cards" editor), and scatters what Haven knows about the user across three disconnected surfaces: profile/petition fields in `/settings`, document-extracted facts in `/documents`, and chat-remembered facts ("What Haven remembers", such as a layoff date stated in chat) at the bottom of `/advisor`. Users also have no way to manually add freeform facts or case context to permanent memory, and lawyers cannot see the client's remembered facts or manual case notes on the firm client dashboard.

## What Changes

- **Separate "Your Info" (`/profile`) from "Settings" (`/settings`).** Add a dedicated "Your Info" destination in the main navigation (`/profile`) that holds all case, visa, green card, document-extracted, and memory information, while narrowing `/settings` strictly to system and email notification preferences. Deep links to `/settings#case-details` and `/settings#green-cards` are updated to point to `/profile`.
- **Combine "Green card journey" into the unified "Green cards" editor.** Remove the redundant single-card "Green card journey" form section. Structure "Your Info" around two core immigration sections — **Current Visa & Employment** (current visa status, status end date, employer, job title, H-1B start date, employer size, country of birth, primary goal, spouse status, and lawyer help needed) and **Green Cards Filed** (`GreenCardEditor` for every employer-sponsored or self-petitioned green card). If a profile has legacy flat green card fields (`permStage`, `i140Filed`, `i140Approved`, `i485Filed`, `priorityDate`, `greenCardSponsor`, or `retainedPriorityDateSponsor`) without corresponding `immigrantPetitions` entries, synthesize or seed them into the unified green card list so no existing case data is hidden or lost, and keep flat profile columns synchronized from the green card list on save.
- **Unify case memory in "Your Info" with manual case notes.** Bring "What Haven remembers" (`advisor_remembered_facts`), manual case notes (user-authored facts/notes about their case), and a summary of facts extracted from uploaded documents (`document_facts`) into "Your Info". Users can manually add new facts/notes to their permanent memory and remove any remembered fact or note from either "Your Info" or `/advisor`.
- **Feed unified memory into both Advisor chat and the Lawyer Dashboard.** Manually added case notes and chat-remembered facts stored in `advisor_remembered_facts` are carried into Advisor prompts (`renderFactsForPrompt`) and displayed in a dedicated **Case Memory & Client Notes** section on the lawyer's client detail page (`/firm/clients/[id]`). Removing a memory immediately hides it from both Advisor context and the lawyer view.

## Capabilities

### New Capabilities
- `case-info-workspace`: Separation of the client's case information workspace (`/profile`, "Your Info" in navigation) from system preferences (`/settings`), combining visa/employment basics and a single unified Green Cards editor while retiring the duplicate "Green card journey" form.
- `unified-case-memory`: Unified display and management of chat-remembered facts, manually entered case notes, and document-extracted facts in "Your Info", with automatic feeding into both the Advisor prompt context and the firm lawyer dashboard.

### Modified Capabilities
None.

## Impact

- **Navigation & Routes**: `apps/haven/src/components/app/app-shell-nav.tsx` (add "Your Info" `/profile` alongside "Settings" `/settings`), new `apps/haven/src/app/profile/page.tsx`, simplified `apps/haven/src/app/settings/page.tsx` (system/email preferences only).
- **Green Card Consolidation**: `apps/haven/src/lib/petitions.ts`, `apps/haven/src/lib/petition-save.ts`, `apps/haven/src/components/app/green-card-editor.tsx`, and `apps/haven/src/server/actions.ts` (seed legacy flat green card fields into `GreenCardEditor` when `immigrantPetitions` is empty, expand category/type options to cover all pathways, and synchronize flat profile columns from `GreenCardEditor`).
- **Unified Memory & Manual Case Notes**: `apps/haven/src/lib/advisor/memory.ts`, `apps/haven/src/app/api/advisor/memory/route.ts` (support `POST` / server action for manually adding `note` facts alongside chat-extracted facts), new `apps/haven/src/components/app/case-memory-card.tsx` shared on `/profile` and `/advisor`.
- **Lawyer Dashboard**: `apps/haven/src/lib/firms/clients.ts` and `apps/haven/src/app/firm/clients/[id]/page.tsx` (load active `advisor_remembered_facts` for the client and display them in a "Case Memory & Client Notes" panel).
- **Cross-App Links**: Update `/settings#case-details` and `/settings#green-cards` references in `apps/haven/src/lib/dashboard-consistency.ts`, `apps/haven/src/lib/document-facts/describe.ts`, `apps/haven/src/lib/immigration-journey.ts`, and `apps/haven/src/server/field-source-actions.ts` to `/profile`.
