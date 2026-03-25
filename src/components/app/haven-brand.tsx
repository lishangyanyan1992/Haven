import { cn } from "@/lib/utils";

export function HavenBrand({
  className,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-lora)] text-[22px] leading-none tracking-tight select-none",
        className
      )}
    >
      <span style={{ color: "var(--haven-ink)" }}>Ha</span>
      <span style={{ color: "var(--haven-sage)" }}>ven</span>
    </span>
  );
}
