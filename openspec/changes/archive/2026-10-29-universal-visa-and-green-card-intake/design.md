# Design

## Context

See `proposal.md` for background and user needs. Currently, `user_profiles` enforces PostgreSQL `enum` types for `visa_type` and `preference_category`. The onboarding flow in `OnboardingFlow.tsx` assumes an H-1B tech worker: Step 1 offers only 7 visa options, Step 2 unconditionally enforces employment fields (employer, job title, H-1B start date, employer size), and Step 3 assumes an employer-sponsored PERM/I-140 pathway.

## Goals / Non-Goals

**Goals:**
- Enable intake of any non-immigrant or immigrant status (visitor, student, work, family, humanitarian, citizen) plus custom user write-ins.
- Prevent non-work or visitor users from being blocked by mandatory employment details.
- Support universal green card pathways (marriage to USC/LPR, family preference, EB-1, EB-2, EB-3, EB-2 NIW, EB-1A, EB-5, humanitarian, diversity lottery, and custom) with accurate stage progression.
- Explicitly capture sponsor attribution (current employer, prior employer, spouse, family member, self-petition, other) to prevent false employer-tying assumptions.
- Maintain complete backwards compatibility with existing user profiles, timeline calculations, and dashboard tracks.

**Non-Goals:**
- Rewriting the core timeline generation engine for non-employment visas (e.g. detailed B-2 6-month stay extensions will show in deadlines and documents, not full H-1B six-year calculators).
- Automating USCIS form generation within Haven (form-filling is owned by `apps/immig-wizard`).

## Decisions

### 1. Database Column Conversion: Enum to Text
- **Decision**: Alter `public.user_profiles.visa_type` and `public.user_profiles.preference_category` from Postgres ENUMs to `text`.
- **Rationale**: Adding new values to Postgres enums (`ALTER TYPE ... ADD VALUE`) cannot run in certain transaction blocks and completely blocks open-ended user write-ins like "G-4", "O-1B", or "Registry". Converting to `text` with default values preserves existing data (`H1B`, `OPT`, etc.) and allows arbitrary strings.
- **Alternatives Considered**:
  - *Keep enums and add a `custom_visa_name` column*: Adds redundant fields and creates ambiguity regarding which column is the source of truth across queries.
  - *Add an 'other' enum value only*: Still requires two columns for any user who types in their status.

### 2. Domain Types: Extensible Literal Unions
- **Decision**: In `apps/haven/src/types/domain.ts`, define standard string literals unioned with `(string & {})` for `VisaType` and `PreferenceCategory`.
- **Rationale**: Provides IDE autocomplete and compile-time safety for known statuses while accepting any custom string without type errors.
- **Alternatives Considered**:
  - *Strict TypeScript enum*: Rejects custom write-ins at compile time.
  - *`string` alone*: Loses autocomplete and type safety across dashboard cards and calculators.

### 3. Categorized Combobox with Typeahead and Write-in
- **Decision**: Replace native `<select>` in Step 1 with a grouped combobox that supports instant search filtering and an explicit `"Other / Not listed"` item that reveals a free-text `<Input>`.
- **Rationale**: A flat dropdown of 30+ visas is unwieldy. Grouping (Visitor, Student, Work, Family, Humanitarian, Resident/Citizen, Other) makes standard options easy to find, while typeahead accelerates selection.

### 4. Adaptive Employment Branching
- **Decision**: Evaluate `visaType` against a set of work-authorized statuses (`H1B`, `L-1A`, `L-1B`, `TN`, `O-1`, `E-3`, `OPT`, `STEM OPT`).
  - If work-authorized: Step 2 displays standard employment fields.
  - If non-work / conditional (e.g. `B-1`, `B-2`, `F-1`, `K-1`, `Visitor`, or `Other`): Step 2 introduces a prominent toggle: *"Are you currently employed in the US?"* If unchecked, employment fields are hidden, and the user progresses to Step 3 without validation errors.
- **Rationale**: Eliminates dead-ends and dummy data entry for visitors, tourists, and family members awaiting EADs.

### 5. Green Card Pathway & Stage Taxonomy
- **Decision**: Structure Step 3 into:
  1. *Green card intent toggle*: (Yes / Not yet)
  2. *Pathway selection*: Family/Marriage, Employer-Sponsored, Self-Petitioned (NIW/EB-1A), Investor, Humanitarian, Diversity Visa, Other.
  3. *Dynamic stage selection*: Stage options filter to match the chosen pathway (e.g., Marriage shows I-130 / I-485 / Consular; Employer shows PERM / I-140 / I-485).
  4. *Sponsor attribution*: Mandatory attribution selection: `Current Employer`, `Prior Employer`, `Self-Petition`, `Spouse`, `Family Member`, or `Other (name)`.
  5. *Priority Date & Retained Sponsor*: Preserves prior approved I-140 details for priority date retention.
- **Rationale**: Reflects real immigration legal structures and enforces Haven's rule against assuming employer ownership of green cards.

## Risks / Trade-offs

- **[Risk] Downstream calculators expecting standard "H1B" string** → **Mitigation**: Helper functions (such as `isH1B(profile.visaType)`) gracefully return false for non-H1B statuses, displaying appropriate generic status cards instead of crashing.
- **[Risk] Free-text status variations (e.g., "b2" vs "B-2")** → **Mitigation**: Standardize on canonical casing in the combobox selection; normalize custom write-ins with trimming.
- **[Risk] Database migration locking table during deploy** → **Mitigation**: `ALTER COLUMN ... TYPE text USING ...::text` on Postgres is an instant metadata operation for enum-to-text without full table rewrite.

## Migration Plan

1. **Migration Execution**: Run Supabase migration altering `user_profiles.visa_type` and `user_profiles.preference_category` to `text`.
2. **Backfill / Compatibility**: Existing records remain identical (`OPT`, `STEM OPT`, `H1B`, etc.).
3. **Rollback Strategy**: The migration is fully non-destructive; if reverted, a script can cast valid enum strings back to the enum type.
