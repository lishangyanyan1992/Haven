"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, PhoneCall } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FirmContactRequest } from "@/lib/firms/clients";
import { markContactRequestHandledAction } from "@/server/firm-actions";

function formatSent(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * What the client sent from the advisor's lawyer handoff, and nothing more:
 * the area, their dates and the questions they were shown. The request itself
 * carries no conversation text (shared chats are shown separately, only after
 * the client agrees). Marking it handled clears the marker and lets them
 * ask again; it does not change their stage.
 */
export function ContactRequestPanel({ firmClientId, request }: { firmClientId: string; request: FirmContactRequest }) {
  const [handled, setHandled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (handled) {
    return (
      <section className="flex items-center gap-2 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 text-body-sm text-[var(--haven-ink-mid)] sm:p-6">
        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
        Request marked handled.
      </section>
    );
  }

  return (
    <section
      className="rounded-[var(--radius-2xl)] border border-[var(--haven-sky)] bg-[var(--haven-sky-light)] p-5 sm:p-6"
      id="contact-request"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h3 flex items-center gap-2">
            <PhoneCall className="h-4 w-4" />
            Asked to be contacted
          </h2>
          <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">
            Sent from Haven&apos;s advisor {formatSent(request.sentAt)}. This is everything they shared; their conversation is not
            included.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error ? <span className="text-[12px] text-[#7a3030]">{error}</span> : null}
          <Button
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const { ok } = await markContactRequestHandledAction(firmClientId, request.id);
                if (ok) setHandled(true);
                else setError("Couldn't update this request.");
              });
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Mark handled
          </Button>
        </div>
      </div>

      <dl className="mt-4 space-y-3 text-body-sm text-[var(--haven-ink)]">
        <div>
          <dt className="text-[var(--haven-ink-mid)]">About</dt>
          <dd className="font-medium">{request.practiceArea}</dd>
        </div>
        {request.dates.length > 0 ? (
          <div>
            <dt className="text-[var(--haven-ink-mid)]">Their dates</dt>
            <dd>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {request.dates.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-[var(--haven-ink-mid)]">Questions they want answered</dt>
          <dd>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {request.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
    </section>
  );
}
