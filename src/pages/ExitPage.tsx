import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, DoorOpen, FileSignature, Plus, UserMinus, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ExportMenu } from '@/components/common/ExportMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { RWF, formatDate, fullName, titleCase, todayISO } from '@/lib/format';
import { employeesApi, exitApi } from '@/services/api';
import type { EmployeeWithRelations, ExitClearance, ExitRequest, FinalSettlement } from '@/types/types';

const EXIT_TYPES = ['resignation', 'termination', 'retirement', 'contract_end'] as const;
const ACTIVE_STATUSES = ['approved', 'clearance', 'in_progress'];

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

interface SettlementForm {
  final_salary: string;
  leave_encashment: string;
  severance: string;
  deductions: string;
}

const toNumber = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function ExitPage() {
  const { employeeId, isHR, isFinance, isManager } = useAuth();

  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ pendingClearances: 0, settlementsAwaiting: 0 });

  const [initiateOpen, setInitiateOpen] = useState(false);
  const [form, setForm] = useState({
    employee_id: '',
    exit_type: 'resignation',
    notice_date: todayISO(),
    last_working_day: todayISO(),
    reason: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selected, setSelected] = useState<ExitRequest | null>(null);
  const [clearances, setClearances] = useState<ExitClearance[]>([]);
  const [settlement, setSettlement] = useState<FinalSettlement | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [settlementForm, setSettlementForm] = useState<SettlementForm>({
    final_salary: '0',
    leave_encashment: '0',
    severance: '0',
    deductions: '0',
  });
  const [confirmPending, setConfirmPending] = useState(false);
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [newItem, setNewItem] = useState({ department: '', item: '' });
  const [addingItem, setAddingItem] = useState(false);

  const canClear = isHR || isFinance;
  const canApprove = isHR || isManager;
  const canComplete = isHR;

  const loadSummary = useCallback(async (rows: ExitRequest[]) => {
    const active = rows.filter((request) => ACTIVE_STATUSES.includes(request.status)).slice(0, 25);
    if (active.length === 0) {
      setSummary({ pendingClearances: 0, settlementsAwaiting: 0 });
      return;
    }
    try {
      const results = await Promise.all(
        active.map(async (request) => {
          const [clearanceRows, settlementRow] = await Promise.all([
            exitApi.clearances(request.id).catch(() => [] as ExitClearance[]),
            exitApi.settlement(request.id).catch(() => null),
          ]);
          return { clearanceRows, settlementRow };
        }),
      );
      setSummary({
        pendingClearances: results.reduce(
          (total, item) => total + item.clearanceRows.filter((row) => row.status === 'pending').length,
          0,
        ),
        settlementsAwaiting: results.filter(
          (item) => item.settlementRow && !['approved', 'paid'].includes(item.settlementRow.status),
        ).length,
      });
    } catch {
      setSummary({ pendingClearances: 0, settlementsAwaiting: 0 });
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await exitApi.requests();
      setRequests(rows);
      await loadSummary(rows);
    } catch (error) {
      toast.error('Could not load the exit register', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, [loadSummary]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!isHR) return;
    employeesApi
      .list({ limit: 300 })
      .then(setEmployees)
      .catch((error: unknown) =>
        toast.error('Could not load the employee directory', { description: errorMessage(error) }),
      );
  }, [isHR]);

  const openInitiate = () => {
    setForm({
      employee_id: isHR ? '' : employeeId ?? '',
      exit_type: 'resignation',
      notice_date: todayISO(),
      last_working_day: todayISO(),
      reason: '',
    });
    setFormError(null);
    setInitiateOpen(true);
  };

  const submitInitiate = async () => {
    setFormError(null);
    const targetEmployee = isHR ? form.employee_id : employeeId;
    if (!targetEmployee) {
      setFormError('Your login is not linked to an employee record, so an exit cannot be initiated.');
      return;
    }
    if (!form.last_working_day) {
      setFormError('The last working day is required.');
      return;
    }
    if (form.last_working_day < form.notice_date) {
      setFormError('The last working day cannot fall before the notice date.');
      return;
    }
    setSaving(true);
    try {
      await exitApi.createRequest({
        employee_id: targetEmployee,
        exit_type: form.exit_type,
        notice_date: form.notice_date,
        last_working_day: form.last_working_day,
        reason: form.reason.trim() || null,
        status: 'submitted',
      });
      toast.success('Exit request initiated');
      setInitiateOpen(false);
      await loadRequests();
    } catch (error) {
      const message = errorMessage(error);
      setFormError(message);
      toast.error('Could not initiate the exit', { description: message });
    } finally {
      setSaving(false);
    }
  };

  const openDetail = async (request: ExitRequest) => {
    setSelected(request);
    setDetailLoading(true);
    setConfirmPending(false);
    setNewItem({ department: '', item: '' });
    try {
      const [clearanceRows, settlementRow] = await Promise.all([
        exitApi.clearances(request.id),
        exitApi.settlement(request.id),
      ]);
      setClearances(clearanceRows);
      setSettlement(settlementRow);
      setSettlementForm({
        final_salary: String(settlementRow?.final_salary ?? request.employee?.base_salary ?? 0),
        leave_encashment: String(settlementRow?.leave_encashment ?? 0),
        severance: String(settlementRow?.severance ?? 0),
        deductions: String(settlementRow?.deductions ?? 0),
      });
    } catch (error) {
      toast.error('Could not load the exit file', { description: errorMessage(error) });
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async (requestId: string) => {
    const [clearanceRows, settlementRow] = await Promise.all([
      exitApi.clearances(requestId),
      exitApi.settlement(requestId),
    ]);
    setClearances(clearanceRows);
    setSettlement(settlementRow);
  };

  const markClearance = async (item: ExitClearance, status: 'cleared' | 'waived') => {
    try {
      await exitApi.clearItem(item.id, status);
      toast.success(status === 'cleared' ? 'Clearance item cleared' : 'Clearance item waived');
      if (selected) await refreshDetail(selected.id);
      await loadRequests();
    } catch (error) {
      toast.error('Could not update the clearance item', { description: errorMessage(error) });
    }
  };

  const addClearanceItem = async () => {
    if (!selected) return;
    if (!newItem.department.trim() || !newItem.item.trim()) {
      toast.error('Both a department and an item description are required');
      return;
    }
    setAddingItem(true);
    try {
      await exitApi.createClearance({
        exit_request_id: selected.id,
        department: newItem.department.trim(),
        item: newItem.item.trim(),
        status: 'pending',
        sort_order: clearances.length,
      });
      toast.success('Clearance item added');
      setNewItem({ department: '', item: '' });
      await refreshDetail(selected.id);
      await loadRequests();
    } catch (error) {
      toast.error('Could not add the clearance item', { description: errorMessage(error) });
    } finally {
      setAddingItem(false);
    }
  };

  const netSettlement =
    toNumber(settlementForm.final_salary) +
    toNumber(settlementForm.leave_encashment) +
    toNumber(settlementForm.severance) -
    toNumber(settlementForm.deductions);

  const pendingClearances = clearances.filter((item) => item.status === 'pending');

  const saveSettlement = async () => {
    if (!selected) return;
    if (pendingClearances.length > 0 && !confirmPending) {
      toast.error('Confirm the outstanding clearances before saving the settlement');
      return;
    }
    setSettlementSaving(true);
    try {
      await exitApi.saveSettlement({
        exit_request_id: selected.id,
        final_salary: toNumber(settlementForm.final_salary),
        leave_encashment: toNumber(settlementForm.leave_encashment),
        severance: toNumber(settlementForm.severance),
        deductions: toNumber(settlementForm.deductions),
        net_settlement: netSettlement,
        status: settlement?.status ?? 'computed',
        computed_at: new Date().toISOString(),
        notes: settlement?.notes ?? null,
      });
      toast.success('Final settlement saved');
      await refreshDetail(selected.id);
      await loadRequests();
    } catch (error) {
      toast.error('Could not save the settlement', { description: errorMessage(error) });
    } finally {
      setSettlementSaving(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    setActing(true);
    try {
      if (status === 'completed') {
        await exitApi.updateRequest(selected.id, { status: 'completed' });
        await employeesApi.update(selected.employee_id, { status: 'exited' });
        toast.success('Exit completed — the employee is now marked as exited');
      } else if (status === 'approved') {
        await exitApi.updateRequest(selected.id, {
          status: 'approved',
          approved_by: employeeId ?? null,
          approved_at: new Date().toISOString(),
        });
        toast.success('Exit approved');
      } else {
        await exitApi.updateRequest(selected.id, { status });
        toast.success(`Exit moved to ${titleCase(status)}`);
      }
      setSelected({ ...selected, status });
      await loadRequests();
    } catch (error) {
      toast.error('Could not update the exit request', { description: errorMessage(error) });
    } finally {
      setActing(false);
    }
  };

  const groupedClearances = useMemo(() => {
    const map = new Map<string, ExitClearance[]>();
    clearances.forEach((item) => {
      const list = map.get(item.department) ?? [];
      list.push(item);
      map.set(item.department, list);
    });
    return Array.from(map.entries());
  }, [clearances]);

  const stats = useMemo(
    () => ({
      inProgress: requests.filter((request) => ACTIVE_STATUSES.includes(request.status)).length,
      completed: requests.filter((request) => request.status === 'completed').length,
    }),
    [requests],
  );

  const exportColumns = useMemo<ExportColumn<ExitRequest>[]>(
    () => [
      { header: 'Employee', accessor: (row) => fullName(row.employee) },
      { header: 'Employee no', accessor: (row) => row.employee?.employee_no ?? '' },
      { header: 'Exit type', accessor: (row) => titleCase(row.exit_type) },
      { header: 'Notice date', accessor: (row) => formatDate(row.notice_date) },
      { header: 'Last working day', accessor: (row) => formatDate(row.last_working_day) },
      { header: 'Status', accessor: (row) => titleCase(row.status) },
      { header: 'Reason', accessor: (row) => row.reason ?? '' },
      { header: 'Approved', accessor: (row) => formatDate(row.approved_at) },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Offboarding"
        title="Employee exit"
        description="Resignations, terminations and retirements, clearances, final settlement and the closing of the personnel file."
        actions={
          <>
            <ExportMenu
              filename="exit-register"
              title="Employee exit register"
              subtitle={`${requests.length} request${requests.length === 1 ? '' : 's'}`}
              columns={exportColumns}
              rows={requests}
            />
            <Button onClick={openInitiate} disabled={!isHR && !employeeId}>
              <Plus className="mr-2 h-4 w-4" />
              Initiate exit
            </Button>
          </>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)
        ) : (
          <>
            <StatCard label="Exits in progress" value={stats.inProgress} hint="Approved or clearing" icon={DoorOpen} />
            <StatCard
              label="Clearances pending"
              value={summary.pendingClearances}
              hint="Items still outstanding"
              icon={FileSignature}
              tone="accent"
            />
            <StatCard
              label="Settlements awaiting approval"
              value={summary.settlementsAwaiting}
              hint="Computed, not yet approved"
              icon={Wallet}
            />
            <StatCard label="Completed exits" value={stats.completed} hint="Files closed" icon={CheckCircle2} />
          </>
        )}
      </section>

      {loading ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={UserMinus}
            title="No exit requests on file"
            description="When an employee resigns or a contract ends, initiate the exit here to start the clearance checklist."
            action={
              isHR || employeeId ? (
                <Button onClick={openInitiate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Initiate exit
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
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Employee</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Exit type</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Notice date</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Last working day</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr
                  key={request.id}
                  className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                  onClick={() => void openDetail(request)}
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-medium text-foreground">{fullName(request.employee)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {request.employee?.employee_no ?? ''}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{titleCase(request.exit_type)}</td>
                  <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDate(request.notice_date)}
                  </td>
                  <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDate(request.last_working_day)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={request.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        void openDetail(request);
                      }}
                    >
                      Open file
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ----------------------------- initiate exit ---------------------------- */}
      <Dialog open={initiateOpen} onOpenChange={setInitiateOpen}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Initiate an exit</DialogTitle>
            <DialogDescription>
              Record the notice and the last working day. Clearances and the final settlement follow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              {isHR ? (
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
              ) : (
                <Input value={employeeId ? 'Your own record' : 'No employee record linked'} readOnly disabled />
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Exit type</Label>
              <Select value={form.exit_type} onValueChange={(value) => setForm({ ...form, exit_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXIT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {titleCase(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="notice-date">Notice date</Label>
                <Input
                  id="notice-date"
                  type="date"
                  value={form.notice_date}
                  onChange={(event) => setForm({ ...form, notice_date: event.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last-day">Last working day</Label>
                <Input
                  id="last-day"
                  type="date"
                  value={form.last_working_day}
                  onChange={(event) => setForm({ ...form, last_working_day: event.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exit-reason">Reason</Label>
              <Textarea
                id="exit-reason"
                rows={3}
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
                placeholder="Resignation letter reference, contract end, retirement…"
              />
            </div>

            {formError ? (
              <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {formError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInitiateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitInitiate()} disabled={saving}>
              {saving ? 'Initiating…' : 'Initiate exit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------- exit file ------------------------------ */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => (open ? undefined : setSelected(null))}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-3xl">
          {selected ? (
            <>
              <DialogHeader>
                <p className="ed-label">Exit file</p>
                <DialogTitle className="text-balance">{fullName(selected.employee)}</DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <span className="text-xs">
                    {titleCase(selected.exit_type)} · notice {formatDate(selected.notice_date)} · last day{' '}
                    {formatDate(selected.last_working_day)}
                  </span>
                </DialogDescription>
              </DialogHeader>

              {detailLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {selected.reason ? (
                    <div>
                      <p className="ed-label mb-1.5">Reason</p>
                      <p className="whitespace-pre-line text-sm text-foreground">{selected.reason}</p>
                    </div>
                  ) : null}

                  {/* --------------------------- clearances --------------------------- */}
                  <section>
                    <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <p className="ed-label">Clearance checklist</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {clearances.filter((item) => item.status === 'cleared').length} of {clearances.length} cleared
                        </p>
                      </div>
                      {pendingClearances.length > 0 ? (
                        <StatusBadge
                          status="pending"
                          label={`${pendingClearances.length} pending`}
                          tone="warning"
                        />
                      ) : clearances.length > 0 ? (
                        <StatusBadge status="cleared" label="All clear" tone="success" />
                      ) : null}
                    </div>

                    {clearances.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                        No clearance items yet. Add the departments that must sign off before the employee leaves.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {groupedClearances.map(([department, items]) => (
                          <div key={department}>
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {department}
                            </p>
                            <ul className="divide-y divide-border rounded-md border border-border">
                              {items.map((item) => (
                                <li
                                  key={item.id}
                                  className="flex flex-col gap-2 px-3 py-2 md:flex-row md:items-center md:justify-between"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm text-foreground">{item.item}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {item.status === 'cleared' && item.cleared_at
                                        ? `Cleared ${formatDate(item.cleared_at)}`
                                        : item.notes ?? 'Awaiting sign-off'}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <StatusBadge status={item.status} />
                                    {canClear && item.status === 'pending' ? (
                                      <>
                                        <Button size="sm" variant="outline" onClick={() => void markClearance(item, 'cleared')}>
                                          Clear
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => void markClearance(item, 'waived')}>
                                          Waive
                                        </Button>
                                      </>
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {isHR ? (
                      <div className="mt-3 grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1fr_1.4fr_auto] md:items-end">
                        <div className="space-y-1.5">
                          <Label htmlFor="clearance-department">Department</Label>
                          <Input
                            id="clearance-department"
                            value={newItem.department}
                            onChange={(event) => setNewItem({ ...newItem, department: event.target.value })}
                            placeholder="Finance"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="clearance-item">Item</Label>
                          <Input
                            id="clearance-item"
                            value={newItem.item}
                            onChange={(event) => setNewItem({ ...newItem, item: event.target.value })}
                            placeholder="Return of petty cash float"
                          />
                        </div>
                        <Button onClick={() => void addClearanceItem()} disabled={addingItem}>
                          {addingItem ? 'Adding…' : 'Add item'}
                        </Button>
                      </div>
                    ) : null}
                  </section>

                  {/* --------------------------- settlement --------------------------- */}
                  <section>
                    <p className="ed-label mb-2">Final settlement</p>

                    {pendingClearances.length > 0 ? (
                      <div className="mb-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        <span>
                          {pendingClearances.length} clearance item{pendingClearances.length === 1 ? '' : 's'} still
                          pending. Saving a settlement now is possible but must be explicitly confirmed.
                        </span>
                      </div>
                    ) : null}

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="final-salary">Final salary (RWF)</Label>
                        <Input
                          id="final-salary"
                          type="number"
                          inputMode="numeric"
                          value={settlementForm.final_salary}
                          onChange={(event) =>
                            setSettlementForm({ ...settlementForm, final_salary: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="leave-encashment">Leave encashment (RWF)</Label>
                        <Input
                          id="leave-encashment"
                          type="number"
                          inputMode="numeric"
                          value={settlementForm.leave_encashment}
                          onChange={(event) =>
                            setSettlementForm({ ...settlementForm, leave_encashment: event.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="severance">Severance (RWF)</Label>
                        <Input
                          id="severance"
                          type="number"
                          inputMode="numeric"
                          value={settlementForm.severance}
                          onChange={(event) => setSettlementForm({ ...settlementForm, severance: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="deductions">Deductions (RWF)</Label>
                        <Input
                          id="deductions"
                          type="number"
                          inputMode="numeric"
                          value={settlementForm.deductions}
                          onChange={(event) => setSettlementForm({ ...settlementForm, deductions: event.target.value })}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-1 rounded-md border border-border bg-muted/50 px-3 py-2 md:flex-row md:items-center md:justify-between">
                      <span className="ed-label">Net settlement</span>
                      <span className="ed-figure text-xl text-accent">{RWF(netSettlement)}</span>
                    </div>

                    {settlement ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last saved {formatDate(settlement.computed_at)} · status {titleCase(settlement.status)}
                      </p>
                    ) : null}

                    {pendingClearances.length > 0 ? (
                      <label
                        htmlFor="confirm-pending"
                        className="mt-3 flex items-start gap-2 rounded-md border border-border px-3 py-2 text-xs text-foreground"
                      >
                        <Checkbox
                          id="confirm-pending"
                          checked={confirmPending}
                          onCheckedChange={(checked) => setConfirmPending(checked === true)}
                          className="mt-0.5"
                        />
                        <span>
                          I confirm the settlement is being saved while clearance items remain outstanding, and that
                          Finance has been informed.
                        </span>
                      </label>
                    ) : null}

                    {canClear ? (
                      <div className="mt-3 flex justify-end">
                        <Button onClick={() => void saveSettlement()} disabled={settlementSaving}>
                          {settlementSaving ? 'Saving…' : 'Save settlement'}
                        </Button>
                      </div>
                    ) : null}
                  </section>

                  {/* ----------------------------- actions ---------------------------- */}
                  <section className="rounded-md border border-border p-3">
                    <p className="ed-label mb-2">Actions</p>
                    <div className="flex flex-wrap gap-2">
                      {canApprove && ['submitted', 'rejected'].includes(selected.status) ? (
                        <Button onClick={() => void updateStatus('approved')} disabled={acting}>
                          Approve exit
                        </Button>
                      ) : null}
                      {canApprove && selected.status === 'approved' ? (
                        <Button variant="outline" onClick={() => void updateStatus('clearance')} disabled={acting}>
                          Move to clearance
                        </Button>
                      ) : null}
                      {canComplete && ['clearance', 'in_progress', 'approved'].includes(selected.status) ? (
                        <Button variant="outline" onClick={() => void updateStatus('completed')} disabled={acting}>
                          Complete exit
                        </Button>
                      ) : null}
                      {selected.status === 'completed' ? (
                        <p className="text-xs text-muted-foreground">
                          This exit is closed and the employee record is marked as exited.
                        </p>
                      ) : null}
                      {!canApprove && !canComplete ? (
                        <p className="text-xs text-muted-foreground">
                          Only HR and the line manager can move this request forward.
                        </p>
                      ) : null}
                    </div>
                  </section>
                </div>
              )}

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
