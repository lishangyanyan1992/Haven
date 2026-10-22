import type { SharedAnswers } from "@/lib/firms/answers";
import type { FirmClientRow, FirmClientStatus } from "@/lib/firms/types";

/**
 * Where a firm client is, from the firm's own copy of their setup answers
 * (see answers.ts) and the join and finish times.
 */
export function firmClientStatus(
  client: Pick<FirmClientRow, "joined_at" | "completed_at">,
  answers: SharedAnswers | null | undefined
): FirmClientStatus {
  if (!client.joined_at) return "email_sent";
  if (client.completed_at) return "finished";
  return answers && Object.keys(answers).length > 0 ? "in_progress" : "signed_up";
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
