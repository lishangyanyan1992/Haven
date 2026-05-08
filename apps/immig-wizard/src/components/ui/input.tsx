import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-[var(--radius-md-token)] border-[1.5px] border-input bg-background px-3.5 py-2.5 text-sm text-foreground shadow-[var(--shadow-xs)] transition-[border-color,box-shadow,background-color] duration-[var(--duration-base)] ease-[var(--ease-out)] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-[var(--ring-soft)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-[color:var(--destructive-subtle)]",
        className
      )}
      {...props}
    />
  )
}

export { Input }
