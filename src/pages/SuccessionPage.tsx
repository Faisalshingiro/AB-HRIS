import {
  AlertTriangle,
  Crown,
  GitBranch,
  Pencil,
  Plus,
  ShieldAlert,
  UserPlus,
  Users,
  X,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import type { ExportColumn } from '@/lib/export';
import { fullName, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import { employeesApi, positionsApi, successionApi } from '@/services/api';
import type {
  EmployeeWithRelations,
  Position,
  SuccessionCandidate,
  SuccessionPlan,
} from '@/types/types';

/* ------------------------------- constants ------------------------------- */

const CRITICALITY_LEVELS = ['critical', 'high', 'medium', 'low'];
const RISK_LEVELS = ['high', 'medium', 'low'];
const READINESS_LEVELS = ['ready_now', 'ready_1_2_years', 'ready_2_3_years'];
const POTENTIAL_LEVELS = ['high', 'medium', 'low'];

const READINESS_LABEL: Record<string, string> = {
  ready_now: 'Ready now',
  ready_1_2_years: 'Ready 1–2 yrs',
  ready_2_3_years: 'Ready 2–3 yrs',
};

const riskTone = (risk: string): 'danger' | 'warning' | 'neutral' => {
  if (risk === 'high') return 'danger';
  if (risk === 'medium') return 'warning';
  return 'neutral';
};

const potentialTone = (potential: string): 'success' | 'info' | 'neutral' => {
  if (potential === 'high') return 'success';
  if (potential === 'medium') return 'info';
  return 'neutral';
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

/* --------------------------------- types --------------------------------- */

interface PlanFormState {
  title: string;
  position_id: string;
  incumbent_employee_id: string;
  criticality: string;
  risk_of_loss: string;
  notes: string;
}

interface CandidateFormState {
  employee_id: string;
  readiness: string;
  potential: string;
  notes: string;
}

const EMPTY_PLAN_FORM: PlanFormState = {
  title: '',
  position_id: 'none',
  incumbent_employee_id: 'none',
  criticality: 'high',
  risk_of_loss: 'medium',
  notes: '',
};

const EMPTY_CANDIDATE_FORM: CandidateFormState = {
  employee_id: '',
  readiness: 'ready_1_2_years',
  potential: 'high',
  notes: '',
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

function CardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-border bg-card p-4 md:p-5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- page ---------------------------------- */

export default function SuccessionPage() {
  const { isHR, isManager } = useAuth();
  const canManage = isHR || isManager;

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SuccessionPlan[]>([]);
  const [candidates, setCandidates] = useState<SuccessionCandidate[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);

  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SuccessionPlan | null>(null);
  const [planForm, setPlanForm] = useState<PlanFormState>(EMPTY_PLAN_FORM);
  const [savingPlan, setSavingPlan] = useState(false);

  const [candidatePlan, setCandidatePlan] = useState<SuccessionPlan | null>(null);
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(EMPTY_CANDIDATE_FORM);
  const [savingCandidate, setSavingCandidate] = useState(false);

  const [removingCandidate, setRemovingCandidate] = useState<SuccessionCandidate | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [planRows, candidateRows, positionRows, employeeRows] = await Promise.all([
        successionApi.plans(),
        successionApi.candidates(),
        positionsApi.list(),
        employeesApi.list({ limit: 200 }),
      ]);
      setPlans(planRows);
      setCandidates(candidateRows);
      setPositions(positionRows);
      setEmployees(employeeRows);
    } catch (error) {
      toast.error('Could not load succession data', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------------------- derived -------------------------------- */

  const candidatesByPlan = useMemo(() => {
    const map = new Map<string, SuccessionCandidate[]>();
    candidates.forEach((candidate) => {
      const list = map.get(candidate.plan_id) ?? [];
      list.push(candidate);
      map.set(candidate.plan_id, list);
    });
    return map;
  }, [candidates]);

  const criticalRoles = plans.filter((plan) => plan.criticality === 'critical').length;
  const highRiskRoles = plans.filter((plan) => plan.risk_of_loss === 'high').length;
  const plansWithoutReadyNow = plans.filter(
    (plan) => !(candidatesByPlan.get(plan.id) ?? []).some((candidate) => candidate.readiness === 'ready_now'),
  ).length;

  const readinessSummary = useMemo(
    () =>
      plans.map((plan) => {
        const list = candidatesByPlan.get(plan.id) ?? [];
        return {
          plan,
          readyNow: list.filter((candidate) => candidate.readiness === 'ready_now').length,
          oneTwo: list.filter((candidate) => candidate.readiness === 'ready_1_2_years').length,
          twoThree: list.filter((candidate) => candidate.readiness === 'ready_2_3_years').length,
          total: list.length,
        };
      }),
    [plans, candidatesByPlan],
  );

  const summaryExportColumns: ExportColumn<(typeof readinessSummary)[number]>[] = [
    { header: 'Role', accessor: (row) => row.plan.title },
    { header: 'Position', accessor: (row) => row.plan.position?.title ?? '' },
    { header: 'Incumbent', accessor: (row) => fullName(row.plan.incumbent) },
    { header: 'Ready now', accessor: (row) => row.readyNow },
    { header: 'Ready 1–2 years', accessor: (row) => row.oneTwo },
    { header: 'Ready 2–3 years', accessor: (row) => row.twoThree },
    { header: 'Total successors', accessor: (row) => row.total },
    { header: 'Criticality', accessor: (row) => titleCase(row.plan.criticality) },
    { header: 'Risk of loss', accessor: (row) => titleCase(row.plan.risk_of_loss) },
  ];

  /* ------------------------------- plan actions --------------------------- */

  const openCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm(EMPTY_PLAN_FORM);
    setPlanDialogOpen(true);
  };

  const openEditPlan = (plan: SuccessionPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      title: plan.title,
      position_id: plan.position_id ?? 'none',
      incumbent_employee_id: plan.incumbent_employee_id ?? 'none',
      criticality: plan.criticality,
      risk_of_loss: plan.risk_of_loss,
      notes: plan.notes ?? '',
    });
    setPlanDialogOpen(true);
  };

  const submitPlan = async () => {
    if (!planForm.title.trim()) {
      toast.error('Give the succession plan a title');
      return;
    }
    setSavingPlan(true);
    try {
      const payload: Partial<SuccessionPlan> = {
        title: planForm.title.trim(),
        position_id: planForm.position_id === 'none' ? null : planForm.position_id,
        incumbent_employee_id: planForm.incumbent_employee_id === 'none' ? null : planForm.incumbent_employee_id,
        criticality: planForm.criticality,
        risk_of_loss: planForm.risk_of_loss,
        notes: planForm.notes.trim() || null,
      };
      if (editingPlan) {
        await successionApi.updatePlan(editingPlan.id, payload);
        toast.success('Succession plan updated');
      } else {
        await successionApi.createPlan(payload);
        toast.success('Succession plan created');
      }
      setPlanDialogOpen(false);
      setEditingPlan(null);
      await load();
    } catch (error) {
      toast.error('Could not save the succession plan', { description: errorMessage(error) });
    } finally {
      setSavingPlan(false);
    }
  };

  /* ---------------------------- candidate actions ------------------------- */

  const openCandidateDialog = (plan: SuccessionPlan) => {
    setCandidatePlan(plan);
    setCandidateForm(EMPTY_CANDIDATE_FORM);
  };

  const submitCandidate = async () => {
    if (!candidatePlan) return;
    if (!candidateForm.employee_id) {
      toast.error('Select the employee to add to the bench');
      return;
    }
    const existing = candidatesByPlan.get(candidatePlan.id) ?? [];
    if (existing.some((candidate) => candidate.employee_id === candidateForm.employee_id)) {
      toast.error('This employee is already on the successor bench');
      return;
    }
    setSavingCandidate(true);
    try {
      await successionApi.addCandidate({
        plan_id: candidatePlan.id,
        employee_id: candidateForm.employee_id,
        readiness: candidateForm.readiness,
        potential: candidateForm.potential,
        notes: candidateForm.notes.trim() || null,
      });
      toast.success('Successor added');
      setCandidatePlan(null);
      await load();
    } catch (error) {
      toast.error('Could not add the successor', { description: errorMessage(error) });
    } finally {
      setSavingCandidate(false);
    }
  };

  const confirmRemoveCandidate = async () => {
    if (!removingCandidate) return;
    setRemoving(true);
    try {
      await successionApi.removeCandidate(removingCandidate.id);
      setCandidates((current) => current.filter((row) => row.id !== removingCandidate.id));
      toast.success('Successor removed from the bench');
      setRemovingCandidate(null);
    } catch (error) {
      toast.error('Could not remove the successor', { description: errorMessage(error) });
    } finally {
      setRemoving(false);
    }
  };

  /* --------------------------------- render -------------------------------- */

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Talent continuity"
        title="Succession planning"
        description="Critical roles, successor benches and readiness across AB Rwanda leadership."
        actions={
          canManage ? (
            <Button size="sm" onClick={openCreatePlan}>
              <Plus className="mr-2 h-4 w-4" />
              New plan
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Critical roles" value={criticalRoles} hint="Plans flagged as critical" icon={Crown} tone="accent" />
        <StatCard
          label="No ready-now successor"
          value={plansWithoutReadyNow}
          hint="Plans without an immediate successor"
          icon={AlertTriangle}
        />
        <StatCard label="Successor candidates" value={candidates.length} hint="Across all succession plans" icon={Users} />
        <StatCard
          label="High risk of loss"
          value={highRiskRoles}
          hint="Roles exposed to attrition"
          icon={ShieldAlert}
        />
      </div>

      {loading ? (
        <CardSkeleton />
      ) : plans.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={GitBranch}
            title="No succession plans yet"
            description="Create a plan for a critical role to start building the successor bench."
            action={
              canManage ? (
                <Button size="sm" onClick={openCreatePlan}>
                  <Plus className="mr-2 h-4 w-4" />
                  New plan
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          {plans.map((plan) => {
            const bench = candidatesByPlan.get(plan.id) ?? [];
            const readyNow = bench.filter((candidate) => candidate.readiness === 'ready_now').length;
            return (
              <article
                key={plan.id}
                className="flex h-full flex-col rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md md:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="ed-label">{plan.position?.title ?? 'Unassigned position'}</p>
                    <h3 className="mt-1 text-pretty text-base font-semibold leading-snug text-foreground">
                      {plan.title}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={plan.criticality} label={titleCase(plan.criticality)} />
                    <StatusBadge
                      status={plan.risk_of_loss}
                      label={`${titleCase(plan.risk_of_loss)} risk`}
                      tone={riskTone(plan.risk_of_loss)}
                    />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    Incumbent:{' '}
                    <span className="font-medium text-foreground">
                      {plan.incumbent ? fullName(plan.incumbent) : 'Vacant'}
                    </span>
                  </span>
                  <span className="ed-table-num">
                    {bench.length} successor{bench.length === 1 ? '' : 's'} · {readyNow} ready now
                  </span>
                </div>

                {plan.notes ? (
                  <p className="mt-3 text-pretty text-sm text-muted-foreground">{plan.notes}</p>
                ) : null}

                <div className="mt-4 border-t border-border pt-3">
                  <p className="ed-label mb-2">Successor bench</p>
                  {bench.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No successors identified yet — this role has no internal cover.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {bench.map((candidate) => (
                        <li
                          key={candidate.id}
                          className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {fullName(candidate.employee)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {candidate.employee?.employee_no ?? ''}
                              {candidate.notes ? ` · ${candidate.notes}` : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                            <StatusBadge
                              status={candidate.readiness}
                              label={READINESS_LABEL[candidate.readiness] ?? titleCase(candidate.readiness)}
                            />
                            <StatusBadge
                              status={candidate.potential}
                              label={`${titleCase(candidate.potential)} potential`}
                              tone={potentialTone(candidate.potential)}
                            />
                            {canManage ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                onClick={() => setRemovingCandidate(candidate)}
                                aria-label={`Remove ${fullName(candidate.employee)} from the bench`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {canManage ? (
                  <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3 md:mt-4">
                    <Button variant="ghost" size="sm" onClick={() => openEditPlan(plan)}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit plan
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openCandidateDialog(plan)}>
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Add successor
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      {/* --------------------------- readiness summary ------------------------- */}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="ed-label">Readiness summary</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Successor depth per role, grouped by readiness horizon.
            </p>
          </div>
          <ExportMenu
            filename="ab-rwanda-succession-readiness"
            title="Succession readiness summary"
            subtitle={`${readinessSummary.length} roles`}
            columns={summaryExportColumns}
            rows={readinessSummary}
          />
        </div>

        {loading ? (
          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : readinessSummary.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState
              icon={GitBranch}
              title="Nothing to summarise"
              description="Readiness appears once succession plans and successors are recorded."
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="ed-label whitespace-nowrap px-4 py-3">Role</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3">Incumbent</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Ready now</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">1–2 years</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">2–3 years</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {readinessSummary.map((row) => (
                    <tr key={row.plan.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-medium text-foreground">{row.plan.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {row.plan.position?.title ?? ''}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {fullName(row.plan.incumbent)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">
                        <span className={row.readyNow > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                          {row.readyNow}
                        </span>
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                        {row.oneTwo}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                        {row.twoThree}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------ plan dialog ---------------------------- */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit succession plan' : 'New succession plan'}</DialogTitle>
            <DialogDescription>
              Identify a critical role, its incumbent and the exposure if the position becomes vacant.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Plan title">
              <Input
                value={planForm.title}
                onChange={(event) => setPlanForm((form) => ({ ...form, title: event.target.value }))}
                placeholder="Finance Manager succession"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Position">
                <Select
                  value={planForm.position_id}
                  onValueChange={(value) => setPlanForm((form) => ({ ...form, position_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not linked</SelectItem>
                    {positions.map((position) => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Incumbent">
                <Select
                  value={planForm.incumbent_employee_id}
                  onValueChange={(value) => setPlanForm((form) => ({ ...form, incumbent_employee_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select incumbent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Vacant</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {fullName(employee)} · {employee.employee_no}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Criticality">
                <Select
                  value={planForm.criticality}
                  onValueChange={(value) => setPlanForm((form) => ({ ...form, criticality: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRITICALITY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {titleCase(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Risk of loss">
                <Select
                  value={planForm.risk_of_loss}
                  onValueChange={(value) => setPlanForm((form) => ({ ...form, risk_of_loss: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {titleCase(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                rows={3}
                value={planForm.notes}
                onChange={(event) => setPlanForm((form) => ({ ...form, notes: event.target.value }))}
                placeholder="Context, exposure and development actions"
              />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitPlan()} disabled={savingPlan}>
              {savingPlan ? 'Saving…' : editingPlan ? 'Save changes' : 'Create plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------- successor dialog -------------------------- */}
      <Dialog open={!!candidatePlan} onOpenChange={(open) => (!open ? setCandidatePlan(null) : undefined)}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add successor</DialogTitle>
            <DialogDescription>
              {candidatePlan ? `${candidatePlan.title} · ${candidatePlan.position?.title ?? 'Unassigned position'}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Employee">
              <Select
                value={candidateForm.employee_id}
                onValueChange={(value) => setCandidateForm((form) => ({ ...form, employee_id: value }))}
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Readiness">
                <Select
                  value={candidateForm.readiness}
                  onValueChange={(value) => setCandidateForm((form) => ({ ...form, readiness: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {READINESS_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {READINESS_LABEL[level]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Potential">
                <Select
                  value={candidateForm.potential}
                  onValueChange={(value) => setCandidateForm((form) => ({ ...form, potential: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POTENTIAL_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {titleCase(level)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                rows={3}
                value={candidateForm.notes}
                onChange={(event) => setCandidateForm((form) => ({ ...form, notes: event.target.value }))}
                placeholder="Development gaps and next moves"
              />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCandidatePlan(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submitCandidate()} disabled={savingCandidate}>
              {savingCandidate ? 'Adding…' : 'Add successor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------- remove confirm --------------------------- */}
      <AlertDialog
        open={!!removingCandidate}
        onOpenChange={(open) => (!open ? setRemovingCandidate(null) : undefined)}
      >
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this successor?</AlertDialogTitle>
            <AlertDialogDescription>
              {fullName(removingCandidate?.employee)} will be removed from the successor bench for this role.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmRemoveCandidate();
              }}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? 'Removing…' : 'Remove successor'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
