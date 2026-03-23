import * as React from "react";

import { cn } from "@/lib/utils";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "block h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-border-mid)] bg-[var(--haven-white)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--color-text-tertiary)] hover:border-[var(--color-border-strong)] focus:border-[var(--haven-sage)]",
        props.className
      )}
    />
  );
}
