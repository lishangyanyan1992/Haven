"use client";

import { useState, useTransition } from "react";
import { LoaderCircle } from "lucide-react";
import { FIRM_PIPELINE_STATUS_LABEL, type FirmPipelineStatus } from "@/lib/firms/types";
import { updateFirmClientPipelineStatusAction } from "@/server/firm-actions";

const PIPELINE_ORDER: FirmPipelineStatus[] = [
  "new_lead",
  "contacted",
  "consultation_scheduled",
  "consultation_completed",
  "contract_sent",
  "contract_signed",
  "archived"
];

const STATUS_PILL_STYLE: Record<FirmPipelineStatus, string> = {
  new_lead: "bg-[var(--haven-sand)] text-[var(--haven-ink)] border-[var(--haven-sand-mid)]",
  contacted: "bg-[var(--haven-sky-light)] text-[var(--haven-ink)] border-[var(--haven-sky-mid)]",
  consultation_scheduled: "bg-amber-100 text-amber-900 border-amber-300",
  consultation_completed: "bg-blue-100 text-blue-900 border-blue-300",
  contract_sent: "bg-purple-100 text-purple-900 border-purple-300",
  contract_signed: "bg-[var(--haven-sage-light)] text-[var(--haven-ink)] border-[var(--haven-sage-mid)] font-bold",
  archived: "bg-stone-100 text-stone-600 border-stone-300"
};

export function PipelineStatusSelect({
  firmClientId,
  initialStatus,
  compact = false
}: {
  firmClientId: string;
  initialStatus: FirmPipelineStatus;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<FirmPipelineStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as FirmPipelineStatus;
    const previous = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      try {
        const res = await updateFirmClientPipelineStatusAction(firmClientId, next);
        if (!res.ok) {
          setStatus(previous);
          setError(res.error || "Update failed");
        }
      } catch {
        setStatus(previous);
        setError("Network error");
      }
    });
  };

  return (
    <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <div className="relative">
        <select
          aria-label="Lead pipeline stage"
          className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition cursor-pointer appearance-none pr-6 focus:outline-none focus:ring-1 focus:ring-[var(--haven-ink)] ${
            STATUS_PILL_STYLE[status]
          } ${compact ? "text-[11px] py-0.5" : ""}`}
          disabled={isPending}
          onChange={handleChange}
          value={status}
        >
          {PIPELINE_ORDER.map((stage) => (
            <option key={stage} value={stage}>
              {FIRM_PIPELINE_STATUS_LABEL[stage]}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-current opacity-60">
          {isPending ? (
            <LoaderCircle className="h-3 w-3 animate-spin" />
          ) : (
            <span className="text-[9px]">▼</span>
          )}
        </div>
      </div>
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </div>
  );
}
