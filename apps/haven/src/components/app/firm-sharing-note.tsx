import { Building2 } from "lucide-react";

/** Reminds a firm client what their firm can see. Shown on setup and documents. */
export function FirmSharingNote({ firmName, className = "" }: { firmName: string; className?: string }) {
  return (
    <p
      className={`flex items-start gap-2 rounded-[var(--radius-lg)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-4 py-3 text-body-sm text-[var(--haven-ink)] ${className}`}
    >
      <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Your answers and documents are shared with <strong>{firmName}</strong>. Your chats with Haven stay private.
      </span>
    </p>
  );
}
