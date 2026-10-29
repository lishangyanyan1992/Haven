"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageSquare } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import type { ClientConversation } from "@/lib/firms/client-messages";

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * "Messages with your lawyer" call-to-action card on the client dashboard
 * (specs/client-lawyer-messaging). Directs the client to Ask (/advisor) to
 * message their lawyer and optionally get instant AI answers first.
 */
export function ClientMessages({ conversations }: { conversations: ClientConversation[] }) {
  const [activeFirmId, setActiveFirmId] = useState(conversations[0]?.firmId ?? "");
  const active = conversations.find((c) => c.firmId === activeFirmId) ?? conversations[0];

  if (!active) return null;

  const latestMessage = active.messages.at(-1) ?? null;
  const latestSender =
    latestMessage?.senderRole === "client"
      ? "You"
      : latestMessage?.senderName || active.firmName;
  const advisorHref =
    conversations.length > 1
      ? `/advisor?firm=${encodeURIComponent(active.firmId)}`
      : "/advisor";

  return (
    <section
      aria-labelledby="messages-heading"
      className="scroll-mt-24 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6"
      id="messages"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h3" id="messages-heading">
            Messages with your lawyer
          </h2>
          {active.hasUnread ? (
            <span className="rounded-full bg-[var(--haven-blush-light)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--haven-blush-ink)]">
              New reply
            </span>
          ) : null}
        </div>
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
              {c.hasUnread ? (
                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[var(--haven-blush-ink)]" aria-label="new message" />
              ) : null}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">{active.firmName}</p>
      )}

      <div className="mt-4 flex flex-col gap-4 rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          {latestMessage ? (
            <>
              <p className="text-caption text-[var(--haven-ink-mid)]">
                <span className="font-semibold text-[var(--haven-ink)]">{latestSender}</span>
                {" · "}
                {formatWhen(latestMessage.createdAt)}
              </p>
              <p className="line-clamp-2 text-body-sm text-[var(--haven-ink)]">{latestMessage.body}</p>
            </>
          ) : (
            <p className="text-body-sm text-[var(--haven-ink)]">
              Have a question or update for {active.firmName}? Send them a message in Ask, and choose whether you want instant AI answers while you wait for their reply.
            </p>
          )}
        </div>

        <div className="shrink-0">
          <Link className={buttonVariants({ variant: "default" })} href={advisorHref}>
            <MessageSquare className="mr-1.5 h-4 w-4" />
            {active.hasUnread ? `Read & reply in Ask` : `Message ${active.firmName}`}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
