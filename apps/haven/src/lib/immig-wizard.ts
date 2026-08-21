/**
 * Haven's links into ImmigWizard, and the switch that turns them all off.
 *
 * ImmigWizard is a separate product on its own subdomain — a guided flow that
 * walks somebody through visa and green card applications. Haven cross-promoted
 * it from four places: the desktop nav, the mobile nav, the homepage footer, and a
 * marketing card on the homepage offering "guided prep for visa and green card
 * applications".
 *
 * ARCHIVED 2026-08-21, at Yanyan's instruction, over unauthorized practice of law.
 *
 * The exposure is not the existence of a form-filling tool. It is that Haven —
 * which is not a law firm and says so on every page — was routing people from
 * immigration advice into something that helps them decide what to file and how
 * to answer it. Whether that crosses into practising law is a question for a
 * lawyer, and the honest position while it is unanswered is not to send anybody
 * there. The cost of being wrong is asymmetric: the links earn some referrals, and
 * a UPL finding is an existential problem for the whole product.
 *
 * WHAT THIS DOES AND DOES NOT DO
 *
 * It removes Haven's entrances. It does not touch ImmigWizard itself, which lives
 * in a different codebase on a different subdomain and is still reachable by
 * anyone with the URL. Taking that down, or adding a disclaimer to it, is a
 * separate decision on a separate deploy.
 *
 * TO BRING IT BACK: set `IMMIG_WIZARD_ARCHIVED` to false. Every entrance returns.
 * Nothing was deleted, so this is one line in either direction — the same shape as
 * `archived-routes.ts`, and for the same reason: a decision that may be reversed
 * should not require anybody to reconstruct what was removed.
 */

/** The one place the URL is written. It was previously written in two. */
const IMMIG_WIZARD_URL = "https://immig.haven-h1b.com/";

/**
 * Whether Haven links to ImmigWizard at all.
 *
 * Flip to false and the nav item, the mobile nav item, the footer link and the
 * homepage card all come back.
 */
export const IMMIG_WIZARD_ARCHIVED = true;

export const IMMIG_WIZARD_ARCHIVED_ON = "2026-08-21";

export const IMMIG_WIZARD_ARCHIVED_REASON =
  "Possible unauthorized practice of law: Haven is not a law firm, and routing people from immigration advice into guided form preparation may cross the line. Parked pending legal review.";

/**
 * The link, or null when archived.
 *
 * Returns null rather than throwing so every call site degrades to rendering
 * nothing — each one already guarded on a falsy URL, which is why archiving is a
 * single flag rather than four component edits.
 */
export function getImmigWizardUrl(): string | null {
  return IMMIG_WIZARD_ARCHIVED ? null : IMMIG_WIZARD_URL;
}
