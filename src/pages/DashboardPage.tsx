import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Briefcase,
  CalendarCheck,
  ClipboardList,
  Clock,
  LogIn,
  LogOut,
  ShieldCheck,
  UserMinus,
  Users,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import {
  attendanceApi,
  dashboardApi,
  employeesApi,
  leaveApi,
  notificationsApi,
  payrollApi,
  performanceApi,
} from '@/services/api';
import type {
  Attendance,
  DashboardStats,
  EmployeeWithRelations,
  LeaveBalance,
  LeaveRequest,
  Notification,
  PayrollItem,
} from '@/types/types';
import { RWF, compactRWF, formatDate, formatTime, fullName, titleCase } from '@/lib/format';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { profile, role, employeeId, isHR, isFinance, isManager } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<EmployeeWithRelations | null>(null);
  const [today, setToday] = useState<Attendance | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [myLeave, setMyLeave] = useState<LeaveRequest[]>([]);
  const [payslips, setPayslips] = useState<PayrollItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [appraisalCount, setAppraisalCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [statsData, notifData] = await Promise.all([
        dashboardApi.stats(),
        profile?.id ? notificationsApi.list(profile.id) : Promise.resolve([]),
      ]);
      setStats(statsData);
      setNotifications(notifData.slice(0, 5));

      if (employeeId) {
        const [employee, attendance, balanceData, leaveData, slips, appraisals] = await Promise.all([
          employeesApi.get(employeeId),
          attendanceApi.today(employeeId),
          leaveApi.balances(employeeId),
          leaveApi.requests({ employeeId, limit: 6 }),
          payrollApi.myPayslips(employeeId),
          performanceApi.appraisals({ employeeId }),
        ]);
        setMe(employee);
        setToday(attendance);
        setBalances(balanceData.filter((b) => b.year === new Date().getFullYear()));
        setMyLeave(leaveData);
        setPayslips(slips);
        setAppraisalCount(appraisals.filter((a) => a.status !== 'finalized').length);
      }

      if (isManager && employeeId) {
        const reports = await employeesApi.directReports(employeeId);
        const reportIds = new Set(reports.map((r) => r.id));
        const allLeave = await leaveApi.requests({ status: 'pending', limit: 100 });
        setPendingApprovals(allLeave.filter((l) => l.employee_id && reportIds.has(l.employee_id)));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load the dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, isManager]);

  const handleClock = async (action: 'in' | 'out') => {
    if (!employeeId) {
      toast.error('Your account is not linked to an employee record');
      return;
    }
    setBusy(true);
    try {
      if (action === 'in') await attendanceApi.clockIn(employeeId);
      else await attendanceApi.clockOut(employeeId);
      toast.success(action === 'in' ? 'Clocked in' : 'Clocked out');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Attendance action failed');
    } finally {
      setBusy(false);
    }
  };

  const annualBalance = useMemo(() => balances.find((b) => b.leave_type?.code === 'ANNUAL'), [balances]);
  const remaining = annualBalance
    ? Number(annualBalance.entitled_days) + Number(annualBalance.carried_over) - Number(annualBalance.used_days)
    : 0;
  const latestPayslip = payslips[0];

  const chartColors = ['hsl(var(--foreground))', 'hsl(var(--accent))', 'hsl(var(--muted-foreground))'];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${titleCase(role ?? 'employee')} workspace · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        title={`Good day, ${profile?.full_name?.split(' ')[0] ?? 'colleague'}`}
        description="A single view of headcount, approvals, attendance and payroll across AB Rwanda PLC."
        actions={
          employeeId ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleClock('in')} disabled={busy || Boolean(today?.clock_in)}>
                <LogIn className="mr-2 h-4 w-4" />
                Clock in
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleClock('out')}
                disabled={busy || !today?.clock_in || Boolean(today?.clock_out)}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Clock out
              </Button>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-4 md:gap-5">
        <StatCard label="Active headcount" value={stats?.activeEmployees ?? 0} hint={`${stats?.onProbation ?? 0} on probation`} icon={Users} />
        <StatCard
          label="Attendance today"
          value={`${stats?.attendanceRate ?? 0}%`}
          hint={`${stats?.presentToday ?? 0} present · ${stats?.lateToday ?? 0} late · ${stats?.absentToday ?? 0} absent`}
          icon={CalendarCheck}
        />
        <StatCard
          label="Pending leave approvals"
          value={stats?.pendingLeave ?? 0}
          hint="Awaiting line manager decision"
          icon={ClipboardList}
          tone="accent"
        />
        <StatCard
          label="Latest payroll"
          value={compactRWF(stats?.payrollNet ?? 0)}
          hint={stats?.payrollStatus ? `Status: ${titleCase(stats.payrollStatus)}` : 'No payroll period yet'}
          icon={Wallet}
        />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Headcount trend</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Active employees over the last six months</p>
              </div>
              <StatusBadge status="active" label={`${stats?.headcount ?? 0} total records`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.headcountTrend ?? []} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="headcountFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--foreground))" strokeWidth={2} fill="url(#headcountFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Headcount by department</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Distribution across the organisation</p>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full min-w-0 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(stats?.departmentBreakdown ?? []).slice(0, 6)}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={92}
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                    {(stats?.departmentBreakdown ?? []).slice(0, 6).map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">My leave balance</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Current year entitlement</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {balances.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No leave balance" description="Your leave entitlement has not been set up yet." />
            ) : (
              balances.slice(0, 4).map((balance) => {
                const total = Number(balance.entitled_days) + Number(balance.carried_over);
                const used = Number(balance.used_days);
                const left = Math.max(total - used, 0);
                return (
                  <div key={balance.id}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-medium">{balance.leave_type?.name ?? 'Leave'}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {left} / {total} days
                      </span>
                    </div>
                    <Progress value={total ? (used / total) * 100 : 0} className="mt-2 h-1.5" />
                  </div>
                );
              })
            )}
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to="/leave">
                Request leave
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today&apos;s attendance</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Your clock-in record</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {today ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <StatusBadge status={today.status} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Clock in</span>
                  <span className="ed-table-num text-sm font-medium">{formatTime(today.clock_in)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Clock out</span>
                  <span className="ed-table-num text-sm font-medium">{formatTime(today.clock_out)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Hours worked</span>
                  <span className="ed-table-num text-sm font-medium">{Number(today.hours_worked).toFixed(1)} h</span>
                </div>
              </>
            ) : (
              <EmptyState
                icon={Clock}
                title="Not clocked in yet"
                description="Record your attendance for today using the clock-in action above."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Latest payslip</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Most recent processed payroll</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestPayslip ? (
              <>
                <div>
                  <p className="ed-label">Net pay</p>
                  <p className="ed-figure mt-1 text-2xl">{RWF(latestPayslip.net_pay)}</p>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Gross</span>
                  <span className="ed-table-num font-medium">{RWF(latestPayslip.gross_pay)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">PAYE</span>
                  <span className="ed-table-num font-medium">{RWF(latestPayslip.paye)}</span>
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link to="/payroll">View payslips</Link>
                </Button>
              </>
            ) : (
              <EmptyState icon={Wallet} title="No payslip yet" description="Payslips appear once payroll has been processed." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">My recent leave requests</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Latest submissions and decisions</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/leave">All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {myLeave.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No leave requests" description="Submit a request from the leave module." />
            ) : (
              <ul className="divide-y divide-border">
                {myLeave.slice(0, 5).map((request) => (
                  <li key={request.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{request.leave_type?.name ?? 'Leave'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(request.start_date)} → {formatDate(request.end_date)} · {request.days} days
                      </p>
                    </div>
                    <StatusBadge status={request.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Notifications</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Latest system alerts</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/notifications">All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="Nothing new" description="You have no unread notifications." />
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((item) => (
                  <li key={item.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-medium">{item.title}</p>
                      {!item.is_read ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" /> : null}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {(isHR || isFinance || isManager) && (
        <div className="mt-5 grid gap-4 md:grid-cols-4 md:gap-5">
          <StatCard label="Open vacancies" value={stats?.openRoles ?? 0} hint={`${stats?.candidates ?? 0} candidates in pipeline`} icon={Briefcase} />
          <StatCard label="Appraisals in progress" value={stats?.pendingAppraisals ?? 0} hint="Not yet finalised" icon={ClipboardList} />
          <StatCard label="Open disciplinary cases" value={stats?.openCases ?? 0} hint="Under investigation or hearing" icon={ShieldCheck} />
          <StatCard label="Exits in progress" value={stats?.exitsInProgress ?? 0} hint="Clearance or settlement pending" icon={UserMinus} />
        </div>
      )}

      {isManager && pendingApprovals.length > 0 ? (
        <Card className="mt-5">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Awaiting your approval</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Leave requests from your direct reports</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/leave">Review</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {pendingApprovals.slice(0, 5).map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{fullName(request.employee)}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.leave_type?.name} · {formatDate(request.start_date)} → {formatDate(request.end_date)}
                    </p>
                  </div>
                  <StatusBadge status={request.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {me && appraisalCount > 0 ? (
        <Card className="mt-5">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">You have {appraisalCount} appraisal awaiting action</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Complete your self-evaluation before the cycle closes.
              </p>
            </div>
            <Button size="sm" asChild className="shrink-0">
              <Link to="/performance">Open performance</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
