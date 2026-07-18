export function PageHeader({
  title,
  subtitle,
  eyebrow,
  badge,
  action,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {(eyebrow || badge) && (
          <div className="flex flex-wrap items-center gap-2">
            {eyebrow && (
              <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                {eyebrow}
              </div>
            )}
            {badge}
          </div>
        )}
        <h1 className="mt-1.5 font-display text-3xl leading-tight md:text-4xl">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 max-w-3xl text-[14px] leading-relaxed text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 self-start sm:self-auto">{action}</div>}
    </header>
  );
}
