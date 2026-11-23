import { CalendarDays, Check, ClipboardList, Plus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ExportMenu } from '@/components/common/ExportMenu';
import { PageHeader } from '@/components/common/PageHeader';
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
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import type { ExportColumn } from '@/lib/export';
import { daysBetween, formatDate, fullName, percent, titleCase, todayISO } from '@/lib/format';
import { employeesApi, leaveApi, notificationsApi } from '@/services/api';
import type { EmployeeWithRelations, LeaveBalance, LeaveRequest, LeaveStatus, LeaveType } from '@/types/types';

const LEAVE_STATUSES: LeaveStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export default function LeavePage() {
  const { employeeId, isHR, isManager } = useAuth();
  const canApproveRequests = isHR || isManager;

  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([]);
  const [myLoading, setMyLoading] = useState(true);
  const [myEmployee, setMyEmployee] = useState<EmployeeWithRelations | null>(null);

  const [approvals, setApprovals] = useState<LeaveRequest[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);

  const [allRequests, setAllRequests] = useState<LeaveRequest[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({
    leave_type_id: '',
    start_date: todayISO(),
    end_date: todayISO(),
    reason: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [decision, setDecision] = useState<{ request: LeaveRequest; status: 'approved' | 'rejected' } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);

  const loadMine = useCallback(async () => {
    if (!employeeId) {
      setMyLoading(false);
      return;
    }
    setMyLoading(true);
    try {
      const [balanceRows, requestRows, employee] = await Promise.all([
        leaveApi.balances(employeeId),
        leaveApi.requests({ employeeId, limit: 100 }),
        employeesApi.get(employeeId),
      ]);
      setBalances(balanceRows);
      setMyRequests(requestRows);
      setMyEmployee(employee);
    } catch (error) {
      toast.error('Could not load your leave records', { description: errorMessage(error) });
    } finally {
      setMyLoading(false);
    }
  }, [employeeId]);

  const loadApprovals = useCallback(async () => {
    if (!canApproveRequests) return;
    setApprovalsLoading(true);
    try {
      const pending = await leaveApi.requests({ status: 'pending', limit: 200 });
      if (isHR) {
        setApprovals(pending);
      } else if (employeeId) {
        const reports = await employeesApi.directReports(employeeId);
        const reportIds = new Set(reports.map((report) => report.id));
        setApprovals(pending.filter((request) => reportIds.has(request.employee_id)));
      } else {
        setApprovals([]);
      }
    } catch (error) {
      toast.error('Could not load the approval queue', { description: errorMessage(error) });
    } finally {
      setApprovalsLoading(false);
    }
  }, [canApproveRequests, isHR, employeeId]);

  const loadAll = useCallback(async () => {
    if (!isHR) return;
    setAllLoading(true);
    try {
      setAllRequests(await leaveApi.requests({ limit: 200 }));
    } catch (error) {
      toast.error('Could not load the leave register', { description: errorMessage(error) });
    } finally {
      setAllLoading(false);
    }
  }, [isHR]);

  useEffect(() => {
    leaveApi
      .types()
      .then(setTypes)
      .catch((error: unknown) => toast.error('Could not load leave types', { description: errorMessage(error) }));
  }, []);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const currentYear = new Date().getFullYear();

  const requestedDays = useMemo(() => {
    if (!requestForm.start_date || !requestForm.end_date) return 0;
    if (requestForm.end_date < requestForm.start_date) return 0;
    return daysBetween(requestForm.start_date, requestForm.end_date);
  }, [requestForm.start_date, requestForm.end_date]);

  const selectedBalance = useMemo(() => {
    if (!requestForm.leave_type_id) return null;
    const year = requestForm.start_date ? new Date(requestForm.start_date).getFullYear() : currentYear;
    return (
      balances.find(
        (balance) => balance.leave_type_id === requestForm.leave_type_id && Number(balance.year) === year,
      ) ?? null
    );
  }, [balances, requestForm.leave_type_id, requestForm.start_date, currentYear]);

  const remainingDays = useMemo(() => {
    if (!selectedBalance) return 0;
    return (
      Number(selectedBalance.entitled_days ?? 0) +
      Number(selectedBalance.carried_over ?? 0) -
      Number(selectedBalance.used_days ?? 0)
    );
  }, [selectedBalance]);

  const openRequest = () => {
    setRequestForm({
      leave_type_id: types[0]?.id ?? '',
      start_date: todayISO(),
      end_date: todayISO(),
      reason: '',
    });
    setFormError(null);
    setRequestOpen(true);
  };

  const submitRequest = async () => {
    setFormError(null);
    if (!employeeId) {
      setFormError('Your login is not linked to an employee record, so leave cannot be requested.');
      return;
    }
    if (!requestForm.leave_type_id) {
      setFormError('Select the type of leave you are requesting.');
      return;
    }
    if (!requestForm.start_date || !requestForm.end_date) {
      setFormError('Both a start and an end date are required.');
      return;
    }
    if (requestForm.end_date < requestForm.start_date) {
      setFormError('The end date cannot fall before the start date.');
      return;
    }
    const days = daysBetween(requestForm.start_date, requestForm.end_date);
    const typeName = types.find((type) => type.id === requestForm.leave_type_id)?.name ?? 'this leave type';

    if (!selectedBalance) {
      setFormError(`No ${typeName} balance is allocated for ${new Date(requestForm.start_date).getFullYear()}.`);
      return;
    }
    if (days > remainingDays) {
      setFormError(
        `You requested ${days} day${days === 1 ? '' : 's'} but only ${remainingDays} day${
          remainingDays === 1 ? '' : 's'
        } of ${typeName} remain for ${selectedBalance.year}.`,
      );
      return;
    }

    const clash = myRequests.find(
      (request) =>
        (request.status === 'pending' || request.status === 'approved') &&
        request.start_date <= requestForm.end_date &&
        request.end_date >= requestForm.start_date,
    );
    if (clash) {
      setFormError(
        `These dates overlap an existing ${clash.status} request (${formatDate(clash.start_date)} – ${formatDate(
          clash.end_date,
        )}). Choose different dates.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      await leaveApi.create({
        employee_id: employeeId,
        leave_type_id: requestForm.leave_type_id,
        start_date: requestForm.start_date,
        end_date: requestForm.end_date,
        days,
        reason: requestForm.reason.trim() || null,
        status: 'pending',
        approver_id: myEmployee?.manager_id ?? null,
      });
      toast.success('Leave request submitted for approval');

      if (myEmployee?.manager_id) {
        try {
          const manager = await employeesApi.get(myEmployee.manager_id);
          if (manager?.profile_id) {
            await notificationsApi.push({
              user_id: manager.profile_id,
              title: 'Leave request awaiting your decision',
              message: `${fullName(myEmployee)} requested ${days} day${days === 1 ? '' : 's'} of ${typeName} from ${formatDate(
                requestForm.start_date,
              )} to ${formatDate(requestForm.end_date)}.`,
              type: 'leave',
              link: '/leave',
            });
          }
        } catch {
          /* the notification is best effort — the request itself is saved */
        }
      }

      setRequestOpen(false);
      await Promise.all([loadMine(), loadApprovals(), loadAll()]);
    } catch (error) {
      const message = errorMessage(error);
      setFormError(message);
      toast.error('Could not submit the leave request', { description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const cancelRequest = async (request: LeaveRequest) => {
    try {
      await leaveApi.cancel(request.id);
      toast.success('Leave request cancelled');
      await Promise.all([loadMine(), loadApprovals(), loadAll()]);
    } catch (error) {
      toast.error('Could not cancel the request', { description: errorMessage(error) });
    }
  };

  const openDecision = (request: LeaveRequest, status: 'approved' | 'rejected') => {
    setDecision({ request, status });
    setDecisionNote('');
    setDecisionError(null);
  };

  const submitDecision = async () => {
    if (!decision) return;
    if (decision.status === 'rejected' && !decisionNote.trim()) {
      setDecisionError('A rejection must carry a reason for the employee.');
      return;
    }
    setDeciding(true);
    try {
      await leaveApi.decide(decision.request.id, decision.status, employeeId, decisionNote.trim());
      toast.success(decision.status === 'approved' ? 'Leave approved' : 'Leave rejected');
      setDecision(null);
      await Promise.all([loadMine(), loadApprovals(), loadAll()]);
    } catch (error) {
      const message = errorMessage(error);
      setDecisionError(message);
      toast.error('Could not record the decision', { description: message });
    } finally {
      setDeciding(false);
    }
  };

  const filteredAll = useMemo(() => {
    return allRequests.filter((request) => {
      if (statusFilter !== 'all' && request.status !== statusFilter) return false;
      if (typeFilter !== 'all' && request.leave_type_id !== typeFilter) return false;
      return true;
    });
  }, [allRequests, statusFilter, typeFilter]);

  const exportColumns = useMemo<ExportColumn<LeaveRequest>[]>(
    () => [
      { header: 'Employee', accessor: (row) => fullName(row.employee) },
      { header: 'Employee no', accessor: (row) => row.employee?.employee_no ?? '' },
      { header: 'Leave type', accessor: (row) => row.leave_type?.name ?? '' },
      { header: 'From', accessor: (row) => formatDate(row.start_date) },
      { header: 'To', accessor: (row) => formatDate(row.end_date) },
      { header: 'Days', accessor: (row) => row.days },
      { header: 'Status', accessor: (row) => titleCase(row.status) },
      { header: 'Requested', accessor: (row) => formatDate(row.created_at) },
      { header: 'Decision note', accessor: (row) => row.decision_note ?? '' },
    ],
    [],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Time & attendance"
        title="Leave"
        description="Balances, requests and approvals, every decision recorded against the employee's leave ledger."
        actions={
          <Button onClick={openRequest} disabled={!employeeId}>
            <Plus className="mr-2 h-4 w-4" />
            Request leave
          </Button>
        }
      />

      {/* -------------------------------- my leave ------------------------------- */}
      <section className="mb-8">
        <SectionHeading
          title="My leave"
          description={`Balances for ${currentYear} and everything you have requested.`}
        />

        {myLoading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
        ) : !employeeId ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState
              icon={CalendarDays}
              title="No employee record linked"
              description="Your login is not connected to a personnel file, so leave balances cannot be shown. Ask HR to link your profile."
            />
          </div>
        ) : balances.length === 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <EmptyState
              icon={CalendarDays}
              title="No leave balances yet"
              description="Balances are allocated when the leave year is opened for your grade."
            />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {balances.map((balance) => {
              const entitled = Number(balance.entitled_days ?? 0) + Number(balance.carried_over ?? 0);
              const used = Number(balance.used_days ?? 0);
              const remaining = Math.max(0, entitled - used);
              return (
                <div key={balance.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {balance.leave_type?.name ?? 'Leave'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {balance.year} · {entitled} entitled · {used} used
                      </p>
                    </div>
                    <p className="ed-figure text-2xl text-accent">{remaining}</p>
                  </div>
                  <Progress value={percent(used, entitled)} className="mt-3" />
                  <p className="mt-1.5 text-xs text-muted-foreground">{remaining} days remaining</p>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          {myLoading ? (
            <div className="space-y-2 rounded-lg border border-border bg-card p-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : myRequests.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={ClipboardList}
                title="You have not requested leave yet"
                description="Submit a request and it will appear here with its approval status."
                action={
                  employeeId ? (
                    <Button onClick={openRequest}>
                      <Plus className="mr-2 h-4 w-4" />
                      Request leave
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
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Leave type</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">From</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">To</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Days</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Requested</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((request) => (
                    <tr key={request.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                        {request.leave_type?.name ?? ''}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(request.start_date)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(request.end_date)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">{request.days}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={request.status} />
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(request.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {request.status === 'pending' ? (
                          <Button variant="ghost" size="sm" onClick={() => cancelRequest(request)}>
                            Cancel
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground"></span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------- approvals ------------------------------- */}
      {canApproveRequests ? (
        <section className="mb-8">
          <SectionHeading
            title="Approvals"
            description={
              isHR
                ? 'Every pending request across the organisation.'
                : 'Pending requests from the people who report to you.'
            }
          />
          {approvalsLoading ? (
            <div className="space-y-2 rounded-lg border border-border bg-card p-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : approvals.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Check}
                title="Nothing awaiting your decision"
                description="New leave requests will land here as soon as they are submitted."
              />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Employee</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Leave type</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">From</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">To</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Days</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Reason</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {approvals.map((request) => (
                    <tr key={request.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="block font-medium text-foreground">{fullName(request.employee)}</span>
                        <span className="ed-table-num block text-xs text-muted-foreground">
                          {request.employee?.employee_no ?? ''}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{request.leave_type?.name ?? ''}</td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(request.start_date)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(request.end_date)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">{request.days}</td>
                      <td className="max-w-[16rem] truncate whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {request.reason ?? ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDecision(request, 'approved')}>
                            <Check className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDecision(request, 'rejected')}>
                            <X className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {/* ------------------------------ all requests ----------------------------- */}
      {isHR ? (
        <section>
          <SectionHeading
            title="All requests"
            description="The full leave register for the organisation."
            action={
              <ExportMenu
                filename="ab-rwanda-leave-requests"
                title="Leave register"
                subtitle={`${filteredAll.length} records`}
                columns={exportColumns}
                rows={filteredAll}
              />
            }
          />
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="md:w-44" aria-label="Filter by status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {LEAVE_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {titleCase(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="md:w-52" aria-label="Filter by leave type">
                <SelectValue placeholder="All leave types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All leave types</SelectItem>
                {types.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {allLoading ? (
            <div className="space-y-2 rounded-lg border border-border bg-card p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredAll.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={ClipboardList}
                title="No requests match this view"
                description="Adjust the status or leave type filters to see more of the register."
              />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Employee</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Leave type</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">From</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">To</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Days</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Decision note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAll.map((request) => (
                    <tr key={request.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="block font-medium text-foreground">{fullName(request.employee)}</span>
                        <span className="ed-table-num block text-xs text-muted-foreground">
                          {request.employee?.employee_no ?? ''}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{request.leave_type?.name ?? ''}</td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(request.start_date)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(request.end_date)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">{request.days}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={request.status} />
                      </td>
                      <td className="max-w-[18rem] truncate whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {request.decision_note ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {filteredAll.length} of {allRequests.length} requests.
          </p>
        </section>
      ) : null}

      {/* ----------------------------- request dialog ---------------------------- */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
            <DialogDescription>
              Days are counted inclusively. Requests are checked against your remaining balance and existing bookings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Leave type</Label>
              <Select
                value={requestForm.leave_type_id || 'none'}
                onValueChange={(value) =>
                  setRequestForm((current) => ({ ...current, leave_type_id: value === 'none' ? '' : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a leave type</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start date</Label>
                <Input
                  type="date"
                  value={requestForm.start_date}
                  onChange={(event) => setRequestForm((current) => ({ ...current, start_date: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End date</Label>
                <Input
                  type="date"
                  value={requestForm.end_date}
                  onChange={(event) => setRequestForm((current) => ({ ...current, end_date: event.target.value }))}
                />
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <span className="ed-table-num font-semibold text-foreground">{requestedDays}</span> day
              {requestedDays === 1 ? '' : 's'} requested
              {selectedBalance ? (
                <>
                  {' · '}
                  <span className="ed-table-num font-semibold text-foreground">{remainingDays}</span> remaining for{' '}
                  {selectedBalance.year}
                </>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason</Label>
              <Textarea
                value={requestForm.reason}
                onChange={(event) => setRequestForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Briefly explain the request"
                rows={3}
              />
            </div>
            {formError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formError}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRequestOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitRequest} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------------------- decision dialog ---------------------------- */}
      <Dialog open={Boolean(decision)} onOpenChange={(open) => (open ? undefined : setDecision(null))}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{decision?.status === 'approved' ? 'Approve leave' : 'Reject leave'}</DialogTitle>
            <DialogDescription>
              {decision
                ? `${fullName(decision.request.employee)} · ${decision.request.leave_type?.name ?? 'Leave'} · ${formatDate(
                    decision.request.start_date,
                  )} – ${formatDate(decision.request.end_date)} (${decision.request.days} days)`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Decision note {decision?.status === 'rejected' ? '(required)' : '(optional)'}
              </Label>
              <Textarea
                value={decisionNote}
                onChange={(event) => setDecisionNote(event.target.value)}
                placeholder={
                  decision?.status === 'rejected'
                    ? 'Explain why the request cannot be granted'
                    : 'Any handover or coverage note'
                }
                rows={3}
              />
            </div>
            {decisionError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {decisionError}
              </p>
            ) : null}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDecision(null)} disabled={deciding}>
              Cancel
            </Button>
            <Button onClick={submitDecision} disabled={deciding}>
              {deciding ? 'Saving…' : decision?.status === 'approved' ? 'Approve request' : 'Reject request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
