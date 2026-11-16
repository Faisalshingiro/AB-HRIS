import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Users, Plus, Search, Download, FileText, Building2, MapPin,
  Mail, Phone, Calendar, Briefcase, Edit, Trash2, Eye, X, Upload
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  PageHeader, DataTable, Modal, StatusBadge, ConfirmDialog, Avatar, EmptyState
} from '@/components/ui';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { formatCurrency, formatDate, fullName, isHrOrAdmin, canManageEmployees, logAudit } from '@/lib/utils';
import type { Employee, Department, Position } from '@/types';

const PROVINCES = ['Kigali', 'Northern', 'Southern', 'Eastern', 'Western'];
const EMPLOYMENT_TYPES = ['permanent', 'contract', 'intern', 'probation'];
const EMPLOYEE_STATUSES = ['active', 'on_leave', 'suspended', 'terminated', 'resigned'];

export function EmployeeManagement() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'employee';
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';

  const [tab, setTab] = useState<'employees' | 'departments' | 'positions'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchQuery);
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Employee | Department | Position | null>(null);
  const [viewingEmp, setViewingEmp] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string } | null>(null);
  const [empCount, setEmpCount] = useState<Record<string, number>>({});

  const canManage = canManageEmployees(role);

  const fetchData = useCallback(async () => {
    setLoading(true);
    if (tab === 'employees') {
      let query = supabase
        .from('employees')
        .select('*, department:departments(*), position:positions(*), reports_to_employee:employees!reports_to(first_name, last_name, employee_number)')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_number.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (deptFilter) query = query.eq('department_id', deptFilter);
      if (statusFilter) query = query.eq('status', statusFilter);

      const { data } = await query.limit(100);
      setEmployees((data as Employee[]) ?? []);
    } else if (tab === 'departments') {
      const { data } = await supabase
        .from('departments')
        .select('*, head_employee:employees!head_employee_id(first_name, last_name), parent_department:departments!parent_department_id(name)')
        .order('name');
      setDepartments((data as Department[]) ?? []);

      // Get employee counts per department
      const { data: counts } = await supabase
        .from('employees')
        .select('department_id')
        .eq('status', 'active');
      const countMap: Record<string, number> = {};
      (counts ?? []).forEach((c) => {
        const did = (c as { department_id: string }).department_id;
        if (did) countMap[did] = (countMap[did] ?? 0) + 1;
      });
      setEmpCount(countMap);
    } else if (tab === 'positions') {
      const { data } = await supabase
        .from('positions')
        .select('*, department:departments(name)')
        .order('title');
      setPositions((data as Position[]) ?? []);
    }
    setLoading(false);
  }, [tab, search, deptFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = (format: 'excel' | 'pdf') => {
    if (tab === 'employees') {
      const cols = [
        { header: 'Employee No', key: 'employee_number' },
        { header: 'First Name', key: 'first_name' },
        { header: 'Last Name', key: 'last_name' },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
        { header: 'Department', key: 'department', format: (_v: unknown, r: Record<string, unknown>) => (r.department as { name?: string })?.name ?? '—' },
        { header: 'Position', key: 'position', format: (_v: unknown, r: Record<string, unknown>) => (r.position as { title?: string })?.title ?? '—' },
        { header: 'Status', key: 'status' },
        { header: 'Hire Date', key: 'hire_date', format: (v: unknown) => formatDate(v as string) },
        { header: 'Type', key: 'employment_type' },
      ];
      if (format === 'excel') exportToExcel('employees', 'Employees', cols, employees as unknown as Record<string, unknown>[]);
      else exportToPDF('employees', 'AB Rwanda PLC - Employee Directory', cols, employees as unknown as Record<string, unknown>[], `Total: ${employees.length} employees`);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Employee Management"
        description="Centralized employee profiles, departments, positions, and organizational structure"
        actions={
          <>
            <button onClick={() => handleExport('excel')} className="btn-secondary btn-sm"><Download size={16} /> Excel</button>
            <button onClick={() => handleExport('pdf')} className="btn-secondary btn-sm"><FileText size={16} /> PDF</button>
            {canManage && (
              <button
                onClick={() => { setEditingItem(null); setModalOpen(true); }}
                className="btn-primary btn-sm"
              >
                <Plus size={16} /> {tab === 'employees' ? 'Add Employee' : tab === 'departments' ? 'Add Department' : 'Add Position'}
              </button>
            )}
          </>
        }
      />

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {(['employees', 'departments', 'positions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filters (employees tab only) */}
      {tab === 'employees' && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, employee number, or email..."
              className="input pl-10"
            />
          </div>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="input sm:w-48">
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-40">
            <option value="">All Statuses</option>
            {EMPLOYEE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      )}

      {/* Content */}
      {tab === 'employees' && (
        <DataTable
          columns={[
            {
              key: 'name',
              header: 'Employee',
              render: (emp) => (
                <div className="flex items-center gap-3">
                  <Avatar firstName={emp.first_name} lastName={emp.last_name} photoUrl={emp.photo_url} size="sm" />
                  <div>
                    <p className="font-medium text-slate-900">{fullName(emp)}</p>
                    <p className="text-xs text-slate-500">{emp.employee_number}</p>
                  </div>
                </div>
              ),
            },
            { key: 'department', header: 'Department', render: (emp) => emp.department?.name ?? '—' },
            { key: 'position', header: 'Position', render: (emp) => emp.position?.title ?? '—' },
            { key: 'email', header: 'Email', render: (emp) => emp.email ?? '—' },
            { key: 'hire_date', header: 'Hire Date', render: (emp) => formatDate(emp.hire_date) },
            {
              key: 'status',
              header: 'Status',
              render: (emp) => <StatusBadge status={emp.status} />,
            },
          ]}
          data={employees}
          loading={loading}
          emptyMessage="No employees found. Try adjusting your filters."
          actions={(emp) => (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => setViewingEmp(emp)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="View">
                <Eye size={16} />
              </button>
              {canManage && (
                <>
                  <button onClick={() => { setEditingItem(emp); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit">
                    <Edit size={16} />
                  </button>
                  {isHrOrAdmin(role) && (
                    <button onClick={() => setDeleteTarget({ id: emp.id, name: fullName(emp), type: 'employee' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                      <Trash2 size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        />
      )}

      {tab === 'departments' && (
        loading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>
        ) : departments.length === 0 ? (
          <EmptyState icon={<Building2 size={48} />} title="No departments yet" description="Create your first department to get started" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <div key={dept.id} className="card-hover p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <Building2 size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{dept.name}</h3>
                      <p className="text-xs text-slate-500">{dept.code}</p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingItem(dept); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
                      {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: dept.id, name: dept.name, type: 'department' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                    </div>
                  )}
                </div>
                {dept.description && <p className="mt-3 text-sm text-slate-600 line-clamp-2">{dept.description}</p>}
                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                  <div>
                    <p className="text-xs text-slate-500">Head</p>
                    <p className="text-sm font-medium text-slate-700">{dept.head_employee ? `${(dept.head_employee as { first_name: string; last_name: string }).first_name} ${(dept.head_employee as { first_name: string; last_name: string }).last_name}` : 'Not assigned'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Employees</p>
                    <p className="text-sm font-bold text-blue-600">{empCount[dept.id] ?? 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'positions' && (
        <DataTable
          columns={[
            { key: 'title', header: 'Title', render: (p) => <span className="font-medium text-slate-900">{p.title}</span> },
            { key: 'code', header: 'Code' },
            { key: 'department', header: 'Department', render: (p) => p.department?.name ?? '—' },
            { key: 'grade', header: 'Grade', render: (p) => p.grade ?? '—' },
            { key: 'min_salary', header: 'Min Salary', render: (p) => formatCurrency(p.min_salary) },
            { key: 'max_salary', header: 'Max Salary', render: (p) => formatCurrency(p.max_salary) },
          ]}
          data={positions}
          loading={loading}
          emptyMessage="No positions defined yet."
          actions={(p) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(p); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: p.id, name: p.title, type: 'position' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
            </div>
          ) : null}
        />
      )}

      {/* Add/Edit Modal */}
      {modalOpen && (
        <ItemModal
          type={tab}
          item={editingItem}
          departments={departments}
          positions={positions}
          employees={employees}
          onClose={() => { setModalOpen(false); setEditingItem(null); }}
          onSaved={() => { setModalOpen(false); setEditingItem(null); fetchData(); }}
        />
      )}

      {/* View Employee Modal */}
      {viewingEmp && (
        <Modal isOpen={true} onClose={() => setViewingEmp(null)} title="Employee Details" size="lg">
          <EmployeeDetail employee={viewingEmp} />
        </Modal>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const table = deleteTarget.type === 'employee' ? 'employees' : deleteTarget.type === 'department' ? 'departments' : 'positions';
          await supabase.from(table).delete().eq('id', deleteTarget.id);
          await logAudit('delete', deleteTarget.type, deleteTarget.id, deleteTarget.name);
          fetchData();
        }}
        title="Confirm Delete"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function ItemModal({ type, item, departments, positions, employees, onClose, onSaved }: {
  type: 'employees' | 'departments' | 'positions';
  item: Employee | Department | Position | null;
  departments: Department[];
  positions: Position[];
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [empForm, setEmpForm] = useState({
    employee_number: '', first_name: '', last_name: '', middle_name: '', gender: '', date_of_birth: '',
    national_id: '', phone: '', email: '', address: '', city: '', province: '', marital_status: '',
    nationality: 'Rwandan', department_id: '', position_id: '', employment_type: 'permanent',
    status: 'active', hire_date: new Date().toISOString().split('T')[0], contract_end_date: '',
    reports_to: '', bank_account: '', bank_name: '',
  });
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '', head_employee_id: '', parent_department_id: '' });
  const [posForm, setPosForm] = useState({ title: '', code: '', department_id: '', grade: '', min_salary: '', max_salary: '' });

  useEffect(() => {
    if (item) {
      if (type === 'employees') {
        const e = item as Employee;
        setEmpForm({
          employee_number: e.employee_number, first_name: e.first_name, last_name: e.last_name, middle_name: e.middle_name ?? '',
          gender: e.gender ?? '', date_of_birth: e.date_of_birth ?? '', national_id: e.national_id ?? '', phone: e.phone ?? '',
          email: e.email ?? '', address: e.address ?? '', city: e.city ?? '', province: e.province ?? '', marital_status: e.marital_status ?? '',
          nationality: e.nationality, department_id: e.department_id ?? '', position_id: e.position_id ?? '', employment_type: e.employment_type,
          status: e.status, hire_date: e.hire_date, contract_end_date: e.contract_end_date ?? '', reports_to: e.reports_to ?? '',
          bank_account: e.bank_account ?? '', bank_name: e.bank_name ?? '',
        });
      } else if (type === 'departments') {
        const d = item as Department;
        setDeptForm({ name: d.name, code: d.code, description: d.description ?? '', head_employee_id: d.head_employee_id ?? '', parent_department_id: d.parent_department_id ?? '' });
      } else {
        const p = item as Position;
        setPosForm({ title: p.title, code: p.code, department_id: p.department_id, grade: p.grade ?? '', min_salary: p.min_salary?.toString() ?? '', max_salary: p.max_salary?.toString() ?? '' });
      }
    }
  }, [item, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (type === 'employees') {
        const payload = {
          ...empForm,
          date_of_birth: empForm.date_of_birth || null,
          contract_end_date: empForm.contract_end_date || null,
          department_id: empForm.department_id || null,
          position_id: empForm.position_id || null,
          reports_to: empForm.reports_to || null,
        };
        if (item) {
          await supabase.from('employees').update(payload).eq('id', (item as Employee).id);
          await logAudit('update', 'employee', (item as Employee).id, fullName(item as Employee));
        } else {
          const { data } = await supabase.from('employees').insert(payload).select().single();
          if (data) await logAudit('create', 'employee', data.id, fullName(data as Employee));
        }
      } else if (type === 'departments') {
        const payload = { ...deptForm, head_employee_id: deptForm.head_employee_id || null, parent_department_id: deptForm.parent_department_id || null };
        if (item) {
          await supabase.from('departments').update(payload).eq('id', (item as Department).id);
          await logAudit('update', 'department', (item as Department).id, deptForm.name);
        } else {
          const { data } = await supabase.from('departments').insert(payload).select().single();
          if (data) await logAudit('create', 'department', data.id, deptForm.name);
        }
      } else {
        const payload = { ...posForm, min_salary: posForm.min_salary ? Number(posForm.min_salary) : null, max_salary: posForm.max_salary ? Number(posForm.max_salary) : null };
        if (item) {
          await supabase.from('positions').update(payload).eq('id', (item as Position).id);
          await logAudit('update', 'position', (item as Position).id, posForm.title);
        } else {
          const { data } = await supabase.from('positions').insert(payload).select().single();
          if (data) await logAudit('create', 'position', data.id, posForm.title);
        }
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const title = type === 'employees' ? (item ? 'Edit Employee' : 'Add Employee') : type === 'departments' ? (item ? 'Edit Department' : 'Add Department') : (item ? 'Edit Position' : 'Add Position');

  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="lg">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'employees' && (
          <>
            <div className="form-grid">
              <div><label className="label">Employee Number *</label><input className="input" value={empForm.employee_number} onChange={(e) => setEmpForm({ ...empForm, employee_number: e.target.value })} required placeholder="ABR-0001" /></div>
              <div><label className="label">Nationality</label><input className="input" value={empForm.nationality} onChange={(e) => setEmpForm({ ...empForm, nationality: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">First Name *</label><input className="input" value={empForm.first_name} onChange={(e) => setEmpForm({ ...empForm, first_name: e.target.value })} required /></div>
              <div><label className="label">Last Name *</label><input className="input" value={empForm.last_name} onChange={(e) => setEmpForm({ ...empForm, last_name: e.target.value })} required /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Middle Name</label><input className="input" value={empForm.middle_name} onChange={(e) => setEmpForm({ ...empForm, middle_name: e.target.value })} /></div>
              <div><label className="label">Gender</label><select className="input" value={empForm.gender} onChange={(e) => setEmpForm({ ...empForm, gender: e.target.value })}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Date of Birth</label><input type="date" className="input" value={empForm.date_of_birth} onChange={(e) => setEmpForm({ ...empForm, date_of_birth: e.target.value })} /></div>
              <div><label className="label">National ID</label><input className="input" value={empForm.national_id} onChange={(e) => setEmpForm({ ...empForm, national_id: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Email</label><input type="email" className="input" value={empForm.email} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} /></div>
              <div><label className="label">Phone</label><input className="input" value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Department</label><select className="input" value={empForm.department_id} onChange={(e) => setEmpForm({ ...empForm, department_id: e.target.value })}><option value="">Select</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className="label">Position</label><select className="input" value={empForm.position_id} onChange={(e) => setEmpForm({ ...empForm, position_id: e.target.value })}><option value="">Select</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Employment Type</label><select className="input" value={empForm.employment_type} onChange={(e) => setEmpForm({ ...empForm, employment_type: e.target.value })}>{EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className="label">Status</label><select className="input" value={empForm.status} onChange={(e) => setEmpForm({ ...empForm, status: e.target.value })}>{EMPLOYEE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Hire Date *</label><input type="date" className="input" value={empForm.hire_date} onChange={(e) => setEmpForm({ ...empForm, hire_date: e.target.value })} required /></div>
              <div><label className="label">Contract End Date</label><input type="date" className="input" value={empForm.contract_end_date} onChange={(e) => setEmpForm({ ...empForm, contract_end_date: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Reports To</label><select className="input" value={empForm.reports_to} onChange={(e) => setEmpForm({ ...empForm, reports_to: e.target.value })}><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
              <div><label className="label">Marital Status</label><select className="input" value={empForm.marital_status} onChange={(e) => setEmpForm({ ...empForm, marital_status: e.target.value })}><option value="">Select</option><option value="single">Single</option><option value="married">Married</option><option value="divorced">Divorced</option><option value="widowed">Widowed</option></select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Province</label><select className="input" value={empForm.province} onChange={(e) => setEmpForm({ ...empForm, province: e.target.value })}><option value="">Select</option>{PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className="label">City</label><input className="input" value={empForm.city} onChange={(e) => setEmpForm({ ...empForm, city: e.target.value })} /></div>
            </div>
            <div><label className="label">Address</label><input className="input" value={empForm.address} onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })} /></div>
            <div className="form-grid">
              <div><label className="label">Bank Name</label><input className="input" value={empForm.bank_name} onChange={(e) => setEmpForm({ ...empForm, bank_name: e.target.value })} /></div>
              <div><label className="label">Bank Account</label><input className="input" value={empForm.bank_account} onChange={(e) => setEmpForm({ ...empForm, bank_account: e.target.value })} /></div>
            </div>
          </>
        )}
        {type === 'departments' && (
          <>
            <div className="form-grid">
              <div><label className="label">Name *</label><input className="input" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} required /></div>
              <div><label className="label">Code *</label><input className="input" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} required placeholder="DEPT-001" /></div>
            </div>
            <div><label className="label">Description</label><textarea className="input" rows={3} value={deptForm.description} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} /></div>
            <div className="form-grid">
              <div><label className="label">Head of Department</label><select className="input" value={deptForm.head_employee_id} onChange={(e) => setDeptForm({ ...deptForm, head_employee_id: e.target.value })}><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
              <div><label className="label">Parent Department</label><select className="input" value={deptForm.parent_department_id} onChange={(e) => setDeptForm({ ...deptForm, parent_department_id: e.target.value })}><option value="">None</option>{departments.filter((d) => d.id !== (item as Department)?.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            </div>
          </>
        )}
        {type === 'positions' && (
          <>
            <div className="form-grid">
              <div><label className="label">Title *</label><input className="input" value={posForm.title} onChange={(e) => setPosForm({ ...posForm, title: e.target.value })} required /></div>
              <div><label className="label">Code *</label><input className="input" value={posForm.code} onChange={(e) => setPosForm({ ...posForm, code: e.target.value })} required placeholder="POS-001" /></div>
            </div>
            <div><label className="label">Department *</label><select className="input" value={posForm.department_id} onChange={(e) => setPosForm({ ...posForm, department_id: e.target.value })} required><option value="">Select</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div className="form-grid">
              <div><label className="label">Grade</label><input className="input" value={posForm.grade} onChange={(e) => setPosForm({ ...posForm, grade: e.target.value })} placeholder="e.g. Level 3" /></div>
              <div></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Min Salary (RWF)</label><input type="number" className="input" value={posForm.min_salary} onChange={(e) => setPosForm({ ...posForm, min_salary: e.target.value })} /></div>
              <div><label className="label">Max Salary (RWF)</label><input type="number" className="input" value={posForm.max_salary} onChange={(e) => setPosForm({ ...posForm, max_salary: e.target.value })} /></div>
            </div>
          </>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EmployeeDetail({ employee }: { employee: Employee }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar firstName={employee.first_name} lastName={employee.last_name} photoUrl={employee.photo_url} size="lg" />
        <div>
          <h3 className="text-xl font-bold text-slate-900">{fullName(employee)}</h3>
          <p className="text-sm text-slate-500">{employee.position?.title ?? 'No position'} · {employee.department?.name ?? 'No department'}</p>
          <div className="mt-2 flex gap-2">
            <StatusBadge status={employee.status} />
            <span className="badge-neutral">{employee.employment_type}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DetailRow icon={<Briefcase size={16} />} label="Employee Number" value={employee.employee_number} />
        <DetailRow icon={<Calendar size={16} />} label="Hire Date" value={formatDate(employee.hire_date)} />
        <DetailRow icon={<Mail size={16} />} label="Email" value={employee.email ?? '—'} />
        <DetailRow icon={<Phone size={16} />} label="Phone" value={employee.phone ?? '—'} />
        <DetailRow icon={<MapPin size={16} />} label="Location" value={[employee.city, employee.province].filter(Boolean).join(', ') || '—'} />
        <DetailRow icon={<FileText size={16} />} label="National ID" value={employee.national_id ?? '—'} />
        <DetailRow icon={<Calendar size={16} />} label="Date of Birth" value={formatDate(employee.date_of_birth)} />
        <DetailRow icon={<Users size={16} />} label="Reports To" value={employee.reports_to_employee ? fullName(employee.reports_to_employee as unknown as { first_name: string; last_name: string }) : '—'} />
        <DetailRow icon={<Building2 size={16} />} label="Bank" value={employee.bank_name ?? '—'} />
        <DetailRow icon={<FileText size={16} />} label="Bank Account" value={employee.bank_account ?? '—'} />
      </div>

      {employee.address && (
        <div>
          <p className="text-sm font-medium text-slate-500">Address</p>
          <p className="mt-1 text-sm text-slate-900">{employee.address}</p>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}
