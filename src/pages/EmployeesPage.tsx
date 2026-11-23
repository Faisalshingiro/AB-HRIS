import { Building2, Eye, Pencil, Plus, Search, UserCheck, UserPlus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useAuth } from '@/contexts/AuthContext';
import type { ExportColumn } from '@/lib/export';
import { formatDate, fullName, initials, titleCase, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import { departmentsApi, employeesApi, positionsApi } from '@/services/api';
import type {
  Department,
  Employee,
  EmployeeStatus,
  EmployeeWithRelations,
  EmploymentType,
  GenderType,
  Position,
} from '@/types/types';

/* ------------------------------- constants ------------------------------- */

const EMPLOYMENT_TYPES: EmploymentType[] = ['permanent', 'fixed_term', 'probation', 'intern', 'consultant'];
const EMPLOYEE_STATUSES: EmployeeStatus[] = ['active', 'probation', 'on_leave', 'suspended', 'exited'];
const GENDERS: GenderType[] = ['male', 'female', 'other'];
const ROW_CAP = 200;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

/* --------------------------------- form ---------------------------------- */

interface EmployeeFormState {
  employee_no: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  gender: string;
  date_of_birth: string;
  national_id: string;
  address: string;
  district: string;
  department_id: string;
  position_id: string;
  manager_id: string;
  employment_type: EmploymentType;
  hire_date: string;
  contract_end_date: string;
  status: EmployeeStatus;
  base_salary: string;
  housing_allowance: string;
  transport_allowance: string;
  other_allowance: string;
  bank_name: string;
  bank_account: string;
  rssb_number: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

const EMPTY_FORM: EmployeeFormState = {
  employee_no: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  gender: '',
  date_of_birth: '',
  national_id: '',
  address: '',
  district: '',
  department_id: 'none',
  position_id: 'none',
  manager_id: 'none',
  employment_type: 'permanent',
  hire_date: '',
  contract_end_date: '',
  status: 'active',
  base_salary: '',
  housing_allowance: '',
  transport_allowance: '',
  other_allowance: '',
  bank_name: '',
  bank_account: '',
  rssb_number: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

const toForm = (employee: EmployeeWithRelations): EmployeeFormState => ({
  employee_no: employee.employee_no ?? '',
  first_name: employee.first_name ?? '',
  last_name: employee.last_name ?? '',
  email: employee.email ?? '',
  phone: employee.phone ?? '',
  gender: employee.gender ?? '',
  date_of_birth: employee.date_of_birth ?? '',
  national_id: employee.national_id ?? '',
  address: employee.address ?? '',
  district: employee.district ?? '',
  department_id: employee.department_id ?? 'none',
  position_id: employee.position_id ?? 'none',
  manager_id: employee.manager_id ?? 'none',
  employment_type: employee.employment_type ?? 'permanent',
  hire_date: employee.hire_date ?? '',
  contract_end_date: employee.contract_end_date ?? '',
  status: employee.status ?? 'active',
  base_salary: String(employee.base_salary ?? 0),
  housing_allowance: String(employee.housing_allowance ?? 0),
  transport_allowance: String(employee.transport_allowance ?? 0),
  other_allowance: String(employee.other_allowance ?? 0),
  bank_name: employee.bank_name ?? '',
  bank_account: employee.bank_account ?? '',
  rssb_number: employee.rssb_number ?? '',
  emergency_contact_name: employee.emergency_contact_name ?? '',
  emergency_contact_phone: employee.emergency_contact_phone ?? '',
});

const toPayload = (form: EmployeeFormState): Partial<Employee> => ({
  employee_no: form.employee_no.trim(),
  first_name: form.first_name.trim(),
  last_name: form.last_name.trim(),
  email: form.email.trim(),
  phone: form.phone.trim() || null,
  gender: (form.gender || null) as GenderType | null,
  date_of_birth: form.date_of_birth || null,
  national_id: form.national_id.trim() || null,
  address: form.address.trim() || null,
  district: form.district.trim() || null,
  department_id: form.department_id === 'none' ? null : form.department_id,
  position_id: form.position_id === 'none' ? null : form.position_id,
  manager_id: form.manager_id === 'none' ? null : form.manager_id,
  employment_type: form.employment_type,
  hire_date: form.hire_date,
  contract_end_date: form.contract_end_date || null,
  status: form.status,
  base_salary: Number(form.base_salary) || 0,
  housing_allowance: Number(form.housing_allowance) || 0,
  transport_allowance: Number(form.transport_allowance) || 0,
  other_allowance: Number(form.other_allowance) || 0,
  bank_name: form.bank_name.trim() || null,
  bank_account: form.bank_account.trim() || null,
  rssb_number: form.rssb_number.trim() || null,
  emergency_contact_name: form.emergency_contact_name.trim() || null,
  emergency_contact_phone: form.emergency_contact_phone.trim() || null,
});

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <p className="ed-label">{title}</p>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

export interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EmployeeWithRelations | null;
  departments: Department[];
  positions: Position[];
  managers: EmployeeWithRelations[];
  onSaved: () => void | Promise<void>;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  departments,
  positions,
  managers,
  onSaved,
}: EmployeeFormDialogProps) {
  const [form, setForm] = useState<EmployeeFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (employee) {
      setForm(toForm(employee));
      return;
    }
    setForm({ ...EMPTY_FORM, hire_date: todayISO() });
    let cancelled = false;
    setSuggesting(true);
    employeesApi
      .nextEmployeeNo()
      .then((nextNo) => {
        if (!cancelled) setForm((current) => ({ ...current, employee_no: nextNo }));
      })
      .catch(() => {
        /* the number can still be typed manually */
      })
      .finally(() => {
        if (!cancelled) setSuggesting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, employee]);

  const set = <K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const positionsForDepartment = useMemo(() => {
    if (form.department_id === 'none') return positions;
    return positions.filter(
      (position) =>
        !position.department_id ||
        position.department_id === form.department_id ||
        position.id === form.position_id,
    );
  }, [positions, form.department_id, form.position_id]);

  const submit = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast.error('First and last name are required');
      return;
    }
    if (!form.email.trim()) {
      toast.error('An email address is required');
      return;
    }
    if (!form.employee_no.trim()) {
      toast.error('An employee number is required');
      return;
    }
    if (!form.hire_date) {
      toast.error('A hire date is required');
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (employee) {
        await employeesApi.update(employee.id, payload);
        toast.success('Employee record updated');
      } else {
        await employeesApi.create(payload);
        toast.success(`${form.first_name.trim()} ${form.last_name.trim()} added to the register`);
      }
      onOpenChange(false);
      await onSaved();
    } catch (error) {
      toast.error('Could not save the employee record', { description: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
        <DialogHeader>
          <DialogTitle>{employee ? 'Edit employee' : 'Add employee'}</DialogTitle>
          <DialogDescription>
            {employee
              ? 'Update the personnel file. Changes are written to the audit trail.'
              : 'Create a new personnel file. The employee number is suggested automatically.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          <FormSection title="Identity">
            <Field label="Employee number">
              <Input
                value={form.employee_no}
                onChange={(event) => set('employee_no', event.target.value)}
                placeholder={suggesting ? 'Suggesting…' : 'ABR-0001'}
              />
            </Field>
            <Field label="Employment status">
              <Select value={form.status} onValueChange={(value) => set('status', value as EmployeeStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleCase(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="First name">
              <Input value={form.first_name} onChange={(event) => set('first_name', event.target.value)} />
            </Field>
            <Field label="Last name">
              <Input value={form.last_name} onChange={(event) => set('last_name', event.target.value)} />
            </Field>
            <Field label="Gender">
              <Select value={form.gender || 'none'} onValueChange={(value) => set('gender', value === 'none' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Not stated" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not stated</SelectItem>
                  {GENDERS.map((gender) => (
                    <SelectItem key={gender} value={gender}>
                      {titleCase(gender)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.date_of_birth} onChange={(event) => set('date_of_birth', event.target.value)} />
            </Field>
            <Field label="National ID">
              <Input value={form.national_id} onChange={(event) => set('national_id', event.target.value)} />
            </Field>
            <Field label="RSSB number">
              <Input value={form.rssb_number} onChange={(event) => set('rssb_number', event.target.value)} />
            </Field>
          </FormSection>

          <FormSection title="Contact">
            <Field label="Email">
              <Input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(event) => set('phone', event.target.value)} placeholder="+250 …" />
            </Field>
            <Field label="District">
              <Input value={form.district} onChange={(event) => set('district', event.target.value)} />
            </Field>
            <Field label="Address">
              <Input value={form.address} onChange={(event) => set('address', event.target.value)} />
            </Field>
            <Field label="Emergency contact name">
              <Input
                value={form.emergency_contact_name}
                onChange={(event) => set('emergency_contact_name', event.target.value)}
              />
            </Field>
            <Field label="Emergency contact phone">
              <Input
                value={form.emergency_contact_phone}
                onChange={(event) => set('emergency_contact_phone', event.target.value)}
              />
            </Field>
          </FormSection>

          <FormSection title="Assignment">
            <Field label="Department">
              <Select value={form.department_id} onValueChange={(value) => set('department_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Position">
              <Select value={form.position_id} onValueChange={(value) => set('position_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {positionsForDepartment.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reports to">
              <Select value={form.manager_id} onValueChange={(value) => set('manager_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="No manager" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No manager</SelectItem>
                  {managers
                    .filter((manager) => manager.id !== employee?.id)
                    .map((manager) => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {fullName(manager)} · {manager.employee_no}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Employment type">
              <Select
                value={form.employment_type}
                onValueChange={(value) => set('employment_type', value as EmploymentType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {titleCase(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Hire date">
              <Input type="date" value={form.hire_date} onChange={(event) => set('hire_date', event.target.value)} />
            </Field>
            <Field label="Contract end date">
              <Input
                type="date"
                value={form.contract_end_date}
                onChange={(event) => set('contract_end_date', event.target.value)}
              />
            </Field>
          </FormSection>

          <FormSection title="Remuneration">
            <Field label="Base salary (RWF)">
              <Input
                type="number"
                min={0}
                value={form.base_salary}
                onChange={(event) => set('base_salary', event.target.value)}
              />
            </Field>
            <Field label="Housing allowance (RWF)">
              <Input
                type="number"
                min={0}
                value={form.housing_allowance}
                onChange={(event) => set('housing_allowance', event.target.value)}
              />
            </Field>
            <Field label="Transport allowance (RWF)">
              <Input
                type="number"
                min={0}
                value={form.transport_allowance}
                onChange={(event) => set('transport_allowance', event.target.value)}
              />
            </Field>
            <Field label="Other allowance (RWF)">
              <Input
                type="number"
                min={0}
                value={form.other_allowance}
                onChange={(event) => set('other_allowance', event.target.value)}
              />
            </Field>
            <Field label="Bank name">
              <Input value={form.bank_name} onChange={(event) => set('bank_name', event.target.value)} />
            </Field>
            <Field label="Bank account">
              <Input value={form.bank_account} onChange={(event) => set('bank_account', event.target.value)} />
            </Field>
          </FormSection>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : employee ? 'Save changes' : 'Create employee'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- page ---------------------------------- */

export default function EmployeesPage() {
  const navigate = useNavigate();
  const { isHR, isFinance, canManagePeople, employeeId } = useAuth();

  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeWithRelations | null>(null);

  const showSalary = isHR || isFinance;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [employeeRows, departmentRows, positionRows] = await Promise.all([
        employeesApi.list({ limit: ROW_CAP }),
        departmentsApi.list(),
        positionsApi.list(),
      ]);
      setEmployees(employeeRows);
      setDepartments(departmentRows);
      setPositions(positionRows);
    } catch (error) {
      toast.error('Could not load the employee register', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scoped = useMemo(() => {
    if (canManagePeople) return employees;
    return employees.filter((employee) => employee.id === employeeId);
  }, [employees, canManagePeople, employeeId]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scoped.filter((employee) => {
      if (departmentFilter !== 'all' && employee.department_id !== departmentFilter) return false;
      if (statusFilter !== 'all' && employee.status !== statusFilter) return false;
      if (!term) return true;
      return (
        `${employee.first_name} ${employee.last_name}`.toLowerCase().includes(term) ||
        employee.employee_no.toLowerCase().includes(term) ||
        (employee.email ?? '').toLowerCase().includes(term)
      );
    });
  }, [scoped, search, departmentFilter, statusFilter]);

  const stats = useMemo(() => {
    const active = scoped.filter((employee) => employee.status === 'active').length;
    const probation = scoped.filter((employee) => employee.status === 'probation').length;
    const departmentIds = new Set(scoped.map((employee) => employee.department_id).filter(Boolean));
    return { total: scoped.length, active, probation, departments: departmentIds.size };
  }, [scoped]);

  const exportColumns = useMemo<ExportColumn<EmployeeWithRelations>[]>(() => {
    const columns: ExportColumn<EmployeeWithRelations>[] = [
      { header: 'Employee no', accessor: (row) => row.employee_no },
      { header: 'Name', accessor: (row) => fullName(row) },
      { header: 'Job title', accessor: (row) => row.position?.title ?? '' },
      { header: 'Department', accessor: (row) => row.department?.name ?? '' },
      { header: 'Employment type', accessor: (row) => titleCase(row.employment_type) },
      { header: 'Hire date', accessor: (row) => formatDate(row.hire_date) },
      { header: 'Status', accessor: (row) => titleCase(row.status) },
      { header: 'Email', accessor: (row) => row.email ?? '' },
      { header: 'Phone', accessor: (row) => row.phone ?? '' },
    ];
    if (showSalary) {
      columns.push({ header: 'Base salary (RWF)', accessor: (row) => Number(row.base_salary ?? 0) });
    }
    return columns;
  }, [showSalary]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (employee: EmployeeWithRelations) => {
    setEditing(employee);
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Employee register"
        description="The single source of truth for every AB Rwanda staff member,  identity, assignment, contract and remuneration."
        actions={
          <>
            <ExportMenu
              filename="ab-rwanda-employees"
              title="Employee register"
              subtitle={`${filtered.length} records`}
              columns={exportColumns}
              rows={filtered}
            />
            {canManagePeople ? (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add employee
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Total employees" value={stats.total} icon={Users} hint="On the register" />
        <StatCard label="Active" value={stats.active} icon={UserCheck} hint="Currently in post" />
        <StatCard label="On probation" value={stats.probation} icon={UserPlus} hint="Under confirmation" />
        <StatCard label="Departments" value={stats.departments} icon={Building2} hint="With staff assigned" />
      </div>

      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, employee number or email"
            className="pl-9"
            aria-label="Search employees"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="md:w-52" aria-label="Filter by department">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((department) => (
              <SelectItem key={department.id} value={department.id}>
                {department.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:w-44" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {EMPLOYEE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {titleCase(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={Users}
            title="No employees match this view"
            description={
              canManagePeople
                ? 'Adjust the search or filters, or add a new employee to the register.'
                : 'Your personnel file is not linked to this account yet. Contact HR.'
            }
            action={
              canManagePeople ? (
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add employee
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Employee</th>
                  <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Job title</th>
                  <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Department</th>
                  <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Type</th>
                  <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Hired</th>
                  <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                  {showSalary ? <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Base salary</th> : null}
                  <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((employee) => (
                  <tr key={employee.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold text-foreground">
                          {initials(employee.first_name, employee.last_name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-foreground">{fullName(employee)}</span>
                          <span className="ed-table-num block text-xs text-muted-foreground">{employee.employee_no}</span>
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{employee.position?.title ?? ''}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{employee.department?.name ?? ''}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{titleCase(employee.employment_type)}</td>
                    <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {formatDate(employee.hire_date)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge status={employee.status} />
                    </td>
                    {showSalary ? (
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right text-foreground">
                        {Number(employee.base_salary ?? 0).toLocaleString('en-RW')}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`View ${fullName(employee)}`}
                          onClick={() => navigate(`/employees/${employee.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canManagePeople ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${fullName(employee)}`}
                            onClick={() => openEdit(employee)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Showing {filtered.length} of {scoped.length} records. The register is capped at {ROW_CAP} rows — refine the
            search to narrow the list.
          </p>
        </>
      )}

      <EmployeeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
        departments={departments}
        positions={positions}
        managers={employees}
        onSaved={load}
      />
    </div>
  );
}
