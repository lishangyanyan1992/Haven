"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { MessageComposer } from "@/components/app/message-composer";
import { MessageThread } from "@/components/app/message-thread";
import type { ConversationMessage } from "@/lib/firms/message-core";
import { markFirmConversationReadAction, sendFirmMessageAction } from "@/server/firm-actions";

/** The firm's conversation with one client (specs/client-lawyer-messaging). */
export function ClientMessagesPanel({
  firmClientId,
  clientName,
  messages,
  hasUnread
}: {
  firmClientId: string;
  clientName: string;
  messages: ConversationMessage[];
  hasUnread: boolean;
}) {
  const router = useRouter();

  // Opening the page counts as reading: the marker clears for the whole firm.
  useEffect(() => {
    if (hasUnread) void markFirmConversationReadAction(firmClientId);
  }, [firmClientId, hasUnread]);

  return (
    <section
      aria-labelledby="messages-heading"
      className="scroll-mt-24 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6"
      id="messages"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3" id="messages-heading">
          Messages
          {hasUnread ? (
            <span className="ml-2 rounded-full bg-[var(--haven-blush-light)] px-2 py-0.5 text-[12px] font-semibold text-[var(--haven-blush-ink)]">
              New
            </span>
          ) : null}
        </h2>
        <p className="text-caption text-[var(--haven-ink-mid)]">{clientName} gets an email when you reply.</p>
      </div>
      <div className="mt-4 max-h-[480px] overflow-y-auto pr-1">
        <MessageThread emptyText={`${clientName} hasn't written yet. You can start the conversation.`} messages={messages} viewer="lawyer" />
      </div>
      <div className="mt-4">
        <MessageComposer
          label={`Reply to ${clientName}`}
          onSend={async (body) => {
            const result = await sendFirmMessageAction({ firmClientId, body });
            if (result.status === "sent") {
              router.refresh();
              return null;
            }
            if (result.status === "invalid") return result.error;
            return "That didn't send. Try again in a moment.";
          }}
          placeholder={`Write to ${clientName}`}
          sendLabel="Send reply"
        />
      </div>
    </section>
  );
}
