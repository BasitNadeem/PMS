export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow && (
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">
            {eyebrow}
          </div>
        )}
        <h1 className="serif text-[34px] leading-[1.05] text-ink">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 text-[15px] text-ink-mute">{subtitle}</p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2.5">{children}</div>
      )}
    </div>
  );
}
