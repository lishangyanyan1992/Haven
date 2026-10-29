"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { MessageComposer } from "@/components/app/message-composer";
import { AI_ANSWER_LABEL_FIRM } from "@/lib/advisor/firm-visibility-copy";
import type { SharedChat, SharedChatMessage } from "@/lib/firms/shared-chats";
import { sendFirmMessageAction } from "@/server/firm-actions";

/**
 * The client's questions to Haven's AI and its answers, read-only, with a way
 * to reply to any answer (specs/advisor-chat-firm-visibility).
 */

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function SharedChatsPanel({
  firmClientId,
  clientName,
  chats
}: {
  firmClientId: string;
  clientName: string;
  chats: SharedChat[];
}) {
  return (
    <section
      aria-labelledby="ai-chats-heading"
      className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6"
    >
      <h2 className="text-h3" id="ai-chats-heading">
        Questions to Haven&apos;s AI
      </h2>
      <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">
        {clientName} asks these knowing you see them. The AI answers first; reply to any answer to confirm or correct it.
      </p>
      {chats.length === 0 ? (
        <p className="text-body-sm mt-4 text-[var(--haven-ink-mid)]">No shared questions yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {chats.map((chat, index) => (
            <details className="rounded-[var(--radius-lg)] border border-[var(--color-border)]" key={chat.id} open={index === 0}>
              <summary className="cursor-pointer list-none px-4 py-3">
                <span className="text-body-sm font-semibold text-[var(--haven-ink)]">{chat.title}</span>
                <span className="ml-2 text-caption text-[var(--haven-ink-mid)]">started {formatWhen(chat.createdAt)}</span>
              </summary>
              <ol className="space-y-3 border-t border-[var(--color-border)] px-4 py-4">
                {chat.messages.map((message) =>
                  message.role === "user" ? (
                    <li className="rounded-[var(--radius-lg)] bg-[var(--haven-sage-light)] px-4 py-3" key={message.id}>
                      <p className="text-caption text-[var(--haven-ink-mid)]">
                        <span className="font-semibold text-[var(--haven-ink)]">{clientName} asked</span> · {formatWhen(message.createdAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-body-sm text-[var(--haven-ink)]">{message.text}</p>
                    </li>
                  ) : (
                    <SharedAiAnswer answer={message} firmClientId={firmClientId} key={message.id} />
                  )
                )}
              </ol>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

export function SharedAiAnswer({ answer, firmClientId }: { answer: SharedChatMessage; firmClientId: string }) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <li className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] px-4 py-3">
      <p className="text-caption text-[var(--haven-ink-mid)]">
        <span className="font-semibold text-[var(--haven-ink)]">Haven AI answered</span> · {formatWhen(answer.createdAt)}
      </p>
      <div className="mt-1 text-body-sm leading-7 text-[var(--haven-ink)] [&_a]:underline [&_a]:underline-offset-2 [&_h1]:mt-3 [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
        <ReactMarkdown
          components={{ a: ({ ...props }) => <a {...props} rel="noreferrer" target="_blank" /> }}
          remarkPlugins={[remarkGfm]}
        >
          {answer.text}
        </ReactMarkdown>
      </div>
      <p className="mt-2 text-caption font-medium text-[var(--haven-ink-mid)]">{AI_ANSWER_LABEL_FIRM}</p>
      <div className="mt-3">
        {replying ? (
          <MessageComposer
            autoFocus
            label="Reply to this answer"
            onCancel={() => setReplying(false)}
            onSend={async (body) => {
              const result = await sendFirmMessageAction({ firmClientId, body, aiAnswerId: answer.id });
              if (result.status === "sent") {
                setReplying(false);
                setSent(true);
                router.refresh();
                return null;
              }
              if (result.status === "invalid") return result.error;
              return "That didn't send. The client may have deleted this chat.";
            }}
            placeholder="Confirm, correct, or add to this answer. Your reply goes to the client's messages."
            sendLabel="Send reply"
          />
        ) : (
          <button
            className="min-h-11 rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-4 py-2 text-sm text-[var(--haven-ink)] hover:border-[var(--haven-sage)]"
            onClick={() => setReplying(true)}
            type="button"
          >
            {sent ? "Reply again" : "Reply to this answer"}
          </button>
        )}
        {sent && !replying ? <span className="ml-3 text-caption text-[var(--haven-ink-mid)]">Sent to Messages.</span> : null}
      </div>
    </li>
  );
}
