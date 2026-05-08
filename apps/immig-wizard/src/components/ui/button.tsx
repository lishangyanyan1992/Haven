import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md-token)] border border-transparent text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color,box-shadow,transform] duration-[var(--duration-base)] ease-[var(--ease-out)] outline-none select-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-[var(--ring-soft)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-[color:var(--destructive-subtle)] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--shadow-xs)] hover:bg-[var(--primary-hover)] hover:shadow-[var(--shadow-md)]",
        outline:
          "border-[1.5px] border-[color:var(--border-strong)] bg-background text-foreground hover:border-[color:var(--primary)] hover:bg-secondary aria-expanded:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[var(--shadow-xs)] hover:bg-[color:var(--neutral-100)] hover:shadow-[var(--shadow-sm)] aria-expanded:bg-secondary",
        ghost:
          "text-primary hover:bg-[color:rgb(30_82_65_/_0.08)] hover:text-[var(--primary-hover)] aria-expanded:bg-[color:rgb(30_82_65_/_0.08)]",
        destructive:
          "bg-[color:var(--destructive-subtle)] text-destructive hover:bg-[color:rgb(201_58_50_/_0.14)] focus-visible:border-destructive",
        link: "rounded-none px-0 text-primary underline-offset-4 hover:text-[var(--primary-hover)] hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3.5 has-data-[icon=inline-start]:pl-3.5",
        xs: "h-7 gap-1.5 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3.5 text-[0.8125rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2 px-5 text-[0.95rem]",
        icon: "size-10",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
