# Haven Advisor Eval Report

Generated: 2026-07-10T14:46:07.461Z
Dataset: haven-advisor-stage-2-detailed-cases v1
Selection: adv-h1b-layoff-001
Advisor prompt: haven-advisor-system production v5
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
Trace: f22c98e7-83d3-45cb-96c6-f96a71b49f36
Elapsed: 28574ms

### Question

I was laid off on June 12, 2026. My last paycheck is June 28, and my H-1B I-94 expires March 15, 2027. A startup wants to file my H-1B transfer but says they need three weeks. Can I stay in the U.S. while they prepare it, and when can I start working?

### Answer

You have a 60-day grace period after your layoff on June 12, 2026, which allows you to remain in the U.S. until August 11, 2026, or until your I-94 expiration on March 15, 2027, whichever comes first. However, note that **LCA preparation alone does not preserve status**. 

You **cannot work until the new employer files a nonfrivolous H-1B petition on your behalf**. If they need three weeks for preparation and have not filed the petition within your grace period, you should consider other options immediately. 

**Safety points**:
- **Do not work without authorization**
- **LCA preparation alone does not preserve status**

If you're nearing the end of your grace period without a filed petition, consider:
- Immediate H-1B filing/receipt strategy
- Possible change of status, such as B-2 if appropriate
- Departure planning if no timely filing is possible
- Premium processing or employer escalation if available
- Immediate counsel review

Confirm your exact deadline and filing strategy with immigration counsel to ensure you stay compliant.

### Judge

Overall 0.88 | Legal 0.90 | Factual 0.88 | Citations 0.95 | Completeness 0.85 | Actionability 0.82

The answer is generally accurate and cautious: it distinguishes ability to remain in the U.S. from ability to work, correctly cites the 60‑day layoff (grace) period and H‑1B portability principle, warns that LCA preparation alone does not preserve status, and advises consulting counsel. It avoids prohibited guarantees and tells the user not to work until an employer files a nonfrivolous H‑1B petition. A few important eligibility nuances and timing clarifications are missing or could be stated mo

Issues:
- Overly definitive phrasing about having a 60‑day grace period without noting eligibility limits (e.g., discretionary aspects, limits such as one 60‑day period per authorized validity period or other exclusions).
- Does not explicitly state the common nuance that an H‑1B beneficiary may begin working for the new employer upon proper filing (receipt) of a nonfrivolous petition — the answer implies it but could state the filing/receipt‑based start rule 
- Does not address possible ambiguity about the effective 'termination date' (employer termination date vs. last paycheck) which can affect the 60‑day calculation — this is an important factual detail for the user to confirm with counsel or e
- The USCIS citation is to an archived page; while still useful, the answer could note that guidance can change and cite the current USCIS/DHS pages or regulations for the most up‑to‑date rules.
- Could mention additional eligibility considerations that affect whether filing within the grace period preserves status (for example, being otherwise in lawful status at time of filing).

Strengths:
- Clearly distinguishes staying in the U.S. (grace period) from work authorization.
- Includes the required caveat to confirm exact dates with immigration counsel.
- Avoids prohibited claims (does not guarantee approval or say the user can work while employer only prepares the filing).
- Cites authoritative sources (eCFR/USCIS) for grace-period and portability concepts.

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

