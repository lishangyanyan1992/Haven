import Link from "next/link";

export function FirmNavTabs({
  current,
  leadsCount,
  clientsCount
}: {
  current: "leads" | "clients";
  leadsCount: number;
  clientsCount: number;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-3">
      <Link
        href="/firm"
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium transition ${
          current === "leads"
            ? "bg-[var(--haven-ink)] text-[var(--haven-cream)] font-semibold shadow-sm"
            : "bg-[var(--haven-white)] text-[var(--haven-ink)] hover:bg-[var(--haven-cream)] border border-[var(--color-border)]"
        }`}
      >
        <span>Leads Pipeline</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            current === "leads"
              ? "bg-[var(--haven-cream)] text-[var(--haven-ink)]"
              : "bg-[var(--haven-cream)] text-[var(--haven-ink-mid)]"
          }`}
        >
          {leadsCount}
        </span>
      </Link>

      <Link
        href="/firm/clients"
        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium transition ${
          current === "clients"
            ? "bg-[var(--haven-ink)] text-[var(--haven-cream)] font-semibold shadow-sm"
            : "bg-[var(--haven-white)] text-[var(--haven-ink)] hover:bg-[var(--haven-cream)] border border-[var(--color-border)]"
        }`}
      >
        <span>Retained Clients</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            current === "clients"
              ? "bg-[var(--haven-cream)] text-[var(--haven-ink)]"
              : "bg-[var(--haven-cream)] text-[var(--haven-ink-mid)]"
          }`}
        >
          {clientsCount}
        </span>
      </Link>
    </div>
  );
}
