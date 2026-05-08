import { cn } from "@/lib/utils"

interface HavenMarkProps {
  className?: string
  iconClassName?: string
  labelClassName?: string
  compact?: boolean
}

export function HavenMark({
  className,
  iconClassName,
  labelClassName,
  compact = false,
}: HavenMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <svg
        viewBox="0 0 64 56"
        aria-hidden="true"
        className={cn("h-8 w-auto shrink-0", iconClassName)}
        fill="none"
      >
        <path
          d="M32 6 L6 24 L6 52 L58 52 L58 24 Z"
          stroke="#1E5241"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 52 L21 40 Q21 33 32 33 Q43 33 43 40 L43 52"
          stroke="#1E5241"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="10"
          y1="24"
          x2="54"
          y2="24"
          stroke="#C98928"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {!compact && (
        <span
          className={cn(
            "font-heading text-[1.85rem] leading-none font-light tracking-[-0.05em] text-foreground",
            labelClassName
          )}
        >
          Haven
        </span>
      )}
    </div>
  )
}
