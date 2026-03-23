import * as React from "react";

import { cn } from "@/lib/utils";

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { style, ...rest } = props;

  return (
    <select
      {...rest}
      className={cn(
        "block h-11 w-full appearance-none rounded-[var(--radius-md)] border border-[var(--color-border-mid)] bg-[var(--haven-white)] bg-no-repeat px-3 pr-10 text-sm text-[var(--color-text-primary)] outline-none transition-[border-color,box-shadow] duration-150 hover:border-[var(--color-border-strong)] focus:border-[var(--haven-sage)]",
        rest.className
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L6 6L11 1' stroke='%237A8E86' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 12px center",
        backgroundSize: "12px 8px",
        ...style
      }}
    />
  );
}
