import {
  Award,
  CalendarRange,
  ClipboardCheck,
  Plus,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ExportMenu } from '@/components/common/ExportMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import type { ExportColumn } from '@/lib/export';
import { formatDate, fullName, titleCase, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import { employeesApi, performanceApi } from '@/services/api';
import type { Appraisal, AppraisalCycle, EmployeeWithRelations, Goal } from '@/types/types';

/* ------------------------------- constants ------------------------------- */

const CYCLE_STATUSES = ['draft', 'active', 'closed'];
const GOAL_CATEGORIES = ['business', 'development', 'behavioural'];
const SCORE_OPTIONS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

const ratingFor = (score: number): string => {
  if (score >= 4.5) return 'Outstanding';
  if (score >= 4) return 'Exceeds expectations';
  if (score >= 3.5) return 'Meets expectations';
  if (score >= 3) return 'Needs improvement';
  return 'Below expectations';
};

const ratingTone = (rating: string | null): 'success' | 'info' | 'neutral' | 'warning' | 'danger' => {
  switch (rating) {
    case 'Outstanding':
      return 'success';
    case 'Exceeds expectations':
      return 'info';
    case 'Meets expectations':
      return 'neutral';
    case 'Needs improvement':
      return 'warning';
    case 'Below expectations':
      return 'danger';
    default:
      return 'neutral';
  }
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

const scoreLabel = (value: number | null | undefined): string =>
  value == null ? '' : Number(value).toFixed(2);

/* --------------------------------- types --------------------------------- */

interface CycleFormState {
  name: string;
  period_start: string;
  period_end: string;
  status: string;
  description: string;
}

interface GoalFormState {
  employee_id: string;
  cycle_id: string;
  title: string;
  description: string;
  category: string;
  weight: string;
  target_value: string;
  due_date: string;
}

interface AppraisalFormState {
  cycle_id: string;
  employee_id: string;
  manager_id: string;
}

interface ReviewFormState {
  self_score: string;
  self_comments: string;
  manager_score: string;
  manager_comments: string;
}

const EMPTY_CYCLE_FORM: CycleFormState = {
  name: '',
  period_start: todayISO(),
  period_end: todayISO(),
  status: 'draft',
  description: '',
};

const EMPTY_GOAL_FORM: GoalFormState = {
  employee_id: '',
  cycle_id: 'none',
  title: '',
  description: '',
  category: 'business',
  weight: '20',
  target_value: '',
  due_date: '',
};

const EMPTY_APPRAISAL_FORM: AppraisalFormState = { cycle_id: '', employee_id: '', manager_id: 'none' };
const EMPTY_REVIEW_FORM: ReviewFormState = {
  self_score: '',
  self_comments: '',
  manager_score: '',
  manager_comments: '',
};

/* -------------------------------- helpers -------------------------------- */

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="ed-label">{label}</Label>
      {children}
    </div>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

function GoalProgress({
  goal,
  disabled,
  onCommit,
}: {
  goal: Goal;
  disabled: boolean;
  onCommit: (value: number) => Promise<boolean>;
}) {
  const [value, setValue] = useState(String(goal.progress ?? 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(String(goal.progress ?? 0));
  }, [goal.progress]);

  const commit = async () => {
    const parsed = Number(value);
    const numeric = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(100, Math.round(parsed)));
    setValue(String(numeric));
    if (numeric === goal.progress) return;
    setSaving(true);
    const ok = await onCommit(numeric);
    setSaving(false);
    if (!ok) setValue(String(goal.progress ?? 0));
  };

  return (
    <div className="flex items-center gap-2">
      <Progress value={goal.progress ?? 0} className="h-1.5 w-16 shrink-0" />
      <Input
        type="number"
        min={0}
        max={100}
        step={5}
        value={value}
        disabled={disabled || saving}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        aria-label={`Progress for ${goal.title}`}
        className="ed-table-num h-7 w-16 px-2 text-xs"
      />
      <span className="text-xs text-muted-foreground">%</span>
    </div>
  );
}

/* --------------------------------- page ---------------------------------- */

export default function PerformancePage() {
  const { isHR, isManager, employeeId } = useAuth();
  const canManage = isHR || isManager;

  const [loading, setLoading] = useState(true);
  const [cycles, setCycles] = useState<AppraisalCycle[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);

  const [goalCycleFilter, setGoalCycleFilter] = useState('all');
  const [goalEmployeeFilter, setGoalEmployeeFilter] = useState('all');

  const [cycleDialogOpen, setCycleDialogOpen] = useState(false);
  const [cycleForm, setCycleForm] = useState<CycleFormState>(EMPTY_CYCLE_FORM);
  const [savingCycle, setSavingCycle] = useState(false);

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalForm, setGoalForm] = useState<GoalFormState>(EMPTY_GOAL_FORM);
  const [savingGoal, setSavingGoal] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [appraisalDialogOpen, setAppraisalDialogOpen] = useState(false);
  const [appraisalForm, setAppraisalForm] = useState<AppraisalFormState>(EMPTY_APPRAISAL_FORM);
  const [savingAppraisal, setSavingAppraisal] = useState(false);

  const [reviewing, setReviewing] = useState<Appraisal | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(EMPTY_REVIEW_FORM);
  const [savingReview, setSavingReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cycleRows, goalRows, appraisalRows, employeeRows] = await Promise.all([
        performanceApi.cycles(),
        performanceApi.goals(),
        performanceApi.appraisals(),
        employeesApi.list({ limit: 200 }),
      ]);
      setCycles(cycleRows);
      setGoals(goalRows);
      setAppraisals(appraisalRows);
      setEmployees(employeeRows);
    } catch (error) {
      toast.error('Could not load performance data', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------------------- derived -------------------------------- */

  const scopedGoals = useMemo(
    () => (canManage ? goals : goals.filter((goal) => goal.employee_id === employeeId)),
    [goals, canManage, employeeId],
  );

  const scopedAppraisals = useMemo(
    () => (canManage ? appraisals : appraisals.filter((row) => row.employee_id === employeeId)),
    [appraisals, canManage, employeeId],
  );

  const filteredGoals = useMemo(
    () =>
      scopedGoals.filter((goal) => {
        const matchesCycle = goalCycleFilter === 'all' || goal.cycle_id === goalCycleFilter;
        const matchesEmployee = goalEmployeeFilter === 'all' || goal.employee_id === goalEmployeeFilter;
        return matchesCycle && matchesEmployee;
      }),
    [scopedGoals, goalCycleFilter, goalEmployeeFilter],
  );

  const activeCycle = cycles.find((cycle) => cycle.status === 'active') ?? null;
  const pendingAppraisals = scopedAppraisals.filter((row) => row.status !== 'finalized');
  const scoredAppraisals = scopedAppraisals.filter((row) => row.final_score != null);
  const averageFinal = scoredAppraisals.length
    ? scoredAppraisals.reduce((sum, row) => sum + Number(row.final_score ?? 0), 0) / scoredAppraisals.length
    : null;

  const employeeOptions = useMemo(
    () => (canManage ? employees : employees.filter((employee) => employee.id === employeeId)),
    [employees, canManage, employeeId],
  );

  const appraisalExportColumns: ExportColumn<Appraisal>[] = [
    { header: 'Employee', accessor: (row) => fullName(row.employee) },
    { header: 'Employee no.', accessor: (row) => row.employee?.employee_no ?? '' },
    { header: 'Cycle', accessor: (row) => row.cycle?.name ?? '' },
    { header: 'Self score', accessor: (row) => scoreLabel(row.self_score) },
    { header: 'Manager score', accessor: (row) => scoreLabel(row.manager_score) },
    { header: 'Final score', accessor: (row) => scoreLabel(row.final_score) },
    { header: 'Rating', accessor: (row) => row.rating ?? '' },
    { header: 'Status', accessor: (row) => titleCase(row.status) },
  ];

  /* ------------------------------ cycle actions --------------------------- */

  const openCycleDialog = () => {
    setCycleForm({ ...EMPTY_CYCLE_FORM, period_start: todayISO(), period_end: todayISO() });
    setCycleDialogOpen(true);
  };

  const submitCycle = async () => {
    if (!cycleForm.name.trim()) {
      toast.error('Give the appraisal cycle a name');
      return;
    }
    if (!cycleForm.period_start || !cycleForm.period_end) {
      toast.error('Both period dates are required');
      return;
    }
    if (cycleForm.period_end < cycleForm.period_start) {
      toast.error('The period end date must fall after the start date');
      return;
    }
    setSavingCycle(true);
    try {
      await performanceApi.createCycle({
        name: cycleForm.name.trim(),
        period_start: cycleForm.period_start,
        period_end: cycleForm.period_end,
        status: cycleForm.status,
        description: cycleForm.description.trim() || null,
      });
      toast.success('Appraisal cycle created');
      setCycleDialogOpen(false);
      await load();
    } catch (error) {
      toast.error('Could not create the cycle', { description: errorMessage(error) });
    } finally {
      setSavingCycle(false);
    }
  };

  const changeCycleStatus = async (cycle: AppraisalCycle, status: string) => {
    try {
      await performanceApi.updateCycle(cycle.id, { status });
      setCycles((current) => current.map((row) => (row.id === cycle.id ? { ...row, status } : row)));
      toast.success(`${cycle.name} marked as ${titleCase(status).toLowerCase()}`);
    } catch (error) {
      toast.error('Could not change the cycle status', { description: errorMessage(error) });
    }
  };

  /* ------------------------------- goal actions --------------------------- */

  const openGoalDialog = () => {
    setGoalForm({
      ...EMPTY_GOAL_FORM,
      employee_id: canManage ? '' : (employeeId ?? ''),
      cycle_id: activeCycle?.id ?? 'none',
    });
    setGoalDialogOpen(true);
  };

  const submitGoal = async () => {
    if (!goalForm.employee_id) {
      toast.error('Select the employee this goal belongs to');
      return;
    }
    if (!goalForm.title.trim()) {
      toast.error('A goal title is required');
      return;
    }
    const weight = Number(goalForm.weight);
    if (Number.isNaN(weight) || weight < 0 || weight > 100) {
      toast.error('Weight must be a number between 0 and 100');
      return;
    }
    setSavingGoal(true);
    try {
      await performanceApi.createGoal({
        employee_id: goalForm.employee_id,
        cycle_id: goalForm.cycle_id === 'none' ? null : goalForm.cycle_id,
        title: goalForm.title.trim(),
        description: goalForm.description.trim() || null,
        category: goalForm.category,
        weight,
        target_value: goalForm.target_value.trim() || null,
        progress: 0,
        status: 'active',
        due_date: goalForm.due_date || null,
      });
      toast.success('Goal added');
      setGoalDialogOpen(false);
      await load();
    } catch (error) {
      toast.error('Could not add the goal', { description: errorMessage(error) });
    } finally {
      setSavingGoal(false);
    }
  };

  const updateGoalProgress = async (goal: Goal, progress: number): Promise<boolean> => {
    const status = progress >= 100 ? 'completed' : goal.status === 'completed' ? 'active' : goal.status;
    try {
      await performanceApi.updateGoal(goal.id, { progress, status });
      setGoals((current) => current.map((row) => (row.id === goal.id ? { ...row, progress, status } : row)));
      toast.success('Goal progress updated');
      return true;
    } catch (error) {
      toast.error('Could not update the goal progress', { description: errorMessage(error) });
      return false;
    }
  };

  const confirmDeleteGoal = async () => {
    if (!deletingGoal) return;
    setDeleting(true);
    try {
      await performanceApi.deleteGoal(deletingGoal.id);
      setGoals((current) => current.filter((row) => row.id !== deletingGoal.id));
      toast.success('Goal deleted');
      setDeletingGoal(null);
    } catch (error) {
      toast.error('Could not delete the goal', { description: errorMessage(error) });
    } finally {
      setDeleting(false);
    }
  };

  /* ----------------------------- appraisal actions ------------------------ */

  const openAppraisalDialog = () => {
    setAppraisalForm({
      cycle_id: activeCycle?.id ?? cycles[0]?.id ?? '',
      employee_id: '',
      manager_id: 'none',
    });
    setAppraisalDialogOpen(true);
  };

  const submitAppraisal = async () => {
    if (!appraisalForm.cycle_id) {
      toast.error('Select the appraisal cycle');
      return;
    }
    if (!appraisalForm.employee_id) {
      toast.error('Select the employee being appraised');
      return;
    }
    setSavingAppraisal(true);
    try {
      await performanceApi.createAppraisal({
        cycle_id: appraisalForm.cycle_id,
        employee_id: appraisalForm.employee_id,
        manager_id: appraisalForm.manager_id === 'none' ? null : appraisalForm.manager_id,
        status: 'draft',
      });
      toast.success('Appraisal opened');
      setAppraisalDialogOpen(false);
      await load();
    } catch (error) {
      toast.error('Could not open the appraisal', { description: errorMessage(error) });
    } finally {
      setSavingAppraisal(false);
    }
  };

  const openReview = (appraisal: Appraisal) => {
    setReviewing(appraisal);
    setReviewForm({
      self_score: appraisal.self_score != null ? String(appraisal.self_score) : '',
      self_comments: appraisal.self_comments ?? '',
      manager_score: appraisal.manager_score != null ? String(appraisal.manager_score) : '',
      manager_comments: appraisal.manager_comments ?? '',
    });
  };

  const submitReview = async (step: 'self' | 'manager' | 'finalize') => {
    if (!reviewing) return;
    const selfScore = reviewForm.self_score ? Number(reviewForm.self_score) : null;
    const managerScore = reviewForm.manager_score ? Number(reviewForm.manager_score) : null;

    if (step === 'self' && selfScore == null) {
      toast.error('Enter a self-evaluation score');
      return;
    }
    if (step === 'manager' && managerScore == null) {
      toast.error('Enter a manager score');
      return;
    }
    if (step === 'finalize' && (selfScore == null || managerScore == null)) {
      toast.error('Both scores are required before finalising');
      return;
    }

    const finalScore =
      selfScore != null && managerScore != null
        ? Math.round(((selfScore + managerScore) / 2) * 100) / 100
        : null;

    const payload: Partial<Appraisal> = {
      self_score: selfScore,
      self_comments: reviewForm.self_comments.trim() || null,
      manager_score: managerScore,
      manager_comments: reviewForm.manager_comments.trim() || null,
      final_score: finalScore,
      rating: finalScore != null ? ratingFor(finalScore) : null,
    };

    if (step === 'self') {
      payload.status = 'self_submitted';
      payload.submitted_at = new Date().toISOString();
    } else if (step === 'manager') {
      payload.status = 'manager_reviewed';
    } else {
      payload.status = 'finalized';
      payload.finalized_at = new Date().toISOString();
    }

    setSavingReview(true);
    try {
      await performanceApi.updateAppraisal(reviewing.id, payload);
      toast.success(
        step === 'self'
          ? 'Self-evaluation submitted'
          : step === 'manager'
            ? 'Manager review saved'
            : 'Appraisal finalised',
      );
      setReviewing(null);
      await load();
    } catch (error) {
      toast.error('Could not save the appraisal', { description: errorMessage(error) });
    } finally {
      setSavingReview(false);
    }
  };

  /* --------------------------------- render -------------------------------- */

  const previewSelf = reviewForm.self_score ? Number(reviewForm.self_score) : null;
  const previewManager = reviewForm.manager_score ? Number(reviewForm.manager_score) : null;
  const previewFinal =
    previewSelf != null && previewManager != null ? (previewSelf + previewManager) / 2 : null;

  const reviewLocked = reviewing?.status === 'finalized';
  const canSelfEval = !!reviewing && !reviewLocked && (canManage || reviewing.employee_id === employeeId);
  const canManagerEval = !!reviewing && !reviewLocked && canManage;
  const canFinalize = !!reviewing && !reviewLocked && isHR;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="People performance"
        title="Performance management"
        description="Appraisal cycles, goals and KPI tracking, and the annual review record for AB Rwanda."
        actions={
          isHR ? (
            <Button size="sm" onClick={openCycleDialog}>
              <Plus className="mr-2 h-4 w-4" />
              New cycle
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard
          label="Active cycle"
          value={activeCycle ? activeCycle.name : 'None'}
          hint={activeCycle ? `${formatDate(activeCycle.period_start)} — ${formatDate(activeCycle.period_end)}` : 'No cycle is currently open'}
          icon={CalendarRange}
        />
        <StatCard label="Goals tracked" value={scopedGoals.length} hint="Objectives across all cycles" icon={Target} />
        <StatCard
          label="Appraisals pending"
          value={pendingAppraisals.length}
          hint="Not yet finalised"
          icon={ClipboardCheck}
          tone="accent"
        />
        <StatCard
          label="Average final score"
          value={averageFinal != null ? averageFinal.toFixed(2) : ''}
          hint={averageFinal != null ? ratingFor(averageFinal) : 'No finalised scores yet'}
          icon={TrendingUp}
        />
      </div>

      <Tabs defaultValue="cycles" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted p-1 md:w-auto">
          <TabsTrigger value="cycles" className="whitespace-nowrap">
            Cycles
          </TabsTrigger>
          <TabsTrigger value="goals" className="whitespace-nowrap">
            Goals &amp; KPIs
          </TabsTrigger>
          <TabsTrigger value="appraisals" className="whitespace-nowrap">
            Appraisals
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------- cycles ------------------------------ */}
        <TabsContent value="cycles" className="space-y-4">
          {loading ? (
            <TableSkeleton rows={4} />
          ) : cycles.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={CalendarRange}
                title="No appraisal cycles yet"
                description="Create a cycle to open goal setting and appraisals for the organisation."
                action={
                  isHR ? (
                    <Button size="sm" onClick={openCycleDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      New cycle
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left">
                      <th className="ed-label whitespace-nowrap px-4 py-3">Cycle</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Period</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Status</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Description</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cycles.map((cycle) => (
                      <tr key={cycle.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{cycle.name}</td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(cycle.period_start)} — {formatDate(cycle.period_end)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={cycle.status} />
                        </td>
                        <td className="max-w-[22rem] px-4 py-3 text-muted-foreground">
                          <span className="line-clamp-2">{cycle.description ?? ''}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          {isHR ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  Change status
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel>Set cycle status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {CYCLE_STATUSES.filter((status) => status !== cycle.status).map((status) => (
                                  <DropdownMenuItem key={status} onClick={() => void changeCycleStatus(cycle, status)}>
                                    {titleCase(status)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-xs text-muted-foreground">Read only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* -------------------------------- goals ------------------------------ */}
        <TabsContent value="goals" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Field label="Cycle" className="md:w-56">
                <Select value={goalCycleFilter} onValueChange={setGoalCycleFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All cycles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All cycles</SelectItem>
                    {cycles.map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {cycle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {canManage ? (
                <Field label="Employee" className="md:w-56">
                  <Select value={goalEmployeeFilter} onValueChange={setGoalEmployeeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All employees</SelectItem>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {fullName(employee)} · {employee.employee_no}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}
            </div>
            <Button size="sm" onClick={openGoalDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add goal
            </Button>
          </div>

          {loading ? (
            <TableSkeleton rows={7} />
          ) : filteredGoals.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Target}
                title="No goals match this view"
                description="Adjust the filters or add a new goal to start tracking progress."
                action={
                  <Button size="sm" variant="outline" onClick={openGoalDialog}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add goal
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left">
                      <th className="ed-label whitespace-nowrap px-4 py-3">Employee</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Goal</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Category</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Weight</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Target</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Progress</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Status</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Due</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGoals.map((goal) => (
                      <tr key={goal.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="font-medium text-foreground">{fullName(goal.employee)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="whitespace-nowrap font-medium text-foreground">{goal.title}</p>
                          {goal.description ? (
                            <p className="max-w-[20rem] truncate text-xs text-muted-foreground">{goal.description}</p>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{titleCase(goal.category)}</td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                          {goal.weight}%
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{goal.target_value ?? ''}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <GoalProgress
                            goal={goal}
                            disabled={!canManage && goal.employee_id !== employeeId}
                            onCommit={(value) => updateGoalProgress(goal, value)}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={goal.status} />
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(goal.due_date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingGoal(goal)}
                            aria-label={`Delete ${goal.title}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------ appraisals --------------------------- */}
        <TabsContent value="appraisals" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              {scopedAppraisals.length} appraisal{scopedAppraisals.length === 1 ? '' : 's'} on record ·{' '}
              {pendingAppraisals.length} awaiting completion
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ExportMenu
                filename="ab-rwanda-appraisals"
                title="Appraisal register"
                subtitle={`${scopedAppraisals.length} appraisals`}
                columns={appraisalExportColumns}
                rows={scopedAppraisals}
              />
              {isHR ? (
                <Button size="sm" onClick={openAppraisalDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  New appraisal
                </Button>
              ) : null}
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={7} />
          ) : scopedAppraisals.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Award}
                title="No appraisals recorded"
                description="Appraisals opened for a cycle will appear here with their scores and rating."
                action={
                  isHR ? (
                    <Button size="sm" onClick={openAppraisalDialog}>
                      <Plus className="mr-2 h-4 w-4" />
                      New appraisal
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50 text-left">
                      <th className="ed-label whitespace-nowrap px-4 py-3">Employee</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Cycle</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Self</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Manager</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Final</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Rating</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Status</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedAppraisals.map((appraisal) => (
                      <tr key={appraisal.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="font-medium text-foreground">{fullName(appraisal.employee)}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {appraisal.employee?.employee_no ?? ''}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {appraisal.cycle?.name ?? ''}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                          {scoreLabel(appraisal.self_score)}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                          {scoreLabel(appraisal.manager_score)}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">
                          {scoreLabel(appraisal.final_score)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {appraisal.rating ? (
                            <StatusBadge status={appraisal.rating} label={appraisal.rating} tone={ratingTone(appraisal.rating)} />
                          ) : (
                            <span className="text-xs text-muted-foreground">Not rated</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={appraisal.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => openReview(appraisal)}>
                            {appraisal.status === 'finalized' ? 'View' : 'Review'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ----------------------------- cycle dialog ---------------------------- */}
      <Dialog open={cycleDialogOpen} onOpenChange={setCycleDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>New appraisal cycle</DialogTitle>
            <DialogDescription>
              Define the review period. Goals and appraisals are attached to a cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Cycle name">
              <Input
                value={cycleForm.name}
                onChange={(event) => setCycleForm((form) => ({ ...form, name: event.target.value }))}
                placeholder="FY2027 Annual Review"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Period start">
                <Input
                  type="date"
                  value={cycleForm.period_start}
                  onChange={(event) => setCycleForm((form) => ({ ...form, period_start: event.target.value }))}
                />
              </Field>
              <Field label="Period end">
                <Input
                  type="date"
                  value={cycleForm.period_end}
                  onChange={(event) => setCycleForm((form) => ({ ...form, period_end: event.target.value }))}
                />
              </Field>
            </div>
            <Field label="Status">
              <Select
                value={cycleForm.status}
                onValueChange={(value) => setCycleForm((form) => ({ ...form, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CYCLE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleCase(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description">
              <Textarea
                rows={3}
                value={cycleForm.description}
                onChange={(event) => setCycleForm((form) => ({ ...form, description: event.target.value }))}
                placeholder="What this cycle covers"
              />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCycleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitCycle()} disabled={savingCycle}>
              {savingCycle ? 'Creating…' : 'Create cycle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------ goal dialog ---------------------------- */}
      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add goal</DialogTitle>
            <DialogDescription>Set a measurable objective and attach it to an appraisal cycle.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Employee">
                <Select
                  value={goalForm.employee_id}
                  onValueChange={(value) => setGoalForm((form) => ({ ...form, employee_id: value }))}
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employeeOptions.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {fullName(employee)} · {employee.employee_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Cycle">
                <Select
                  value={goalForm.cycle_id}
                  onValueChange={(value) => setGoalForm((form) => ({ ...form, cycle_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No cycle</SelectItem>
                    {cycles.map((cycle) => (
                      <SelectItem key={cycle.id} value={cycle.id}>
                        {cycle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Goal title">
              <Input
                value={goalForm.title}
                onChange={(event) => setGoalForm((form) => ({ ...form, title: event.target.value }))}
                placeholder="Reduce payroll processing time"
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={2}
                value={goalForm.description}
                onChange={(event) => setGoalForm((form) => ({ ...form, description: event.target.value }))}
                placeholder="How success will be measured"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Category">
                <Select
                  value={goalForm.category}
                  onValueChange={(value) => setGoalForm((form) => ({ ...form, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GOAL_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {titleCase(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Weight (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={goalForm.weight}
                  onChange={(event) => setGoalForm((form) => ({ ...form, weight: event.target.value }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Target value">
                <Input
                  value={goalForm.target_value}
                  onChange={(event) => setGoalForm((form) => ({ ...form, target_value: event.target.value }))}
                  placeholder="e.g. 95% accuracy"
                />
              </Field>
              <Field label="Due date">
                <Input
                  type="date"
                  value={goalForm.due_date}
                  onChange={(event) => setGoalForm((form) => ({ ...form, due_date: event.target.value }))}
                />
              </Field>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitGoal()} disabled={savingGoal}>
              {savingGoal ? 'Saving…' : 'Add goal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------- appraisal dialog -------------------------- */}
      <Dialog open={appraisalDialogOpen} onOpenChange={setAppraisalDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Open appraisal</DialogTitle>
            <DialogDescription>Start a new appraisal record for an employee in a cycle.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Cycle">
              <Select
                value={appraisalForm.cycle_id}
                onValueChange={(value) => setAppraisalForm((form) => ({ ...form, cycle_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map((cycle) => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Employee">
              <Select
                value={appraisalForm.employee_id}
                onValueChange={(value) => setAppraisalForm((form) => ({ ...form, employee_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {fullName(employee)} · {employee.employee_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reviewing manager">
              <Select
                value={appraisalForm.manager_id}
                onValueChange={(value) => setAppraisalForm((form) => ({ ...form, manager_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {fullName(employee)} · {employee.employee_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAppraisalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitAppraisal()} disabled={savingAppraisal}>
              {savingAppraisal ? 'Opening…' : 'Open appraisal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------- review dialog ---------------------------- */}
      <Dialog open={!!reviewing} onOpenChange={(open) => (!open ? setReviewing(null) : undefined)}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{reviewing ? fullName(reviewing.employee) : 'Appraisal'}</DialogTitle>
            <DialogDescription>
              {reviewing?.cycle?.name ?? 'Appraisal cycle'} ·{' '}
              {reviewing ? titleCase(reviewing.status) : ''}
            </DialogDescription>
          </DialogHeader>

          {reviewing ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="ed-label">Computed final score</p>
                    <p className="ed-figure mt-1 text-2xl">
                      {previewFinal != null ? previewFinal.toFixed(2) : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="ed-label">Rating</p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {previewFinal != null ? ratingFor(previewFinal) : 'Awaiting scores'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  The final score is the average of the self and manager scores.
                </p>
              </div>

              <div className="space-y-3">
                <p className="ed-label">Employee self-evaluation</p>
                <Field label="Self score (1–5)">
                  <Select
                    value={reviewForm.self_score}
                    onValueChange={(value) => setReviewForm((form) => ({ ...form, self_score: value }))}
                    disabled={!canSelfEval}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select score" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCORE_OPTIONS.map((score) => (
                        <SelectItem key={score} value={String(score)}>
                          {score.toFixed(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Self comments">
                  <Textarea
                    rows={3}
                    value={reviewForm.self_comments}
                    onChange={(event) => setReviewForm((form) => ({ ...form, self_comments: event.target.value }))}
                    disabled={!canSelfEval}
                    placeholder="Achievements, challenges and evidence"
                  />
                </Field>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <p className="ed-label">Manager evaluation</p>
                <Field label="Manager score (1–5)">
                  <Select
                    value={reviewForm.manager_score}
                    onValueChange={(value) => setReviewForm((form) => ({ ...form, manager_score: value }))}
                    disabled={!canManagerEval}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select score" />
                    </SelectTrigger>
                    <SelectContent>
                      {SCORE_OPTIONS.map((score) => (
                        <SelectItem key={score} value={String(score)}>
                          {score.toFixed(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Manager comments">
                  <Textarea
                    rows={3}
                    value={reviewForm.manager_comments}
                    onChange={(event) => setReviewForm((form) => ({ ...form, manager_comments: event.target.value }))}
                    disabled={!canManagerEval}
                    placeholder="Assessment against goals and competencies"
                  />
                </Field>
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex-col gap-2 md:flex-row">
            <Button variant="outline" onClick={() => setReviewing(null)}>
              Close
            </Button>
            {canSelfEval ? (
              <Button variant="secondary" onClick={() => void submitReview('self')} disabled={savingReview}>
                Submit self-evaluation
              </Button>
            ) : null}
            {canManagerEval ? (
              <Button variant="secondary" onClick={() => void submitReview('manager')} disabled={savingReview}>
                Save manager review
              </Button>
            ) : null}
            {canFinalize ? (
              <Button onClick={() => void submitReview('finalize')} disabled={savingReview}>
                Finalise
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------- delete confirm --------------------------- */}
      <AlertDialog open={!!deletingGoal} onOpenChange={(open) => (!open ? setDeletingGoal(null) : undefined)}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deletingGoal?.title}” and its progress history will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteGoal();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete goal'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
