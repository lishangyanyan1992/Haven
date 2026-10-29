import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ImmigrantPetition } from "@/types/domain";

import { loadFieldSources, saveFieldSources } from "./db";
import {
  PETITION_FIELDS,
  petitionFieldKey,
  sourceAfterDocumentDeleted,
  sourceAfterPersonSave,
  type FieldSource,
  type ProfileValues
} from "./plan";

/**
 * Record that a person saved these values. A changed document value keeps the
 * document's value beside it; anything else they changed becomes "You entered
 * this". Never throws: a failure here must not lose the person's save.
 */
export async function recordPersonEdits(
  userId: string,
  edits: Array<{ fieldKey: string; previous: string | null | undefined; next: string | null | undefined }>
) {
  try {
    const sources = await loadFieldSources(userId, { strict: true });
    const updates: FieldSource[] = [];
    for (const edit of edits) {
      const next = sourceAfterPersonSave(edit.fieldKey, edit.previous ?? null, edit.next ?? null, sources.get(edit.fieldKey));
      if (next) updates.push(next);
    }
    await saveFieldSources(userId, updates, userId);
  } catch (error) {
    console.error("[field-sources] could not record edits", error instanceof Error ? error.message : error);
  }
}

/** The profile edits in a save, for recordPersonEdits. Only fields the save sent. */
export function profileEdits(previous: ProfileValues, next: ProfileValues) {
  return (Object.keys(next) as Array<keyof ProfileValues>).map((field) => ({
    fieldKey: field,
    previous: previous[field],
    next: next[field]
  }));
}

/** The green card edits between two saved lists, plus the ids of green cards removed. */
export function petitionEdits(before: ImmigrantPetition[], after: ImmigrantPetition[]) {
  const edits: Array<{ fieldKey: string; previous: string | null; next: string | null }> = [];
  for (const p of after) {
    const old = before.find((b) => b.id === p.id);
    for (const field of PETITION_FIELDS) {
      if (field === "sponsorName") continue;
      const prev = (old?.[field] as string | undefined) ?? null;
      const next = (p[field] as string | undefined) ?? null;
      if (old || next) edits.push({ fieldKey: petitionFieldKey(p.id, field), previous: prev, next });
    }
  }
  const removed = before.filter((b) => !after.some((a) => a.id === b.id)).map((b) => b.id);
  return { edits, removed };
}

/** A green card was removed: its labels go, and its details are marked "Not used: green card removed". */
export async function forgetRemovedPetitions(userId: string, petitionIds: string[]) {
  if (petitionIds.length === 0) return;
  const db = createSupabaseAdminClient() as any;
  for (const id of petitionIds) {
    // Escape LIKE wildcards in the id.
    const prefix = `petition:${id.replace(/[\\%_]/g, (c) => `\\${c}`)}.`;
    await db.from("field_sources").delete().eq("user_id", userId).like("field_key", `${prefix}%`);
    await db
      .from("document_facts")
      .update({ state: "not_used_record_removed", applied_to: null })
      .eq("user_id", userId)
      .like("applied_to", `${prefix}%`);
    await db.from("user_documents").update({ petition_id: null }).eq("user_id", userId).eq("petition_id", id);
  }
}

/**
 * Call before a document is deleted: relabels the values it filled. Throws on
 * failure, so the delete stops rather than leaving values labeled with a
 * document that no longer exists.
 */
export async function forgetDeletedDocument(userId: string, documentId: string) {
  const db = createSupabaseAdminClient() as any;
  const { data: facts, error } = await db.from("document_facts").select("id").eq("document_id", documentId).eq("user_id", userId);
  if (error) throw new Error(`Could not read this document's details: ${error.message}`);
  const ids = new Set<string>((facts ?? []).map((f: { id: string }) => f.id));
  if (ids.size === 0) return;
  const updates: FieldSource[] = [];
  for (const source of (await loadFieldSources(userId, { strict: true })).values()) {
    const next = sourceAfterDocumentDeleted(source, ids);
    if (next) updates.push(next);
  }
  await saveFieldSources(userId, updates, userId);
}
