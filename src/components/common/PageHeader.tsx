import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="ed-label mb-2">{eyebrow}</p> : null}
          <h1 className="text-balance text-xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-prose text-pretty text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="ed-rule mt-5" />
    </div>
  );
}
