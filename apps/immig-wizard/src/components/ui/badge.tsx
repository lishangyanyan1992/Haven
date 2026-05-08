import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] whitespace-nowrap uppercase transition-all focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-[var(--ring-soft)] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-[color:var(--destructive-subtle)] [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary-subtle text-[color:var(--green-700)] [a]:hover:bg-[color:var(--green-100)]",
        secondary:
          "border-[color:var(--border)] bg-secondary text-secondary-foreground [a]:hover:bg-[color:var(--neutral-100)]",
        destructive:
          "border-transparent bg-[color:var(--destructive-subtle)] text-destructive [a]:hover:bg-[color:rgb(201_58_50_/_0.14)]",
        outline:
          "border-[color:var(--border-strong)] bg-background text-foreground [a]:hover:bg-secondary",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground",
        link: "border-transparent px-0 text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
