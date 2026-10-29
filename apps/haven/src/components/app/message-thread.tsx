import type { ConversationMessage } from "@/lib/firms/message-core";

/**
 * One client–lawyer conversation, oldest first. Used on the client dashboard
 * and the firm's client page; `viewer` decides which side reads as "you".
 */

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function MessageThread({
  messages,
  viewer,
  emptyText
}: {
  messages: ConversationMessage[];
  viewer: "client" | "lawyer";
  emptyText: string;
}) {
  if (messages.length === 0) {
    return <p className="text-body-sm text-[var(--haven-ink-mid)]">{emptyText}</p>;
  }
  return (
    <ol className="space-y-3">
      {messages.map((message) => {
        const mine = message.senderRole === viewer;
        // A firm has several lawyers, so on the firm's side each lawyer message keeps its author's name.
        const who =
          mine && viewer === "client"
            ? "You"
            : message.senderName || (message.senderRole === "lawyer" ? "Your lawyer" : "Client");
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
                    {viewer === "client" ? (
                      <a
                        className="text-caption underline underline-offset-2"
                        href={`/advisor?chat=${encodeURIComponent(message.aiAnswerQuote.chatId)}`}
                      >
                        Open that chat
                      </a>
                    ) : null}
                  </div>
                )
              ) : null}
              <p className="mt-2 whitespace-pre-wrap break-words text-body-sm text-[var(--haven-ink)]">{message.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
