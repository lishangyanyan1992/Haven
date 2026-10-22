"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { replaceFirmLinkAction, setFirmLinkActiveAction } from "@/server/firm-actions";

export function LinkControls({ initialUrl, isActive }: { initialUrl: string | null; isActive: boolean }) {
  const [url, setUrl] = useState(initialUrl);
  // Another lawyer may have replaced the link; show whatever the server has now.
  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(work: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await work();
      } catch {
        setError("That didn't work. Please try again.");
      }
    });
  }

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3">Your intake link</h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
            isActive ? "bg-[var(--haven-sage-light)] text-[var(--haven-ink)]" : "bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)]"
          }`}
        >
          {isActive ? "On" : "Off"}
        </span>
      </div>
      <p className="text-body-sm mt-2 text-[var(--haven-ink-mid)]">
        Send this link to a client by email, text or chat. They&apos;ll set up an account, answer a few questions and
        upload documents, and then show up below.
      </p>

      {url ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label="Intake link"
            className="min-w-0 flex-1 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] px-3 py-2 font-mono text-[13px] text-[var(--haven-ink)]"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={url}
          />
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setError("Couldn't copy. Select the link and copy it by hand.");
              }
            }}
            type="button"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy intake link"}
          </Button>
        </div>
      ) : (
        <p className="text-body-sm mt-4">Your firm doesn&apos;t have a link yet. Make one with “Replace link”.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          disabled={isPending || !url}
          onClick={() => run(() => setFirmLinkActiveAction(!isActive))}
          type="button"
          variant="outline"
        >
          {isActive ? "Turn link off" : "Turn link on"}
        </Button>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--haven-cream)] px-3 py-2">
            <span className="text-body-sm">The old link will stop working for good.</span>
            <Button
              disabled={isPending}
              onClick={() =>
                run(async () => {
                  const result = await replaceFirmLinkAction();
                  setUrl(result.url);
                  setConfirming(false);
                })
              }
              size="sm"
              type="button"
            >
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Replace it
            </Button>
            <Button disabled={isPending} onClick={() => setConfirming(false)} size="sm" type="button" variant="outline">
              Cancel
            </Button>
          </div>
        ) : (
          <Button disabled={isPending} onClick={() => setConfirming(true)} type="button" variant="outline">
            <RefreshCw className="h-4 w-4" />
            Replace link
          </Button>
        )}
      </div>
      {error ? <p className="text-body-sm mt-3 text-[#7a3030]">{error}</p> : null}
    </section>
  );
}
