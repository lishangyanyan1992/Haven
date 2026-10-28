import { Building2 } from "lucide-react";

function formatFirmNames(names: string[]): string {
  if (names.length === 0) return "your law firm";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

/** Reminds a firm client what their connected firms can see. Shown on setup and documents. */
export function FirmSharingNote({
  firmName,
  firmNames,
  className = ""
}: {
  firmName?: string;
  firmNames?: string[];
  className?: string;
}) {
  const displayFirms =
    firmNames && firmNames.length > 0
      ? formatFirmNames(firmNames)
      : firmName || "your law firm";

  return (
    <p
      className={`flex items-start gap-2 rounded-[var(--radius-lg)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-4 py-3 text-body-sm text-[var(--haven-ink)] ${className}`}
    >
      <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Your answers and documents are shared with <strong>{displayFirms}</strong>. Your chats with Haven stay private.
      </span>
    </p>
  );
}
