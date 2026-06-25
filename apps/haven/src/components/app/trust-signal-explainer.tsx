// Single source of truth for how the "Trust signal" is described to users.
// Mirrors the scoring in scripts/legal-directory/build.mjs (trustScore). Used in
// the directory card tooltip and the firm detail page.
//
// Uses only phrasing elements (<span> with block display) — never <p>/<ul>/<li> —
// so it can be safely nested inside an inline tooltip or a <p> caption without
// producing invalid HTML / hydration errors.

const FACTORS = [
  "Bar-verified license (with no public discipline)",
  "AILA membership",
  "Client review volume and rating",
  "Profile completeness"
];

export function TrustSignalExplainer() {
  return (
    <span className="block">
      <span className="block font-medium text-[var(--haven-ink)]">How the trust signal (0–100) is set</span>
      <span className="mt-1 block">A relative prioritization score that adds points for:</span>
      <span className="mt-1.5 block">
        {FACTORS.map((factor) => (
          <span className="block pl-3 -indent-2 before:content-['•_']" key={factor}>
            {factor}
          </span>
        ))}
      </span>
      <span className="mt-1.5 block">
        Higher means a stronger verified track record — it is not legal advice or an endorsement.
      </span>
    </span>
  );
}
