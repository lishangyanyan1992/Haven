import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-28 w-full rounded-[var(--radius-md-token)] border-[1.5px] border-input bg-background px-3.5 py-3 text-sm text-foreground shadow-[var(--shadow-xs)] transition-[border-color,box-shadow,background-color] duration-[var(--duration-base)] ease-[var(--ease-out)] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-[var(--ring-soft)] disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-[color:var(--destructive-subtle)]",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
