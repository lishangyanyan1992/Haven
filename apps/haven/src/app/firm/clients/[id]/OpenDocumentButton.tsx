"use client";

import { useState, useTransition } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { openFirmDocumentAction } from "@/server/firm-actions";

/** Asks for a fresh 5-minute link on each click, then opens it. */
export function OpenDocumentButton({ firmClientId, documentId }: { firmClientId: string; documentId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {error ? <span className="text-[12px] text-[#7a3030]">{error}</span> : null}
      <Button
        disabled={isPending}
        onClick={() => {
          setError(null);
          // Open the tab now, inside the click, so pop-up blockers allow it.
          const tab = window.open("", "_blank");
          startTransition(async () => {
            const { url } = await openFirmDocumentAction(firmClientId, documentId);
            if (!url) {
              tab?.close();
              setError("Couldn't open this document.");
            } else if (tab) {
              tab.opener = null;
              tab.location.href = url;
            } else {
              // Pop-up blocked: open it here instead.
              window.location.assign(url);
            }
          });
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
        Open
      </Button>
    </div>
  );
}
