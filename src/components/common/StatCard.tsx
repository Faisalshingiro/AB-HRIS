import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'accent';
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default', className }: StatCardProps) {
  const displayValue = typeof value === 'string' ? value.replace(/%{2,}/g, '%') : value;

  return (
    <div
      className={cn(
        'flex h-full flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md md:p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="ed-label">{label}</p>
        {Icon ? (
          <Icon
            className={cn('h-4 w-4 shrink-0', tone === 'accent' ? 'text-accent' : 'text-muted-foreground')}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className="mt-3">
        <p className={cn('ed-figure text-2xl md:text-3xl', tone === 'accent' ? 'text-accent' : 'text-foreground')}>
          {displayValue}
        </p>
        {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}
