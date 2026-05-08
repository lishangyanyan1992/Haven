import * as React from "react";

import { cn } from "@/lib/utils";

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "block min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border-mid)] bg-[var(--haven-white)] px-3 py-3 text-sm leading-6 text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[var(--color-text-tertiary)] hover:border-[var(--color-border-strong)] focus:border-[var(--haven-sage)]",
        props.className
      )}
    />
  );
}
