import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Landmark,
  Lock,
  Pencil,
  Play,
  Plus,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ExportMenu } from '@/components/common/ExportMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { exportToPdf, type ExportColumn } from '@/lib/export';
import { RWF, compactRWF, formatDate, fullName, monthLabel, titleCase, toISODate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { payrollApi } from '@/services/api';
import type { PayrollItem, PayrollPeriod } from '@/types/types';

/* -------------------------------- helpers -------------------------------- */

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

const num = (value: number | string | null | undefined): number => Number(value ?? 0);

const LOCKED_STATUSES = ['approved', 'paid', 'locked'];

const isLocked = (status: string | undefined): boolean => LOCKED_STATUSES.includes(status ?? '');

const periodStatusHint = (status: string): string => {
  switch (status) {
    case 'draft':
      return 'Draft — ready to run';
    case 'pending_approval':
      return 'Awaiting approval — no recalculation';
    case 'approved':
      return 'Approved — locked';
    case 'paid':
      return 'Paid — locked';
    case 'locked':
      return 'Locked — no recalculation';
    default:
      return `${titleCase(status)} — no recalculation`;
  }
};

const defaultPeriodForm = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const pay = new Date(now.getFullYear(), now.getMonth(), 28);
  return {
    name: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    period_start: toISODate(start),
    period_end: toISODate(end),
    pay_date: toISODate(pay),
    notes: '',
  };
};

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

function PeriodPicker({
  periods,
  value,
  onChange,
  children,
}: {
  periods: PayrollPeriod[];
  value: string;
  onChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3">
        <span className="ed-label">Pay period</span>
        <Select value={value} onValueChange={onChange} disabled={periods.length === 0}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Select a period" />
          </SelectTrigger>
          <SelectContent>
            {periods.map((period) => (
              <SelectItem key={period.id} value={period.id}>
                {period.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

/* ----------------------------- employee view ----------------------------- */

function PayslipLine({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-0',
        emphasis && 'border-b-0',
      )}
    >
      <dt className={cn('text-sm', emphasis ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</dt>
      <dd
        className={cn(
          'ed-table-num whitespace-nowrap text-sm',
          emphasis ? 'font-semibold text-foreground' : 'text-foreground',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function EmployeePayslips({ employeeId, employeeName }: { employeeId: string | null; employeeName: string }) {
  const [payslips, setPayslips] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    payrollApi
      .myPayslips(employeeId)
      .then((rows) => {
        if (!active) return;
        setPayslips(rows);
        setExpandedId(rows[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        toast.error('Could not load your payslips', { description: errorMessage(error) });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [employeeId]);

  const currentYear = new Date().getFullYear();
  const latest = payslips[0] ?? null;
  const paidThisYear = payslips
    .filter((item) => new Date(item.period?.pay_date ?? item.created_at).getFullYear() === currentYear)
    .reduce((sum, item) => sum + num(item.net_pay), 0);

  const downloadPayslip = (item: PayrollItem) => {
    const lines = [
      { label: 'Basic salary', value: RWF(item.basic_salary) },
      { label: 'Allowances', value: RWF(item.allowances) },
      { label: 'Overtime', value: RWF(item.overtime) },
      { label: 'Gross pay', value: RWF(item.gross_pay) },
      { label: 'PAYE', value: `- ${RWF(item.paye)}` },
      { label: 'RSSB pension (employee 3%)', value: `- ${RWF(item.pension_employee)}` },
      { label: 'Maternity leave benefit (0.3%)', value: `- ${RWF(item.maternity_employee)}` },
      { label: 'CBHI (0.5%)', value: `- ${RWF(item.cbhi)}` },
      { label: 'Other deductions', value: `- ${RWF(item.other_deductions)}` },
      { label: 'Total deductions', value: `- ${RWF(item.total_deductions)}` },
      { label: 'Net pay', value: RWF(item.net_pay) },
      { label: 'Days absent', value: String(item.days_absent) },
    ];
    const periodName = item.period?.name ?? monthLabel(item.created_at);
    try {
      exportToPdf(
        `payslip-${periodName.replace(/\s+/g, '-').toLowerCase()}`,
        'AB Rwanda — Payslip',
        `${employeeName} · ${periodName} · Paid ${formatDate(item.period?.pay_date ?? item.created_at)}`,
        [
          { header: 'Line', accessor: (row: { label: string; value: string }) => row.label },
          { header: 'Amount', accessor: (row: { label: string; value: string }) => row.value },
        ],
        lines,
        { orientation: 'portrait' },
      );
      toast.success('Payslip downloaded');
    } catch {
      toast.error('Could not generate the payslip PDF');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Payroll"
        title="My payslips"
        description="Every payslip issued to you, with the full statutory breakdown behind each net figure."
      />

      {loading ? (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
          <TableSkeleton rows={4} />
        </div>
      ) : !employeeId ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={Receipt}
            title="No employee record linked"
            description="Your login is not connected to a personnel file, so payslips cannot be shown. Ask HR to link your profile."
          />
        </div>
      ) : payslips.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={Receipt}
            title="No payslips yet"
            description="Payslips appear here as soon as finance processes a payroll period that includes you."
          />
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-3 md:grid-cols-3">
            <StatCard
              label="Latest net pay"
              value={latest ? RWF(latest.net_pay) : ''}
              hint={latest ? (latest.period?.name ?? monthLabel(latest.created_at)) : undefined}
              icon={Wallet}
              tone="accent"
            />
            <StatCard
              label={`Paid in ${currentYear}`}
              value={compactRWF(paidThisYear)}
              hint="Net pay across this calendar year"
              icon={Banknote}
            />
            <StatCard
              label="Payslips issued"
              value={payslips.length}
              hint="Most recent 24 payslips on file"
              icon={Receipt}
            />
          </div>

          <div className="space-y-3">
            {payslips.map((item) => {
              const open = expandedId === item.id;
              return (
                <div key={item.id} className="overflow-hidden rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : item.id)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {item.period?.name ?? `Payslip · ${monthLabel(item.created_at)}`}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Paid {formatDate(item.period?.pay_date ?? item.created_at)} · {item.days_absent} day
                        {item.days_absent === 1 ? '' : 's'} absent
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="ed-label">Net pay</p>
                        <p className="ed-table-num mt-0.5 text-sm font-semibold text-foreground">{RWF(item.net_pay)}</p>
                      </div>
                      <ChevronDown
                        className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')}
                        aria-hidden="true"
                      />
                    </div>
                  </button>

                  {open ? (
                    <div className="border-t border-border px-4 py-4">
                      <dl className="grid gap-x-8 md:grid-cols-2">
                        <PayslipLine label="Basic salary" value={RWF(item.basic_salary)} />
                        <PayslipLine label="Allowances" value={RWF(item.allowances)} />
                        <PayslipLine label="Overtime" value={RWF(item.overtime)} />
                        <PayslipLine label="Gross pay" value={RWF(item.gross_pay)} emphasis />
                        <PayslipLine label="PAYE" value={`- ${RWF(item.paye)}`} />
                        <PayslipLine label="RSSB pension (employee 3%)" value={`- ${RWF(item.pension_employee)}`} />
                        <PayslipLine
                          label="Maternity leave benefit (0.3%)"
                          value={`- ${RWF(item.maternity_employee)}`}
                        />
                        <PayslipLine label="CBHI (0.5%)" value={`- ${RWF(item.cbhi)}`} />
                        <PayslipLine label="Other deductions" value={`- ${RWF(item.other_deductions)}`} />
                        <PayslipLine label="Total deductions" value={`- ${RWF(item.total_deductions)}`} emphasis />
                        <PayslipLine label="Net pay" value={RWF(item.net_pay)} emphasis />
                        <PayslipLine label="Days absent" value={String(item.days_absent)} />
                      </dl>

                      {item.notes ? (
                        <p className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          {item.notes}
                        </p>
                      ) : null}

                      <div className="mt-4 flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => downloadPayslip(item)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download payslip
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------ rates panel ------------------------------ */

function RatesPanel() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
        <h3 className="text-sm font-semibold text-foreground">Statutory reference — Rwanda</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Rates applied by the payroll engine. Use them to verify a payslip line by line.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="ed-label whitespace-nowrap py-2 text-left">PAYE band (monthly)</th>
              <th className="ed-label whitespace-nowrap py-2 text-right">Rate</th>
            </tr>
          </thead>
          <tbody>
            {[
              { band: 'Up to RWF 60,000', rate: '0%' },
              { band: 'RWF 60,001 – 100,000', rate: '10%' },
              { band: 'RWF 100,001 – 200,000', rate: '20%' },
              { band: 'Above RWF 200,000', rate: '30%' },
            ].map((row) => (
              <tr key={row.band} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap py-1.5 text-muted-foreground">{row.band}</td>
                <td className="ed-table-num whitespace-nowrap py-1.5 text-right text-foreground">{row.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
        {[
          { label: 'RSSB pension — employee', rate: '3.0%' },
          { label: 'RSSB pension — employer', rate: '3.0%' },
          { label: 'Maternity leave benefit — employee', rate: '0.3%' },
          { label: 'Maternity leave benefit — employer', rate: '0.3%' },
          { label: 'CBHI — employee', rate: '0.5%' },
        ].map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="ed-table-num whitespace-nowrap text-foreground">{row.rate}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* -------------------------------- page ---------------------------------- */

type ConfirmKind = 'run' | 'approve' | 'paid';

interface ConfirmState {
  kind: ConfirmKind;
  period: PayrollPeriod;
}

export default function PayrollPage() {
  const { employeeId, profile, isFinance } = useAuth();
  const isPayrollOfficer = isFinance;

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [tab, setTab] = useState('periods');

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [newPeriodOpen, setNewPeriodOpen] = useState(false);
  const [periodForm, setPeriodForm] = useState(defaultPeriodForm);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<PayrollItem | null>(null);
  const [adjustOther, setAdjustOther] = useState('0');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  const loadPeriods = useCallback(async () => {
    setPeriodsLoading(true);
    try {
      const rows = await payrollApi.periods();
      setPeriods(rows);
      setSelectedPeriodId((current) =>
        current && rows.some((row) => row.id === current) ? current : (rows[0]?.id ?? ''),
      );
    } catch (error) {
      toast.error('Could not load payroll periods', { description: errorMessage(error) });
    } finally {
      setPeriodsLoading(false);
    }
  }, []);

  const loadItems = useCallback(async (periodId: string) => {
    if (!periodId) {
      setItems([]);
      return;
    }
    setItemsLoading(true);
    try {
      setItems(await payrollApi.items(periodId));
    } catch (error) {
      toast.error('Could not load the payroll register', { description: errorMessage(error) });
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isPayrollOfficer) void loadPeriods();
  }, [isPayrollOfficer, loadPeriods]);

  useEffect(() => {
    if (isPayrollOfficer && selectedPeriodId) void loadItems(selectedPeriodId);
  }, [isPayrollOfficer, selectedPeriodId, loadItems]);

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  );

  const latestPeriod = periods[0] ?? null;
  const averageNet =
    latestPeriod && latestPeriod.employee_count > 0 ? num(latestPeriod.total_net) / latestPeriod.employee_count : 0;

  const canEditItems = isFinance && !!selectedPeriod && !isLocked(selectedPeriod.status);

  /* ------------------------------ actions ------------------------------- */

  const openNewPeriod = () => {
    setPeriodForm(defaultPeriodForm());
    setPeriodError(null);
    setNewPeriodOpen(true);
  };

  const submitPeriod = async () => {
    setPeriodError(null);
    const name = periodForm.name.trim();
    if (!name) {
      setPeriodError('Give the period a name, for example “November 2026”.');
      return;
    }
    if (!periodForm.period_start || !periodForm.period_end || !periodForm.pay_date) {
      setPeriodError('Period start, period end and pay date are all required.');
      return;
    }
    if (periodForm.period_end < periodForm.period_start) {
      setPeriodError('The period end cannot fall before the period start.');
      return;
    }
    if (periodForm.pay_date < periodForm.period_start) {
      setPeriodError('The pay date cannot fall before the period start.');
      return;
    }
    if (periods.some((period) => period.name.toLowerCase() === name.toLowerCase())) {
      setPeriodError('A payroll period with that name already exists.');
      return;
    }

    setCreating(true);
    try {
      await payrollApi.createPeriod({
        name,
        period_start: periodForm.period_start,
        period_end: periodForm.period_end,
        pay_date: periodForm.pay_date,
        notes: periodForm.notes.trim() || null,
        status: 'draft',
      });
      toast.success('Payroll period created', {
        description: 'Run payroll when you are ready to compute the payslips.',
      });
      setNewPeriodOpen(false);
      await loadPeriods();
    } catch (error) {
      const message = errorMessage(error);
      setPeriodError(message);
      toast.error('Could not create the payroll period', { description: message });
    } finally {
      setCreating(false);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      if (confirm.kind === 'run') {
        const result = await payrollApi.run(confirm.period.id);
        toast.success(
          `Payroll processed for ${result.employees} employee${result.employees === 1 ? '' : 's'}`,
          { description: `Total net pay ${RWF(result.total_net)}` },
        );
      } else if (confirm.kind === 'approve') {
        await payrollApi.approve(confirm.period.id);
        toast.success(`${confirm.period.name} approved`, {
          description: 'The period is now locked against recalculation.',
        });
      } else {
        await payrollApi.markPaid(confirm.period.id);
        toast.success(`${confirm.period.name} marked as paid`, {
          description: 'Net pay has been recorded as disbursed.',
        });
      }
      setConfirm(null);
      await loadPeriods();
      if (selectedPeriodId) await loadItems(selectedPeriodId);
    } catch (error) {
      toast.error('The payroll action could not be completed', { description: errorMessage(error) });
    } finally {
      setConfirmBusy(false);
    }
  };

  const openAdjust = (item: PayrollItem) => {
    setAdjustTarget(item);
    setAdjustOther(String(num(item.other_deductions)));
    setAdjustNote(item.notes ?? '');
    setAdjustError(null);
  };

  const adjustPreview = useMemo(() => {
    if (!adjustTarget) return { statutory: 0, total: 0, net: 0 };
    const parsed = Number(adjustOther);
    const other = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    const statutory =
      num(adjustTarget.paye) +
      num(adjustTarget.pension_employee) +
      num(adjustTarget.maternity_employee) +
      num(adjustTarget.cbhi);
    const total = statutory + other;
    return { statutory, total, net: num(adjustTarget.gross_pay) - total };
  }, [adjustTarget, adjustOther]);

  const submitAdjust = async () => {
    if (!adjustTarget) return;
    const other = Number(adjustOther);
    if (!Number.isFinite(other) || other < 0) {
      setAdjustError('Other deductions must be a positive amount — enter 0 to clear them.');
      return;
    }
    setAdjusting(true);
    try {
      await payrollApi.updateItem(adjustTarget.id, {
        other_deductions: other,
        total_deductions: adjustPreview.total,
        net_pay: adjustPreview.net,
        notes: adjustNote.trim() || null,
      });
      toast.success('Payslip line updated', {
        description: `${fullName(adjustTarget.employee)} · net pay ${RWF(adjustPreview.net)}`,
      });
      setAdjustTarget(null);
      await loadItems(selectedPeriodId);
    } catch (error) {
      const message = errorMessage(error);
      setAdjustError(message);
      toast.error('Could not update the payslip line', { description: message });
    } finally {
      setAdjusting(false);
    }
  };

  /* ------------------------------ derived ------------------------------- */

  const registerTotals = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc.basic += num(item.basic_salary);
          acc.allowances += num(item.allowances);
          acc.gross += num(item.gross_pay);
          acc.paye += num(item.paye);
          acc.pension += num(item.pension_employee);
          acc.cbhi += num(item.cbhi);
          acc.other += num(item.other_deductions);
          acc.deductions += num(item.total_deductions);
          acc.net += num(item.net_pay);
          return acc;
        },
        { basic: 0, allowances: 0, gross: 0, paye: 0, pension: 0, cbhi: 0, other: 0, deductions: 0, net: 0 },
      ),
    [items],
  );

  const statutory = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc.gross += num(item.gross_pay);
          acc.paye += num(item.paye);
          acc.pensionEmployee += num(item.pension_employee);
          acc.pensionEmployer += num(item.pension_employer);
          acc.maternityEmployee += num(item.maternity_employee);
          acc.maternityEmployer += num(item.maternity_employer);
          acc.cbhi += num(item.cbhi);
          acc.net += num(item.net_pay);
          return acc;
        },
        {
          gross: 0,
          paye: 0,
          pensionEmployee: 0,
          pensionEmployer: 0,
          maternityEmployee: 0,
          maternityEmployer: 0,
          cbhi: 0,
          net: 0,
        },
      ),
    [items],
  );

  const statutoryTotals = useMemo(() => {
    const employeeTotal =
      statutory.paye + statutory.pensionEmployee + statutory.maternityEmployee + statutory.cbhi;
    const employerTotal = statutory.pensionEmployer + statutory.maternityEmployer;
    return { employeeTotal, employerTotal, grandTotal: employeeTotal + employerTotal };
  }, [statutory]);

  const registerColumns = useMemo<ExportColumn<PayrollItem>[]>(
    () => [
      { header: 'Employee no', accessor: (row) => row.employee?.employee_no ?? '' },
      { header: 'Employee', accessor: (row) => fullName(row.employee) },
      { header: 'Basic salary', accessor: (row) => num(row.basic_salary) },
      { header: 'Allowances', accessor: (row) => num(row.allowances) },
      { header: 'Overtime', accessor: (row) => num(row.overtime) },
      { header: 'Gross pay', accessor: (row) => num(row.gross_pay) },
      { header: 'PAYE', accessor: (row) => num(row.paye) },
      { header: 'RSSB pension (3%)', accessor: (row) => num(row.pension_employee) },
      { header: 'CBHI (0.5%)', accessor: (row) => num(row.cbhi) },
      { header: 'Other deductions', accessor: (row) => num(row.other_deductions) },
      { header: 'Total deductions', accessor: (row) => num(row.total_deductions) },
      { header: 'Net pay', accessor: (row) => num(row.net_pay) },
      { header: 'Days absent', accessor: (row) => num(row.days_absent) },
    ],
    [],
  );

  const statutoryRows = useMemo(
    () => [
      { line: 'Gross pay', employee: statutory.gross, employer: 0, total: statutory.gross },
      { line: 'PAYE', employee: statutory.paye, employer: 0, total: statutory.paye },
      {
        line: 'RSSB pension (3%)',
        employee: statutory.pensionEmployee,
        employer: statutory.pensionEmployer,
        total: statutory.pensionEmployee + statutory.pensionEmployer,
      },
      {
        line: 'Maternity leave benefit (0.3%)',
        employee: statutory.maternityEmployee,
        employer: statutory.maternityEmployer,
        total: statutory.maternityEmployee + statutory.maternityEmployer,
      },
      { line: 'CBHI (0.5%)', employee: statutory.cbhi, employer: 0, total: statutory.cbhi },
      {
        line: 'Total statutory deductions',
        employee: statutoryTotals.employeeTotal,
        employer: statutoryTotals.employerTotal,
        total: statutoryTotals.grandTotal,
      },
      { line: 'Net pay', employee: 0, employer: 0, total: statutory.net },
    ],
    [statutory, statutoryTotals],
  );

  const statutoryColumns = useMemo<ExportColumn<(typeof statutoryRows)[number]>[]>(
    () => [
      { header: 'Line', accessor: (row) => row.line },
      { header: 'Employee (RWF)', accessor: (row) => row.employee },
      { header: 'Employer (RWF)', accessor: (row) => row.employer },
      { header: 'Total (RWF)', accessor: (row) => row.total },
    ],
    [],
  );

  const bankColumns = useMemo<ExportColumn<PayrollItem>[]>(
    () => [
      { header: 'Employee', accessor: (row) => fullName(row.employee) },
      { header: 'Employee no', accessor: (row) => row.employee?.employee_no ?? '' },
      { header: 'Bank', accessor: (row) => row.employee?.bank_name ?? '' },
      { header: 'Account number', accessor: (row) => row.employee?.bank_account ?? '' },
      { header: 'Net pay (RWF)', accessor: (row) => num(row.net_pay) },
    ],
    [],
  );

  const missingBankDetails = useMemo(
    () => items.filter((item) => !item.employee?.bank_name || !item.employee?.bank_account).length,
    [items],
  );

  const confirmCopy = useMemo(() => {
    if (!confirm) return { title: '', description: '', label: 'Confirm' };
    if (confirm.kind === 'run') {
      return {
        title: `Run payroll for ${confirm.period.name}?`,
        description:
          'Every active, probationary and on-leave employee is recalculated from their salary and attendance. Existing payslip lines for this period are replaced.',
        label: 'Run payroll',
      };
    }
    if (confirm.kind === 'approve') {
      return {
        title: `Approve ${confirm.period.name}?`,
        description:
          'Approval locks the period against recalculation and finalises every payslip. This cannot be undone from the workspace.',
        label: 'Approve payroll',
      };
    }
    return {
      title: `Mark ${confirm.period.name} as paid?`,
      description:
        'This records that net pay has been disbursed to employees. The period becomes read-only and cannot be recalculated.',
      label: 'Mark as paid',
    };
  }, [confirm]);

  /* ------------------------------- render ------------------------------- */

  if (!isPayrollOfficer) {
    return <EmployeePayslips employeeId={employeeId} employeeName={profile?.full_name ?? 'Employee'} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Finance & payroll"
        title="Payroll"
        description="Monthly payroll runs, statutory deductions and bank schedules for AB Rwanda, every figure traceable to a payslip line."
        actions={
          <>
            <Button variant="outline" onClick={() => void loadPeriods()} disabled={periodsLoading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', periodsLoading && 'animate-spin')} />
              Refresh
            </Button>
            {isFinance ? (
              <Button onClick={openNewPeriod}>
                <Plus className="mr-2 h-4 w-4" />
                New period
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          label="Current period"
          value={latestPeriod ? monthLabel(latestPeriod.period_start) : ''}
          hint={latestPeriod ? titleCase(latestPeriod.status) : 'No periods yet'}
          icon={CalendarDays}
          tone="accent"
        />
        <StatCard
          label="Total net · latest"
          value={latestPeriod ? compactRWF(latestPeriod.total_net) : ''}
          hint={latestPeriod ? `Pay date ${formatDate(latestPeriod.pay_date)}` : 'Run payroll to populate'}
          icon={Wallet}
        />
        <StatCard
          label="Employees on payroll"
          value={latestPeriod ? latestPeriod.employee_count : 0}
          hint="Active, probation and on-leave staff"
          icon={Users}
        />
        <StatCard
          label="Average net pay"
          value={latestPeriod ? compactRWF(averageNet) : ''}
          hint="Per employee, latest period"
          icon={Banknote}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 md:w-auto md:grid-cols-4">
          <TabsTrigger value="periods" className="text-xs md:text-sm">
            Periods
          </TabsTrigger>
          <TabsTrigger value="register" className="text-xs md:text-sm">
            Payroll register
          </TabsTrigger>
          <TabsTrigger value="statutory" className="text-xs md:text-sm">
            Statutory report
          </TabsTrigger>
          <TabsTrigger value="bank" className="text-xs md:text-sm">
            Bank schedule
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------ periods ----------------------------- */}
        <TabsContent value="periods" className="mt-0">
          {!isFinance ? (
            <p className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              You have read-only access to payroll. Processing, approval and payslip adjustments are restricted to
              finance officers.
            </p>
          ) : null}

          {periodsLoading ? (
            <TableSkeleton rows={6} />
          ) : periods.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={CalendarDays}
                title="No payroll periods yet"
                description="Create a period for the month you want to pay, then run payroll to compute every payslip."
                action={
                  isFinance ? (
                    <Button onClick={openNewPeriod}>
                      <Plus className="mr-2 h-4 w-4" />
                      New period
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Period</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Period start</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Period end</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Pay date</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Employees</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Total gross</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Deductions</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Total net</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => {
                    const canRun = isFinance && period.status === 'draft';
                    const canApprove = isFinance && period.status === 'pending_approval';
                    const canPay = isFinance && period.status === 'approved';
                    return (
                      <tr key={period.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{period.name}</td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(period.period_start)}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(period.period_end)}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(period.pay_date)}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">
                          {period.employee_count}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">
                          {RWF(period.total_gross)}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                          {RWF(period.total_deductions)}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">
                          {RWF(period.total_net)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={period.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!canRun}
                              title={
                                canRun
                                  ? 'Recalculate every payslip in this period'
                                  : isFinance
                                    ? 'Payroll can only be run while the period is in draft'
                                    : 'Only finance officers may process payroll'
                              }
                              onClick={() => setConfirm({ kind: 'run', period })}
                            >
                              <Play className="mr-1.5 h-3.5 w-3.5" />
                              Run
                            </Button>
                            {period.status === 'pending_approval' ? (
                              <Button
                                size="sm"
                                disabled={!canApprove}
                                title={canApprove ? 'Approve and lock this period' : 'Only finance officers may approve payroll'}
                                onClick={() => setConfirm({ kind: 'approve', period })}
                              >
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                Approve
                              </Button>
                            ) : null}
                            {period.status === 'approved' ? (
                              <Button
                                size="sm"
                                disabled={!canPay}
                                title={canPay ? 'Record that net pay has been disbursed' : 'Only finance officers may mark payroll as paid'}
                                onClick={() => setConfirm({ kind: 'paid', period })}
                              >
                                <Landmark className="mr-1.5 h-3.5 w-3.5" />
                                Mark paid
                              </Button>
                            ) : null}
                          </div>
                          {period.status !== 'draft' ? (
                            <p className="mt-1 text-[11px] text-muted-foreground">{periodStatusHint(period.status)}</p>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------ register ---------------------------- */}
        <TabsContent value="register" className="mt-0">
          <PeriodPicker
            periods={periods}
            value={selectedPeriodId}
            onChange={setSelectedPeriodId}
            children={
              <ExportMenu
                filename={`payroll-register-${selectedPeriod?.name ?? 'period'}`}
                title={`Payroll register — ${selectedPeriod?.name ?? 'Period'}`}
                subtitle={`${items.length} payslip lines · ${selectedPeriod ? formatDate(selectedPeriod.period_start) : ''} to ${selectedPeriod ? formatDate(selectedPeriod.period_end) : ''}`}
                columns={registerColumns}
                rows={items}
                disabled={itemsLoading || items.length === 0}
              />
            }
          />

          {selectedPeriod && isLocked(selectedPeriod.status) ? (
            <p className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              This period is {titleCase(selectedPeriod.status).toLowerCase()} — payslip lines are locked and cannot be
              adjusted.
            </p>
          ) : null}

          {itemsLoading ? (
            <TableSkeleton rows={8} />
          ) : !selectedPeriod ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={CalendarDays}
                title="No payroll period selected"
                description="Create a period and run payroll to populate the register."
              />
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Receipt}
                title="No payslips in this period"
                description="Run payroll for this period to compute payslips for every active employee."
                action={
                  isFinance && selectedPeriod.status === 'draft' ? (
                    <Button onClick={() => setConfirm({ kind: 'run', period: selectedPeriod })}>
                      <Play className="mr-2 h-4 w-4" />
                      Run payroll
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Employee no</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Employee</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Basic</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Allowances</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Gross</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">PAYE</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Pension 3%</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">CBHI 0.5%</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Other</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Deductions</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Net pay</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Absent</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {item.employee?.employee_no ?? ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                        {fullName(item.employee)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">
                        {RWF(item.basic_salary)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                        {RWF(item.allowances)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">
                        {RWF(item.gross_pay)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                        {RWF(item.paye)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                        {RWF(item.pension_employee)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                        {RWF(item.cbhi)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                        {RWF(item.other_deductions)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">
                        {RWF(item.total_deductions)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">
                        {RWF(item.net_pay)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                        {item.days_absent}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canEditItems}
                          title={
                            canEditItems
                              ? 'Adjust other deductions and add a note'
                              : isFinance
                                ? 'Approved and paid periods are locked'
                                : 'Only finance officers may adjust payslip lines'
                          }
                          onClick={() => openAdjust(item)}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Adjust
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/40 font-semibold text-foreground">
                    <td className="whitespace-nowrap px-4 py-3" colSpan={2}>
                      Totals · {items.length} employee{items.length === 1 ? '' : 's'}
                    </td>
                    <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">{RWF(registerTotals.basic)}</td>
                    <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">
                      {RWF(registerTotals.allowances)}
                    </td>
                    <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">{RWF(registerTotals.gross)}</td>
                    <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">{RWF(registerTotals.paye)}</td>
                    <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">
                      {RWF(registerTotals.pension)}
                    </td>
                    <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">{RWF(registerTotals.cbhi)}</td>
                    <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">{RWF(registerTotals.other)}</td>
                    <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">
                      {RWF(registerTotals.deductions)}
                    </td>
                    <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">{RWF(registerTotals.net)}</td>
                    <td className="whitespace-nowrap px-4 py-3" />
                    <td className="whitespace-nowrap px-4 py-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ----------------------------- statutory ---------------------------- */}
        <TabsContent value="statutory" className="mt-0">
          <PeriodPicker
            periods={periods}
            value={selectedPeriodId}
            onChange={setSelectedPeriodId}
            children={
              <ExportMenu
                filename={`statutory-report-${selectedPeriod?.name ?? 'period'}`}
                title={`Statutory report — ${selectedPeriod?.name ?? 'Period'}`}
                subtitle={`${items.length} employees · PAYE, RSSB pension, maternity and CBHI`}
                columns={statutoryColumns}
                rows={statutoryRows}
                disabled={itemsLoading || items.length === 0}
              />
            }
          />

          {itemsLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-28 w-full" />
                ))}
              </div>
              <TableSkeleton rows={6} />
            </div>
          ) : !selectedPeriod || items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Receipt}
                title="Nothing to report yet"
                description="Run payroll for a period and the statutory contributions will be aggregated here."
              />
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <StatCard label="Total gross" value={compactRWF(statutory.gross)} hint="Before deductions" icon={Wallet} />
                <StatCard label="Total PAYE" value={compactRWF(statutory.paye)} hint="Pay as you earn" icon={Receipt} />
                <StatCard
                  label="Total statutory"
                  value={compactRWF(statutoryTotals.grandTotal)}
                  hint="Employee + employer contributions"
                  icon={ShieldCheck}
                  tone="accent"
                />
                <StatCard label="Total net pay" value={compactRWF(statutory.net)} hint="Payable to employees" icon={Banknote} />
              </div>

              <div className="mb-4 overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/60">
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Contribution</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Employee</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Employer</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Gross pay', employee: null, employer: null, total: statutory.gross, strong: false },
                      { label: 'PAYE', employee: statutory.paye, employer: null, total: statutory.paye, strong: false },
                      {
                        label: 'RSSB pension (3%)',
                        employee: statutory.pensionEmployee,
                        employer: statutory.pensionEmployer,
                        total: statutory.pensionEmployee + statutory.pensionEmployer,
                        strong: false,
                      },
                      {
                        label: 'Maternity leave benefit (0.3%)',
                        employee: statutory.maternityEmployee,
                        employer: statutory.maternityEmployer,
                        total: statutory.maternityEmployee + statutory.maternityEmployer,
                        strong: false,
                      },
                      { label: 'CBHI (0.5%)', employee: statutory.cbhi, employer: null, total: statutory.cbhi, strong: false },
                      {
                        label: 'Total statutory deductions',
                        employee: statutoryTotals.employeeTotal,
                        employer: statutoryTotals.employerTotal,
                        total: statutoryTotals.grandTotal,
                        strong: true,
                      },
                      { label: 'Net pay', employee: null, employer: null, total: statutory.net, strong: true },
                    ].map((row) => (
                      <tr
                        key={row.label}
                        className={cn(
                          'border-b border-border last:border-0',
                          row.strong ? 'bg-muted/40 font-semibold' : 'hover:bg-muted/40',
                        )}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-foreground">{row.label}</td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">
                          {row.employee === null ? '' : RWF(row.employee)}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">
                          {row.employer === null ? '' : RWF(row.employer)}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">
                          {RWF(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground" colSpan={4}>
                        {items.length} employee{items.length === 1 ? '' : 's'} · {selectedPeriod.name} · pay date{' '}
                        {formatDate(selectedPeriod.pay_date)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <RatesPanel />
            </>
          )}
        </TabsContent>

        {/* ------------------------------- bank ------------------------------- */}
        <TabsContent value="bank" className="mt-0">
          <PeriodPicker
            periods={periods}
            value={selectedPeriodId}
            onChange={setSelectedPeriodId}
            children={
              <ExportMenu
                filename={`bank-schedule-${selectedPeriod?.name ?? 'period'}`}
                title={`Bank schedule — ${selectedPeriod?.name ?? 'Period'}`}
                subtitle={`${items.length} employees · net pay to be credited`}
                columns={bankColumns}
                rows={items}
                disabled={itemsLoading || items.length === 0}
              />
            }
          />

          {itemsLoading ? (
            <TableSkeleton rows={8} />
          ) : !selectedPeriod || items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Building2}
                title="No bank schedule for this period"
                description="Run payroll for a period and the net pay of every employee will be listed here for disbursement."
              />
            </div>
          ) : (
            <>
              {missingBankDetails > 0 ? (
                <p className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {missingBankDetails} employee{missingBankDetails === 1 ? '' : 's'} on this schedule have no bank
                  details on file. Update their personnel record before disbursing.
                </p>
              ) : null}

              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/60">
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Employee</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Employee no</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Bank</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Account number</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Net pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                          {fullName(item.employee)}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {item.employee?.employee_no ?? ''}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-foreground">
                          {item.employee?.bank_name ?? ''}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {item.employee?.bank_account ?? ''}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">
                          {RWF(item.net_pay)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/40 font-semibold text-foreground">
                      <td className="whitespace-nowrap px-4 py-3" colSpan={4}>
                        Total to disburse · {items.length} employee{items.length === 1 ? '' : 's'}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">{RWF(registerTotals.net)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* --------------------------- confirm dialog --------------------------- */}
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !confirmBusy) setConfirm(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{confirmCopy.title}</DialogTitle>
            <DialogDescription>{confirmCopy.description}</DialogDescription>
          </DialogHeader>

          {confirm ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Period</span>
                <span className="font-medium text-foreground">{confirm.period.name}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Pay date</span>
                <span className="ed-table-num text-foreground">{formatDate(confirm.period.pay_date)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Employees</span>
                <span className="ed-table-num text-foreground">{confirm.period.employee_count}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Current net</span>
                <span className="ed-table-num text-foreground">{RWF(confirm.period.total_net)}</span>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={confirmBusy}>
              Cancel
            </Button>
            <Button onClick={() => void runConfirm()} disabled={confirmBusy}>
              {confirmBusy ? 'Working…' : confirmCopy.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------- new period dialog ------------------------- */}
      <Dialog
        open={newPeriodOpen}
        onOpenChange={(open) => {
          if (!open && !creating) setNewPeriodOpen(false);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>New payroll period</DialogTitle>
            <DialogDescription>
              Define the month to be paid. Payslips are computed when you run payroll for the period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="period-name">Period name</Label>
              <Input
                id="period-name"
                value={periodForm.name}
                onChange={(event) => setPeriodForm((form) => ({ ...form, name: event.target.value }))}
                placeholder="November 2026"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="period-start">Period start</Label>
                <Input
                  id="period-start"
                  type="date"
                  value={periodForm.period_start}
                  onChange={(event) => setPeriodForm((form) => ({ ...form, period_start: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="period-end">Period end</Label>
                <Input
                  id="period-end"
                  type="date"
                  value={periodForm.period_end}
                  onChange={(event) => setPeriodForm((form) => ({ ...form, period_end: event.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="period-pay-date">Pay date</Label>
              <Input
                id="period-pay-date"
                type="date"
                value={periodForm.pay_date}
                onChange={(event) => setPeriodForm((form) => ({ ...form, pay_date: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="period-notes">Notes</Label>
              <Textarea
                id="period-notes"
                rows={3}
                value={periodForm.notes}
                onChange={(event) => setPeriodForm((form) => ({ ...form, notes: event.target.value }))}
                placeholder="Optional context for this run, for example a one-off bonus cycle."
              />
            </div>

            {periodError ? <p className="text-sm text-destructive">{periodError}</p> : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewPeriodOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={() => void submitPeriod()} disabled={creating}>
              {creating ? 'Creating…' : 'Create period'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------- adjust dialog --------------------------- */}
      <Dialog
        open={!!adjustTarget}
        onOpenChange={(open) => {
          if (!open && !adjusting) setAdjustTarget(null);
        }}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adjust payslip line</DialogTitle>
            <DialogDescription>
              {adjustTarget
                ? `${fullName(adjustTarget.employee)} · ${adjustTarget.employee?.employee_no ?? 'No employee number'}`
                : 'Adjust the non-statutory deductions for this payslip.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div>
                <p className="ed-label">Gross pay</p>
                <p className="ed-table-num mt-1 text-foreground">{RWF(adjustTarget?.gross_pay)}</p>
              </div>
              <div>
                <p className="ed-label">Statutory deductions</p>
                <p className="ed-table-num mt-1 text-foreground">{RWF(adjustPreview.statutory)}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="other-deductions">Other deductions (RWF)</Label>
              <Input
                id="other-deductions"
                type="number"
                min={0}
                step={100}
                value={adjustOther}
                onChange={(event) => setAdjustOther(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Advances, loans or damages — anything outside PAYE, RSSB, maternity and CBHI.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adjust-note">Note</Label>
              <Textarea
                id="adjust-note"
                rows={3}
                value={adjustNote}
                onChange={(event) => setAdjustNote(event.target.value)}
                placeholder="Reason for the adjustment — recorded on the audit trail."
              />
            </div>

            <div className="rounded-lg border border-border bg-card p-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Total deductions</span>
                <span className="ed-table-num font-medium text-foreground">{RWF(adjustPreview.total)}</span>
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Net pay</span>
                <span className="ed-table-num font-semibold text-accent">{RWF(adjustPreview.net)}</span>
              </div>
            </div>

            {adjustError ? <p className="text-sm text-destructive">{adjustError}</p> : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAdjustTarget(null)} disabled={adjusting}>
              Cancel
            </Button>
            <Button onClick={() => void submitAdjust()} disabled={adjusting}>
              {adjusting ? 'Saving…' : 'Save adjustment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
