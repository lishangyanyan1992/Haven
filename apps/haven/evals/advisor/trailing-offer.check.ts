/**
 * Offers to do work Haven will not do.
 *
 * "If you want, I can track and summarize the USCIS filing chart each month for
 * your priority date" describes a standing service that does not exist. The
 * conversation ends when the answer does. Somebody who believes a monitor is now
 * running is worse off than before they asked, because the thing they stopped
 * watching has a deadline attached to it.
 *
 * The system prompt forbade this in two different wordings and the model ignored
 * both, which is the whole reason this file exists: at that point the rule stops
 * being a prompt and becomes code.
 *
 * The risk is over-cutting. "If you want to keep working, the transfer has to be
 * filed first" is advice, not an offer, and deleting it would be far worse than
 * the problem being fixed — so the negative cases below carry the weight.
 *
 * Run: npm run check:trailing-offer
 */

export {};

async function main() {
  const { stripTrailingOffer } = await import("@/lib/advisor/service");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const BODY = "Your grace period ends on September 6, 2026.\nConfirm the receipt notice with your employer.";

  // -------------------------------------------------------------- must be cut
  const offers: Array<[string, string]> = [
    [
      "the exact wording from the real answer",
      "If you want, I can:\n- Track and summarize the USCIS filing chart each month for your PD, or\n- Walk through the EB-2 upgrade scenario step-by-step."
    ],
    ["a single-line offer", "If you'd like, I can draft a checklist for your attorney."],
    ["a question form", "Would you like me to list the documents to assemble?"],
    ["want me to", "Want me to go through the change-of-status option in detail?"],
    ["let me know if", "Let me know if you want me to check the next bulletin."],
    ["happy to", "Happy to walk through the timeline if that would help."],
    ["a bare I can", "I can also:\n- monitor the bulletin\n- prepare a filing checklist"]
  ];

  for (const [name, tail] of offers) {
    const result = stripTrailingOffer(`${BODY}\n\n${tail}`);
    const gone = !result.includes(tail.split("\n")[0]);
    const bodyKept = result.includes("September 6, 2026") && result.includes("Confirm the receipt notice");
    check(`${name} is cut`, gone && bodyKept, result);
  }

  // ---------------------------------------------------------- must NOT be cut
  //
  // These are advice. Cutting one deletes the thing the person needed.
  const keeps: Array<[string, string]> = [
    ["a conditional in the middle", "If you want to keep working, the transfer has to be filed first.\n\nYour grace period ends September 6, 2026."],
    ["a conditional at the end", "Your grace period ends September 6, 2026.\n\nIf you want to stay past that date, something has to be filed before it."],
    ["a question to the user", "Your grace period ends September 6, 2026.\n\nWhat was your last day of employment? The date changes the whole answer."],
    ["a plain closing sentence", "Your grace period ends September 6, 2026.\n\nSpeak to an immigration attorney this week."],
    ["a bulleted checklist", "What to do now:\n- Get the receipt notice\n- Confirm your I-94 date"]
  ];

  for (const [name, text] of keeps) {
    const result = stripTrailingOffer(text);
    check(`${name} survives`, result === text, `became:\n      ${result}`);
  }

  // An answer that is nothing but an offer must not become empty — an empty reply
  // is a worse failure than the one being fixed.
  const allOffer = stripTrailingOffer("If you want, I can help with that.");
  check("an answer that is only an offer is left alone", allOffer.length > 0, "it returned empty");

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
