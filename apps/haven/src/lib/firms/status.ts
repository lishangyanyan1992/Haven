import type { FirmClientRow, FirmClientStatus } from "@/lib/firms/types";

/**
 * Where a firm client is. Kept in one place, next to the same field checks
 * onboarding uses to work out partial progress (resolvePostAuthRedirect in
 * src/server/actions.ts): a step counts as saved once its key field is filled.
 */
export type StatusProfile = {
  country_of_birth?: string | null;
  employer_name?: string | null;
  preference_category?: string | null;
} | null;

export function firmClientStatus(client: Pick<FirmClientRow, "joined_at" | "completed_at">, profile: StatusProfile): FirmClientStatus {
  if (!client.joined_at) return "email_sent";
  if (client.completed_at) return "finished";
  if (!profile) return "signed_up";

  const savedAnyStep =
    Boolean(profile.country_of_birth?.trim()) ||
    Boolean(profile.employer_name?.trim()) ||
    Boolean(profile.preference_category && profile.preference_category !== "Not sure");

  return savedAnyStep ? "in_progress" : "signed_up";
}

/** New = finished, and no lawyer at the firm has opened them yet. Firm-wide. */
export function isNewFirmClient(client: Pick<FirmClientRow, "completed_at" | "reviewed_at">) {
  return Boolean(client.completed_at) && !client.reviewed_at;
}

export const FIRM_CLIENT_STATUS_LABEL: Record<FirmClientStatus, string> = {
  email_sent: "Email sent",
  signed_up: "Signed up",
  in_progress: "In progress",
  finished: "Finished"
};
