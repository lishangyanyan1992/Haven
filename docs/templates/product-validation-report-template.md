<!--
HOW TO USE THIS TEMPLATE
This is the output format for an automated UAT run: "execute the UAT plan against
the live product and tell me if it's ready to launch." It is a short executive
verdict, not the full test log — the full case-by-case results stay in the UAT
tracker spreadsheet (e.g. docs/advisor-chatbot/advisor-uat-tracker.xlsx). This
report exists to answer one question fast: GO or NO-GO, and why.

Workflow to produce one:
1. Pull the PRD and UAT plan for the product being validated.
2. Execute the UAT plan's test cases against the live/staging product (browser
   automation, API calls, or manual walkthrough — whatever the product needs).
3. Log every result in the full tracker (Pass/Fail/Severity/Actual Result/Trace ID).
4. Fill this template using ONLY the tracker's results — do not invent outcomes.
   - Section 2 shows the launch-blocking failures: any Critical or High severity
     defect (S1/S2 in Haven's severity scale), or any failure of a test case tied
     to a "must pass" / release-gate acceptance criterion. One sub-block per
     failure, worst first. If there are zero qualifying failures, say so plainly
     and list the total cases executed and passed instead of an empty table.
   - Section 3's verdict is mechanical, not a judgment call: if any Section 2
     failure exists, the verdict is NO-GO. GO requires zero open Critical/High
     defects, full pass on any group the UAT plan marks release-blocking, and
     the primary KPI's measurement plan intact. Use CONDITIONAL-GO only if the
     UAT plan itself defines a conditional-launch path (e.g. "ship behind a
     flag") — do not invent one.
5. Delete this comment block from the delivered report.
-->

# Product Validation Report

**[Product Name] ([MVP / release version]) | [Company / Project]**

## 1. The Foundation: PRD Summary

[3–5 sentences: what the product does, who it's for, what's explicitly in vs.
out of scope for this release, and the primary KPI it's judged against. Pull
this directly from the PRD's Problem Statement, Non-Goals, and Success Metrics
sections — don't paraphrase from memory.]

## 2. The Findings: Critical Failure Analysis

[One block per launch-blocking failure — Critical/High severity, or any failure
of a release-gate acceptance criterion from the UAT plan. Worst first. If none,
replace this section with: "No Critical or High-severity defects found. X of Y
test cases executed; Z passed. [Any lower-severity issues, in one line, with a
pointer to the tracker.]"]

**Test Case:** [The exact scenario tested, in the user's words if adversarial —
e.g. an out-of-scope or edge-case prompt, not just the happy path.]

| | |
|---|---|
| **Expected Result** | [What the PRD/UAT acceptance criterion required.] |
| **Actual Result** | [What actually happened — exact bot/product output, not a summary.] |

**Why this is critical:** [Which specific UAT acceptance criterion or release
gate this violates, and the real-world consequence if shipped as-is — user
trust, safety, legal exposure, KPI impact. Tie it to language in the PRD/UAT
plan, don't assert severity from vibes.]

[Repeat the Test Case / Expected / Actual / Why-critical block for each
qualifying failure.]

## 3. The Verdict: Launch Recommendation

> ## [GO / NO-GO / CONDITIONAL-GO]
>
> [One paragraph: the recommendation and its direct basis — which defect(s)
> from Section 2 drive it, or confirmation that the release gate was fully met.
> Name what must happen before a NO-GO can flip to GO: fix + retest which
> specific case(s).]

**Basis for validation:** [Name the exact PRD and UAT Plan documents used, with
paths/links.]
