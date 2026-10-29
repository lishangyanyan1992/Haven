"use client";

import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { MESSAGE_MAX_LENGTH } from "@/lib/firms/message-limits";

/**
 * A plain-text box with a Send button, shared by both sides of messaging.
 * `onSend` returns an error to show, or null when the message went out.
 */
export function MessageComposer({
  label,
  placeholder,
  sendLabel = "Send",
  onSend,
  onCancel,
  autoFocus = false
}: {
  label: string;
  placeholder: string;
  sendLabel?: string;
  onSend: (body: string) => Promise<string | null>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const fieldId = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, startSending] = useTransition();
  const length = draft.trim().length;
  const tooLong = length > MESSAGE_MAX_LENGTH;

  const send = () => {
    if (length === 0 || tooLong || isSending) return;
    setError(null);
    startSending(async () => {
      try {
        const problem = await onSend(draft);
        if (problem) setError(problem);
        else setDraft("");
      } catch {
        setError("That didn't send. Try again in a moment.");
      }
    });
  };

  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        autoFocus={autoFocus}
        className="min-h-24 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] px-4 py-3 text-base text-[var(--haven-ink)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--haven-sage)] focus:outline-none"
        id={fieldId}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        value={draft}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-caption ${tooLong || error ? "text-[var(--haven-blush-ink)]" : "text-[var(--haven-ink-mid)]"}`} role="status">
          {error ??
            (tooLong
              ? `Too long to send: ${length.toLocaleString("en-US")} of ${MESSAGE_MAX_LENGTH.toLocaleString("en-US")} characters.`
              : length > MESSAGE_MAX_LENGTH * 0.8
                ? `${length.toLocaleString("en-US")} of ${MESSAGE_MAX_LENGTH.toLocaleString("en-US")} characters`
                : "")}
        </p>
        <div className="flex gap-2">
          {onCancel ? (
            <Button onClick={onCancel} size="sm" type="button" variant="outline">
              Cancel
            </Button>
          ) : null}
          <Button disabled={length === 0 || tooLong || isSending} onClick={send} size="sm" type="button">
            {isSending ? "Sending…" : sendLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
