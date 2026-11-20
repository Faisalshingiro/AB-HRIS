import { useEffect, useState, useCallback } from 'react';
import { Plus, ShieldCheck, AlertTriangle, Download, FileText, Edit, Trash2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, DataTable, Modal, StatusBadge, ConfirmDialog, EmptyState } from '@/components/ui';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { formatDate, fullName, isHrOrAdmin, logAudit } from '@/lib/utils';
import type { SuccessionPlan, DisciplinaryCase, Employee, Position, Department } from '@/types';

const READINESS_LEVELS = ['ready_now', 'ready_1_2_years', 'ready_3_5_years', 'development_needed'];
const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
const CASE_STATUSES = ['open', 'under_investigation', 'hearing_scheduled', 'resolved', 'dismissed', 'appealed'];
const SEVERITY_LEVELS = ['minor', 'moderate', 'major', 'gross'];

export function Succession() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'employee';
  const canManage = isHrOrAdmin(role) || role === 'department_manager';

  const [tab, setTab] = useState<'succession' | 'disciplinary'>('succession');
  const [plans, setPlans] = useState<SuccessionPlan[]>([]);
  const [cases, setCases] = useState<DisciplinaryCase[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SuccessionPlan | DisciplinaryCase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [planData, caseData, empData, posData, deptData] = await Promise.all([
      supabase.from('succession_plans').select('*, position:positions(*), current_employee:employees!current_employee_id(first_name, last_name, employee_number), successor:employees!successor_id(first_name, last_name, employee_number)').order('created_at', { ascending: false }),
      supabase.from('disciplinary_cases').select('*, employee:employees(first_name, last_name, employee_number, department:departments(name))').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name, employee_number').order('first_name'),
      supabase.from('positions').select('id, title, department_id').order('title'),
      supabase.from('departments').select('*').order('name'),
    ]);
    setPlans((planData.data as SuccessionPlan[]) ?? []);
    setCases((caseData.data as DisciplinaryCase[]) ?? []);
    setEmployees((empData.data as Employee[]) ?? []);
    setPositions((posData.data as Position[]) ?? []);
    setDepartments((deptData.data as Department[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = (format: 'excel' | 'pdf') => {
    if (tab === 'disciplinary') {
      const cols = [
        { header: 'Case No', key: 'case_number' },
        { header: 'Employee', key: 'employee', format: (_v: unknown, r: Record<string, unknown>) => { const e = r.employee as { first_name?: string; last_name?: string } | null; return e ? `${e.first_name} ${e.last_name}` : '—'; } },
        { header: 'Incident Date', key: 'incident_date', format: (v: unknown) => formatDate(v as string) },
        { header: 'Severity', key: 'severity' },
        { header: 'Status', key: 'status' },
        { header: 'Offence', key: 'offence_type', format: (v: unknown) => v as string || '—' },
      ];
      if (format === 'excel') exportToExcel('disciplinary_cases', 'Disciplinary', cols, cases as unknown as Record<string, unknown>[]);
      else exportToPDF('disciplinary_cases', 'AB Rwanda PLC - Disciplinary Cases', cols, cases as unknown as Record<string, unknown>[]);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Succession & Disciplinary Management"
        description="Talent management, succession planning, disciplinary cases, and documentation"
        actions={
          <>
            <button onClick={() => handleExport('excel')} className="btn-secondary btn-sm"><Download size={16} /> Excel</button>
            {canManage && <button onClick={() => { setEditingItem(null); setModalOpen(true); }} className="btn-primary btn-sm"><Plus size={16} /> {tab === 'succession' ? 'Add Plan' : 'Add Case'}</button>}
          </>
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {([['succession', 'Succession Plans'], ['disciplinary', 'Disciplinary Cases']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {label} ({key === 'succession' ? plans.length : cases.length})
          </button>
        ))}
      </div>

      {tab === 'succession' && (
        loading ? <LoadingSpinner /> :
        plans.length === 0 ? <EmptyState icon={<TrendingUp size={48} />} title="No succession plans" description="Create succession plans for key positions" /> :
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {plans.map((p) => (
            <div key={p.id} className="card-hover p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ShieldCheck size={24} /></div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.position?.title ?? '—'}</h3>
                    <p className="text-xs text-slate-500">{p.position?.department?.name ?? ''}</p>
                  </div>
                </div>
                <StatusBadge status={p.risk_level} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <p className="text-xs text-slate-500">Current</p>
                  <p className="text-sm font-medium text-slate-900">{p.current_employee ? fullName(p.current_employee as unknown as { first_name: string; last_name: string }) : 'Vacant'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Successor</p>
                  <p className="text-sm font-medium text-slate-900">{p.successor ? fullName(p.successor as unknown as { first_name: string; last_name: string }) : 'Not identified'}</p>
                </div>
              </div>
              {p.readiness_level && <div className="mt-2"><StatusBadge status={p.readiness_level} /></div>}
              {p.notes && <p className="mt-2 text-sm text-slate-600 line-clamp-2">{p.notes}</p>}
              {canManage && (
                <div className="mt-3 flex justify-end gap-1">
                  <button onClick={() => { setEditingItem(p); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
                  {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: p.id, name: p.position?.title ?? 'plan', type: 'plan' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'disciplinary' && (
        <DataTable
          columns={[
            { key: 'case_number', header: 'Case No', render: (c) => <span className="font-mono text-xs font-medium text-slate-900">{c.case_number}</span> },
            { key: 'employee', header: 'Employee', render: (c) => c.employee ? fullName(c.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'incident_date', header: 'Incident', render: (c) => formatDate(c.incident_date) },
            { key: 'offence_type', header: 'Offence', render: (c) => c.offence_type ?? '—' },
            { key: 'severity', header: 'Severity', render: (c) => <StatusBadge status={c.severity} /> },
            { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          ]}
          data={cases}
          loading={loading}
          emptyMessage="No disciplinary cases recorded."
          actions={(c) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(c); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: c.id, name: c.case_number, type: 'case' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
            </div>
          ) : null}
        />
      )}

      {modalOpen && (
        <SuccessionModal type={tab} item={editingItem} employees={employees} positions={positions} onClose={() => { setModalOpen(false); setEditingItem(null); }} onSaved={() => { setModalOpen(false); setEditingItem(null); fetchData(); }} />
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => {
        if (!deleteTarget) return;
        const table = deleteTarget.type === 'plan' ? 'succession_plans' : 'disciplinary_cases';
        await supabase.from(table).delete().eq('id', deleteTarget.id);
        await logAudit('delete', deleteTarget.type, deleteTarget.id, deleteTarget.name);
        fetchData();
      }} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"?`} confirmLabel="Delete" danger />
    </div>
  );
}

function SuccessionModal({ type, item, employees, positions, onClose, onSaved }: {
  type: 'succession' | 'disciplinary';
  item: SuccessionPlan | DisciplinaryCase | null;
  employees: Employee[];
  positions: Position[];
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
      if (type === 'succession') setForm({ position_id: '', current_employee_id: '', successor_id: '', readiness_level: '', risk_level: 'medium', status: 'active', notes: '' });
      else setForm({ case_number: `DC-${Date.now().toString().slice(-6)}`, employee_id: '', incident_date: new Date().toISOString().split('T')[0], reported_date: new Date().toISOString().split('T')[0], offence_type: '', description: '', severity: 'minor', action_taken: '', status: 'open', hearing_date: '', outcome: '' });
    }
  }, [item, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const table = type === 'succession' ? 'succession_plans' : 'disciplinary_cases';
      const payload: Record<string, unknown> = { ...form };
      ['current_employee_id', 'successor_id', 'position_id', 'employee_id', 'hearing_date'].forEach((k) => { if (payload[k] === '') payload[k] = null; });

      if (item) {
        await supabase.from(table).update(payload).eq('id', (item as { id: string }).id);
        await logAudit('update', type, (item as { id: string }).id, form.case_number || 'plan');
      } else {
        const { data } = await supabase.from(table).insert(payload).select().single();
        if (data) await logAudit('create', type, data.id, form.case_number || 'plan');
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const title = type === 'succession' ? (item ? 'Edit Plan' : 'Add Succession Plan') : (item ? 'Edit Case' : 'Add Disciplinary Case');

  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="lg">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'succession' && (
          <>
            <div><label className="label">Position *</label><select className="input" value={form.position_id || ''} onChange={(e) => setForm({ ...form, position_id: e.target.value })} required><option value="">Select</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
            <div className="form-grid">
              <div><label className="label">Current Employee</label><select className="input" value={form.current_employee_id || ''} onChange={(e) => setForm({ ...form, current_employee_id: e.target.value })}><option value="">Vacant</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
              <div><label className="label">Successor</label><select className="input" value={form.successor_id || ''} onChange={(e) => setForm({ ...form, successor_id: e.target.value })}><option value="">Not identified</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Readiness Level</label><select className="input" value={form.readiness_level || ''} onChange={(e) => setForm({ ...form, readiness_level: e.target.value })}><option value="">Select</option>{READINESS_LEVELS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="label">Risk Level</label><select className="input" value={form.risk_level || 'medium'} onChange={(e) => setForm({ ...form, risk_level: e.target.value })}>{RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}</select></div>
            </div>
            <div><label className="label">Status</label><select className="input" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="active">Active</option><option value="reviewed">Reviewed</option><option value="archived">Archived</option></select></div>
            <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </>
        )}
        {type === 'disciplinary' && (
          <>
            <div className="form-grid">
              <div><label className="label">Case Number *</label><input className="input" value={form.case_number || ''} onChange={(e) => setForm({ ...form, case_number: e.target.value })} required /></div>
              <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Incident Date *</label><input type="date" className="input" value={form.incident_date || ''} onChange={(e) => setForm({ ...form, incident_date: e.target.value })} required /></div>
              <div><label className="label">Offence Type</label><input className="input" value={form.offence_type || ''} onChange={(e) => setForm({ ...form, offence_type: e.target.value })} placeholder="e.g. Misconduct, Absenteeism" /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Severity</label><select className="input" value={form.severity || 'minor'} onChange={(e) => setForm({ ...form, severity: e.target.value })}>{SEVERITY_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="label">Status</label><select className="input" value={form.status || 'open'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{CASE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></div>
            </div>
            <div><label className="label">Description *</label><textarea className="input" rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} required /></div>
            <div className="form-grid">
              <div><label className="label">Hearing Date</label><input type="date" className="input" value={form.hearing_date || ''} onChange={(e) => setForm({ ...form, hearing_date: e.target.value })} /></div>
              <div></div>
            </div>
            <div><label className="label">Action Taken</label><textarea className="input" rows={2} value={form.action_taken || ''} onChange={(e) => setForm({ ...form, action_taken: e.target.value })} /></div>
            <div><label className="label">Outcome</label><textarea className="input" rows={2} value={form.outcome || ''} onChange={(e) => setForm({ ...form, outcome: e.target.value })} /></div>
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
