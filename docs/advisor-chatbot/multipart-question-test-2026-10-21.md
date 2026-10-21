# Multi-part question test — 21 Oct 2026

**Question:** Does today's fixed-step Advisor handle questions that ask several things at once, or does it need a planning step?

**Method:**
- 20 real r/h1b layoff posts were paraphrased into chat questions, with 54 separate asks between them.
- Each was run once through the local Advisor with an empty new-user profile and no community database (offline harness).
- Every ask was graded by hand as answered, partly answered or missed.
- Inputs, raw answers and the runner are in the session scratchpad, not committed.

## Result

| | Asks | Share |
|---|---|---|
| Answered | 32 | 59% |
| Partly answered (hedged to "fact-specific, ask counsel") | 11 | 20% |
| Missed | 11 | 20% |

**8 of the 11 misses came from 3 questions that were declined outright** (mp02, mp12, mp15). Each mentioned PERM in passing. Their main asks were in scope: switching to H-4, H-1B transfer while H-4 is pending, and bridging to max-out. The scope rule saw "PERM" and declined the whole message.

On the 17 questions it did answer, 32 of 43 asks were fully answered.

## Findings

1. **Mentioning PERM in passing declines the whole question.** This is the largest failure, at 15% of questions. Fix it in the scope rule: decline only when PERM is the main ask, and otherwise answer the rest and redirect the PERM part in one line. No planner is needed.
2. **The same template appears in every answer.** Each answer repeats the same block: grace-period rule, portability, B-2, depart, premium processing and see counsel. That holds whatever was asked, so answers run 5,000–8,000 characters and the specific answer gets buried. The parts are present but hard to find.
3. **Source gaps:**
   - The $100K H-1B fee is unknown (mp09, mp16).
   - B-2 processing times are missing.
   - Anyone already counted against the cap does not need the lottery again. That rule is missing or muddled in mp14 and mp19, where answers say it "depends on employer type".
4. **It asks "what status are you on?" after the user has said H-1B.** This happened in 9 of 17 answers.
5. **The lawyer directory link points H-1B workers to "Student firms".** This happened in 5 answers.

## Conclusion for the planning idea

The Advisor does not mainly fail multi-part questions by dropping parts. It fails them through:
- a scope rule that is too blunt;
- a template that buries the answer;
- source gaps.

All three are rule or content fixes. A planning step would add latency and a new failure mode without addressing them. Revisit once real traffic exists and the outcome scores show restated or pushed-back rates on multi-part questions.

## Caveats

- There was one grader (Claude) and one run per question.
- There was no community-stories database, so community grounding is under-represented.
- The empty profile means answers could not use the person's own dates.

## Follow-up: PERM aside (same day)

The scope rule changed for questions that name PERM. When the question also carries a strong in-scope signal (a layoff, the grace period, B-2, H-4 or the 240-day rule), it is now answered rather than declined:
- One line above the answer says PERM isn't covered and who to ask.
- The writer is told to leave the PERM part out.

A PERM question with no such signal is still declined. An example is "My employer started PERM… max-out is in March".

Reran mp02, mp12 and mp15. All three now get the aside followed by an answer to their in-scope parts. mp12's main ask is PERM, so its answer still points to counsel on that part, without making any claims.
