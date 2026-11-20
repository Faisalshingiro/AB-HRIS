import { cn } from '@/lib/utils';
import { titleCase } from '@/lib/format';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
  accent: 'bg-accent',
};

const STATUS_TONE: Record<string, Tone> = {
  active: 'success',
  approved: 'success',
  cleared: 'success',
  completed: 'success',
  paid: 'success',
  verified: 'success',
  finalized: 'success',
  hired: 'success',
  present: 'success',
  open: 'info',
  pending: 'warning',
  pending_approval: 'warning',
  probation: 'warning',
  screening: 'warning',
  interview: 'info',
  offer: 'accent',
  draft: 'neutral',
  on_hold: 'neutral',
  closed: 'neutral',
  cancelled: 'neutral',
  rejected: 'danger',
  absent: 'danger',
  late: 'warning',
  remote: 'info',
  leave: 'info',
  on_leave: 'info',
  suspended: 'danger',
  exited: 'neutral',
  submitted: 'info',
  clearance: 'warning',
  investigation: 'warning',
  hearing: 'warning',
  decided: 'info',
  appealed: 'warning',
  applied: 'neutral',
  self_submitted: 'info',
  manager_reviewed: 'accent',
  enrolled: 'info',
  in_progress: 'info',
  planned: 'neutral',
  locked: 'neutral',
  computed: 'info',
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
  ready_now: 'success',
  ready_1_2_years: 'info',
  ready_2_3_years: 'warning',
};

interface StatusBadgeProps {
  status: string | null | undefined;
  label?: string;
  tone?: Tone;
  className?: string;
}

export function StatusBadge({ status, label, tone, className }: StatusBadgeProps) {
  const key = (status ?? '').toLowerCase();
  const resolved = tone ?? STATUS_TONE[key] ?? 'neutral';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[resolved])} aria-hidden="true" />
      {label ?? titleCase(status)}
    </span>
  );
}
