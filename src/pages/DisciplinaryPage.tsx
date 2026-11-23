import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ClipboardList, Gavel, Plus, Scale, ShieldCheck } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import type { ExportColumn } from '@/lib/export';
import { formatDate, formatDateTime, fullName, titleCase, todayISO } from '@/lib/format';
import { disciplinaryApi, employeesApi } from '@/services/api';
import type { DisciplinaryAction, DisciplinaryCase, EmployeeWithRelations } from '@/types/types';

const CASE_STATUSES = ['open', 'investigation', 'hearing', 'decided', 'closed', 'appealed'] as const;
const SEVERITIES = ['minor', 'moderate', 'serious', 'gross'] as const;
const CATEGORIES = ['misconduct', 'attendance', 'safety', 'performance', 'policy'] as const;
const ACTION_TYPES = ['verbal_warning', 'written_warning', 'query_issued', 'hearing', 'decision', 'suspension'] as const;

const SEVERITY_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'danger'> = {
  minor: 'neutral',
  moderate: 'info',
  serious: 'warning',
  gross: 'danger',
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

/**
 * The register numbers cases as DC-<year>-<sequence>. The suggestion returned by the API can
 * carry the year inside the running number, so the trailing sequence is normalised here.
 */
const normaliseCaseNo = (suggested: string): string => {
  const year = new Date().getFullYear();
  const match = suggested.match(/(\d+)\s*$/);
  const tail = match ? Number.parseInt(match[1], 10) : 0;
  const sequence = Number.isFinite(tail) ? tail % 1000 : 0;
  return `DC-${year}-${String(sequence).padStart(3, '0')}`;
};

interface RecordForm {
  case_no: string;
  employee_id: string;
  category: string;
  incident_date: string;
  description: string;
  severity: string;
  reported_by: string;
}

const emptyRecordForm = (): RecordForm => ({
  case_no: '',
  employee_id: '',
  category: 'misconduct',
  incident_date: todayISO(),
  description: '',
  severity: 'minor',
  reported_by: '',
});

export default function DisciplinaryPage() {
  const { employeeId, isHR, isManager } = useAuth();

  const [cases, setCases] = useState<DisciplinaryCase[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const [recordOpen, setRecordOpen] = useState(false);
  const [form, setForm] = useState<RecordForm>(emptyRecordForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<DisciplinaryCase | null>(null);
  const [actions, setActions] = useState<DisciplinaryAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);
  const [actionForm, setActionForm] = useState({
    action_type: 'verbal_warning',
    description: '',
    action_date: todayISO(),
  });
  const [actionSaving, setActionSaving] = useState(false);
  const [caseForm, setCaseForm] = useState({ status: 'open', outcome: '', sanction: '' });
  const [caseSaving, setCaseSaving] = useState(false);

  const canRecord = isHR || isManager;

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      setCases(await disciplinaryApi.cases());
    } catch (error) {
      toast.error('Could not load disciplinary cases', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (!canRecord) return;
    employeesApi
      .list({ limit: 300 })
      .then(setEmployees)
      .catch((error: unknown) =>
        toast.error('Could not load the employee directory', { description: errorMessage(error) }),
      );
  }, [canRecord]);

  const loadActions = useCallback(async (caseId: string) => {
    setActionsLoading(true);
    try {
      setActions(await disciplinaryApi.actions(caseId));
    } catch (error) {
      toast.error('Could not load the case timeline', { description: errorMessage(error) });
    } finally {
      setActionsLoading(false);
    }
  }, []);

  const openDetail = (record: DisciplinaryCase) => {
    setSelected(record);
    setCaseForm({ status: record.status, outcome: record.outcome ?? '', sanction: record.sanction ?? '' });
    setActionForm({ action_type: 'verbal_warning', description: '', action_date: todayISO() });
    setActions([]);
    void loadActions(record.id);
  };

  const openRecord = async () => {
    const next = emptyRecordForm();
    next.reported_by = employeeId ?? '';
    setForm(next);
    setFormError(null);
    setRecordOpen(true);
    try {
      const suggested = await disciplinaryApi.nextCaseNo();
      setForm((current) => (current.case_no ? current : { ...current, case_no: normaliseCaseNo(suggested) }));
    } catch {
      /* the case number can still be typed by hand */
    }
  };

  const submitRecord = async () => {
    setFormError(null);
    if (!form.employee_id) {
      setFormError('Select the employee the case concerns.');
      return;
    }
    if (!form.case_no.trim()) {
      setFormError('A case number is required.');
      return;
    }
    if (!form.description.trim()) {
      setFormError('Describe the incident so the file is complete.');
      return;
    }
    setSaving(true);
    try {
      await disciplinaryApi.createCase({
        case_no: form.case_no.trim(),
        employee_id: form.employee_id,
        category: form.category,
        incident_date: form.incident_date,
        description: form.description.trim(),
        severity: form.severity,
        status: 'open',
        reported_by: form.reported_by || null,
      });
      toast.success('Disciplinary case recorded');
      setRecordOpen(false);
      await loadCases();
    } catch (error) {
      const message = errorMessage(error);
      setFormError(message);
      toast.error('Could not record the case', { description: message });
    } finally {
      setSaving(false);
    }
  };

  const submitAction = async () => {
    if (!selected) return;
    if (!actionForm.description.trim()) {
      toast.error('Describe the action before adding it to the timeline');
      return;
    }
    setActionSaving(true);
    try {
      await disciplinaryApi.createAction({
        case_id: selected.id,
        action_type: actionForm.action_type,
        description: actionForm.description.trim(),
        action_date: actionForm.action_date,
        issued_by: employeeId ?? null,
      });
      toast.success('Action added to the case timeline');
      setActionForm({ action_type: 'verbal_warning', description: '', action_date: todayISO() });
      await loadActions(selected.id);
    } catch (error) {
      toast.error('Could not add the action', { description: errorMessage(error) });
    } finally {
      setActionSaving(false);
    }
  };

  const submitCaseUpdate = async () => {
    if (!selected) return;
    setCaseSaving(true);
    try {
      const decided = caseForm.status === 'decided' || caseForm.status === 'closed';
      await disciplinaryApi.updateCase(selected.id, {
        status: caseForm.status,
        outcome: caseForm.outcome.trim() || null,
        sanction: caseForm.sanction.trim() || null,
        decided_at: decided ? selected.decided_at ?? new Date().toISOString() : null,
      });
      toast.success('Case updated');
      const updated: DisciplinaryCase = {
        ...selected,
        status: caseForm.status,
        outcome: caseForm.outcome.trim() || null,
        sanction: caseForm.sanction.trim() || null,
      };
      setSelected(updated);
      await loadCases();
    } catch (error) {
      toast.error('Could not update the case', { description: errorMessage(error) });
    } finally {
      setCaseSaving(false);
    }
  };

  const filtered = useMemo(
    () =>
      cases.filter((record) => {
        if (statusFilter !== 'all' && record.status !== statusFilter) return false;
        if (severityFilter !== 'all' && record.severity !== severityFilter) return false;
        return true;
      }),
    [cases, statusFilter, severityFilter],
  );

  const stats = useMemo(() => {
    const year = new Date().getFullYear();
    return {
      open: cases.filter((record) => record.status !== 'closed').length,
      investigation: cases.filter((record) => record.status === 'investigation').length,
      hearings: cases.filter((record) => record.status === 'hearing').length,
      closedThisYear: cases.filter(
        (record) =>
          record.status === 'closed' &&
          new Date(record.decided_at ?? record.created_at).getFullYear() === year,
      ).length,
    };
  }, [cases]);

  const exportColumns = useMemo<ExportColumn<DisciplinaryCase>[]>(
    () => [
      { header: 'Case no', accessor: (row) => row.case_no },
      { header: 'Employee', accessor: (row) => fullName(row.employee) },
      { header: 'Employee no', accessor: (row) => row.employee?.employee_no ?? '' },
      { header: 'Category', accessor: (row) => titleCase(row.category) },
      { header: 'Incident date', accessor: (row) => formatDate(row.incident_date) },
      { header: 'Severity', accessor: (row) => titleCase(row.severity) },
      { header: 'Status', accessor: (row) => titleCase(row.status) },
      { header: 'Sanction', accessor: (row) => row.sanction ?? '' },
      { header: 'Outcome', accessor: (row) => row.outcome ?? '' },
      { header: 'Decided', accessor: (row) => formatDate(row.decided_at) },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Employee relations"
        title="Disciplinary"
        description="Every case is logged, investigated and closed on the record, with a full audit trail of the actions taken."
        actions={
          <>
            <ExportMenu
              filename="disciplinary-register"
              title="Disciplinary register"
              subtitle={`${filtered.length} case${filtered.length === 1 ? '' : 's'}`}
              columns={exportColumns}
              rows={filtered}
            />
            {canRecord ? (
              <Button onClick={() => void openRecord()}>
                <Plus className="mr-2 h-4 w-4" />
                Record case
              </Button>
            ) : null}
          </>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)
        ) : (
          <>
            <StatCard label="Open cases" value={stats.open} hint="Not yet closed" icon={ClipboardList} />
            <StatCard
              label="Under investigation"
              value={stats.investigation}
              hint="Evidence being gathered"
              icon={ShieldCheck}
              tone="accent"
            />
            <StatCard label="Hearings scheduled" value={stats.hearings} hint="Awaiting the hearing" icon={Gavel} />
            <StatCard
              label="Closed this year"
              value={stats.closedThisYear}
              hint={`Decided in ${new Date().getFullYear()}`}
              icon={Scale}
            />
          </>
        )}
      </section>

      <section className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CASE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {titleCase(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="All severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {SEVERITIES.map((severity) => (
                <SelectItem key={severity} value={severity}>
                  {titleCase(severity)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {cases.length} case{cases.length === 1 ? '' : 's'} shown
        </p>
      </section>

      {loading ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={ShieldCheck}
            title={cases.length === 0 ? 'No disciplinary cases on file' : 'No cases match these filters'}
            description={
              cases.length === 0
                ? 'Cases you record will appear here with their investigation timeline and outcome.'
                : 'Adjust the status or severity filter to see more of the register.'
            }
            action={
              canRecord && cases.length === 0 ? (
                <Button onClick={() => void openRecord()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Record case
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
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Case no</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Employee</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Category</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Incident date</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Severity</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Sanction</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr
                  key={record.id}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                  onClick={() => openDetail(record)}
                >
                  <td className="ed-table-num whitespace-nowrap px-4 py-3 font-medium text-foreground">
                    {record.case_no}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-medium text-foreground">{fullName(record.employee)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{record.employee?.employee_no ?? ''}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{titleCase(record.category)}</td>
                  <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDate(record.incident_date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge
                      status={record.severity}
                      label={titleCase(record.severity)}
                      tone={SEVERITY_TONE[record.severity] ?? 'neutral'}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="max-w-[14rem] truncate whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {record.sanction ?? ''}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetail(record);
                      }}
                    >
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------ record case ----------------------------- */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record a disciplinary case</DialogTitle>
            <DialogDescription>
              Open a case file against an employee. The case number is suggested from the register.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="case-no">Case number</Label>
                <Input
                  id="case-no"
                  value={form.case_no}
                  onChange={(event) => setForm({ ...form, case_no: event.target.value })}
                  placeholder="DC-2026-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="incident-date">Incident date</Label>
                <Input
                  id="incident-date"
                  type="date"
                  value={form.incident_date}
                  onChange={(event) => setForm({ ...form, incident_date: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={form.employee_id} onValueChange={(value) => setForm({ ...form, employee_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select the employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {fullName(employee)} · {employee.employee_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {titleCase(category)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Severity</Label>
                <Select value={form.severity} onValueChange={(value) => setForm({ ...form, severity: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((severity) => (
                      <SelectItem key={severity} value={severity}>
                        {titleCase(severity)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="case-description">Description of the incident</Label>
              <Textarea
                id="case-description"
                rows={4}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="What happened, when, who was present and what evidence exists."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Reported by</Label>
              <Select value={form.reported_by} onValueChange={(value) => setForm({ ...form, reported_by: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select the reporting officer" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {fullName(employee)} · {employee.employee_no}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formError ? (
              <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRecordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitRecord()} disabled={saving}>
              {saving ? 'Recording…' : 'Record case'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------ case detail ----------------------------- */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => (open ? undefined : setSelected(null))}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <p className="ed-label">{selected.case_no}</p>
                <DialogTitle className="text-balance">
                  {fullName(selected.employee)} · {titleCase(selected.category)}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <StatusBadge
                    status={selected.severity}
                    label={`${titleCase(selected.severity)} severity`}
                    tone={SEVERITY_TONE[selected.severity] ?? 'neutral'}
                  />
                  <span className="text-xs">Incident {formatDate(selected.incident_date)}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div>
                  <p className="ed-label mb-1.5">Description</p>
                  <p className="whitespace-pre-line text-sm text-foreground">{selected.description}</p>
                </div>

                <div className="grid gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm md:grid-cols-2">
                  <div>
                    <p className="ed-label">Outcome</p>
                    <p className="mt-1 text-foreground">{selected.outcome ?? 'Not yet decided'}</p>
                  </div>
                  <div>
                    <p className="ed-label">Sanction</p>
                    <p className="mt-1 text-foreground">{selected.sanction ?? 'None recorded'}</p>
                  </div>
                  <div>
                    <p className="ed-label">Decided</p>
                    <p className="mt-1 text-foreground">{formatDateTime(selected.decided_at)}</p>
                  </div>
                  <div>
                    <p className="ed-label">Opened</p>
                    <p className="mt-1 text-foreground">{formatDateTime(selected.created_at)}</p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-end justify-between gap-2">
                    <p className="ed-label">Case timeline</p>
                    <span className="text-xs text-muted-foreground">{actions.length} entries</span>
                  </div>
                  {actionsLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : actions.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                      No actions recorded yet. Warnings, queries and hearings will appear here in date order.
                    </p>
                  ) : (
                    <ol className="relative space-y-3 border-l border-border pl-4">
                      {actions.map((action) => (
                        <li key={action.id} className="relative">
                          <span
                            className="absolute -left-[1.32rem] top-1.5 h-2 w-2 rounded-full bg-accent"
                            aria-hidden="true"
                          />
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{titleCase(action.action_type)}</p>
                            <p className="ed-table-num text-xs text-muted-foreground">
                              {formatDate(action.action_date)}
                            </p>
                          </div>
                          {action.description ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">{action.description}</p>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {canRecord ? (
                  <div className="rounded-lg border border-border p-3">
                    <p className="ed-label mb-2">Add an action</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Action type</Label>
                        <Select
                          value={actionForm.action_type}
                          onValueChange={(value) => setActionForm({ ...actionForm, action_type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTION_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {titleCase(type)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="action-date">Action date</Label>
                        <Input
                          id="action-date"
                          type="date"
                          value={actionForm.action_date}
                          onChange={(event) => setActionForm({ ...actionForm, action_date: event.target.value })}
                        />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <Label htmlFor="action-description">Description</Label>
                      <Textarea
                        id="action-description"
                        rows={2}
                        value={actionForm.description}
                        onChange={(event) => setActionForm({ ...actionForm, description: event.target.value })}
                        placeholder="What was issued, to whom and on what grounds."
                      />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={() => void submitAction()} disabled={actionSaving}>
                        {actionSaving ? 'Adding…' : 'Add action'}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {isHR ? (
                  <div className="rounded-lg border border-border p-3">
                    <p className="ed-label mb-2">Case decision</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Status</Label>
                        <Select
                          value={caseForm.status}
                          onValueChange={(value) => setCaseForm({ ...caseForm, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CASE_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {titleCase(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="case-sanction">Sanction</Label>
                        <Input
                          id="case-sanction"
                          value={caseForm.sanction}
                          onChange={(event) => setCaseForm({ ...caseForm, sanction: event.target.value })}
                          placeholder="Written warning, suspension…"
                        />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <Label htmlFor="case-outcome">Outcome</Label>
                      <Textarea
                        id="case-outcome"
                        rows={2}
                        value={caseForm.outcome}
                        onChange={(event) => setCaseForm({ ...caseForm, outcome: event.target.value })}
                        placeholder="The finding of the hearing and the reasoning behind it."
                      />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" onClick={() => void submitCaseUpdate()} disabled={caseSaving}>
                        {caseSaving ? 'Saving…' : 'Save decision'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
