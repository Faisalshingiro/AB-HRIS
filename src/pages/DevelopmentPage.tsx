import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  GraduationCap,
  Monitor,
  Pencil,
  Plus,
  UserPlus,
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
import { compactRWF, formatDate, fullName, percent, RWF, titleCase, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import { developmentApi, employeesApi } from '@/services/api';
import type { EmployeeWithRelations, Training, TrainingEnrollment } from '@/types/types';

/* ------------------------------- constants ------------------------------- */

const TRAINING_CATEGORIES = ['compliance', 'technical', 'leadership', 'finance', 'customer', 'safety', 'other'];
const TRAINING_MODES = ['in_person', 'online', 'hybrid'];
const TRAINING_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'];
const ENROLLMENT_STATUSES = ['enrolled', 'in_progress', 'completed', 'dropped'];

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

/* --------------------------------- types --------------------------------- */

interface TrainingFormState {
  title: string;
  provider: string;
  category: string;
  mode: string;
  start_date: string;
  end_date: string;
  cost: string;
  capacity: string;
  status: string;
  description: string;
}

interface EnrollmentFormState {
  training_id: string;
  employee_id: string;
}

interface EnrollmentEditState {
  status: string;
  score: string;
  completed_at: string;
}

const EMPTY_TRAINING_FORM: TrainingFormState = {
  title: '',
  provider: '',
  category: 'technical',
  mode: 'in_person',
  start_date: todayISO(),
  end_date: todayISO(),
  cost: '0',
  capacity: '20',
  status: 'planned',
  description: '',
};

const EMPTY_ENROLLMENT_FORM: EnrollmentFormState = { training_id: '', employee_id: '' };
const EMPTY_ENROLLMENT_EDIT: EnrollmentEditState = { status: 'enrolled', score: '', completed_at: '' };

/* -------------------------------- helpers -------------------------------- */

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="ed-label">{label}</Label>
      {children}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
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

/* --------------------------------- page ---------------------------------- */

export default function DevelopmentPage() {
  const { isHR, isManager, employeeId } = useAuth();
  const canManage = isHR || isManager;
  const isTeamManager = isManager && !isHR;

  const [loading, setLoading] = useState(true);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);

  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [trainingForm, setTrainingForm] = useState<TrainingFormState>(EMPTY_TRAINING_FORM);
  const [savingTraining, setSavingTraining] = useState(false);

  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState<EnrollmentFormState>(EMPTY_ENROLLMENT_FORM);
  const [savingEnroll, setSavingEnroll] = useState(false);

  const [editingEnrollment, setEditingEnrollment] = useState<TrainingEnrollment | null>(null);
  const [enrollmentEdit, setEnrollmentEdit] = useState<EnrollmentEditState>(EMPTY_ENROLLMENT_EDIT);
  const [savingEnrollment, setSavingEnrollment] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const isTeamManager = isManager && !isHR;
      const employeeRows = isTeamManager
        ? employeeId
          ? await employeesApi.list({ limit: 200, managerId: employeeId })
          : []
        : await employeesApi.list({ limit: 200 });
      const reportIds = new Set(employeeRows.map((employee) => employee.id));
      const [trainingRows, enrollmentRows] = await Promise.all([
        developmentApi.trainings(),
        developmentApi.enrollments(),
      ]);
      setTrainings(trainingRows);
      setEnrollments(isTeamManager ? enrollmentRows.filter((row) => reportIds.has(row.employee_id)) : enrollmentRows);
      setEmployees(employeeRows);
    } catch (error) {
      toast.error('Could not load development data', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [employeeId, isHR, isManager]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------------------- derived -------------------------------- */

  const scopedEnrollments = useMemo(
    () => (canManage ? enrollments : enrollments.filter((row) => row.employee_id === employeeId)),
    [enrollments, canManage, employeeId],
  );

  const enrolledByTraining = useMemo(() => {
    const map = new Map<string, number>();
    enrollments.forEach((row) => {
      if (row.status === 'dropped') return;
      map.set(row.training_id, (map.get(row.training_id) ?? 0) + 1);
    });
    return map;
  }, [enrollments]);

  const activeEnrollments = scopedEnrollments.filter(
    (row) => row.status === 'enrolled' || row.status === 'in_progress',
  );
  const completedEnrollments = scopedEnrollments.filter((row) => row.status === 'completed');
  const completionRate = percent(completedEnrollments.length, scopedEnrollments.length);
  const totalSpend = trainings.reduce((sum, training) => sum + Number(training.cost ?? 0), 0);

  const categoryCoverage = useMemo(() => {
    const trainingById = new Map(trainings.map((training) => [training.id, training]));
    const buckets = new Map<
      string,
      { category: string; enrollments: number; completed: number; employees: Set<string>; trainings: Set<string> }
    >();

    enrollments.forEach((row) => {
      const training = trainingById.get(row.training_id);
      const category = training?.category ?? 'other';
      const bucket =
        buckets.get(category) ??
        { category, enrollments: 0, completed: 0, employees: new Set<string>(), trainings: new Set<string>() };
      bucket.enrollments += 1;
      if (row.status === 'completed') bucket.completed += 1;
      bucket.employees.add(row.employee_id);
      bucket.trainings.add(row.training_id);
      buckets.set(category, bucket);
    });

    return Array.from(buckets.values())
      .map((bucket) => ({
        category: bucket.category,
        enrollments: bucket.enrollments,
        completed: bucket.completed,
        employees: bucket.employees.size,
        trainings: bucket.trainings.size,
      }))
      .sort((a, b) => b.employees - a.employees);
  }, [enrollments, trainings]);

  const maxCoverage = Math.max(1, ...categoryCoverage.map((row) => row.employees));

  const enrollmentExportColumns: ExportColumn<TrainingEnrollment>[] = [
    { header: 'Employee', accessor: (row) => fullName(row.employee) },
    { header: 'Employee no.', accessor: (row) => row.employee?.employee_no ?? '' },
    { header: 'Training', accessor: (row) => row.training?.title ?? '' },
    { header: 'Provider', accessor: (row) => row.training?.provider ?? '' },
    { header: 'Status', accessor: (row) => titleCase(row.status) },
    { header: 'Score', accessor: (row) => (row.score != null ? row.score : '') },
    { header: 'Completed', accessor: (row) => formatDate(row.completed_at) },
  ];

  /* ----------------------------- training actions ------------------------- */

  const openCreateTraining = () => {
    setEditingTraining(null);
    setTrainingForm({ ...EMPTY_TRAINING_FORM, start_date: todayISO(), end_date: todayISO() });
    setTrainingDialogOpen(true);
  };

  const openEditTraining = (training: Training) => {
    setEditingTraining(training);
    setTrainingForm({
      title: training.title,
      provider: training.provider ?? '',
      category: training.category,
      mode: training.mode,
      start_date: training.start_date ?? '',
      end_date: training.end_date ?? '',
      cost: String(training.cost ?? 0),
      capacity: String(training.capacity ?? 0),
      status: training.status,
      description: training.description ?? '',
    });
    setTrainingDialogOpen(true);
  };

  const submitTraining = async () => {
    if (!trainingForm.title.trim()) {
      toast.error('A training title is required');
      return;
    }
    if (trainingForm.start_date && trainingForm.end_date && trainingForm.end_date < trainingForm.start_date) {
      toast.error('The end date must fall after the start date');
      return;
    }
    const cost = Number(trainingForm.cost);
    const capacity = Number(trainingForm.capacity);
    if (Number.isNaN(cost) || cost < 0) {
      toast.error('Cost must be a positive amount in RWF');
      return;
    }
    if (Number.isNaN(capacity) || capacity < 1) {
      toast.error('Capacity must be at least one seat');
      return;
    }

    setSavingTraining(true);
    try {
      const payload: Partial<Training> = {
        title: trainingForm.title.trim(),
        provider: trainingForm.provider.trim() || null,
        category: trainingForm.category,
        mode: trainingForm.mode,
        start_date: trainingForm.start_date || null,
        end_date: trainingForm.end_date || null,
        cost,
        capacity,
        status: trainingForm.status,
        description: trainingForm.description.trim() || null,
      };
      if (editingTraining) {
        await developmentApi.updateTraining(editingTraining.id, payload);
        toast.success('Training updated');
      } else {
        await developmentApi.createTraining(payload);
        toast.success('Training added to the catalogue');
      }
      setTrainingDialogOpen(false);
      setEditingTraining(null);
      await load();
    } catch (error) {
      toast.error('Could not save the training', { description: errorMessage(error) });
    } finally {
      setSavingTraining(false);
    }
  };

  /* ---------------------------- enrollment actions ------------------------ */

  const openEnrollDialog = () => {
    setEnrollForm({
      training_id: trainings.find((training) => training.status !== 'completed')?.id ?? '',
      employee_id: canManage ? '' : (employeeId ?? ''),
    });
    setEnrollDialogOpen(true);
  };

  const submitEnrollment = async () => {
    if (!enrollForm.training_id) {
      toast.error('Select the training');
      return;
    }
    if (!enrollForm.employee_id) {
      toast.error('Select the employee to enrol');
      return;
    }
    const training = trainings.find((row) => row.id === enrollForm.training_id);
    const taken = enrolledByTraining.get(enrollForm.training_id) ?? 0;
    if (training && training.capacity > 0 && taken >= training.capacity) {
      toast.error('This training is already at capacity');
      return;
    }
    setSavingEnroll(true);
    try {
      await developmentApi.enroll({
        training_id: enrollForm.training_id,
        employee_id: enrollForm.employee_id,
        status: 'enrolled',
      });
      toast.success('Employee enrolled');
      setEnrollDialogOpen(false);
      await load();
    } catch (error) {
      toast.error('Could not enrol the employee', { description: errorMessage(error) });
    } finally {
      setSavingEnroll(false);
    }
  };

  const openEnrollmentEdit = (enrollment: TrainingEnrollment) => {
    setEditingEnrollment(enrollment);
    setEnrollmentEdit({
      status: enrollment.status,
      score: enrollment.score != null ? String(enrollment.score) : '',
      completed_at: enrollment.completed_at ? enrollment.completed_at.slice(0, 10) : '',
    });
  };

  const submitEnrollmentEdit = async () => {
    if (!editingEnrollment) return;
    const score = enrollmentEdit.score.trim() ? Number(enrollmentEdit.score) : null;
    if (score != null && (Number.isNaN(score) || score < 0 || score > 100)) {
      toast.error('Score must be a number between 0 and 100');
      return;
    }
    const completedAt =
      enrollmentEdit.status === 'completed'
        ? enrollmentEdit.completed_at || todayISO()
        : enrollmentEdit.completed_at || null;

    setSavingEnrollment(true);
    try {
      await developmentApi.updateEnrollment(editingEnrollment.id, {
        status: enrollmentEdit.status,
        score,
        completed_at: completedAt,
      });
      toast.success('Enrolment updated');
      setEditingEnrollment(null);
      await load();
    } catch (error) {
      toast.error('Could not update the enrolment', { description: errorMessage(error) });
    } finally {
      setSavingEnrollment(false);
    }
  };

  const quickStatus = async (enrollment: TrainingEnrollment, status: string) => {
    try {
      await developmentApi.updateEnrollment(enrollment.id, {
        status,
        completed_at: status === 'completed' ? (enrollment.completed_at ?? todayISO()) : enrollment.completed_at,
      });
      setEnrollments((current) =>
        current.map((row) =>
          row.id === enrollment.id
            ? {
                ...row,
                status,
                completed_at: status === 'completed' ? (row.completed_at ?? todayISO()) : row.completed_at,
              }
            : row,
        ),
      );
      toast.success(`Marked as ${titleCase(status).toLowerCase()}`);
    } catch (error) {
      toast.error('Could not change the enrolment status', { description: errorMessage(error) });
    }
  };

  /* --------------------------------- render -------------------------------- */

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Learning & growth"
        title="Employee development"
        description={
          isTeamManager
            ? 'Development programmes, enrolments and skills progress for your team.'
            : 'Training catalogue, enrolment tracking and the skills coverage of the AB Rwanda workforce.'
        }
        actions={
          isHR ? (
            <Button size="sm" onClick={openCreateTraining}>
              <Plus className="mr-2 h-4 w-4" />
              New training
            </Button>
          ) : null
        }
      />

      <div className={`grid grid-cols-2 gap-3 md:gap-4 ${isHR ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
        <StatCard label="Total trainings" value={trainings.length} hint="Across the catalogue" icon={GraduationCap} />
        <StatCard
          label="Active enrolments"
          value={activeEnrollments.length}
          hint="Enrolled or in progress"
          icon={Users}
          tone="accent"
        />
        <StatCard
          label="Completion rate"
          value={completionRate}
          hint={`${completedEnrollments.length} of ${scopedEnrollments.length} enrolments`}
          icon={CheckCircle2}
        />
        {isHR ? (
          <StatCard
            label="Training spend"
            value={compactRWF(totalSpend)}
            hint="Committed across all programmes"
            icon={Wallet}
          />
        ) : null}
      </div>

      <Tabs defaultValue="catalogue" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted p-1 md:w-auto">
          <TabsTrigger value="catalogue" className="whitespace-nowrap">
            Training catalogue
          </TabsTrigger>
          <TabsTrigger value="enrollments" className="whitespace-nowrap">
            Enrolments
          </TabsTrigger>
          <TabsTrigger value="skills" className="whitespace-nowrap">
            Skills coverage
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------ catalogue ---------------------------- */}
        <TabsContent value="catalogue" className="space-y-4">
          {loading ? (
            <CardSkeleton />
          ) : trainings.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={GraduationCap}
                title="The catalogue is empty"
                description="Add a training programme to start enrolling employees."
                action={
                  isHR ? (
                    <Button size="sm" onClick={openCreateTraining}>
                      <Plus className="mr-2 h-4 w-4" />
                      New training
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {trainings.map((training) => {
                const taken = enrolledByTraining.get(training.id) ?? 0;
                const fill = training.capacity > 0 ? Math.min(100, Math.round((taken / training.capacity) * 100)) : 0;
                return (
                  <article
                    key={training.id}
                    className="flex h-full flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="ed-label">{titleCase(training.category)}</p>
                      <StatusBadge status={training.status} />
                    </div>
                    <h3 className="mt-2 text-pretty text-base font-semibold leading-snug text-foreground">
                      {training.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">{training.provider ?? 'Internal programme'}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                        {titleCase(training.mode)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDate(training.start_date)} — {formatDate(training.end_date)}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Enrolled</span>
                        <span className="ed-table-num font-medium text-foreground">
                          {taken} / {training.capacity}
                        </span>
                      </div>
                      <Progress value={fill} className="h-1.5" />
                    </div>

                    {isHR ? (
                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 md:mt-4">
                        <span className="ed-table-num text-sm font-semibold text-foreground">{RWF(training.cost)}</span>
                        <Button variant="ghost" size="sm" onClick={() => openEditTraining(training)}>
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ----------------------------- enrollments --------------------------- */}
        <TabsContent value="enrollments" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              {scopedEnrollments.length} enrolment{scopedEnrollments.length === 1 ? '' : 's'} ·{' '}
              {activeEnrollments.length} in progress
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <ExportMenu
                filename="ab-rwanda-training-enrollments"
                title="Training enrolments"
                subtitle={`${scopedEnrollments.length} records`}
                columns={enrollmentExportColumns}
                rows={scopedEnrollments}
              />
              <Button size="sm" onClick={openEnrollDialog}>
                <UserPlus className="mr-2 h-4 w-4" />
                Enrol employee
              </Button>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={7} />
          ) : scopedEnrollments.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Users}
                title="No enrolments yet"
                description="Enrol an employee on a training programme to start tracking completion."
                action={
                  <Button size="sm" variant="outline" onClick={openEnrollDialog}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Enrol employee
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
                      <th className="ed-label whitespace-nowrap px-4 py-3">Training</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Status</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Score</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3">Completed</th>
                      <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedEnrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className="font-medium text-foreground">{fullName(enrollment.employee)}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {enrollment.employee?.employee_no ?? ''}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {enrollment.training?.title ?? ''}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StatusBadge status={enrollment.status} />
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                          {enrollment.score != null ? `${enrollment.score}%` : ''}
                        </td>
                        <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(enrollment.completed_at)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => openEnrollmentEdit(enrollment)}>
                              Update
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" aria-label="Change enrolment status">
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuLabel>Set status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {ENROLLMENT_STATUSES.filter((status) => status !== enrollment.status).map((status) => (
                                  <DropdownMenuItem key={status} onClick={() => void quickStatus(enrollment, status)}>
                                    {titleCase(status)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------- skills ------------------------------ */}
        <TabsContent value="skills" className="space-y-4">
          {loading ? (
            <TableSkeleton rows={5} />
          ) : categoryCoverage.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={BarChart3}
                title="No coverage data yet"
                description="Skills coverage is derived from training enrolments across the catalogue."
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 md:p-6">
              <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="ed-label">Coverage by training category</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Distinct employees trained in each category, across {trainings.length} programmes.
                  </p>
                </div>
                <p className="ed-table-num text-xs text-muted-foreground">
                  {enrollments.length} enrolments · {completedEnrollments.length} completed
                </p>
              </div>

              <div className="mt-6 space-y-5">
                {categoryCoverage.map((row) => {
                  const width = Math.max(4, Math.round((row.employees / maxCoverage) * 100));
                  return (
                    <div key={row.category}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{titleCase(row.category)}</p>
                        <p className="ed-table-num text-xs text-muted-foreground">
                          {row.employees} employee{row.employees === 1 ? '' : 's'} · {row.completed}/{row.enrollments}{' '}
                          completed · {row.trainings} programme{row.trainings === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${width}%` }}
                          role="presentation"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  Employees trained
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5" aria-hidden="true" />
                  Completion recorded per enrolment
                </span>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ---------------------------- training dialog -------------------------- */}
      <Dialog open={trainingDialogOpen} onOpenChange={setTrainingDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTraining ? 'Edit training' : 'New training'}</DialogTitle>
            <DialogDescription>
              {editingTraining
                ? 'Update the programme details, capacity and status.'
                : 'Add a programme to the catalogue so employees can be enrolled.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Title">
              <Input
                value={trainingForm.title}
                onChange={(event) => setTrainingForm((form) => ({ ...form, title: event.target.value }))}
                placeholder="People Leadership Essentials"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Provider">
                <Input
                  value={trainingForm.provider}
                  onChange={(event) => setTrainingForm((form) => ({ ...form, provider: event.target.value }))}
                  placeholder="Corporate Training Rwanda"
                />
              </Field>
              <Field label="Category">
                <Select
                  value={trainingForm.category}
                  onValueChange={(value) => setTrainingForm((form) => ({ ...form, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRAINING_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {titleCase(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Mode">
                <Select
                  value={trainingForm.mode}
                  onValueChange={(value) => setTrainingForm((form) => ({ ...form, mode: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRAINING_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {titleCase(mode)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={trainingForm.status}
                  onValueChange={(value) => setTrainingForm((form) => ({ ...form, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRAINING_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {titleCase(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Start date">
                <Input
                  type="date"
                  value={trainingForm.start_date}
                  onChange={(event) => setTrainingForm((form) => ({ ...form, start_date: event.target.value }))}
                />
              </Field>
              <Field label="End date">
                <Input
                  type="date"
                  value={trainingForm.end_date}
                  onChange={(event) => setTrainingForm((form) => ({ ...form, end_date: event.target.value }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Cost (RWF)">
                <Input
                  type="number"
                  min={0}
                  value={trainingForm.cost}
                  onChange={(event) => setTrainingForm((form) => ({ ...form, cost: event.target.value }))}
                />
              </Field>
              <Field label="Capacity">
                <Input
                  type="number"
                  min={1}
                  value={trainingForm.capacity}
                  onChange={(event) => setTrainingForm((form) => ({ ...form, capacity: event.target.value }))}
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                rows={3}
                value={trainingForm.description}
                onChange={(event) => setTrainingForm((form) => ({ ...form, description: event.target.value }))}
                placeholder="What the programme covers"
              />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setTrainingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitTraining()} disabled={savingTraining}>
              {savingTraining ? 'Saving…' : editingTraining ? 'Save changes' : 'Add training'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------- enrol dialog ----------------------------- */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enrol employee</DialogTitle>
            <DialogDescription>Place an employee on a training programme from the catalogue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Training">
              <Select
                value={enrollForm.training_id}
                onValueChange={(value) => setEnrollForm((form) => ({ ...form, training_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select training" />
                </SelectTrigger>
                <SelectContent>
                  {trainings.map((training) => (
                    <SelectItem key={training.id} value={training.id}>
                      {training.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Employee">
              <Select
                value={enrollForm.employee_id}
                onValueChange={(value) => setEnrollForm((form) => ({ ...form, employee_id: value }))}
                disabled={!canManage}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {(canManage ? employees : employees.filter((employee) => employee.id === employeeId)).map(
                    (employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {fullName(employee)} · {employee.employee_no}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEnrollDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitEnrollment()} disabled={savingEnroll}>
              {savingEnroll ? 'Enrolling…' : 'Enrol employee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------- enrollment edit dialog ---------------------- */}
      <Dialog open={!!editingEnrollment} onOpenChange={(open) => (!open ? setEditingEnrollment(null) : undefined)}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update enrolment</DialogTitle>
            <DialogDescription>
              {editingEnrollment ? fullName(editingEnrollment.employee) : ''} ·{' '}
              {editingEnrollment?.training?.title ?? ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Status">
              <Select
                value={enrollmentEdit.status}
                onValueChange={(value) => setEnrollmentEdit((form) => ({ ...form, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENROLLMENT_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleCase(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Score (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={enrollmentEdit.score}
                  onChange={(event) => setEnrollmentEdit((form) => ({ ...form, score: event.target.value }))}
                  placeholder="Optional"
                />
              </Field>
              <Field label="Completed on">
                <Input
                  type="date"
                  value={enrollmentEdit.completed_at}
                  onChange={(event) => setEnrollmentEdit((form) => ({ ...form, completed_at: event.target.value }))}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Marking the enrolment as completed records today&apos;s date when none is provided.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingEnrollment(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submitEnrollmentEdit()} disabled={savingEnrollment}>
              {savingEnrollment ? 'Saving…' : 'Save enrolment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
