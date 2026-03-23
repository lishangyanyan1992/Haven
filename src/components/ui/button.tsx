import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border text-sm font-medium transition-all duration-150 focus-visible:outline-none active:scale-[0.97] active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-[var(--haven-ink)] bg-[var(--haven-ink)] text-[var(--haven-cream)] hover:bg-[var(--haven-ink-mid)] hover:border-[var(--haven-ink-mid)]",
        accent:
          "border-[var(--haven-sage)] bg-[var(--haven-sage)] text-white hover:border-[var(--haven-sage-strong)] hover:bg-[var(--haven-sage-strong)]",
        outline:
          "border-[var(--haven-ink)] bg-transparent text-[var(--haven-ink)] hover:bg-[var(--haven-sage-light)]",
        ghost:
          "border-transparent bg-[var(--haven-sage-light)] text-[var(--haven-ink-mid)] hover:bg-[var(--haven-sage-mid)] hover:text-[var(--haven-ink)]",
        // For use on dark/ink-colored backgrounds
        cream:
          "border-[var(--haven-cream)] bg-[var(--haven-cream)] text-[var(--haven-ink)] hover:bg-white hover:border-white",
        "ghost-light":
          "border-[rgba(253,250,246,0.3)] bg-[rgba(253,250,246,0.1)] text-[var(--haven-cream)] hover:bg-[rgba(253,250,246,0.2)]",
        destructive:
          "border-[var(--haven-blush)] bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)] hover:bg-[var(--haven-blush)]"
      },
      size: {
        default: "px-5 py-2.5",
        sm: "min-h-9 px-3.5 py-1.5 text-[13px]",
        lg: "min-h-12 px-7 py-3 text-[15px]"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, size, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
