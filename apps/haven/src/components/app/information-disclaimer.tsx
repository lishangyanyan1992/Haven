type InformationDisclaimerProps = {
  compact?: boolean;
};

export function InformationDisclaimer({ compact = false }: InformationDisclaimerProps) {
  return (
    <div
      className={
        compact
          ? "rounded-[var(--radius-xl)] border border-[rgba(191,10,48,0.18)] bg-[var(--haven-blush-light)] px-4 py-4"
          : "rounded-[var(--radius-2xl)] border border-[rgba(191,10,48,0.18)] bg-[var(--haven-blush-light)] px-5 py-5 md:px-6"
      }
    >
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--haven-blush-ink)]">
        Important disclaimer
      </p>
      <p className="text-body-sm mt-2 text-[var(--haven-blush-ink)]">
        Haven provides general information only. Nothing on this page is legal advice, and it should not be treated as a substitute for advice from a qualified immigration lawyer or accredited legal representative. Immigration outcomes depend on the specific facts of your case. If you need case-specific guidance, consult a lawyer before making decisions or filing.
      </p>
    </div>
  );
}
