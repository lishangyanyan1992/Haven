"use client";

import { useEffect, useState, useTransition } from "react";
import { Calendar, Check, LoaderCircle, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isValidBookingUrl } from "@/lib/firms/engagement";
import { saveFirmConsultationBookingAction } from "@/server/firm-actions";

type ConsultationBookingControlsProps = {
  initialBookingUrl: string | null;
  initialBookingEmail: string | null;
};

export function ConsultationBookingControls({
  initialBookingUrl,
  initialBookingEmail
}: ConsultationBookingControlsProps) {
  const [bookingUrl, setBookingUrl] = useState(initialBookingUrl ?? "");
  const [bookingEmail, setBookingEmail] = useState(initialBookingEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setBookingUrl(initialBookingUrl ?? "");
    setBookingEmail(initialBookingEmail ?? "");
  }, [initialBookingUrl, initialBookingEmail]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const trimmedUrl = bookingUrl.trim();
    const trimmedEmail = bookingEmail.trim();

    if (trimmedUrl && !isValidBookingUrl(trimmedUrl)) {
      setError("Booking link must start with https:// or http:// and include a valid destination.");
      return;
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await saveFirmConsultationBookingAction({
          bookingUrl: trimmedUrl || null,
          bookingEmail: trimmedEmail || null
        });

        if (!result.ok) {
          setError(result.error);
          return;
        }

        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } catch {
        setError("Could not save consultation booking channels. Please try again.");
      }
    });
  }

  const isConfigured = Boolean(bookingUrl.trim() || bookingEmail.trim());

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-[var(--haven-ink)]" />
          <h2 className="text-h3">Consultation booking channels</h2>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
            isConfigured
              ? "bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
              : "bg-[var(--haven-cream-mid)] text-[var(--haven-ink-soft)]"
          }`}
        >
          {isConfigured ? "Configured" : "Not configured"}
        </span>
      </div>

      <p className="text-body-sm mt-2 text-[var(--haven-ink-mid)]">
        Give clients a link to self-schedule an initial consultation call (such as Calendly or Cal.com), an email
        to contact your scheduling team, or both. These appear on the client&apos;s Case dashboard after intake review.
      </p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <label className="text-label text-[var(--haven-ink)]" htmlFor="firm-booking-url">
            Booking calendar link
          </label>
          <div className="relative">
            <input
              id="firm-booking-url"
              className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] px-3.5 py-2 text-body-sm text-[var(--haven-ink)] placeholder:text-[var(--haven-ink-soft)] focus:border-[var(--haven-ink)] focus:outline-none"
              onChange={(e) => setBookingUrl(e.target.value)}
              placeholder="https://calendly.com/your-firm/initial-consultation"
              type="url"
              value={bookingUrl}
            />
          </div>
          <p className="text-[12px] text-[var(--haven-ink-soft)]">
            Opens in a new tab when clients click &quot;Book consultation call&quot; on their dashboard.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-label text-[var(--haven-ink)]" htmlFor="firm-booking-email">
            Scheduling contact email
          </label>
          <div className="relative">
            <input
              id="firm-booking-email"
              className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] px-3.5 py-2 text-body-sm text-[var(--haven-ink)] placeholder:text-[var(--haven-ink-soft)] focus:border-[var(--haven-ink)] focus:outline-none"
              onChange={(e) => setBookingEmail(e.target.value)}
              placeholder="consultations@yourfirm.com"
              type="email"
              value={bookingEmail}
            />
          </div>
          <p className="text-[12px] text-[var(--haven-ink-soft)]">
            Used as a mailto link for clients to request scheduling directly.
          </p>
        </div>

        {error ? (
          <p className="rounded-[var(--radius-md)] bg-[var(--haven-blush-light)] px-3 py-2 text-body-sm text-[var(--haven-blush-ink)]">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button disabled={isPending} type="submit">
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {isPending ? "Saving..." : "Save booking channels"}
          </Button>

          {saved ? (
            <span className="flex items-center gap-1.5 text-body-sm font-medium text-[var(--haven-sage-ink)]">
              <Check className="h-4 w-4 text-[var(--haven-sage)]" />
              Settings saved
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
}
