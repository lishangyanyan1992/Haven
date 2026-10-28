import type { FirmPipelineStatus } from "@/lib/firms/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Which firm, if any, invited the person the advisor is answering.
 *
 * This is the client side of the firm link, keyed by the signed-in user rather
 * than by a lawyer's firm, so it lives apart from the firm dashboard data in
 * clients.ts. It reads only the firm_clients row for this user and the firm's
 * name. Whether a contact request is already open is asked separately by the
 * button that sends one, so a reloaded answer never shows a stale state.
 *
 * Three answers, not two. "unknown" is what a failed lookup returns, and the
 * handoff treats it differently from "none": a person who may be a firm client
 * must never be shown the public directory, because that hands a firm's lead to
 * its competitors. Losing the directory link for a minute costs someone without
 * a firm very little.
 *
 * Read on every message, never cached: the firm can move someone to contract
 * signed at any moment, and the handoff's wording has to follow.
 */
export type AdvisorFirmLink =
  | {
      kind: "firm";
      firmId: string;
      firmName: string;
      firmClientId: string;
      pipelineStatus: FirmPipelineStatus;
    }
  | { kind: "none" }
  | { kind: "unknown" };

export async function getAdvisorFirmLink(
  userId: string,
  // Tests pass a stub; production always uses the service-role client.
  dbOverride?: unknown
): Promise<AdvisorFirmLink> {
  const db = (dbOverride ?? createSupabaseAdminClient()) as any;
  try {
    let clientQuery = db
      .from("firm_clients")
      .select("id, firm_id, pipeline_status")
      .eq("user_id", userId);
    if (typeof clientQuery.order === "function") {
      clientQuery = clientQuery
        .order("joined_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    }
    if (typeof clientQuery.limit === "function") {
      clientQuery = clientQuery.limit(1);
    }
    const { data: client, error } = await clientQuery.maybeSingle();
    if (error) throw new Error(error.message);
    if (!client) return { kind: "none" };

    const firm = await db.from("firms").select("name").eq("id", client.firm_id).maybeSingle();
    if (firm.error) throw new Error(firm.error.message);
    // A client row pointing at a firm we cannot read is not "no firm".
    if (!firm.data?.name) return { kind: "unknown" };

    return {
      kind: "firm",
      firmId: client.firm_id,
      firmName: firm.data.name,
      firmClientId: client.id,
      pipelineStatus: (client.pipeline_status ?? "new_lead") as FirmPipelineStatus
    };
  } catch (error) {
    console.error("[advisor] firm link lookup failed", error);
    return { kind: "unknown" };
  }
}
