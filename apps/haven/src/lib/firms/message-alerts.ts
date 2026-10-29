import { siteUrl } from "@/lib/firms/message-core";

/**
 * Alert emails for client and lawyer messages (specs/client-lawyer-messaging).
 *
 * An alert names who wrote and links to the conversation. It never carries
 * any part of a message: these builders take no message text at all, so a
 * later edit can't leak one in by accident.
 */

export type AlertEmail = { subject: string; text: string };

export type SendEmail = (input: { to: string; subject: string; text: string }) => Promise<unknown>;

/** To each lawyer at the firm, when a client writes. */
export function lawyerAlertEmail(input: { clientName: string; firmClientId: string }): AlertEmail {
  const name = input.clientName.trim() || "A client";
  return {
    subject: `New message from ${name} in Haven`,
    text: [
      `${name} sent you a message in Haven.`,
      "",
      `Read and reply: ${siteUrl(`/firm/clients/${input.firmClientId}#messages`)}`,
      "",
      "For privacy, Haven doesn't include messages in email."
    ].join("\n")
  };
}

/** To the client, when a lawyer writes. */
export function clientAlertEmail(input: { firmName: string }): AlertEmail {
  const firm = input.firmName.trim() || "your law firm";
  return {
    subject: `You have a new message from ${firm}`,
    text: [
      `${firm} sent you a message in Haven.`,
      "",
      `Read and reply: ${siteUrl("/dashboard#messages")}`,
      "",
      "For privacy, Haven doesn't include messages in email."
    ].join("\n")
  };
}

/** Send one alert to each address. Failures are logged; the message itself is already saved. */
export async function sendAlert(recipients: string[], email: AlertEmail, send: SendEmail): Promise<number> {
  let sent = 0;
  for (const to of Array.from(new Set(recipients.map((r) => r.trim().toLowerCase()).filter(Boolean)))) {
    try {
      await send({ to, subject: email.subject, text: email.text });
      sent += 1;
    } catch (error) {
      console.error("[messages] alert email failed", error instanceof Error ? error.message : String(error));
    }
  }
  return sent;
}

/** The real sender, loaded lazily so checks never touch mail settings. */
export async function defaultSendEmail(input: { to: string; subject: string; text: string }) {
  const { sendProductEmail } = await import("@/lib/email-notifications");
  return sendProductEmail(input);
}
