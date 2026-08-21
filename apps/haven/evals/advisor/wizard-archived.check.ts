/**
 * Haven's entrances into ImmigWizard, and that they are all shut.
 *
 * Archived 2026-08-21 over possible unauthorized practice of law: Haven is not a
 * law firm and says so on every page, and it was routing people from immigration
 * advice into a flow that helps them decide what to file and how to answer it.
 *
 * There were four entrances — desktop nav, mobile nav, homepage footer, homepage
 * card — and the URL was written down in two files. Four separate edits would have
 * meant four places for one to be missed or to creep back. They now share a single
 * switch, and this asserts that: both that the switch is off, and that nothing has
 * grown its own copy of the link since.
 *
 * The check is written so that turning the wizard back on flips it cleanly rather
 * than requiring the test to be deleted.
 *
 * Run: npm run check:wizard-archived
 */

export {};

async function main() {
  const { getImmigWizardUrl, IMMIG_WIZARD_ARCHIVED, IMMIG_WIZARD_ARCHIVED_REASON } = await import("@/lib/immig-wizard");
  const fs = await import("node:fs");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // ------------------------------------------------------------- one link, one place
  //
  // The URL used to live in two components. A second copy is how one entrance
  // survives an archive: it is not wired to the switch, so nothing turns it off.
  const read = (relative: string) => fs.readFileSync(new URL(relative, import.meta.url), "utf8");
  const surfaces = [
    "../../src/components/app/public-navbar.tsx",
    "../../src/components/app/mobile-public-nav.tsx",
    "../../src/components/app/marketing-feature-previews.tsx",
    "../../src/app/page.tsx"
  ];
  for (const path of surfaces) {
    check(
      `${path.split("/").pop()} does not hold its own copy of the URL`,
      !/immig\.haven-h1b\.com/.test(read(path)),
      "a hardcoded link is back, and the switch will not reach it"
    );
  }

  // The one place it is allowed to appear.
  check(
    "the URL lives in the switch module",
    /immig\.haven-h1b\.com/.test(read("../../src/lib/immig-wizard.ts")),
    "the link is not where it should be"
  );

  // ------------------------------------------------------------------ the switch
  if (IMMIG_WIZARD_ARCHIVED) {
    check("no link is produced while archived", getImmigWizardUrl() === null, String(getImmigWizardUrl()));
    check(
      "the reason is recorded, not just the flag",
      /unauthorized practice of law/i.test(IMMIG_WIZARD_ARCHIVED_REASON),
      IMMIG_WIZARD_ARCHIVED_REASON
    );
  } else {
    check("un-archiving produces a link again", (getImmigWizardUrl() ?? "").startsWith("https://"), String(getImmigWizardUrl()));
  }

  // Every entrance guards on a falsy URL, which is what makes one flag enough. If
  // somebody adds an entrance that does not, this is the line that should have
  // caught it — so it checks the guard rather than the rendering.
  const navbar = read("../../src/components/app/public-navbar.tsx");
  const homepage = read("../../src/app/page.tsx");
  const previews = read("../../src/components/app/marketing-feature-previews.tsx");
  check("the desktop nav renders nothing without a link", /immigWizardUrl \?/.test(navbar), "no guard found");
  check("the footer renders nothing without a link", /immigWizardUrl \?/.test(homepage), "no guard found");
  check(
    "the homepage card is removed entirely, not left with a dead button",
    /if \(!immigWizardUrl\) return null;/.test(previews),
    "the card still renders when the wizard is archived"
  );

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
