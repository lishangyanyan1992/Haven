"use server";

import { redirect } from "next/navigation";

import { SIGNED_IN_HOME } from "@/lib/archived-routes";
import { markDeadlinesPrompted, saveDeadlineAnswers } from "@/lib/deadlines";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The one-time "Your deadlines" prompt for clients who finished setup earlier. */

async function signedInUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

export async function saveDeadlinePromptAction(formData: FormData) {
  const userId = await signedInUserId();
  try {
    await saveDeadlineAnswers(userId, formData);
  } catch (error) {
    // Keep the prompt open so the client can try again; don't mark it done.
    console.error("[deadlines] prompt save failed", error);
    redirect("/onboarding/deadlines?error=save");
  }
  await markDeadlinesPrompted(userId);
  redirect(SIGNED_IN_HOME);
}

export async function skipDeadlinePromptAction() {
  const userId = await signedInUserId();
  await markDeadlinesPrompted(userId);
  redirect(SIGNED_IN_HOME);
}
