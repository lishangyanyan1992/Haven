// California State Bar adapter.
//
// CalBar's attorney *detail* page is server-rendered HTML we can parse reliably:
//   https://apps.calbar.ca.gov/attorney/Licensee/Detail/{barNumber}
// It contains a "License Status Changes" table whose current row ends in
// "Present", plus any disciplinary/administrative actions.
//
// The brittle part is name -> bar number (CalBar's search results load via AJAX),
// so this adapter is keyed on a known bar number. enrich.mjs captures a
// `barNumberHint` from the firm's own website ("State Bar No. 123456"), which is
// the most reliable source. Name-only firms fall back to manual verification.
//
// Defensive by design: anything ambiguous returns null (=> needsManualVerify)
// rather than a false "verified / clean record".

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const DETAIL_BASE = "https://apps.calbar.ca.gov/attorney/Licensee/Detail";

const STATUS_STRINGS = ["Not Eligible to Practice Law", "Inactive", "Active"];
// Specific disciplinary OUTCOMES that mean the record is not a clean standing.
// Deliberately excludes generic phrases like "disciplinary action" that appear
// in the page's explanatory legend text (which would false-positive everyone).
const DISCIPLINE_MARKERS = [
  "Disbarred",
  "Suspended",
  "Interim suspension",
  "Public Reproval",
  "Resigned with charges pending"
];

// Extract just the License Status Changes <table>…</table> element — NOT the
// heading/legend paragraph before it, which mentions "disciplinary actions".
function statusChangesTable(html) {
  const headingIdx = html.search(/license status changes/i);
  if (headingIdx === -1) return "";
  const rest = html.slice(headingIdx);
  const open = rest.search(/<table/i);
  if (open === -1) return "";
  const afterOpen = rest.slice(open);
  const close = afterOpen.search(/<\/table>/i);
  return close === -1 ? afterOpen : afterOpen.slice(0, close + "</table>".length);
}

// Parse current standing from the table: the present row (date range ending
// "Present") carries the current status.
function parseCurrentStatus(table) {
  const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    if (/present/i.test(row)) {
      for (const status of STATUS_STRINGS) {
        if (row.includes(status)) return status;
      }
    }
  }
  // Fallback: first explicit status token anywhere in the table.
  for (const status of STATUS_STRINGS) {
    if (table.includes(status)) return status;
  }
  return null;
}

function hasDiscipline(table) {
  return DISCIPLINE_MARKERS.some((marker) => new RegExp(marker.replace(/\s+/g, "\\s+"), "i").test(table));
}

export async function lookupByBarNumber(barNumber) {
  const num = String(barNumber).replace(/\D/g, "");
  if (!num) return null;

  const res = await fetch(`${DETAIL_BASE}/${num}`, {
    headers: { "User-Agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) return null;
  const html = await res.text();

  // Guard: make sure we actually landed on a licensee record, not an error page.
  if (!/license status/i.test(html)) return null;

  const table = statusChangesTable(html);
  if (!table) return null;

  const status = parseCurrentStatus(table);
  if (!status) return null;

  return {
    barNumber: num,
    status,
    noDiscipline: !hasDiscipline(table)
  };
}

// firm.barNumberHint comes from enrich.mjs (scanned off the firm's own site).
export async function ca(firm) {
  if (!firm.barNumberHint) return null;
  const result = await lookupByBarNumber(firm.barNumberHint);
  // Only treat an Active license as a positive verification.
  if (!result || result.status !== "Active") return null;
  return result;
}
