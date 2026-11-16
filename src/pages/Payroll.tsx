import { useEffect, useState, useCallback } from 'react';
import { Plus, DollarSign, Download, FileText, Edit, Trash2, Calculator, Receipt, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, DataTable, Modal, StatusBadge, ConfirmDialog, EmptyState, StatCard } from '@/components/ui';
import { exportToExcel, exportToPDF, exportPayslipPDF } from '@/lib/export';
import { formatCurrency, formatDate, fullName, isHrOrAdmin, canManagePayroll, logAudit, getMonthName } from '@/lib/utils';
import type { PayrollRun, Payslip, Allowance, Deduction, EmployeeSalaryComponent, Employee } from '@/types';

const PAYROLL_STATUSES = ['draft', 'processing', 'completed', 'approved', 'rejected', 'paid'];
const PAYSLIP_STATUSES = ['generated', 'approved', 'paid', 'disputed'];
const COMPONENT_TYPES = ['base_salary', 'allowance', 'deduction'];

export function Payroll() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'employee';
  const canManage = canManagePayroll(role);
  const isEmployee = role === 'employee';

  const [tab, setTab] = useState<'payslips' | 'runs' | 'components' | 'allowances' | 'deductions'>('payslips');
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [components, setComponents] = useState<EmployeeSalaryComponent[]>([]);
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [deductions, setDeductions] = useState<Deduction[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Payslip | PayrollRun | Allowance | Deduction | EmployeeSalaryComponent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string } | null>(null);
  const [payrollSummary, setPayrollSummary] = useState({ totalGross: 0, totalNet: 0, totalDeductions: 0, count: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [payData, runData, compData, allowData, dedData, empData] = await Promise.all([
      supabase.from('payslips').select('*, employee:employees(first_name, last_name, employee_number, department:departments(name))').order('created_at', { ascending: false }),
      supabase.from('payroll_runs').select('*').order('created_at', { ascending: false }),
      supabase.from('employee_salary_components').select('*, employee:employees(first_name, last_name, employee_number)').order('created_at', { ascending: false }),
      supabase.from('allowances').select('*').order('name'),
      supabase.from('deductions').select('*').order('name'),
      supabase.from('employees').select('id, first_name, last_name, employee_number').order('first_name'),
    ]);
    setPayslips((payData.data as Payslip[]) ?? []);
    setRuns((runData.data as PayrollRun[]) ?? []);
    setComponents((compData.data as EmployeeSalaryComponent[]) ?? []);
    setAllowances((allowData.data as Allowance[]) ?? []);
    setDeductions((dedData.data as Deduction[]) ?? []);
    setEmployees((empData.data as Employee[]) ?? []);

    const payslipData = (payData.data as Payslip[]) ?? [];
    setPayrollSummary({
      totalGross: payslipData.reduce((sum, p) => sum + Number(p.gross_pay ?? 0), 0),
      totalNet: payslipData.reduce((sum, p) => sum + Number(p.net_pay ?? 0), 0),
      totalDeductions: payslipData.reduce((sum, p) => sum + Number(p.total_deductions ?? 0), 0),
      count: payslipData.length,
    });
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = (format: 'excel' | 'pdf') => {
    if (tab === 'payslips') {
      const cols = [
        { header: 'Employee', key: 'employee', format: (_v: unknown, r: Record<string, unknown>) => { const e = r.employee as { first_name?: string; last_name?: string } | null; return e ? `${e.first_name} ${e.last_name}` : '—'; } },
        { header: 'Period', key: 'period', format: (_v: unknown, r: Record<string, unknown>) => `${getMonthName(r.pay_period_month as number)} ${r.pay_period_year}` },
        { header: 'Base', key: 'base_salary', format: (v: unknown) => formatCurrency(v as number) },
        { header: 'Gross', key: 'gross_pay', format: (v: unknown) => formatCurrency(v as number) },
        { header: 'Deductions', key: 'total_deductions', format: (v: unknown) => formatCurrency(v as number) },
        { header: 'Net', key: 'net_pay', format: (v: unknown) => formatCurrency(v as number) },
        { header: 'Status', key: 'status' },
      ];
      if (format === 'excel') exportToExcel('payslips', 'Payslips', cols, payslips as unknown as Record<string, unknown>[]);
      else exportToPDF('payslips', 'AB Rwanda PLC - Payslips', cols, payslips as unknown as Record<string, unknown>[]);
    }
  };

  const handlePayslipPDF = (payslip: Payslip) => {
    const empName = payslip.employee ? fullName(payslip.employee as unknown as { first_name: string; last_name: string }) : 'Employee';
    const empNum = payslip.employee?.employee_number ?? '—';
    const period = `${getMonthName(payslip.pay_period_month)} ${payslip.pay_period_year}`;
    const details = [
      { label: 'Base Salary', amount: Number(payslip.base_salary) },
      { label: 'Total Allowances', amount: Number(payslip.total_allowances) },
      { label: 'Gross Pay', amount: Number(payslip.gross_pay) },
      { label: 'Tax', amount: Number(payslip.tax_amount) },
      { label: 'Total Deductions', amount: Number(payslip.total_deductions) },
    ];
    exportPayslipPDF(empName, empNum, period, payslip as unknown as Record<string, unknown>, details);
  };

  const generatePayroll = async () => {
    if (!canManage) return;
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    // Check if run already exists
    const { data: existing } = await supabase.from('payroll_runs').select('id').eq('pay_period_month', month).eq('pay_period_year', year).maybeSingle();
    if (existing) { alert('Payroll run already exists for this period'); return; }

    const { data: run } = await supabase.from('payroll_runs').insert({ pay_period_month: month, pay_period_year: year, status: 'processing', run_date: new Date().toISOString().split('T')[0] }).select().single();
    if (!run) return;

    // Get active employees
    const { data: activeEmps } = await supabase.from('employees').select('id, first_name, last_name, employee_number').eq('status', 'active');
    if (!activeEmps) return;

    let totalGross = 0, totalDeductions = 0, totalNet = 0;

    for (const emp of activeEmps as Employee[]) {
      // Get salary components
      const { data: comps } = await supabase.from('employee_salary_components').select('*').eq('employee_id', emp.id).eq('is_active', true);
      let baseSalary = 0, totalAllow = 0, totalDed = 0;
      (comps ?? []).forEach((c: EmployeeSalaryComponent) => {
        if (c.component_type === 'base_salary') baseSalary += Number(c.amount);
        else if (c.component_type === 'allowance') totalAllow += Number(c.amount);
        else if (c.component_type === 'deduction') totalDed += Number(c.amount);
      });

      if (baseSalary === 0) {
        // Try to get from employment_contracts
        const { data: contract } = await supabase.from('employment_contracts').select('salary').eq('employee_id', emp.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (contract) baseSalary = Number((contract as { salary: number }).salary);
      }

      const grossPay = baseSalary + totalAllow;
      // Simple tax estimate (configurable — this is a placeholder)
      const taxAmount = grossPay > 0 ? Math.round(grossPay * 0.15) : 0;
      const totalDed = totalDed + taxAmount;
      const netPay = grossPay - totalDed;

      await supabase.from('payslips').insert({
        payroll_run_id: run.id,
        employee_id: emp.id,
        pay_period_month: month,
        pay_period_year: year,
        base_salary: baseSalary,
        total_allowances: totalAllow,
        gross_pay: grossPay,
        total_deductions: totalDed,
        tax_amount: taxAmount,
        net_pay: netPay,
        currency: 'RWF',
        status: 'generated',
        details: { components: comps ?? [] },
      });

      totalGross += grossPay;
      totalDeductions += totalDed;
      totalNet += netPay;
    }

    await supabase.from('payroll_runs').update({ status: 'completed', total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet, employee_count: (activeEmps as Employee[]).length }).eq('id', run.id);
    await logAudit('create', 'payroll_run', run.id, `${getMonthName(month)} ${year}`);
    fetchData();
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Payroll Management"
        description="Salary structures, allowances, deductions, payroll processing, and payslips"
        actions={
          <>
            <button onClick={() => handleExport('excel')} className="btn-secondary btn-sm"><Download size={16} /> Excel</button>
            {canManage && tab === 'runs' && <button onClick={generatePayroll} className="btn-primary btn-sm"><Calculator size={16} /> Generate Payroll</button>}
            {canManage && <button onClick={() => { setEditingItem(null); setModalOpen(true); }} className="btn-primary btn-sm"><Plus size={16} /> {tab === 'payslips' ? 'Add Payslip' : tab === 'runs' ? 'Add Run' : tab === 'components' ? 'Add Component' : tab === 'allowances' ? 'Add Allowance' : 'Add Deduction'}</button>}
          </>
        }
      />

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Gross" value={formatCurrency(payrollSummary.totalGross)} icon={<DollarSign size={24} />} color="green" />
        <StatCard label="Total Net" value={formatCurrency(payrollSummary.totalNet)} icon={<DollarSign size={24} />} color="blue" />
        <StatCard label="Total Deductions" value={formatCurrency(payrollSummary.totalDeductions)} icon={<DollarSign size={24} />} color="amber" />
        <StatCard label="Payslips" value={payrollSummary.count} icon={<Receipt size={24} />} color="teal" />
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
        {([['payslips', 'Payslips'], ['runs', 'Payroll Runs'], ['components', 'Salary Components'], ['allowances', 'Allowances'], ['deductions', 'Deductions']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'payslips' && (
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (p) => p.employee ? fullName(p.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'period', header: 'Period', render: (p) => `${getMonthName(p.pay_period_month)} ${p.pay_period_year}` },
            { key: 'base_salary', header: 'Base', render: (p) => formatCurrency(p.base_salary) },
            { key: 'gross_pay', header: 'Gross', render: (p) => formatCurrency(p.gross_pay) },
            { key: 'total_deductions', header: 'Deductions', render: (p) => formatCurrency(p.total_deductions) },
            { key: 'net_pay', header: 'Net Pay', render: (p) => <span className="font-semibold text-slate-900">{formatCurrency(p.net_pay)}</span> },
            { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
          ]}
          data={payslips}
          loading={loading}
          emptyMessage="No payslips generated yet."
          actions={(p) => (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => handlePayslipPDF(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600" title="Download PDF"><FileText size={16} /></button>
              {canManage && (
                <>
                  <button onClick={() => { setEditingItem(p); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
                  {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: p.id, name: 'payslip', type: 'payslip' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                </>
              )}
            </div>
          )}
        />
      )}

      {tab === 'runs' && (
        loading ? <LoadingSpinner /> :
        runs.length === 0 ? <EmptyState icon={<Calculator size={48} />} title="No payroll runs" description="Generate payroll to create runs" /> :
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {runs.map((r) => (
            <div key={r.id} className="card-hover p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600"><Calculator size={24} /></div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{getMonthName(r.pay_period_month)} {r.pay_period_year}</h3>
                    <p className="text-xs text-slate-500">{r.employee_count} employees</p>
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                <div><p className="text-xs text-slate-500">Gross</p><p className="text-sm font-semibold text-slate-900">{formatCurrency(r.total_gross)}</p></div>
                <div><p className="text-xs text-slate-500">Deduct</p><p className="text-sm font-semibold text-amber-600">{formatCurrency(r.total_deductions)}</p></div>
                <div><p className="text-xs text-slate-500">Net</p><p className="text-sm font-semibold text-green-600">{formatCurrency(r.total_net)}</p></div>
              </div>
              {canManage && (
                <div className="mt-3 flex justify-end gap-1">
                  <button onClick={() => { setEditingItem(r); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
                  {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: r.id, name: `${getMonthName(r.pay_period_month)} ${r.pay_period_year}`, type: 'run' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'components' && (
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (c) => c.employee ? fullName(c.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'component_name', header: 'Component' },
            { key: 'component_type', header: 'Type', render: (c) => <span className={c.component_type === 'deduction' ? 'badge-danger' : c.component_type === 'allowance' ? 'badge-info' : 'badge-neutral'}>{c.component_type.replace(/_/g, ' ')}</span> },
            { key: 'amount', header: 'Amount', render: (c) => formatCurrency(c.amount) },
            { key: 'effective_date', header: 'Effective', render: (c) => formatDate(c.effective_date) },
            { key: 'is_active', header: 'Active', render: (c) => c.is_active ? <span className="badge-success">Yes</span> : <span className="badge-neutral">No</span> },
          ]}
          data={components}
          loading={loading}
          emptyMessage="No salary components configured."
          actions={(c) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(c); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              <button onClick={() => setDeleteTarget({ id: c.id, name: c.component_name, type: 'component' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ) : null}
        />
      )}

      {tab === 'allowances' && (
        <DataTable
          columns={[
            { key: 'name', header: 'Name' }, { key: 'code', header: 'Code' },
            { key: 'allowance_type', header: 'Type', render: (a) => a.allowance_type ?? '—' },
            { key: 'default_amount', header: 'Default Amount', render: (a) => a.is_percentage ? `${a.default_amount}%` : formatCurrency(a.default_amount) },
            { key: 'is_taxable', header: 'Taxable', render: (a) => a.is_taxable ? 'Yes' : 'No' },
          ]}
          data={allowances}
          loading={loading}
          emptyMessage="No allowances configured."
          actions={(a) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(a); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              <button onClick={() => setDeleteTarget({ id: a.id, name: a.name, type: 'allowance' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ) : null}
        />
      )}

      {tab === 'deductions' && (
        <DataTable
          columns={[
            { key: 'name', header: 'Name' }, { key: 'code', header: 'Code' },
            { key: 'deduction_type', header: 'Type', render: (d) => d.deduction_type ?? '—' },
            { key: 'default_amount', header: 'Default Amount', render: (d) => d.is_percentage ? `${d.default_amount}%` : formatCurrency(d.default_amount) },
          ]}
          data={deductions}
          loading={loading}
          emptyMessage="No deductions configured."
          actions={(d) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(d); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              <button onClick={() => setDeleteTarget({ id: d.id, name: d.name, type: 'deduction' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ) : null}
        />
      )}

      {modalOpen && (
        <PayrollModal type={tab} item={editingItem} employees={employees} allowances={allowances} deductions={deductions} onClose={() => { setModalOpen(false); setEditingItem(null); }} onSaved={() => { setModalOpen(false); setEditingItem(null); fetchData(); }} />
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => {
        if (!deleteTarget) return;
        const tableMap: Record<string, string> = { payslip: 'payslips', run: 'payroll_runs', component: 'employee_salary_components', allowance: 'allowances', deduction: 'deductions' };
        await supabase.from(tableMap[deleteTarget.type]).delete().eq('id', deleteTarget.id);
        await logAudit('delete', deleteTarget.type, deleteTarget.id, deleteTarget.name);
        fetchData();
      }} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"?`} confirmLabel="Delete" danger />
    </div>
  );
}

function PayrollModal({ type, item, employees, allowances, deductions, onClose, onSaved }: {
  type: 'payslips' | 'runs' | 'components' | 'allowances' | 'deductions';
  item: Payslip | PayrollRun | Allowance | Deduction | EmployeeSalaryComponent | null;
  employees: Employee[];
  allowances: Allowance[];
  deductions: Deduction[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (item) {
      const obj: Record<string, string> = {};
      Object.keys(item as Record<string, unknown>).forEach((k) => {
        const val = (item as Record<string, unknown>)[k];
        obj[k] = val === null || val === undefined ? '' : String(val);
      });
      setForm(obj);
    } else {
      if (type === 'payslips') setForm({ employee_id: '', pay_period_month: String(new Date().getMonth() + 1), pay_period_year: String(new Date().getFullYear()), base_salary: '', total_allowances: '', gross_pay: '', total_deductions: '', tax_amount: '', net_pay: '', currency: 'RWF', status: 'generated' });
      else if (type === 'runs') setForm({ pay_period_month: String(new Date().getMonth() + 1), pay_period_year: String(new Date().getFullYear()), status: 'draft', notes: '' });
      else if (type === 'components') setForm({ employee_id: '', component_type: 'base_salary', component_id: '', component_name: '', amount: '', is_percentage: 'false', is_active: 'true', effective_date: new Date().toISOString().split('T')[0] });
      else if (type === 'allowances') setForm({ name: '', code: '', description: '', allowance_type: 'other', default_amount: '0', is_percentage: 'false', is_taxable: 'true' });
      else setForm({ name: '', code: '', description: '', deduction_type: 'other', default_amount: '0', is_percentage: 'false' });
    }
  }, [item, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tableMap: Record<string, string> = { payslips: 'payslips', runs: 'payroll_runs', components: 'employee_salary_components', allowances: 'allowances', deductions: 'deductions' };
      const table = tableMap[type];
      const payload: Record<string, unknown> = { ...form };
      if (type === 'payslips') { ['base_salary', 'total_allowances', 'gross_pay', 'total_deductions', 'tax_amount', 'net_pay'].forEach((k) => { payload[k] = Number(form[k]) || 0; }); payload.pay_period_month = Number(form.pay_period_month); payload.pay_period_year = Number(form.pay_period_year); }
      if (type === 'runs') { payload.pay_period_month = Number(form.pay_period_month); payload.pay_period_year = Number(form.pay_period_year); }
      if (type === 'components') { payload.amount = Number(form.amount) || 0; payload.is_percentage = form.is_percentage === 'true'; payload.is_active = form.is_active === 'true'; }
      if (type === 'allowances') { payload.default_amount = Number(form.default_amount) || 0; payload.is_percentage = form.is_percentage === 'true'; payload.is_taxable = form.is_taxable === 'true'; }
      if (type === 'deductions') { payload.default_amount = Number(form.default_amount) || 0; payload.is_percentage = form.is_percentage === 'true'; }
      ['employee_id', 'component_id', 'end_date'].forEach((k) => { if (payload[k] === '') payload[k] = null; });

      if (item) {
        await supabase.from(table).update(payload).eq('id', (item as { id: string }).id);
        await logAudit('update', type, (item as { id: string }).id, form.name || form.component_name || type);
      } else {
        const { data } = await supabase.from(table).insert(payload).select().single();
        if (data) await logAudit('create', type, data.id, form.name || form.component_name || type);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const title = type === 'payslips' ? (item ? 'Edit Payslip' : 'Add Payslip') : type === 'runs' ? (item ? 'Edit Run' : 'Add Run') : type === 'components' ? (item ? 'Edit Component' : 'Add Component') : type === 'allowances' ? (item ? 'Edit Allowance' : 'Add Allowance') : (item ? 'Edit Deduction' : 'Add Deduction');

  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="lg">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'payslips' && (
          <>
            <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            <div className="form-grid">
              <div><label className="label">Month</label><select className="input" value={form.pay_period_month || ''} onChange={(e) => setForm({ ...form, pay_period_month: e.target.value })}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>)}</select></div>
              <div><label className="label">Year</label><input type="number" className="input" value={form.pay_period_year || ''} onChange={(e) => setForm({ ...form, pay_period_year: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Base Salary</label><input type="number" className="input" value={form.base_salary || ''} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} /></div>
              <div><label className="label">Total Allowances</label><input type="number" className="input" value={form.total_allowances || ''} onChange={(e) => setForm({ ...form, total_allowances: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Gross Pay</label><input type="number" className="input" value={form.gross_pay || ''} onChange={(e) => setForm({ ...form, gross_pay: e.target.value })} /></div>
              <div><label className="label">Tax Amount</label><input type="number" className="input" value={form.tax_amount || ''} onChange={(e) => setForm({ ...form, tax_amount: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Total Deductions</label><input type="number" className="input" value={form.total_deductions || ''} onChange={(e) => setForm({ ...form, total_deductions: e.target.value })} /></div>
              <div><label className="label">Net Pay</label><input type="number" className="input" value={form.net_pay || ''} onChange={(e) => setForm({ ...form, net_pay: e.target.value })} /></div>
            </div>
            <div><label className="label">Status</label><select className="input" value={form.status || 'generated'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{PAYSLIP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          </>
        )}
        {type === 'runs' && (
          <>
            <div className="form-grid">
              <div><label className="label">Month</label><select className="input" value={form.pay_period_month || ''} onChange={(e) => setForm({ ...form, pay_period_month: e.target.value })}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>)}</select></div>
              <div><label className="label">Year</label><input type="number" className="input" value={form.pay_period_year || ''} onChange={(e) => setForm({ ...form, pay_period_year: e.target.value })} /></div>
            </div>
            <div><label className="label">Status</label><select className="input" value={form.status || 'draft'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{PAYROLL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </>
        )}
        {type === 'components' && (
          <>
            <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            <div className="form-grid">
              <div><label className="label">Component Type</label><select className="input" value={form.component_type || 'base_salary'} onChange={(e) => setForm({ ...form, component_type: e.target.value })}>{COMPONENT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="label">Component Name</label><input className="input" value={form.component_name || ''} onChange={(e) => setForm({ ...form, component_name: e.target.value })} placeholder="e.g. Base Salary, Transport Allowance" /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Amount (RWF)</label><input type="number" className="input" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><label className="label">Effective Date</label><input type="date" className="input" value={form.effective_date || ''} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Is Percentage</label><select className="input" value={form.is_percentage || 'false'} onChange={(e) => setForm({ ...form, is_percentage: e.target.value })}><option value="false">No</option><option value="true">Yes</option></select></div>
              <div><label className="label">Active</label><select className="input" value={form.is_active || 'true'} onChange={(e) => setForm({ ...form, is_active: e.target.value })}><option value="true">Yes</option><option value="false">No</option></select></div>
            </div>
          </>
        )}
        {(type === 'allowances' || type === 'deductions') && (
          <>
            <div className="form-grid">
              <div><label className="label">Name *</label><input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><label className="label">Code *</label><input className="input" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></div>
            </div>
            <div><label className="label">Description</label><input className="input" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="form-grid">
              <div><label className="label">{type === 'allowances' ? 'Allowance Type' : 'Deduction Type'}</label><select className="input" value={form[type === 'allowances' ? 'allowance_type' : 'deduction_type'] || 'other'} onChange={(e) => setForm({ ...form, [type === 'allowances' ? 'allowance_type' : 'deduction_type']: e.target.value })}>
                {type === 'allowances' ? ['housing', 'transport', 'medical', 'meal', 'communication', 'education', 'risk', 'overtime', 'other'].map((t) => <option key={t} value={t}>{t}</option>) : ['tax', 'pension', 'social_security', 'loan', 'insurance', 'advance', 'other'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select></div>
              <div><label className="label">Default Amount</label><input type="number" className="input" value={form.default_amount || '0'} onChange={(e) => setForm({ ...form, default_amount: e.target.value })} /></div>
            </div>
            <div><label className="label">Is Percentage</label><select className="input" value={form.is_percentage || 'false'} onChange={(e) => setForm({ ...form, is_percentage: e.target.value })}><option value="false">No</option><option value="true">Yes</option></select></div>
            {type === 'allowances' && <div><label className="label">Taxable</label><select className="input" value={form.is_taxable || 'true'} onChange={(e) => setForm({ ...form, is_taxable: e.target.value })}><option value="true">Yes</option><option value="false">No</option></select></div>}
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

function LoadingSpinner() {
  return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
}
