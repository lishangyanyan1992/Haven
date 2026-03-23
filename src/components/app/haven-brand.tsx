import { cn } from "@/lib/utils";

export function HavenBrand({
  className,
  compact = false
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--color-border)] bg-[var(--haven-white)]">
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2.75L4.75 6.9V15.1L12 19.25L19.25 15.1V6.9L12 2.75Z"
            fill="var(--haven-sage-light)"
            stroke="var(--haven-sage-mid)"
            strokeWidth="1"
          />
          <circle cx="12" cy="11.5" r="3" fill="var(--haven-sage)" opacity="0.9" />
          <circle cx="12" cy="11.5" r="1.1" fill="var(--haven-ink)" opacity="0.8" />
        </svg>
      </div>
      {!compact && (
        <div>
          <p className="text-[15px] font-medium tracking-[-0.01em] text-[var(--haven-ink)]">Haven</p>
          <p className="text-label">Belonging first</p>
        </div>
      )}
    </div>
  );
}
