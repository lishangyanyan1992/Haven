"use client";

import { useState, useTransition } from "react";
import { Download, FileDown, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportFirmClientDossierAction } from "@/server/firm-actions";

export function ExportCmsButton({
  firmClientId,
  clientName,
  variant = "outline"
}: {
  firmClientId: string;
  clientName: string;
  variant?: "outline" | "default";
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await exportFirmClientDossierAction(firmClientId);
        if (!res.ok || !res.dossier) {
          setError(res.error || "Failed to generate export dossier");
          return;
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.dossier, null, 2));
        const cleanName = (clientName || "client").toLowerCase().replace(/[^a-z0-9]/g, "-");
        const downloadAnchor = document.createElement("a");
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `cms-case-dossier-${cleanName}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();

        // If documents with signed URLs exist, optionally prompt or download them
        const docs = res.dossier.documents || [];
        if (docs.length > 0) {
          for (const doc of docs) {
            if (doc.downloadUrl) {
              const docAnchor = document.createElement("a");
              docAnchor.setAttribute("href", doc.downloadUrl);
              docAnchor.setAttribute("target", "_blank");
              docAnchor.setAttribute("download", doc.name);
              document.body.appendChild(docAnchor);
              docAnchor.click();
              docAnchor.remove();
            }
          }
        }
      } catch (err: any) {
        setError(err.message || "Export error");
      }
    });
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        aria-label="Export client dossier for case management"
        className="flex items-center gap-1.5"
        disabled={isPending}
        onClick={handleExport}
        size="sm"
        variant={variant}
      >
        {isPending ? (
          <>
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Preparing Export...
          </>
        ) : (
          <>
            <FileDown className="h-3.5 w-3.5" />
            Export for CMS
          </>
        )}
      </Button>
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
