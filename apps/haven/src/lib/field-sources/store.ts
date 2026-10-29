import { randomUUID } from "node:crypto";

import { factSetForKey } from "@/lib/document-facts/catalog";
import { recordFirmSharedAnswers } from "@/lib/firms/answers";
import { saveDeadlineAnswers } from "@/lib/deadlines";
import { safeRevalidate, writePetitions } from "@/lib/petition-write";
import { normalizePetitions } from "@/lib/petitions";
import { refreshDerivedSignals } from "@/lib/profile-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ImmigrantPetition } from "@/types/domain";

import { loadFieldSources, profileValuesFromRow, saveFieldSources } from "./db";
import {
  mergePetitionChanges,
  parseFieldKey,
  planFactApplication,
  type FactOutcome,
  type FieldSource,
  type ProfileValues
} from "./plan";

export { profileValuesFromRow };

function admin() {
  return createSupabaseAdminClient() as any;
}

function newPetitionId(sponsorName: string) {
  const slug = sponsorName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "petition";
  return `doc-${slug}-${randomUUID().slice(0, 8)}`;
}

// ── Writing profile values ───────────────────────────────────────────────────

const PROFILE_COLUMNS = { visaType: "visa_type", countryOfBirth: "country_of_birth", employerName: "employer_name" } as const;

/** Writes filled profile values the same way Settings and "Your deadlines" do, including the firm's copy. */
async function writeProfileValues(userId: string, patch: ProfileValues) {
  const columns: Record<string, string> = {};
  const draft: Record<string, string> = {};
  for (const [field, column] of Object.entries(PROFILE_COLUMNS)) {
    const value = patch[field as keyof typeof PROFILE_COLUMNS];
    if (value) {
      columns[column] = value;
      draft[field] = value;
    }
  }
  if (Object.keys(columns).length > 0) {
    const { error } = await admin().from("user_profiles").update(columns).eq("id", userId);
    if (error) throw new Error(`Could not save profile values: ${error.message}`);
    await recordFirmSharedAnswers(userId, draft, { has: (key: string) => key in draft });
  }
  if (patch.statusEndDate) {
    const form = new FormData();
    form.set("statusEndDate", patch.statusEndDate);
    await saveDeadlineAnswers(userId, form, { byPerson: false });
  } else if (Object.keys(columns).length > 0) {
    await refreshDerivedSignals(userId);
  }
}

// ── Applying one document's details ──────────────────────────────────────────

export type ApplyResult = { outcomes: FactOutcome[]; createdSponsor: string | null };

/**
 * Write a document's stored details into the profile and green cards, record
 * where each value came from, and mark each detail's state. Safe to run again.
 */
export async function applyDocumentFacts(userId: string, documentId: string): Promise<ApplyResult> {
  const db = admin();
  const [{ data: doc }, { data: factRows }, { data: row }] = await Promise.all([
    db.from("user_documents").select("id, user_id, petition_id").eq("id", documentId).eq("user_id", userId).maybeSingle(),
    db.from("document_facts").select("*").eq("document_id", documentId).eq("user_id", userId),
    db.from("user_profiles").select("*").eq("id", userId).maybeSingle()
  ]);
  if (!doc || !row || !factRows?.length) return { outcomes: [], createdSponsor: null };
  const set = factSetForKey(factRows[0].fact_key);
  if (!set) return { outcomes: [], createdSponsor: null };

  const { count: i94Count } = await db
    .from("document_facts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("fact_key", "i94.admit_until")
    .eq("confident", true);

  const answers = (row.deadline_answers && typeof row.deadline_answers === "object" ? row.deadline_answers : {}) as Record<string, unknown>;
  const petitions = normalizePetitions(answers.immigrantPetitions);
  const plan = planFactApplication({
    set,
    facts: factRows.map((f: any) => ({ id: f.id, key: f.fact_key, value: f.value, confident: f.confident, page: f.page })),
    document: { id: doc.id, label: set.documentName, petitionId: doc.petition_id ?? null },
    profile: profileValuesFromRow(row),
    petitions,
    sources: await loadFieldSources(userId, { strict: true }),
    hasI94StatusDate: (i94Count ?? 0) > 0,
    newPetitionId
  });

  let outcomes = plan.outcomes;
  let upserts = plan.sourceUpserts;
  if (plan.petitionsChanged) {
    // Only the green card this document changed is checked: an older one with a
    // problem of its own must not block the document.
    const touched = plan.createdPetition ? [plan.createdPetition.id] : plan.petitionId ? [plan.petitionId] : [];
    // Apply this document's changes to the list as saved now, so a save that
    // happened since it was read (another document, Settings) isn't lost.
    const saved = await writePetitions(
      userId,
      (current: ImmigrantPetition[]) => mergePetitionChanges(petitions, plan.petitions, current, touched),
      { onlyCheck: touched }
    );
    if (!saved.ok) {
      // These values wouldn't pass the green card's checks: leave the ones that
      // needed writing for a person. Disagreements need no write, so they stay.
      console.error("[document-facts] green card save refused", saved.error, saved.fieldErrors);
      const isPetitionField = (key: string | null) => Boolean(key && parseFieldKey(key)?.kind === "petition");
      const unwritten = new Set(
        outcomes.filter((o) => o.state === "filled" && isPetitionField(o.appliedTo)).map((o) => o.appliedTo as string)
      );
      outcomes = outcomes.map((o) =>
        o.state === "filled" && unwritten.has(o.appliedTo as string) ? { ...o, state: "needs_check", appliedTo: null } : o
      );
      upserts = upserts.filter((s) => !(unwritten.has(s.fieldKey) && s.origin === "document"));
    }
  }
  if (Object.keys(plan.profilePatch).length > 0) await writeProfileValues(userId, plan.profilePatch);

  if (plan.petitionId && !doc.petition_id && outcomes.some((o) => o.state !== "needs_check")) {
    await db.from("user_documents").update({ petition_id: plan.petitionId }).eq("id", documentId).eq("user_id", userId);
  }
  await saveFieldSources(userId, upserts, null);
  for (const outcome of outcomes) {
    await db.from("document_facts").update({ state: outcome.state, applied_to: outcome.appliedTo }).eq("id", outcome.factId);
  }
  safeRevalidate("/documents", "/settings", "/dashboard", "/firm");
  return { outcomes, createdSponsor: plan.createdPetition?.sponsorName ?? null };
}

/** Write one value into its field, the same way a document's detail is written. */
export async function writeFieldValue(userId: string, fieldKey: string, value: string): Promise<{ ok: boolean; error?: string }> {
  const parsed = parseFieldKey(fieldKey);
  if (!parsed) return { ok: false, error: "That field can't be changed here." };
  if (parsed.kind === "profile") {
    await writeProfileValues(userId, { [parsed.field]: value });
    return { ok: true };
  }
  const { data: row } = await admin().from("user_profiles").select("deadline_answers").eq("id", userId).maybeSingle();
  const answers = (row?.deadline_answers && typeof row.deadline_answers === "object" ? row.deadline_answers : {}) as Record<string, unknown>;
  const petitions = normalizePetitions(answers.immigrantPetitions);
  if (!petitions.some((p) => p.id === parsed.petitionId)) return { ok: false, error: "That green card wasn't found." };
  const next = petitions.map((p) => (p.id === parsed.petitionId ? { ...p, [parsed.field]: value } : p));
  const saved = await writePetitions(
    userId,
    (current: ImmigrantPetition[]) => mergePetitionChanges(petitions, next, current, [parsed.petitionId]),
    { onlyCheck: [parsed.petitionId] }
  );
  return saved.ok ? { ok: true } : { ok: false, error: saved.error };
}
