import { cn } from "@/lib/utils";

export function Table(props: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table {...props} className={cn("w-full border-collapse text-left text-sm", props.className)} />;
}

export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} className={cn("text-xs uppercase tracking-[0.16em] text-muted-foreground", props.className)} />;
}

export function TBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} className={cn("[&_tr:last-child]:border-0", props.className)} />;
}

export function TR(props: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props} className={cn("border-b border-border", props.className)} />;
}

export function TH(props: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...props} className={cn("px-4 py-3 font-medium", props.className)} />;
}

export function TD(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} className={cn("px-4 py-4 align-top", props.className)} />;
}
