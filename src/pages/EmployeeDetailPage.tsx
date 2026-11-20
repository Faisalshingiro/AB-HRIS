import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileText,
  Gauge,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  Target,
  UserX,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate, formatDateTime, formatTime, fullName, initials, RWF, titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  attendanceApi,
  departmentsApi,
  employeesApi,
  leaveApi,
  onboardingApi,
  performanceApi,
  positionsApi,
} from '@/services/api';
import type {
  Appraisal,
  Attendance,
  Department,
  EmployeeDocument,
  EmployeeWithRelations,
  Goal,
  LeaveBalance,
  LeaveRequest,
  Position,
} from '@/types/types';
import { EmployeeFormDialog } from './EmployeesPage';

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-border bg-card p-4 md:p-5', className)}>
      <p className="ed-label mb-2">{title}</p>
      <div>{children}</div>
    </section>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isHR, isFinance, canManagePeople, employeeId } = useAuth();

  const [employee, setEmployee] = useState<EmployeeWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [tabLoading, setTabLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [managers, setManagers] = useState<EmployeeWithRelations[]>([]);

  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [appraisals, setAppraisals] = useState<Appraisal[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  const loadedTabs = useRef<Set<string>>(new Set());

  const canSeeSensitive = isHR || isFinance;
  const isOwnRecord = Boolean(employeeId) && employeeId === id;
  const restricted = !canManagePeople && !isOwnRecord;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const record = await employeesApi.get(id);
      setEmployee(record);
    } catch (error) {
      toast.error('Could not load this employee', { description: errorMessage(error) });
      setEmployee(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isHR) return;
    Promise.all([departmentsApi.list(), positionsApi.list(), employeesApi.list({ limit: 200 })])
      .then(([departmentRows, positionRows, employeeRows]) => {
        setDepartments(departmentRows);
        setPositions(positionRows);
        setManagers(employeeRows);
      })
      .catch(() => {
        /* the edit dialog still works with empty reference lists */
      });
  }, [isHR]);

  useEffect(() => {
    if (!id || restricted) return;
    const cacheKey = `${id}:${tab}`;
    if (loadedTabs.current.has(cacheKey)) return;
    loadedTabs.current.add(cacheKey);

    const run = async () => {
      setTabLoading(true);
      try {
        if (tab === 'attendance') {
          setAttendance(await attendanceApi.list({ employeeId: id, limit: 30 }));
        } else if (tab === 'leave') {
          const [balanceRows, requestRows] = await Promise.all([
            leaveApi.balances(id),
            leaveApi.requests({ employeeId: id, limit: 50 }),
          ]);
          setBalances(balanceRows);
          setLeaveRequests(requestRows);
        } else if (tab === 'documents') {
          setDocuments(await onboardingApi.documents(id));
        } else if (tab === 'performance') {
          const [appraisalRows, goalRows] = await Promise.all([
            performanceApi.appraisals({ employeeId: id }),
            performanceApi.goals({ employeeId: id }),
          ]);
          setAppraisals(appraisalRows);
          setGoals(goalRows);
        }
      } catch (error) {
        loadedTabs.current.delete(cacheKey);
        toast.error('Could not load this section', { description: errorMessage(error) });
      } finally {
        setTabLoading(false);
      }
    };

    void run();
  }, [tab, id, restricted]);

  const mask = useCallback(
    (value: string | null | undefined): string => {
      if (!value) return '';
      if (canSeeSensitive) return value;
      const trimmed = value.trim();
      return trimmed.length <= 4 ? '••••' : `•••• ${trimmed.slice(-4)}`;
    },
    [canSeeSensitive],
  );

  const allowanceTotal = useMemo(() => {
    if (!employee) return 0;
    return (
      Number(employee.housing_allowance ?? 0) +
      Number(employee.transport_allowance ?? 0) +
      Number(employee.other_allowance ?? 0)
    );
  }, [employee]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-full" />
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (restricted) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <EmptyState
          icon={ShieldCheck}
          title="This record is restricted"
          description="You can only open your own personnel file. Contact HR if you need access to another employee."
          action={
            <Button asChild variant="outline">
              <Link to="/employees">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to the register
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <EmptyState
          icon={UserX}
          title="Employee not found"
          description="This personnel file may have been removed, or the link is out of date."
          action={
            <Button asChild variant="outline">
              <Link to="/employees">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to the register
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/employees">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Employee register
          </Link>
        </Button>
      </div>

      <PageHeader
        eyebrow={employee.employee_no}
        title={fullName(employee)}
        description={`${employee.position?.title ?? 'Unassigned position'} · ${employee.department?.name ?? 'Unassigned department'}`}
        actions={
          <>
            <StatusBadge status={employee.status} />
            {isHR ? (
              <Button onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-border bg-card p-4 md:flex-row md:items-center md:p-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-lg font-semibold text-foreground">
          {initials(employee.first_name, employee.last_name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-foreground">{fullName(employee)}</p>
          <p className="ed-table-num text-sm text-muted-foreground">{employee.employee_no}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {employee.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {employee.phone ?? ''}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Hired {formatDate(employee.hire_date)}
            </span>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted p-1 md:w-auto">
          <TabsTrigger value="overview" className="whitespace-nowrap">
            Overview
          </TabsTrigger>
          <TabsTrigger value="employment" className="whitespace-nowrap">
            Employment
          </TabsTrigger>
          <TabsTrigger value="attendance" className="whitespace-nowrap">
            Attendance
          </TabsTrigger>
          <TabsTrigger value="leave" className="whitespace-nowrap">
            Leave
          </TabsTrigger>
          <TabsTrigger value="documents" className="whitespace-nowrap">
            Documents
          </TabsTrigger>
          <TabsTrigger value="performance" className="whitespace-nowrap">
            Performance
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------- overview ------------------------------ */}
        <TabsContent value="overview" className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel title="Personal details">
            <DetailRow label="Full name" value={fullName(employee)} />
            <DetailRow label="Gender" value={titleCase(employee.gender)} />
            <DetailRow label="Date of birth" value={formatDate(employee.date_of_birth)} />
            <DetailRow label="National ID" value={<span className="ed-table-num">{mask(employee.national_id)}</span>} />
            <DetailRow label="District" value={employee.district ?? ''} />
            <DetailRow label="Address" value={employee.address ?? ''} />
          </Panel>

          <Panel title="Contact & emergency">
            <DetailRow label="Email" value={employee.email} />
            <DetailRow label="Phone" value={employee.phone ?? ''} />
            <DetailRow label="Emergency contact" value={employee.emergency_contact_name ?? ''} />
            <DetailRow label="Emergency phone" value={employee.emergency_contact_phone ?? ''} />
          </Panel>

          <Panel title="Bank & statutory" className="md:col-span-2">
            <div className="grid gap-x-8 md:grid-cols-2">
              <DetailRow label="Bank" value={employee.bank_name ?? ''} />
              <DetailRow label="Account" value={<span className="ed-table-num">{mask(employee.bank_account)}</span>} />
              <DetailRow label="RSSB number" value={employee.rssb_number ?? ''} />
              <DetailRow label="National ID" value={<span className="ed-table-num">{mask(employee.national_id)}</span>} />
            </div>
            {!canSeeSensitive ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Sensitive identifiers are masked to the last four characters for your role.
              </p>
            ) : null}
          </Panel>
        </TabsContent>

        {/* ------------------------------ employment ----------------------------- */}
        <TabsContent value="employment" className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel title="Contract">
            <DetailRow label="Employee number" value={<span className="ed-table-num">{employee.employee_no}</span>} />
            <DetailRow label="Employment type" value={titleCase(employee.employment_type)} />
            <DetailRow label="Hire date" value={formatDate(employee.hire_date)} />
            <DetailRow label="Contract end" value={formatDate(employee.contract_end_date)} />
            <DetailRow label="Status" value={<StatusBadge status={employee.status} />} />
            <DetailRow label="Reports to" value={employee.manager ? fullName(employee.manager) : ''} />
          </Panel>

          <Panel title="Assignment">
            <DetailRow label="Department" value={employee.department?.name ?? ''} />
            <DetailRow label="Position" value={employee.position?.title ?? ''} />
            <DetailRow label="Grade" value={employee.position?.grade ?? ''} />
            <DetailRow label="Department code" value={employee.department?.code ?? ''} />
          </Panel>

          <Panel title="Salary breakdown" className="md:col-span-2">
            <div className="grid gap-x-8 md:grid-cols-2">
              <DetailRow label="Base salary" value={<span className="ed-table-num">{RWF(employee.base_salary)}</span>} />
              <DetailRow
                label="Housing allowance"
                value={<span className="ed-table-num">{RWF(employee.housing_allowance)}</span>}
              />
              <DetailRow
                label="Transport allowance"
                value={<span className="ed-table-num">{RWF(employee.transport_allowance)}</span>}
              />
              <DetailRow
                label="Other allowance"
                value={<span className="ed-table-num">{RWF(employee.other_allowance)}</span>}
              />
              <DetailRow label="Total allowances" value={<span className="ed-table-num">{RWF(allowanceTotal)}</span>} />
              <DetailRow
                label="Gross monthly"
                value={
                  <span className="ed-table-num text-accent">{RWF(Number(employee.base_salary ?? 0) + allowanceTotal)}</span>
                }
              />
            </div>
          </Panel>
        </TabsContent>

        {/* ------------------------------ attendance ----------------------------- */}
        <TabsContent value="attendance" className="mt-4">
          {tabLoading ? (
            <TableSkeleton />
          ) : attendance.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState icon={CalendarDays} title="No attendance recorded" description="Clock-ins for this employee will appear here." />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Date</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Clock in</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Clock out</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Hours</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((record) => (
                    <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-foreground">{formatDate(record.work_date)}</td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">{formatTime(record.clock_in)}</td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">{formatTime(record.clock_out)}</td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">
                        {Number(record.hours_worked ?? 0).toFixed(1)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={record.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* -------------------------------- leave -------------------------------- */}
        <TabsContent value="leave" className="mt-4 space-y-4">
          {tabLoading ? (
            <TableSkeleton />
          ) : (
            <>
              {balances.length === 0 ? (
                <div className="rounded-lg border border-border bg-card">
                  <EmptyState icon={CalendarDays} title="No leave balances" description="Balances are created when the leave year is opened." />
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {balances.map((balance) => {
                    const entitled = Number(balance.entitled_days ?? 0) + Number(balance.carried_over ?? 0);
                    const used = Number(balance.used_days ?? 0);
                    const remaining = Math.max(0, entitled - used);
                    const pct = entitled > 0 ? Math.min(100, Math.round((used / entitled) * 100)) : 0;
                    return (
                      <div key={balance.id} className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{balance.leave_type?.name ?? 'Leave'}</p>
                            <p className="text-xs text-muted-foreground">
                              {balance.year} · {entitled} entitled · {used} used
                            </p>
                          </div>
                          <p className="ed-figure text-xl text-accent">{remaining}</p>
                        </div>
                        <Progress value={pct} className="mt-3" />
                        <p className="mt-1.5 text-xs text-muted-foreground">{remaining} days remaining</p>
                      </div>
                    );
                  })}
                </div>
              )}

              {leaveRequests.length === 0 ? (
                <div className="rounded-lg border border-border bg-card">
                  <EmptyState icon={ClipboardList} title="No leave requests" description="Requests submitted by this employee will appear here." />
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-card">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/60">
                        <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Type</th>
                        <th className="ed-label whitespace-nowrap px-4 py-3 text-left">From</th>
                        <th className="ed-label whitespace-nowrap px-4 py-3 text-left">To</th>
                        <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Days</th>
                        <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                        <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Decision note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveRequests.map((request) => (
                        <tr key={request.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                          <td className="whitespace-nowrap px-4 py-3 text-foreground">{request.leave_type?.name ?? ''}</td>
                          <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(request.start_date)}</td>
                          <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(request.end_date)}</td>
                          <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">{request.days}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <StatusBadge status={request.status} />
                          </td>
                          <td className="max-w-[16rem] truncate whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {request.decision_note ?? ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ------------------------------ documents ------------------------------ */}
        <TabsContent value="documents" className="mt-4">
          {tabLoading ? (
            <TableSkeleton />
          ) : documents.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState icon={FileText} title="No documents on file" description="Contracts, IDs and certificates uploaded for this employee will appear here." />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Document</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Type</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Uploaded</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Verified</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-3">
                        {document.file_url ? (
                          <a
                            href={document.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {document.file_name}
                          </a>
                        ) : (
                          <span className="font-medium text-foreground">{document.file_name}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{titleCase(document.doc_type)}</td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(document.uploaded_at)}</td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDate(document.verified_at)}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={document.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ----------------------------- performance ----------------------------- */}
        <TabsContent value="performance" className="mt-4 space-y-4">
          {tabLoading ? (
            <TableSkeleton />
          ) : (
            <>
              <Panel title="Appraisals">
                {appraisals.length === 0 ? (
                  <EmptyState icon={Gauge} title="No appraisals yet" description="Appraisal cycles will appear here once opened." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="ed-label whitespace-nowrap px-2 py-2 text-left">Cycle</th>
                          <th className="ed-label whitespace-nowrap px-2 py-2 text-right">Self</th>
                          <th className="ed-label whitespace-nowrap px-2 py-2 text-right">Manager</th>
                          <th className="ed-label whitespace-nowrap px-2 py-2 text-right">Final</th>
                          <th className="ed-label whitespace-nowrap px-2 py-2 text-left">Rating</th>
                          <th className="ed-label whitespace-nowrap px-2 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appraisals.map((appraisal) => (
                          <tr key={appraisal.id} className="border-b border-border last:border-0">
                            <td className="whitespace-nowrap px-2 py-2.5 text-foreground">{appraisal.cycle?.name ?? ''}</td>
                            <td className="ed-table-num whitespace-nowrap px-2 py-2.5 text-right text-muted-foreground">
                              {appraisal.self_score ?? ''}
                            </td>
                            <td className="ed-table-num whitespace-nowrap px-2 py-2.5 text-right text-muted-foreground">
                              {appraisal.manager_score ?? ''}
                            </td>
                            <td className="ed-table-num whitespace-nowrap px-2 py-2.5 text-right font-medium text-foreground">
                              {appraisal.final_score ?? ''}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground">{titleCase(appraisal.rating)}</td>
                            <td className="whitespace-nowrap px-2 py-2.5">
                              <StatusBadge status={appraisal.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title="Goals">
                {goals.length === 0 ? (
                  <EmptyState icon={Target} title="No goals set" description="Objectives agreed for this employee will appear here." />
                ) : (
                  <div className="space-y-3">
                    {goals.map((goal) => (
                      <div key={goal.id} className="rounded-md border border-border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{goal.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {titleCase(goal.category)} · weight {goal.weight}% · due {formatDate(goal.due_date)}
                            </p>
                          </div>
                          <StatusBadge status={goal.status} />
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <Progress value={Math.min(100, Number(goal.progress ?? 0))} className="flex-1" />
                          <span className="ed-table-num w-10 text-right text-xs text-muted-foreground">
                            {Number(goal.progress ?? 0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </>
          )}
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Personnel file last updated {formatDateTime(employee.updated_at)}.
      </p>

      <EmployeeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        employee={employee}
        departments={departments}
        positions={positions}
        managers={managers}
        onSaved={load}
      />
    </div>
  );
}
