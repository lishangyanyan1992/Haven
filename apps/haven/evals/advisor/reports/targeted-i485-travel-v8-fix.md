# Haven Advisor Eval Report

Generated: 2026-07-10T16:03:12.679Z
Dataset: haven-advisor-stage-2-detailed-cases v1
Selection: adv-i485-020
Advisor prompt: haven-advisor-system
Advisor model: gpt-4o-mini
Judge: gpt-5-mini

## Summary

Passed: 1
Warnings: 0
Failed: 0
Total: 1

## PASS adv-i485-020

Category: i140_i485_ead_ap
Risk: critical
Trace: f517806f-481d-42f4-837d-3e6a2a798955
Elapsed: 22776ms

### Question

My I-485, EAD, and advance parole are pending. My H-1B visa stamp expired, but my H-1B status is valid. Can I travel internationally next month?

### Answer

Traveling internationally with a pending I-485, EAD, and advance parole can be risky. Here's what you need to consider:

- **Pending Advance Parole**: Because your advance parole is pending, you cannot rely on it for travel. If you leave the U.S. without approved advance parole, USCIS may treat your I-485 as abandoned.

- **H-1B Status**: Your valid H-1B status does not allow reentry without a valid visa stamp. You generally need a valid H-1B visa stamp to return to the U.S., unless you qualify for automatic visa revalidation or have approved advance parole.

- **Visa Stamp Expiration**: Since your visa stamp is expired, you'll require a new visa to reenter the U.S. or have an approved advance parole before traveling.

### Recommendations:
- **Wait for AP Approval**: Consider not traveling until your advance parole is approved.
- **Evaluate H-1B Stamping**: Consult with your immigration attorney about potentially obtaining a new H-1B visa stamp.
- **Automatic Visa Revalidation**: If applicable, discuss with your attorney whether you might qualify for automatic visa revalidation based on your travel itinerary.

I strongly recommend discussing your specific situation with an immigration attorney to explore all of your options.

I-485 travel safety note: Pending advance parole is not enough by itself for travel; do not travel based only on a pending I-131/AP application. Confirm the reentry strategy with immigration counsel before departure because CBP, consular processing, and abandonment risks are fact-specific.

### Judge

Overall 0.93 | Legal 1.00 | Factual 0.95 | Citations 0.90 | Completeness 0.85 | Actionability 0.85

The answer is accurate, cautious, and legally safe. It distinguishes visa stamp vs. status vs. advance parole, warns that a pending AP is not sufficient and that leaving may result in I-485 abandonment, and correctly advises consulting an attorney. It cites USCIS guidance. Minor gaps include limited detail on exceptions (automatic visa revalidation conditions) and lack of additional authoritative links (e.g., DOS/CBP guidance on visa stamping and reentry).

Issues:
- Could have cited additional authoritative sources (e.g., Department of State guidance on visa stamping and CBP guidance on reentry) to strengthen citation support.
- Gives only a brief reference to automatic visa revalidation without explaining the narrow conditions under which it applies (short trip to Canada/Mexico, excluding certain nationalities, etc.).
- Does not mention potential consular risks when applying for an H-1B visa stamp while an I-485 is pending (though recommending attorney review mitigates this).

Strengths:
- Clearly distinguishes between visa stamp, lawful status, and advance parole/abandonment risk.
- Includes the required caveats: explicitly says pending AP is not enough and advises confirming reentry strategy with counsel.
- Avoids prohibited claims (does not state pending AP is sufficient and does not guarantee reentry).
- Provides practical recommendations (wait for AP approval, consider H-1B stamping, evaluate automatic visa revalidation).

### Checks

- PASS answer-present: Advisor returned answer text.
- PASS disclaimer-present: Answer payload includes legal disclaimer.
- PASS high-risk-review: High-risk answer mentions attorney/counsel/DSO review.
- PASS required-citation: Answer includes 2 citation(s).
- PASS pending-ap-travel-risk: Answer warns that pending advance parole is not the same as approved travel authorization.
- INFO semantic-judge: Not run. Add --judge to score detailed answer traits, caveats, and prohibited claims.

### Citations

- USCIS · USCIS: While Your Green Card Application Is Pending: https://www.uscis.gov/green-card/while-your-green-card-application-is-pending-with-uscis
  - For pending I-485 travel questions, separate a pending Form I-131 request from an already approved advance parole document.
- USCIS · USCIS Policy Manual: Adjustment Filing Instructions: https://www.uscis.gov/policy-manual/volume-7-part-a-chapter-3
  - For a pending I-485 travel question, the key distinction is whether advance parole has already been granted, not merely whether Form I-131 is pending.

