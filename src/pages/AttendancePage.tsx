import { CalendarCheck, CalendarDays, Clock, LogIn, LogOut, Plus, Timer, UserCheck, Users } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import type { ExportColumn } from '@/lib/export';
import { formatDate, formatTime, fullName, percent, titleCase, toISODate, todayISO } from '@/lib/format';
import { attendanceApi, employeesApi } from '@/services/api';
import type { Attendance, AttendanceStatus, EmployeeWithRelations } from '@/types/types';

const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'remote', 'leave', 'holiday'];

const STATUS_BAR: Record<string, string> = {
  present: 'bg-success',
  late: 'bg-warning',
  absent: 'bg-destructive',
  remote: 'bg-info',
  leave: 'bg-accent',
  holiday: 'bg-muted-foreground',
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

const isoDaysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toISODate(date);
};

export default function AttendancePage() {
  const { employeeId, isHR, isManager } = useAuth();
  const canViewTeam = isHR || isManager;

  const [todayRecord, setTodayRecord] = useState<Attendance | null>(null);
  const [myRecords, setMyRecords] = useState<Attendance[]>([]);
  const [personalLoading, setPersonalLoading] = useState(true);
  const [clocking, setClocking] = useState(false);

  const [from, setFrom] = useState(isoDaysAgo(13));
  const [to, setTo] = useState(todayISO());
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [teamRecords, setTeamRecords] = useState<Attendance[]>([]);
  const [todayTeam, setTodayTeam] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);

  const [markOpen, setMarkOpen] = useState(false);
  const [markForm, setMarkForm] = useState({ employee_id: '', work_date: todayISO(), status: 'present', notes: '' });
  const [marking, setMarking] = useState(false);

  const loadPersonal = useCallback(async () => {
    if (!employeeId) {
      setPersonalLoading(false);
      return;
    }
    setPersonalLoading(true);
    try {
      const [record, recent] = await Promise.all([
        attendanceApi.today(employeeId),
        attendanceApi.list({ employeeId, from: isoDaysAgo(29), to: todayISO(), limit: 60 }),
      ]);
      setTodayRecord(record);
      setMyRecords(recent);
    } catch (error) {
      toast.error('Could not load your attendance', { description: errorMessage(error) });
    } finally {
      setPersonalLoading(false);
    }
  }, [employeeId]);

  const loadTeam = useCallback(async () => {
    if (!canViewTeam) return;
    setTeamLoading(true);
    try {
      const employeeRows = isHR
        ? await employeesApi.list({ limit: 200 })
        : employeeId
          ? await employeesApi.list({ limit: 200, managerId: employeeId })
          : [];
      const teamIds = new Set(employeeRows.map((employee) => employee.id));
      const [rows, todayRows] = await Promise.all([
        attendanceApi.list({
          from,
          to,
          employeeId: employeeFilter === 'all' ? undefined : employeeFilter,
          limit: 500,
        }),
        attendanceApi.list({ from: todayISO(), to: todayISO(), limit: 500 }),
      ]);
      setEmployees(employeeRows);
      setTeamRecords(isHR ? rows : rows.filter((row) => teamIds.has(row.employee_id)));
      setTodayTeam(isHR ? todayRows : todayRows.filter((row) => teamIds.has(row.employee_id)));
    } catch (error) {
      toast.error('Could not load the team attendance', { description: errorMessage(error) });
    } finally {
      setTeamLoading(false);
    }
  }, [canViewTeam, employeeId, employeeFilter, from, isHR, to]);

  useEffect(() => {
    void loadPersonal();
  }, [loadPersonal]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const handleClockIn = async () => {
    if (!employeeId) {
      toast.error('Your account is not linked to an employee record');
      return;
    }
    setClocking(true);
    try {
      await attendanceApi.clockIn(employeeId);
      toast.success('Clocked in — have a good day');
      await loadPersonal();
      if (canViewTeam) await loadTeam();
    } catch (error) {
      toast.error('Could not clock in', { description: errorMessage(error) });
    } finally {
      setClocking(false);
    }
  };

  const handleClockOut = async () => {
    if (!employeeId) {
      toast.error('Your account is not linked to an employee record');
      return;
    }
    setClocking(true);
    try {
      await attendanceApi.clockOut(employeeId);
      toast.success('Clocked out — hours recorded');
      await loadPersonal();
      if (canViewTeam) await loadTeam();
    } catch (error) {
      toast.error('Could not clock out', { description: errorMessage(error) });
    } finally {
      setClocking(false);
    }
  };

  const submitMark = async () => {
    if (!markForm.employee_id) {
      toast.error('Select the employee to mark');
      return;
    }
    if (!markForm.work_date) {
      toast.error('Pick the work date');
      return;
    }
    setMarking(true);
    try {
      await attendanceApi.mark(markForm.employee_id, markForm.work_date, markForm.status, markForm.notes.trim() || undefined);
      toast.success('Attendance marked');
      setMarkOpen(false);
      setMarkForm({ employee_id: '', work_date: todayISO(), status: 'present', notes: '' });
      await loadTeam();
    } catch (error) {
      toast.error('Could not mark attendance', { description: errorMessage(error) });
    } finally {
      setMarking(false);
    }
  };

  const personalStats = useMemo(() => {
    const present = myRecords.filter((record) => record.status === 'present' || record.status === 'remote').length;
    const late = myRecords.filter((record) => record.status === 'late').length;
    const absent = myRecords.filter((record) => record.status === 'absent').length;
    const hours = myRecords.reduce((sum, record) => sum + Number(record.hours_worked ?? 0), 0);
    return { present, late, absent, hours, rate: percent(present, myRecords.length) };
  }, [myRecords]);

  const teamStats = useMemo(() => {
    const present = todayTeam.filter((record) => record.status === 'present').length;
    const late = todayTeam.filter((record) => record.status === 'late').length;
    const absent = todayTeam.filter((record) => record.status === 'absent').length;
    const remote = todayTeam.filter((record) => record.status === 'remote').length;
    const rate = percent(present + remote, todayTeam.length);
    return { present, late, absent, remote, rate };
  }, [todayTeam]);

  const distribution = useMemo(() => {
    const counts = new Map<string, number>();
    teamRecords.forEach((record) => {
      counts.set(record.status, (counts.get(record.status) ?? 0) + 1);
    });
    const total = teamRecords.length;
    return ATTENDANCE_STATUSES.map((status) => ({
      status,
      count: counts.get(status) ?? 0,
      share: total ? Math.round(((counts.get(status) ?? 0) / total) * 100) : 0,
    })).filter((entry) => entry.count > 0);
  }, [teamRecords]);

  const exportColumns = useMemo<ExportColumn<Attendance>[]>(
    () => [
      { header: 'Employee', accessor: (row) => fullName(row.employee) },
      { header: 'Employee no', accessor: (row) => row.employee?.employee_no ?? '' },
      { header: 'Date', accessor: (row) => formatDate(row.work_date) },
      { header: 'Clock in', accessor: (row) => formatTime(row.clock_in) },
      { header: 'Clock out', accessor: (row) => formatTime(row.clock_out) },
      { header: 'Hours', accessor: (row) => Number(row.hours_worked ?? 0).toFixed(2) },
      { header: 'Status', accessor: (row) => titleCase(row.status) },
    ],
    [],
  );

  const today = todayISO();

  return (
    <div>
      <PageHeader
        eyebrow="Time & attendance"
        title="Attendance"
        description="Clock in, clock out and keep an auditable record of who is at work, on time and on leave."
        actions={
          isHR ? (
            <Button onClick={() => setMarkOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Mark attendance
            </Button>
          ) : undefined
        }
      />

      {/* ------------------------------ clock card ------------------------------ */}
      <div className="mb-6 rounded-lg border border-border bg-card p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="ed-label">Today · {formatDate(today)}</p>
            {personalLoading ? (
              <Skeleton className="mt-2 h-8 w-56" />
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="ed-figure text-2xl md:text-3xl">
                  {todayRecord ? `${Number(todayRecord.hours_worked ?? 0).toFixed(1)}h` : '0.0h'}
                </p>
                {todayRecord ? <StatusBadge status={todayRecord.status} /> : <StatusBadge status="absent" label="Not clocked in" />}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <LogIn className="h-3.5 w-3.5" />
                In {formatTime(todayRecord?.clock_in)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LogOut className="h-3.5 w-3.5" />
                Out {formatTime(todayRecord?.clock_out)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleClockIn} disabled={clocking || !employeeId || Boolean(todayRecord?.clock_in)}>
              <LogIn className="mr-2 h-4 w-4" />
              Clock in
            </Button>
            <Button
              variant="outline"
              onClick={handleClockOut}
              disabled={clocking || !todayRecord?.clock_in || Boolean(todayRecord?.clock_out)}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Clock out
            </Button>
          </div>
        </div>
        {!employeeId ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Your login is not linked to an employee record, so clock-ins are unavailable. Ask HR to link your profile.
          </p>
        ) : null}
      </div>

      {/* -------------------------------- stats -------------------------------- */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5 md:gap-4">
        {canViewTeam ? (
          <>
            <StatCard label="Present today" value={teamStats.present} icon={UserCheck} hint="Clocked in on site" />
            <StatCard label="Late today" value={teamStats.late} icon={Clock} hint="After 08:15" tone="accent" />
            <StatCard label="Absent today" value={teamStats.absent} icon={CalendarDays} hint="No record" />
            <StatCard label="Remote today" value={teamStats.remote} icon={Users} hint="Working off site" />
            <StatCard label="Attendance rate" value={teamStats.rate} icon={CalendarCheck} hint="Present or remote" />
          </>
        ) : (
          <>
            <StatCard label="Days present" value={personalStats.present} icon={UserCheck} hint="Last 30 days" />
            <StatCard label="Late arrivals" value={personalStats.late} icon={Clock} hint="Last 30 days" tone="accent" />
            <StatCard label="Absences" value={personalStats.absent} icon={CalendarDays} hint="Last 30 days" />
            <StatCard label="Hours logged" value={personalStats.hours.toFixed(1)} icon={Timer} hint="Last 30 days" />
            <StatCard label="Attendance rate" value={personalStats.rate} icon={CalendarCheck} hint="Last 30 days" />
          </>
        )}
      </div>

      {/* ------------------------------ team view ------------------------------ */}
      {canViewTeam ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-2 md:flex-row md:items-end">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="md:w-40" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="md:w-40" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Employee</Label>
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="md:w-56" aria-label="Filter by employee">
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
              </div>
            </div>
            <ExportMenu
              filename="ab-rwanda-attendance"
              title="Attendance register"
              subtitle={`${formatDate(from)} – ${formatDate(to)}`}
              columns={exportColumns}
              rows={teamRecords}
            />
          </div>

          {distribution.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="ed-label mb-3">Status distribution · {teamRecords.length} records</p>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                {distribution.map((entry) => (
                  <div
                    key={entry.status}
                    className={STATUS_BAR[entry.status] ?? 'bg-muted-foreground'}
                    style={{ width: `${entry.share}%` }}
                    title={`${titleCase(entry.status)} · ${entry.count}`}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {distribution.map((entry) => (
                  <span key={entry.status} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_BAR[entry.status] ?? 'bg-muted-foreground'}`} />
                    {titleCase(entry.status)} · {entry.count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {teamLoading ? (
            <div className="space-y-2 rounded-lg border border-border bg-card p-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : teamRecords.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={CalendarDays}
                title="No attendance in this window"
                description="Widen the date range or clear the employee filter to see more records."
              />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Employee</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Date</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Clock in</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Clock out</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Hours</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {teamRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="block font-medium text-foreground">{fullName(record.employee)}</span>
                        <span className="ed-table-num block text-xs text-muted-foreground">
                          {record.employee?.employee_no ?? ''}
                        </span>
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(record.work_date)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatTime(record.clock_in)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatTime(record.clock_out)}
                      </td>
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
          <p className="text-xs text-muted-foreground">
            Showing {teamRecords.length} records from {formatDate(from)} to {formatDate(to)}.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          <p className="ed-label">My last 30 days</p>
          {personalLoading ? (
            <div className="space-y-2 rounded-lg border border-border bg-card p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : myRecords.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={CalendarDays}
                title="No attendance yet"
                description="Clock in above and your daily record will start building here."
              />
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
                  {myRecords.map((record) => (
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
        </section>
      )}

      {/* ---------------------------- mark attendance --------------------------- */}
      <Dialog open={markOpen} onOpenChange={setMarkOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mark attendance</DialogTitle>
            <DialogDescription>
              Record a status for an employee and date. Existing records for that day are overwritten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Employee</Label>
              <Select
                value={markForm.employee_id || 'none'}
                onValueChange={(value) => setMarkForm((current) => ({ ...current, employee_id: value === 'none' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select an employee</SelectItem>
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
                <Label className="text-xs text-muted-foreground">Work date</Label>
                <Input
                  type="date"
                  value={markForm.work_date}
                  onChange={(event) => setMarkForm((current) => ({ ...current, work_date: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select
                  value={markForm.status}
                  onValueChange={(value) => setMarkForm((current) => ({ ...current, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTENDANCE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {titleCase(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
              <Textarea
                value={markForm.notes}
                onChange={(event) => setMarkForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Reason, approval reference or remark"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMarkOpen(false)} disabled={marking}>
              Cancel
            </Button>
            <Button onClick={submitMark} disabled={marking}>
              {marking ? 'Saving…' : 'Save record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
