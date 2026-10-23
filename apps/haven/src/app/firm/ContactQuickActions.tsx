"use client";

import { useState } from "react";
import { Check, Copy, Mail, Phone, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContactQuickActionsProps {
  email: string;
  phone?: string | null;
  subject?: string;
  size?: "sm" | "lg";
  className?: string;
}

export function ContactQuickActions({
  email,
  phone,
  subject = "Haven Immigration Intake Follow-Up",
  size = "lg",
  className = ""
}: ContactQuickActionsProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const cleanPhone = phone?.trim();
  const telHref = cleanPhone ? `tel:${cleanPhone.replace(/[^\d+]/g, "")}` : null;
  const mailtoHref = email ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : null;

  const handleCopyEmail = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  };

  const handleCopyPhone = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!cleanPhone) return;
    try {
      await navigator.clipboard.writeText(cleanPhone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {
      // ignore clipboard failures
    }
  };

  if (size === "sm") {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <div className="flex items-center gap-1.5 text-body-sm">
          <a
            className="flex items-center gap-1 font-medium text-[var(--haven-ink)] underline-offset-4 hover:underline"
            href={mailtoHref ?? "#"}
            title="Send email"
          >
            <Mail className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
            <span className="truncate max-w-[200px]">{email}</span>
          </a>
          <button
            aria-label="Copy email address"
            className="rounded p-1 text-[var(--haven-ink-mid)] hover:bg-[var(--haven-cream)] hover:text-[var(--haven-ink)]"
            onClick={handleCopyEmail}
            type="button"
          >
            {copiedEmail ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          </button>
        </div>

        {cleanPhone ? (
          <div className="flex items-center gap-1.5 text-body-sm">
            <a
              className="flex items-center gap-1 text-[var(--haven-ink)] underline-offset-4 hover:underline"
              href={telHref ?? "#"}
              title="Call phone number"
            >
              <Phone className="h-3.5 w-3.5 text-[var(--haven-ink-mid)]" />
              <span>{cleanPhone}</span>
            </a>
            <button
              aria-label="Copy phone number"
              className="rounded p-1 text-[var(--haven-ink-mid)] hover:bg-[var(--haven-cream)] hover:text-[var(--haven-ink)]"
              onClick={handleCopyPhone}
              type="button"
            >
              {copiedPhone ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        ) : (
          <span className="text-[12px] text-[var(--haven-ink-mid)]">No phone collected</span>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 shadow-sm ${className}`}>
      <h3 className="text-label text-[var(--haven-ink-mid)]">Direct Contact Information</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Email Block */}
        <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-ink-mid)]">Email Address</p>
            <p className="mt-1 text-h3 text-[var(--haven-ink)] break-all">{email}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 pt-2">
            <a
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--haven-ink)] px-3 py-1.5 text-[12px] font-medium text-[var(--haven-cream)] hover:opacity-90"
              href={mailtoHref ?? "#"}
            >
              <Mail className="h-3.5 w-3.5" />
              Open Email App
            </a>
            <Button
              aria-label="Copy email address"
              className="h-auto py-1.5 px-3 text-[12px]"
              onClick={handleCopyEmail}
              type="button"
              variant="outline"
            >
              {copiedEmail ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  Copy Email
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Phone Block */}
        <div className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--haven-ink-mid)]">Phone Number</p>
            {cleanPhone ? (
              <p className="mt-1 text-h3 text-[var(--haven-ink)]">{cleanPhone}</p>
            ) : (
              <p className="mt-1 text-body text-[var(--haven-ink-mid)] italic">No phone number recorded</p>
            )}
          </div>
          {cleanPhone ? (
            <div className="mt-3 flex flex-wrap gap-2 pt-2">
              <a
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-emerald-700 px-3 py-1.5 text-[12px] font-medium text-[var(--haven-cream)] hover:bg-emerald-800"
                href={telHref ?? "#"}
              >
                <PhoneCall className="h-3.5 w-3.5" />
                Call Directly
              </a>
              <Button
                aria-label="Copy phone number"
                className="h-auto py-1.5 px-3 text-[12px]"
                onClick={handleCopyPhone}
                type="button"
                variant="outline"
              >
                {copiedPhone ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy Phone
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
