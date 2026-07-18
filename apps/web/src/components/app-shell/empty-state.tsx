import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("soft-card p-12 text-center", className)}>
      <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/15 via-purple-brand/10 to-gold-brand/15 grid place-items-center">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div className="font-display text-xl mt-4">{title}</div>
      {subtitle && <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
