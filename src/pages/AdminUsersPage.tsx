import { useCallback, useEffect, useMemo, useState } from 'react';
import { Briefcase, Search, ShieldAlert, ShieldCheck, UserCog, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { roleLabels } from '@/components/layouts/nav-config';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate, fullName } from '@/lib/format';
import { employeesApi, profilesApi } from '@/services/api';
import type { EmployeeWithRelations, Profile, UserRole } from '@/types/types';

const ROLES: UserRole[] = ['admin', 'hr', 'manager', 'finance', 'employee'];

const ROLE_REFERENCE: { role: UserRole; summary: string; access: string }[] = [
  {
    role: 'admin',
    summary: 'Full system control',
    access: 'Everything — user administration, audit logs, payroll, people records and configuration.',
  },
  {
    role: 'hr',
    summary: 'People operations',
    access:
      'Organisation-wide people records, recruitment, onboarding, attendance and leave administration, performance, development, succession, disciplinary, exit, documents and audit logs. Payroll access is limited to personal payslips.',
  },
  {
    role: 'manager',
    summary: 'Team leadership',
    access:
      'Direct-report records, attendance, leave approvals, performance and development. No organisation-wide dashboard, payroll register, recruitment or HR case access.',
  },
  {
    role: 'finance',
    summary: 'Payroll & settlements',
    access:
      'Payroll processing, final settlements, finance clearance items and finance documents, plus personal self-service. No HR employee register or people-management modules.',
  },
  {
    role: 'employee',
    summary: 'Self-service',
    access:
      'Own profile, attendance, leave, performance, payslips, documents and personal requests only. No employee directory or organisation-wide metrics.',
  },
];

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

export default function AdminUsersPage() {
  const { isAdmin, profile: currentProfile } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRows, employeeRows] = await Promise.all([profilesApi.list(), employeesApi.list({ limit: 300 })]);
      setProfiles(profileRows);
      setEmployees(employeeRows);
    } catch (error) {
      toast.error('Could not load the user directory', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    void load();
  }, [isAdmin, load]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, EmployeeWithRelations>();
    employees.forEach((employee) => map.set(employee.id, employee));
    return map;
  }, [employees]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return profiles;
    return profiles.filter((profile) =>
      `${profile.full_name ?? ''} ${profile.username ?? ''} ${profile.email ?? ''}`.toLowerCase().includes(term),
    );
  }, [profiles, search]);

  const stats = useMemo(
    () => ({
      total: profiles.length,
      admins: profiles.filter((profile) => profile.role === 'admin').length,
      hr: profiles.filter((profile) => profile.role === 'hr').length,
      finance: profiles.filter((profile) => profile.role === 'finance').length,
      managers: profiles.filter((profile) => profile.role === 'manager').length,
      employees: profiles.filter((profile) => profile.role === 'employee').length,
    }),
    [profiles],
  );

  const changeRole = async (profile: Profile, role: UserRole) => {
    if (profile.role === role) return;
    setBusyId(profile.id);
    try {
      await profilesApi.updateRole(profile.id, role);
      setProfiles((current) =>
        current.map((row) => (row.id === profile.id ? { ...row, role } : row)),
      );
      toast.success(`${profile.full_name ?? profile.username ?? 'User'} is now ${roleLabels[role]}`);
    } catch (error) {
      toast.error('Could not change the role', { description: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  const toggleActive = async (profile: Profile, isActive: boolean) => {
    setBusyId(profile.id);
    try {
      await profilesApi.setActive(profile.id, isActive);
      setProfiles((current) =>
        current.map((row) => (row.id === profile.id ? { ...row, is_active: isActive } : row)),
      );
      toast.success(isActive ? 'Account enabled' : 'Account disabled');
    } catch (error) {
      toast.error('Could not update the account', { description: errorMessage(error) });
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div>
        <PageHeader
          eyebrow="Administration"
          title="Users & roles"
          description="Manage who can sign in and what each person is allowed to do."
        />
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={ShieldAlert}
            title="Administrator access required"
            description="Only administrators can manage user accounts and roles. Ask an administrator if you need a change to your access."
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Users & roles"
        description="Every account, the role it carries and the employee record it is linked to. Changes are written to the audit trail."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <UserCog className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)
        ) : (
          <>
            <StatCard label="Total users" value={stats.total} hint="Accounts with access" icon={Users} />
            <StatCard label="Administrators" value={stats.admins} hint="Full system control" icon={ShieldCheck} tone="accent" />
            <StatCard label="HR officers" value={stats.hr} hint="People operations" icon={Briefcase} />
            <StatCard label="Finance officers" value={stats.finance} hint="Payroll & settlements" icon={Wallet} />
            <StatCard label="Managers" value={stats.managers} hint="Team approvals" icon={UserCog} />
            <StatCard label="Employees" value={stats.employees} hint="Self-service access" icon={Users} />
          </>
        )}
      </section>

      <section className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, username or email"
            className="pl-9"
            aria-label="Search users"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {profiles.length} account{profiles.length === 1 ? '' : 's'} shown
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
            icon={Users}
            title={profiles.length === 0 ? 'No user accounts yet' : 'No accounts match this search'}
            description={
              profiles.length === 0
                ? 'Accounts appear here once staff sign up or an administrator creates them.'
                : 'Try a different name, username or email address.'
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Name</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Username</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Email</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Role</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Linked employee</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Active</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((profile) => {
                const linked = profile.employee_id ? employeeMap.get(profile.employee_id) : null;
                const isSelf = profile.id === currentProfile?.id;
                return (
                  <tr key={profile.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-medium text-foreground">{profile.full_name ?? ''}</span>
                      {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{profile.username ?? ''}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{profile.email ?? ''}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Select
                        value={profile.role}
                        onValueChange={(value) => void changeRole(profile, value as UserRole)}
                        disabled={busyId === profile.id || isSelf}
                      >
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {roleLabels[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {linked ? `${fullName(linked)} · ${linked.employee_no}` : 'Not linked'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={profile.is_active}
                          onCheckedChange={(checked) => void toggleActive(profile, checked)}
                          disabled={busyId === profile.id || isSelf}
                          aria-label={`Toggle account for ${profile.full_name ?? profile.username ?? 'user'}`}
                        />
                        <StatusBadge
                          status={profile.is_active ? 'active' : 'suspended'}
                          label={profile.is_active ? 'Active' : 'Disabled'}
                          tone={profile.is_active ? 'success' : 'danger'}
                        />
                      </div>
                    </td>
                    <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(profile.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Role permissions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            What each role can reach across the HRIS. Roles are additive only through the administrator role.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {ROLE_REFERENCE.map((entry) => (
            <div key={entry.role} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{roleLabels[entry.role]}</p>
                <span className="ed-label">{entry.summary}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{entry.access}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
