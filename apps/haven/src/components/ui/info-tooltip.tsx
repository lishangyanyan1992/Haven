import type { ReactNode } from "react";
import { Info } from "lucide-react";

type InfoTooltipProps = {
  /** Accessible label for the trigger (screen readers + hover title). */
  label: string;
  /** Tooltip body. */
  children: ReactNode;
  /** Horizontal anchor — "end" opens leftward (good near a right edge). */
  align?: "center" | "end";
};

/**
 * Dependency-free, accessible tooltip. Pure CSS (hover + focus-within), so it
 * works inside both server and client components. The trigger is a real button
 * for keyboard focus; the panel is aria-describedly revealed on hover/focus.
 */
export function InfoTooltip({ label, children, align = "center" }: InfoTooltipProps) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        className="inline-flex items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--haven-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--haven-sky-mid)]"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute top-full z-30 mt-2 w-64 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--haven-white)] p-3 text-left text-caption font-normal leading-relaxed text-[var(--haven-ink-mid)] opacity-0 shadow-[0_10px_30px_-12px_rgba(44,54,48,0.4)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 ${
          align === "end" ? "right-0" : "left-1/2 -translate-x-1/2"
        }`}
      >
        {children}
      </span>
    </span>
  );
}
