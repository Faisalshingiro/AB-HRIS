import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Briefcase, UserCheck, CalendarDays, DollarSign, Target,
  TrendingUp, AlertCircle, Clock, FileText, Activity
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { StatCard, PageHeader, StatusBadge } from '@/components/ui';
import { formatCurrency, getMonthName, isHrOrAdmin, canManagePayroll } from '@/lib/utils';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeave: number;
  openVacancies: number;
  pendingApplications: number;
  pendingLeaveRequests: number;
  pendingOnboarding: number;
  totalPayroll: number;
  upcomingReviews: number;
  pendingExitRequests: number;
  recentHires: { id: string; first_name: string; last_name: string; hire_date: string; department?: { name: string } | null; position?: { title: string } | null }[];
  pendingLeaveList: { id: string; employee: { first_name: string; last_name: string; employee_number: string } | null; start_date: string; end_date: string; leave_type: { name: string } | null; status: string }[];
  monthlyPayroll: { total_net: number; employee_count: number; status: string } | null;
}

export function Dashboard() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'employee';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    const [employees, activeEmps, onLeaveEmps, vacancies, applications, leaveReqs, onboardingTasks, exitReqs, reviews, recentHires, pendingLeave, payrollRun] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'on_leave'),
      supabase.from('job_vacancies').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabase.from('job_applications').select('id', { count: 'exact', head: true }).in('status', ['submitted', 'reviewing', 'shortlisted']),
      supabase.from('leave_requests').select('id, employee:employees(first_name, last_name, employee_number), start_date, end_date, leave_type:leave_types(name), status').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('onboarding_tasks').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
      supabase.from('exit_requests').select('id', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
      supabase.from('performance_reviews').select('id', { count: 'exact', head: true }).in('status', ['draft', 'submitted']),
      supabase.from('employees').select('id, first_name, last_name, hire_date, department:departments(name), position:positions(title)').order('hire_date', { ascending: false }).limit(5),
      supabase.from('leave_requests').select('id, employee:employees(first_name, last_name, employee_number), start_date, end_date, leave_type:leave_types(name), status').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('payroll_runs').select('total_net, employee_count, status, pay_period_month, pay_period_year').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    // Calculate total payroll from latest payslips
    let totalPayroll = 0;
    const { data: payslipSum } = await supabase.from('payslips').select('net_pay');
    if (payslipSum) {
      totalPayroll = payslipSum.reduce((sum, p) => sum + Number(p.net_pay ?? 0), 0);
    }

    setStats({
      totalEmployees: employees.count ?? 0,
      activeEmployees: activeEmps.count ?? 0,
      onLeave: onLeaveEmps.count ?? 0,
      openVacancies: vacancies.count ?? 0,
      pendingApplications: applications.count ?? 0,
      pendingLeaveRequests: leaveReqs.count ?? 0,
      pendingOnboarding: onboardingTasks.count ?? 0,
      totalPayroll,
      upcomingReviews: reviews.count ?? 0,
      pendingExitRequests: exitReqs.count ?? 0,
      recentHires: (recentHires.data as DashboardStats['recentHires']) ?? [],
      pendingLeaveList: (pendingLeave.data as DashboardStats['pendingLeaveList']) ?? [],
      monthlyPayroll: payrollRun.data as DashboardStats['monthlyPayroll'],
    });

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const showHrStats = isHrOrAdmin(role) || role === 'department_manager';
  const showPayrollStats = canManagePayroll(role) || role === 'employee';

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${profile?.full_name?.split(' ')[0] ?? 'User'}`}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Employees"
          value={stats?.totalEmployees ?? 0}
          icon={<Users size={24} />}
          color="blue"
          trend={{ value: `${stats?.activeEmployees ?? 0} active`, positive: true }}
        />
        {showHrStats && (
          <StatCard
            label="Open Vacancies"
            value={stats?.openVacancies ?? 0}
            icon={<Briefcase size={24} />}
            color="teal"
            trend={{ value: `${stats?.pendingApplications ?? 0} applications`, positive: stats?.pendingApplications ? true : false }}
          />
        )}
        {showHrStats && (
          <StatCard
            label="Pending Leave"
            value={stats?.pendingLeaveRequests ?? 0}
            icon={<CalendarDays size={24} />}
            color="amber"
          />
        )}
        {showHrStats && (
          <StatCard
            label="Onboarding Tasks"
            value={stats?.pendingOnboarding ?? 0}
            icon={<UserCheck size={24} />}
            color="green"
          />
        )}
        {showPayrollStats && (
          <StatCard
            label="Monthly Payroll"
            value={formatCurrency(stats?.monthlyPayroll?.total_net ?? stats?.totalPayroll ?? 0)}
            icon={<DollarSign size={24} />}
            color="purple"
            trend={stats?.monthlyPayroll ? { value: `${stats.monthlyPayroll.employee_count} employees`, positive: true } : undefined}
          />
        )}
        {showHrStats && (
          <StatCard
            label="Pending Reviews"
            value={stats?.upcomingReviews ?? 0}
            icon={<Target size={24} />}
            color="red"
          />
        )}
        {showHrStats && (
          <StatCard
            label="Exit Requests"
            value={stats?.pendingExitRequests ?? 0}
            icon={<AlertCircle size={24} />}
            color="amber"
          />
        )}
        <StatCard
          label="On Leave Today"
          value={stats?.onLeave ?? 0}
          icon={<Clock size={24} />}
          color="blue"
        />
      </div>

      {/* Two-column layout */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent hires */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Recent Hires</h3>
            <Link to="/employees" className="text-sm font-medium text-blue-600 hover:text-blue-700">View all</Link>
          </div>
          {stats?.recentHires && stats.recentHires.length > 0 ? (
            <div className="space-y-3">
              {stats.recentHires.map((emp) => (
                <div key={emp.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-sm font-semibold text-white">
                    {emp.first_name.charAt(0)}{emp.last_name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{emp.first_name} {emp.last_name}</p>
                    <p className="truncate text-xs text-slate-500">{emp.position?.title ?? 'No position'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">{emp.department?.name ?? '—'}</p>
                    <p className="text-xs text-slate-400">{new Date(emp.hire_date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">No recent hires</p>
          )}
        </div>

        {/* Pending leave requests */}
        {showHrStats ? (
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Pending Leave Requests</h3>
              <Link to="/employees" className="text-sm font-medium text-blue-600 hover:text-blue-700">View all</Link>
            </div>
            {stats?.pendingLeaveList && stats.pendingLeaveList.length > 0 ? (
              <div className="space-y-3">
                {stats.pendingLeaveList.map((lr) => (
                  <div key={lr.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <CalendarDays size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {lr.employee ? `${lr.employee.first_name} ${lr.employee.last_name}` : 'Unknown'}
                      </p>
                      <p className="truncate text-xs text-slate-500">{lr.leave_type?.name ?? 'Leave'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">{new Date(lr.start_date).toLocaleDateString()}</p>
                      <StatusBadge status={lr.status} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">No pending leave requests</p>
            )}
          </div>
        ) : (
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Quick Links</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/employees" className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50">
                <Users size={20} className="text-blue-600" />
                <span className="text-sm font-medium text-slate-900">Employee Directory</span>
              </Link>
              <Link to="/performance" className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50">
                <Target size={20} className="text-blue-600" />
                <span className="text-sm font-medium text-slate-900">My Performance</span>
              </Link>
              <Link to="/payroll" className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50">
                <DollarSign size={20} className="text-blue-600" />
                <span className="text-sm font-medium text-slate-900">My Payslips</span>
              </Link>
              <Link to="/development" className="flex flex-col items-start gap-2 rounded-lg border border-slate-200 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50">
                <TrendingUp size={20} className="text-blue-600" />
                <span className="text-sm font-medium text-slate-900">Training</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Activity summary */}
      {isHrOrAdmin(role) && (
        <div className="mt-6 card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity size={20} className="text-blue-600" />
            <h3 className="font-semibold text-slate-900">System Activity Summary</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Total Employees</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{stats?.totalEmployees ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Active</p>
              <p className="mt-1 text-xl font-bold text-green-600">{stats?.activeEmployees ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">On Leave</p>
              <p className="mt-1 text-xl font-bold text-amber-600">{stats?.onLeave ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Monthly Payroll</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(stats?.monthlyPayroll?.total_net ?? 0)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
