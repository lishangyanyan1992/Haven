import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px] font-medium leading-[1.4]",
  {
    variants: {
      variant: {
        visa: "bg-[var(--haven-sage-light)] text-[var(--haven-ink-mid)]",
        community: "bg-[var(--haven-sky-light)] text-[var(--haven-sky-ink)]",
        active: "bg-[var(--haven-success-light)] text-[var(--haven-success-ink)]",
        pending: "bg-[var(--haven-sand)] text-[var(--haven-ink-mid)]",
        urgent: "bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)]",
        count:
          "min-h-[18px] min-w-[18px] justify-center rounded-full bg-[var(--haven-sage)] px-1.5 text-[11px] font-semibold text-white"
      }
    },
    defaultVariants: {
      variant: "visa"
    }
  }
);

type BadgeProps = {
  children: React.ReactNode;
  className?: string;
} & VariantProps<typeof badgeVariants>;

export function Badge({ children, className, variant }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)}>{children}</span>;
}
