import * as React from "react";

import { cn } from "@/lib/utils";

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { style, ...rest } = props;

  return (
    <select
      {...rest}
      className={cn(
        "block h-11 w-full appearance-auto rounded-[var(--radius-md)] border border-[var(--color-border-mid)] bg-[var(--haven-white)] px-3 pr-3 text-sm text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--haven-sage)]",
        rest.className
      )}
      style={style}
    />
  );
}
