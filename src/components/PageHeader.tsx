import type { ReactNode } from "react";

interface PageHeaderProps {
  kicker?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

// Cabeçalho de página no padrão do ds-summit: rótulo em verde, título leve e texto de apoio.
export function PageHeader({ kicker = "CUPOLA Summit 2027", title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="mb-2 block text-xs font-semibold tracking-[0.08em] text-accent-text">{kicker}</span>
        <h1 className="text-[clamp(24px,3vw,34px)] font-[650] leading-[1.15] tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[60ch] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
