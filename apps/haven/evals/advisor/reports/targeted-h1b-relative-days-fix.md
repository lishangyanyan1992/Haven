# Haven Advisor Eval Report

Generated: 2026-07-10T15:24:06.541Z
Dataset: haven-advisor-stage-2-detailed-cases v1
Selection: adv-h1b-layoff-001
Advisor prompt: haven-advisor-system production v6
Advisor model: gpt-4o-mini
Judge: gpt-5-mini

## Summary

Passed: 1
Warnings: 0
Failed: 0
Total: 1

## PASS adv-h1b-layoff-001

Category: h1b_layoff_grace_period
Risk: high
Trace: 03a5131b-0157-4f30-aa4a-93aad5013448
Elapsed: 34097ms

### Question

I was laid off on June 12, 2026. My last paycheck is June 28, and my H-1B I-94 expires March 15, 2027. A startup wants to file my H-1B transfer but says they need three weeks. Can I stay in the U.S. while they prepare it, and when can I start working?

### Answer

You can remain in the U.S. for up to 60 days after your layoff, until either this period ends or your H-1B I-94 expires on March 15, 2027, whichever comes first. However, **do not work without authorization**, and **LCA preparation alone does not preserve status**. 

The startup's H-1B transfer petition must be filed before the 60-day grace period ends. You may start working once they properly file the nonfrivolous petition. Since your layoff was on June 12, you must ensure the petition is filed by early August to stay within the grace period.

Consider discussing the situation with an immigration attorney immediately to confirm your options and filing strategy. They can help ensure you meet the necessary deadlines.

H-1B safety note: If June 12, 2026 is the employment-termination date, the 60-day grace period would point to about August 11, 2026; the March 15, 2027 I-94 date does not extend the grace period beyond 60 days. If the new employer cannot file Form I-129 before day 60, ask counsel immediately about change of status, departure planning, possible consular return, premium processing or employer escalation, and receipt-notice timing. Confirm the exact grace-period deadline and filing strategy with immigration counsel immediately.

### Judge

Overall 0.91 | Legal 0.90 | Factual 0.95 | Citations 0.90 | Completeness 0.90 | Actionability 0.88

The answer is accurate, cautious, and cites regulatory and USCIS sources. It correctly distinguishes authorized stay (60-day grace period) from work authorization, gives a concrete filing deadline estimate (about Aug 11, 2026), and warns that work cannot start until a proper nonfrivolous H-1B petition is filed. The response includes the required caveats to consult counsel and avoids prohibited guarantees about approval or permitting work while the employer merely prepares paperwork.

Issues:
- Slightly overconfident wording about when the user can start working: while portability generally permits beginning employment when a nonfrivolous I-129 is filed, that outcome depends on meeting all portability conditions (including that th
- The answer assumes June 12 is the employment-termination date; in some cases the official termination date can differ (e.g., last day worked vs. last paycheck). The response does advise counsel review but could have emphasized confirming th
- One citation is to an archived USCIS page; while helpful, a direct, current USCIS policy guidance (or a clear quote from the eCFR) would strengthen support. Some quoted phrasing attributed to regulations is somewhat simplified and might not

Strengths:
- Clearly distinguishes remaining in the U.S. (60-day grace period) from permission to work and explicitly warns against unauthorized employment.
- Gives a concrete deadline estimate (60 days from the layoff date) and computes the approximate calendar cutoff (about Aug 11, 2026).
- Recommends immediate consultation with an immigration attorney and mentions practical options (premium processing, consular return) if the new employer cannot timely file.
- Provides relevant citations to DHS/eCFR and USCIS material on H-1B portability and the nonimmigrant grace period.

### Checks

- PASS answer-present: Advisor returned answer text.
- PASS disclaimer-present: Answer payload includes legal disclaimer.
- PASS high-risk-review: High-risk answer mentions attorney/counsel/DSO review.
- PASS required-citation: Answer includes 3 citation(s).
- INFO semantic-judge: Not run. Add --judge to score detailed answer traits, caveats, and prohibited claims.

### Citations

- DHS/eCFR · 8 CFR 214.2: H-1B Portability: https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/subpart-A/section-214.2
  - 8 CFR 214.2 describes H-1B portability: an eligible H-1B worker may start new employment when a nonfrivolous H-1B petition for new employment has been filed, or on the requested start date, whichever is later.
- USCIS · USCIS Options for Nonimmigrant Workers Following Termination of Employment: https://www.uscis.gov/archive/options-for-nonimmigrant-workers-following-termination-of-employment-0
  - USCIS says eligible H-1B workers may be able to begin new employment after a new employer properly files a nonfrivolous H-1B petition, subject to portability requirements and case-specific facts.
- DHS/eCFR · 8 CFR 214.1: Nonimmigrant Grace Period: https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/subpart-A/section-214.1
  - Unless separately authorized, the worker may not work during the grace period. A layoff answer should separate remaining in the United States from permission to work.

