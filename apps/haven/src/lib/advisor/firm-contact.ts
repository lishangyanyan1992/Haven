import { advisorAnswerPayloadSchema } from "@/lib/advisor/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * "Let [firm] know" — a firm's client asking that firm to get in touch
 * (specs/firm-contact-requests).
 *
 * The browser sends one thing: which answer the button sat under, by its trace
 * id. Everything else is read on the server:
 *
 *   - the offer, from that answer as it was stored for this user, so the firm
 *     receives exactly the dates and questions the person was shown and nothing
 *     they typed;
 *   - the firm, from this user's firm_clients row, so a request can only ever go
 *     to the firm that invited them.
 *
 * Nothing here records which answer or conversation a request came from. A
 * lawyer reading a request has no path back to the chat.
 *
 * Trusting the stored answer depends on users being unable to write one: only
 * the server inserts advisor_messages (migration 0045), and
 * evals/firms/contact-requests.check.ts keeps it that way.
 */

export type ContactRequestResult =
  | { status: "sent"; sentAt: string }
  | { status: "already_sent"; sentAt: string }
  | { status: "unavailable"; reason: "not_found" | "no_offer" | "no_firm" | "error" };

const UNIQUE_VIOLATION = "23505";

function db(override?: unknown) {
  return (override ?? createSupabaseAdminClient()) as any;
}

/** The firm_clients row for this user, or null. */
async function clientRowFor(client: any, userId: string): Promise<{ id: string; firm_id: string } | null> {
  let query = client.from("firm_clients").select("id, firm_id").eq("user_id", userId);
  if (typeof query.order === "function") {
    query = query
      .order("joined_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  }
  if (typeof query.limit === "function") {
    query = query.limit(1);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function openRequestFor(client: any, firmClientId: string): Promise<{ created_at: string } | null> {
  const { data, error } = await client
    .from("firm_contact_requests")
    .select("created_at")
    .eq("firm_client_id", firmClientId)
    .is("handled_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function sendFirmContactRequest(userId: string, traceId: string, dbOverride?: unknown): Promise<ContactRequestResult> {
  const client = db(dbOverride);
  try {
    const { data: message, error } = await client
      .from("advisor_messages")
      .select("answer_payload")
      .eq("user_id", userId)
      .eq("role", "assistant")
      .filter("retrieval_metadata->>traceId", "eq", traceId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!message) return { status: "unavailable", reason: "not_found" };

    const payload = advisorAnswerPayloadSchema.safeParse(message.answer_payload);
    const offer = payload.success ? payload.data.firm_contact_offer : undefined;
    if (!offer) return { status: "unavailable", reason: "no_offer" };

    const firmClient = await clientRowFor(client, userId);
    if (!firmClient) return { status: "unavailable", reason: "no_firm" };

    const inserted = await client
      .from("firm_contact_requests")
      .insert({
        firm_id: firmClient.firm_id,
        firm_client_id: firmClient.id,
        practice_area: offer.practiceArea,
        dates: offer.dates,
        questions: offer.questions
      })
      .select("created_at")
      .single();

    if (inserted.error) {
      // One open request per client, enforced by the database.
      if (inserted.error.code === UNIQUE_VIOLATION) {
        const open = await openRequestFor(client, firmClient.id);
        if (open) return { status: "already_sent", sentAt: open.created_at };
      }
      throw new Error(inserted.error.message);
    }
    return { status: "sent", sentAt: inserted.data.created_at };
  } catch (error) {
    console.error("[advisor] contact request failed", error);
    return { status: "unavailable", reason: "error" };
  }
}

/**
 * Whether this user already has an open request with their firm. Asked by the
 * button when it renders, so a reloaded answer reflects what the firm has done
 * since, not what was true when the answer was written.
 */
export async function getOpenFirmContactRequest(userId: string, dbOverride?: unknown): Promise<{ sentAt: string | null }> {
  const client = db(dbOverride);
  try {
    const firmClient = await clientRowFor(client, userId);
    if (!firmClient) return { sentAt: null };
    const open = await openRequestFor(client, firmClient.id);
    return { sentAt: open?.created_at ?? null };
  } catch (error) {
    console.error("[advisor] contact request status failed", error);
    return { sentAt: null };
  }
}
