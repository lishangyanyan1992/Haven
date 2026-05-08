import { cn } from "@/lib/utils";

export function HavenBrand({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <svg
        viewBox="0 0 64 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("h-8 w-auto select-none", className)}
        aria-label="Haven"
      >
        <path d="M32 6 L6 24 L6 52 L58 52 L58 24 Z" stroke="var(--haven-ink-mid)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d="M21 52 L21 40 Q21 33 32 33 Q43 33 43 40 L43 52" stroke="var(--haven-ink-mid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="10" y1="24" x2="54" y2="24" stroke="var(--haven-blush)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 220 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-9 w-auto select-none", className)}
      aria-label="Haven"
    >
      <path d="M32 4 L6 22 L6 50 L58 50 L58 22 Z" stroke="var(--haven-ink-mid)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M21 50 L21 38 Q21 31 32 31 Q43 31 43 38 L43 50" stroke="var(--haven-ink-mid)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="10" y1="22" x2="54" y2="22" stroke="var(--haven-blush)" strokeWidth="2.5" strokeLinecap="round" />
      <text
        x="72"
        y="38"
        fontFamily="'Cormorant Garamond', Georgia, serif"
        fontSize="34"
        fontWeight="300"
        fill="var(--neutral-900)"
        letterSpacing="-0.5"
      >
        Haven
      </text>
    </svg>
  );
}
