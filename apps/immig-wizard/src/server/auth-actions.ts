"use server";

import { createSupabaseServerClient } from "@haven/auth/server";
import { normalizeRedirectPath } from "@haven/auth/redirects";

type SignInInput = {
  email: string;
  password: string;
  redirectTo?: string;
};

export async function signInAction(input: SignInInput) {
  const supabase = await createSupabaseServerClient();
  const email = String(input.email ?? "").trim().toLowerCase();
  const password = String(input.password ?? "");
  const redirectTo = normalizeRedirectPath(input.redirectTo, "/account");

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return {
      error: "Incorrect email or password."
    };
  }

  return {
    redirectTo
  };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return {
    redirectTo: "/"
  };
}
