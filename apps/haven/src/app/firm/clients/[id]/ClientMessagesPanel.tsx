"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { MessageComposer } from "@/components/app/message-composer";
import type { ConversationMessage } from "@/lib/firms/message-core";
import type { SharedChat, SharedChatMessage } from "@/lib/firms/shared-chats";
import { markFirmConversationReadAction, sendFirmMessageAction } from "@/server/firm-actions";
import { SharedAiAnswer } from "./SharedChatsPanel";

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type UnifiedLawyerEntry =
  | { kind: "message"; createdAt: string; message: ConversationMessage }
  | { kind: "ai_answer"; createdAt: string; answer: SharedChatMessage };

/**
 * The firm's unified conversation with one client (specs/client-lawyer-messaging,
 * specs/advisor-chat-firm-visibility): client messages, shared AI answers, and
 * lawyer replies in chronological order.
 */
export function ClientMessagesPanel({
  firmClientId,
  clientName,
  messages,
  chats = [],
  hasUnread
}: {
  firmClientId: string;
  clientName: string;
  messages: ConversationMessage[];
  chats?: SharedChat[];
  hasUnread: boolean;
}) {
  const router = useRouter();

  // Opening the page counts as reading: the marker clears for the whole firm.
  useEffect(() => {
    if (hasUnread) void markFirmConversationReadAction(firmClientId);
  }, [firmClientId, hasUnread]);

  const entries = useMemo(() => {
    const clientMessageTimes = messages
      .filter((m) => m.senderRole === "client")
      .map((m) => ({ body: m.body.trim(), time: new Date(m.createdAt).getTime() }));

    const out: UnifiedLawyerEntry[] = messages.map((message) => ({
      kind: "message",
      createdAt: message.createdAt,
      message
    }));

    for (const chat of chats) {
      for (const item of chat.messages) {
        if (item.role === "assistant") {
          out.push({ kind: "ai_answer", createdAt: item.createdAt, answer: item });
        } else {
          const itemTime = new Date(item.createdAt).getTime();
          const alreadyInMessages = clientMessageTimes.some(
            (cm) => cm.body === item.text.trim() && Math.abs(cm.time - itemTime) < 60_000
          );
          if (!alreadyInMessages) {
            out.push({
              kind: "message",
              createdAt: item.createdAt,
              message: {
                id: `chat-user-${item.id}`,
                senderRole: "client",
                senderName: clientName,
                body: item.text,
                source: "dashboard",
                createdAt: item.createdAt,
                aiAnswerQuote: null
              }
            });
          }
        }
      }
    }

    return out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [chats, clientName, messages]);

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
        <p className="text-caption text-[var(--haven-ink-mid)]">
          {clientName} gets an email when you reply. If {clientName} turns on AI answers, they appear here too so you can confirm or correct them.
        </p>
      </div>
      <div className="mt-4 max-h-[560px] overflow-y-auto pr-1">
        {entries.length === 0 ? (
          <p className="text-body-sm text-[var(--haven-ink-mid)]">
            {clientName} hasn&apos;t written yet. You can start the conversation.
          </p>
        ) : (
          <ol className="space-y-3">
            {entries.map((entry) => {
              if (entry.kind === "ai_answer") {
                return <SharedAiAnswer answer={entry.answer} firmClientId={firmClientId} key={`ai-${entry.answer.id}`} />;
              }
              const message = entry.message;
              const mine = message.senderRole === "lawyer";
              const who = message.senderName || (message.senderRole === "lawyer" ? "Your lawyer" : clientName);
              return (
                <li className={`flex ${mine ? "justify-end" : "justify-start"}`} key={message.id}>
                  <div
                    className={`max-w-[85%] rounded-[var(--radius-lg)] px-4 py-3 ${
                      mine ? "bg-[var(--haven-sage-light)]" : "border border-[var(--color-border)] bg-[var(--haven-white)]"
                    }`}
                  >
                    <p className="text-caption text-[var(--haven-ink-mid)]">
                      <span className="font-semibold text-[var(--haven-ink)]">{who}</span>
                      {" · "}
                      {formatWhen(message.createdAt)}
                      {message.source === "onboarding" ? " · sent during setup" : ""}
                    </p>
                    {message.aiAnswerQuote ? (
                      "deleted" in message.aiAnswerQuote ? (
                        <p className="mt-2 border-l-2 border-[var(--color-border)] pl-3 text-caption italic text-[var(--haven-ink-mid)]">
                          The AI chat this refers to was deleted
                        </p>
                      ) : (
                        <div className="mt-2 border-l-2 border-[var(--haven-sage)] pl-3">
                          <p className="text-caption text-[var(--haven-ink-mid)]">About this Haven AI answer:</p>
                          <p className="text-caption italic text-[var(--haven-ink)]">&ldquo;{message.aiAnswerQuote.excerpt}&rdquo;</p>
                        </div>
                      )
                    ) : null}
                    <p className="mt-2 whitespace-pre-wrap break-words text-body-sm text-[var(--haven-ink)]">{message.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
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
