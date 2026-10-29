"use server";

import { loadFieldSources, saveFieldSources } from "@/lib/field-sources/db";
import { writeFieldValue } from "@/lib/field-sources/store";
import { safeRevalidate } from "@/lib/petition-write";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResolveResult = { ok: true } | { ok: false; error: string };

async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Switch a field to the value its document shows. */
export async function applyDocumentValueAction(fieldKey: string): Promise<ResolveResult> {
  try {
    return await applyDocumentValue(fieldKey);
  } catch (error) {
    console.error("[field-sources] use document value failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "That didn't save. Try again in a moment." };
  }
}

async function applyDocumentValue(fieldKey: string): Promise<ResolveResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const source = (await loadFieldSources(userId, { strict: true })).get(fieldKey);
  if (!source?.documentValue) return { ok: false, error: "There's no document value for this field any more." };

  const written = await writeFieldValue(userId, fieldKey, source.documentValue);
  if (!written.ok) return { ok: false, error: written.error ?? "We couldn't save that. Try again in a moment." };
  await saveFieldSources(
    userId,
    [{ ...source, origin: "document", value: source.documentValue, documentValue: null, resolution: null }],
    userId
  );
  safeRevalidate("/settings", "/dashboard", "/documents", "/firm");
  return { ok: true };
}

/** Keep the person's own value; the warning goes, the label still names the document's value. */
export async function keepMineAction(fieldKey: string): Promise<ResolveResult> {
  try {
    return await keepMine(fieldKey);
  } catch (error) {
    console.error("[field-sources] keep mine failed", error instanceof Error ? error.message : error);
    return { ok: false, error: "That didn't save. Try again in a moment." };
  }
}

async function keepMine(fieldKey: string): Promise<ResolveResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const source = (await loadFieldSources(userId, { strict: true })).get(fieldKey);
  if (!source || source.origin !== "person" || !source.documentValue) return { ok: false, error: "Nothing to resolve here." };
  await saveFieldSources(userId, [{ ...source, resolution: "kept_mine" }], userId);
  safeRevalidate("/settings", "/dashboard", "/firm");
  return { ok: true };
}
