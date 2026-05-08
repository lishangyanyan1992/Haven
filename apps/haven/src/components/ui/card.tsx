import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-[var(--radius-lg)] border transition-colors duration-150", {
  variants: {
    variant: {
      default: "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-mid)]",
      feature: "border-transparent bg-[var(--haven-sand)] rounded-[var(--radius-2xl)]",
      alert: "border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)]",
      urgent: "border-[var(--haven-blush)] bg-[var(--haven-blush-light)]",
      post: "border-[var(--color-border)] bg-[var(--color-surface)]"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

type CardProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, ...props }: CardProps) {
  return <div {...props} className={cn(cardVariants({ variant }), className)} />;
}

export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("flex items-start justify-between gap-4 p-6", props.className)} />;
}

export function CardTitle(props: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} className={cn("text-h3", props.className)} />;
}

export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("p-6 pt-0", props.className)} />;
}
