"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { MessageComposer } from "@/components/app/message-composer";
import { MessageThread } from "@/components/app/message-thread";
import type { ClientConversation } from "@/lib/firms/client-messages";
import { markClientMessagesReadAction, sendClientMessageAction } from "@/server/message-actions";

/**
 * "Messages" on the client dashboard: one conversation per firm the client
 * has joined (specs/client-lawyer-messaging).
 */
export function ClientMessages({ conversations }: { conversations: ClientConversation[] }) {
  const router = useRouter();
  const [activeFirmId, setActiveFirmId] = useState(conversations[0]?.firmId ?? "");
  const active = conversations.find((c) => c.firmId === activeFirmId) ?? conversations[0];

  // Seeing a conversation clears its unread marker.
  useEffect(() => {
    if (active?.hasUnread) void markClientMessagesReadAction(active.firmId);
  }, [active?.firmId, active?.hasUnread]);

  if (!active) return null;

  return (
    <section
      aria-labelledby="messages-heading"
      className="scroll-mt-24 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6"
      id="messages"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3" id="messages-heading">
          Messages with your lawyer
        </h2>
        <p className="text-caption text-[var(--haven-ink-mid)]">You&apos;ll get an email when your lawyer replies.</p>
      </div>

      {conversations.length > 1 ? (
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Law firms">
          {conversations.map((c) => (
            <button
              aria-selected={c.firmId === active.firmId}
              className={`min-h-11 rounded-full border px-4 py-2 text-sm ${
                c.firmId === active.firmId
                  ? "border-[var(--haven-sage)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
                  : "border-[var(--color-border)] bg-[var(--haven-white)] text-[var(--haven-ink-mid)]"
              }`}
              key={c.firmId}
              onClick={() => setActiveFirmId(c.firmId)}
              role="tab"
              type="button"
            >
              {c.firmName}
              {c.hasUnread && c.firmId !== active.firmId ? (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[var(--haven-blush-ink)]" aria-label="new message" />
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">{active.firmName}</p>
      )}

      <div className="mt-4 max-h-[480px] overflow-y-auto pr-1">
        <MessageThread
          emptyText={`No messages yet. Write to ${active.firmName} below.`}
          messages={active.messages}
          viewer="client"
        />
      </div>

      {/* One box per firm, so each keeps its own draft and none can be sent to the wrong firm. */}
      {conversations.map((c) => (
        <div className={c.firmId === active.firmId ? "mt-4" : "hidden"} key={c.firmId}>
          <MessageComposer
            label={`Message to ${c.firmName}`}
            onSend={async (body) => {
              const result = await sendClientMessageAction({ firmId: c.firmId, body });
              if (result.status === "sent") {
                router.refresh();
                return null;
              }
              if (result.status === "invalid") return result.error;
              return "That didn't send. Try again in a moment.";
            }}
            placeholder={`Write to ${c.firmName}`}
          />
        </div>
      ))}
    </section>
  );
}
