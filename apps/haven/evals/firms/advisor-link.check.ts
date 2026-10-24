/**
 * Which firm invited the person the advisor is answering (specs/advisor-attorney-handoff).
 *
 * The lookup has three answers and the handoff depends on telling them apart:
 * a firm client is sent back to their firm, someone with no firm keeps the
 * directory, and an unknown answer must show neither. The case that matters
 * most is the last one: a failed lookup that came back as "none" would show a
 * firm's own client the directory of its competitors.
 *
 * Runs against a stub database. No network, no keys.
 *
 * Run: npm run check:advisor-firm-link
 */

export {};

type Result = { data: unknown; error: { message: string } | null };
type Tables = Record<string, Result | (() => Result)>;

/** Enough of the query builder for the lookup: every chain ends in maybeSingle(). */
function stubDb(tables: Tables) {
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        maybeSingle: async () => {
          const entry = tables[table];
          if (!entry) return { data: null, error: null };
          return typeof entry === "function" ? entry() : entry;
        }
      };
      return chain;
    }
  };
}

async function main() {
  const { getAdvisorFirmLink } = await import("@/lib/firms/advisor-link");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // Keep the expected console.error from a failed lookup out of the output.
  const quiet = async <T>(fn: () => Promise<T>) => {
    const original = console.error;
    console.error = () => {};
    try {
      return await fn();
    } finally {
      console.error = original;
    }
  };

  const clientRow = { data: { id: "fc-1", firm_id: "firm-1", pipeline_status: "consultation_scheduled" }, error: null };
  const firmRow = { data: { name: "Rivera Immigration Law" }, error: null };

  const firm = await getAdvisorFirmLink("user-1", stubDb({ firm_clients: clientRow, firms: firmRow }));
  check(
    "firm client: firm, name, stage",
    firm.kind === "firm" &&
      firm.firmName === "Rivera Immigration Law" &&
      firm.firmId === "firm-1" &&
      firm.firmClientId === "fc-1" &&
      firm.pipelineStatus === "consultation_scheduled",
    JSON.stringify(firm)
  );

  const none = await getAdvisorFirmLink("user-2", stubDb({ firm_clients: { data: null, error: null } }));
  check("no firm_clients row: none", none.kind === "none", JSON.stringify(none));

  const failedClient = await quiet(() => getAdvisorFirmLink("user-3", stubDb({ firm_clients: { data: null, error: { message: "timeout" } } })));
  check("client lookup error: unknown, not none", failedClient.kind === "unknown", JSON.stringify(failedClient));

  const thrown = await quiet(() =>
    getAdvisorFirmLink(
      "user-3",
      stubDb({
        firm_clients: () => {
          throw new Error("network down");
        }
      })
    )
  );
  check("client lookup throws: unknown", thrown.kind === "unknown", JSON.stringify(thrown));

  const failedFirm = await quiet(() => getAdvisorFirmLink("user-4", stubDb({ firm_clients: clientRow, firms: { data: null, error: { message: "denied" } } })));
  check("firm name lookup error: unknown", failedFirm.kind === "unknown", JSON.stringify(failedFirm));

  const missingFirm = await quiet(() => getAdvisorFirmLink("user-4", stubDb({ firm_clients: clientRow, firms: { data: null, error: null } })));
  check("client row pointing at an unreadable firm: unknown, not none", missingFirm.kind === "unknown", JSON.stringify(missingFirm));

  const noStage = await getAdvisorFirmLink(
    "user-6",
    stubDb({ firm_clients: { data: { id: "fc-6", firm_id: "firm-1", pipeline_status: null }, error: null }, firms: firmRow })
  );
  check("missing stage reads as new lead", noStage.kind === "firm" && noStage.pipelineStatus === "new_lead", JSON.stringify(noStage));

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
