"use server";

import { createSupabaseServerClient } from "@haven/auth/server";

import { stripSensitiveSupplements } from "@/lib/storage";
import type { FormSupplementAnswers, WizardState } from "@/types/wizard";

const DEFAULT_FILING_SLUG = "marriage-green-card-adjustment-of-status";

type WizardSessionPayload = {
  filingSlug?: string;
  wizardState: WizardState;
  supplements: FormSupplementAnswers;
};

export async function getWizardSessionAction(filingSlug = DEFAULT_FILING_SLUG) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { authenticated: false as const, session: null };
  }

  const { data, error } = await supabase
    .from("wizard_sessions")
    .select("*")
    .eq("user_id", user.id)
    .eq("filing_slug", filingSlug)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    authenticated: true as const,
    session: data
      ? {
          ...data,
          supplements: stripSensitiveSupplements((data.supplements ?? {}) as FormSupplementAnswers)
        }
      : data
  };
}

export async function upsertWizardSessionAction(payload: WizardSessionPayload) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { authenticated: false as const, saved: false as const };
  }

  const filingSlug = payload.filingSlug ?? DEFAULT_FILING_SLUG;
  const wizardState = payload.wizardState;
  const supplements = stripSensitiveSupplements(payload.supplements);

  const { error } = await supabase.from("wizard_sessions").upsert(
    {
      user_id: user.id,
      filing_slug: filingSlug,
      wizard_state: wizardState,
      supplements,
      current_step: wizardState.currentStep,
      started_at: wizardState.startedAt,
      last_updated_at: wizardState.lastUpdatedAt,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "user_id,filing_slug"
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return { authenticated: true as const, saved: true as const };
}

export async function listWizardSessionsAction() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { authenticated: false as const, sessions: [] };
  }

  const { data, error } = await supabase
    .from("wizard_sessions")
    .select("id, filing_slug, current_step, last_updated_at, started_at")
    .eq("user_id", user.id)
    .order("last_updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return { authenticated: true as const, sessions: data ?? [] };
}

export async function deleteWizardSessionAction(filingSlug = DEFAULT_FILING_SLUG) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return { authenticated: false as const, deleted: false as const };
  }

  const { error } = await supabase
    .from("wizard_sessions")
    .delete()
    .eq("user_id", user.id)
    .eq("filing_slug", filingSlug);

  if (error) {
    throw new Error(error.message);
  }

  return { authenticated: true as const, deleted: true as const };
}
