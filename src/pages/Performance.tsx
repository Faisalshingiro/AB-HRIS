import { useEffect, useState, useCallback } from 'react';
import { Plus, Target, Star, Download, FileText, Edit, Trash2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, DataTable, Modal, StatusBadge, ConfirmDialog, EmptyState } from '@/components/ui';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { formatDate, fullName, isHrOrAdmin, logAudit } from '@/lib/utils';
import type { PerformanceKpi, PerformanceObjective, PerformanceReview, Employee, Department, Position } from '@/types';

const OBJECTIVE_STATUSES = ['active', 'completed', 'overdue', 'cancelled'];
const REVIEW_STATUSES = ['draft', 'submitted', 'reviewed', 'finalized', 'acknowledged'];

export function Performance() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'employee';
  const canManage = isHrOrAdmin(role) || role === 'department_manager';

  const [tab, setTab] = useState<'kpis' | 'objectives' | 'reviews'>('objectives');
  const [kpis, setKpis] = useState<PerformanceKpi[]>([]);
  const [objectives, setObjectives] = useState<PerformanceObjective[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PerformanceKpi | PerformanceObjective | PerformanceReview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [kpiData, objData, revData, empData, deptData, posData] = await Promise.all([
      supabase.from('performance_kpis').select('*, position:positions(*), department:departments(*)').order('created_at', { ascending: false }),
      supabase.from('performance_objectives').select('*, employee:employees(first_name, last_name, employee_number), kpi:performance_kpis(name)').order('created_at', { ascending: false }),
      supabase.from('performance_reviews').select('*, employee:employees(first_name, last_name, employee_number), reviewer:employees!reviewer_id(first_name, last_name)').order('review_date', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name, employee_number').order('first_name'),
      supabase.from('departments').select('*').order('name'),
      supabase.from('positions').select('*').order('title'),
    ]);
    setKpis((kpiData.data as PerformanceKpi[]) ?? []);
    setObjectives((objData.data as PerformanceObjective[]) ?? []);
    setReviews((revData.data as PerformanceReview[]) ?? []);
    setEmployees((empData.data as Employee[]) ?? []);
    setDepartments((deptData.data as Department[]) ?? []);
    setPositions((posData.data as Position[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = (format: 'excel' | 'pdf') => {
    if (tab === 'reviews') {
      const cols = [
        { header: 'Employee', key: 'employee', format: (_v: unknown, r: Record<string, unknown>) => { const e = r.employee as { first_name?: string; last_name?: string } | null; return e ? `${e.first_name} ${e.last_name}` : '—'; } },
        { header: 'Cycle', key: 'review_cycle' },
        { header: 'Period', key: 'review_period', format: (v: unknown) => v as string || '—' },
        { header: 'Date', key: 'review_date', format: (v: unknown) => formatDate(v as string) },
        { header: 'Rating', key: 'overall_rating', format: (v: unknown) => v ? `${v}/5` : '—' },
        { header: 'Status', key: 'status' },
      ];
      if (format === 'excel') exportToExcel('performance_reviews', 'Reviews', cols, reviews as unknown as Record<string, unknown>[]);
      else exportToPDF('performance_reviews', 'AB Rwanda PLC - Performance Reviews', cols, reviews as unknown as Record<string, unknown>[]);
    }
  };

  const ProgressBar = ({ value }: { value: number }) => (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full rounded-full ${value >= 75 ? 'bg-green-500' : value >= 50 ? 'bg-blue-500' : value >= 25 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600">{value}%</span>
    </div>
  );

  const StarRating = ({ rating }: { rating: number | null }) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} className={rating && n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
      ))}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Performance Management"
        description="KPIs, objectives, performance reviews, and evaluation reports"
        actions={
          <>
            <button onClick={() => handleExport('excel')} className="btn-secondary btn-sm"><Download size={16} /> Excel</button>
            <button onClick={() => handleExport('pdf')} className="btn-secondary btn-sm"><FileText size={16} /> PDF</button>
            {canManage && <button onClick={() => { setEditingItem(null); setModalOpen(true); }} className="btn-primary btn-sm"><Plus size={16} /> {tab === 'kpis' ? 'Add KPI' : tab === 'objectives' ? 'Add Objective' : 'Add Review'}</button>}
          </>
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {(['objectives', 'kpis', 'reviews'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {t} ({t === 'objectives' ? objectives.length : t === 'kpis' ? kpis.length : reviews.length})
          </button>
        ))}
      </div>

      {tab === 'objectives' && (
        loading ? <LoadingSpinner /> :
        objectives.length === 0 ? <EmptyState icon={<Target size={48} />} title="No objectives" description="Create performance objectives for employees" /> :
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {objectives.map((obj) => (
            <div key={obj.id} className="card-hover p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{obj.title}</h3>
                  <p className="text-sm text-slate-500">{obj.employee ? fullName(obj.employee as unknown as { first_name: string; last_name: string }) : '—'}</p>
                </div>
                <StatusBadge status={obj.status} />
              </div>
              {obj.description && <p className="mt-2 text-sm text-slate-600 line-clamp-2">{obj.description}</p>}
              <div className="mt-3">
                <p className="mb-1 text-xs text-slate-500">Progress</p>
                <ProgressBar value={obj.progress} />
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span>Due: {formatDate(obj.due_date)}</span>
                <span>Cycle: {obj.review_cycle}</span>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingItem(obj); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
                    {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: obj.id, name: obj.title, type: 'objective' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'kpis' && (
        <DataTable
          columns={[
            { key: 'name', header: 'KPI', render: (k) => <span className="font-medium text-slate-900">{k.name}</span> },
            { key: 'department', header: 'Department', render: (k) => k.department?.name ?? 'All' },
            { key: 'position', header: 'Position', render: (k) => k.position?.title ?? 'All' },
            { key: 'weight', header: 'Weight', render: (k) => `${k.weight}%` },
            { key: 'target', header: 'Target', render: (k) => k.target_value ?? '—' },
            { key: 'unit', header: 'Unit', render: (k) => k.measurement_unit ?? '—' },
          ]}
          data={kpis}
          loading={loading}
          emptyMessage="No KPIs defined yet."
          actions={(k) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(k); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: k.id, name: k.name, type: 'kpi' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
            </div>
          ) : null}
        />
      )}

      {tab === 'reviews' && (
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (r) => r.employee ? fullName(r.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'review_cycle', header: 'Cycle' },
            { key: 'review_date', header: 'Date', render: (r) => formatDate(r.review_date) },
            { key: 'overall_rating', header: 'Rating', render: (r) => <StarRating rating={r.overall_rating} /> },
            { key: 'reviewer', header: 'Reviewer', render: (r) => r.reviewer ? fullName(r.reviewer as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
          data={reviews}
          loading={loading}
          emptyMessage="No reviews created yet."
          actions={(r) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(r); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: r.id, name: 'review', type: 'review' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
            </div>
          ) : null}
        />
      )}

      {modalOpen && (
        <PerformanceModal type={tab} item={editingItem} employees={employees} departments={departments} positions={positions} kpis={kpis} onClose={() => { setModalOpen(false); setEditingItem(null); }} onSaved={() => { setModalOpen(false); setEditingItem(null); fetchData(); }} />
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => {
        if (!deleteTarget) return;
        const table = deleteTarget.type === 'kpi' ? 'performance_kpis' : deleteTarget.type === 'objective' ? 'performance_objectives' : 'performance_reviews';
        await supabase.from(table).delete().eq('id', deleteTarget.id);
        await logAudit('delete', deleteTarget.type, deleteTarget.id, deleteTarget.name);
        fetchData();
      }} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"?`} confirmLabel="Delete" danger />
    </div>
  );
}

function PerformanceModal({ type, item, employees, departments, positions, kpis, onClose, onSaved }: {
  type: 'kpis' | 'objectives' | 'reviews';
  item: PerformanceKpi | PerformanceObjective | PerformanceReview | null;
  employees: Employee[];
  departments: Department[];
  positions: Position[];
  kpis: PerformanceKpi[];
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
      if (type === 'kpis') setForm({ name: '', description: '', position_id: '', department_id: '', weight: '100', target_value: '', measurement_unit: '' });
      else if (type === 'objectives') setForm({ employee_id: '', title: '', description: '', kpi_id: '', target: '', achievement: '', progress: '0', status: 'active', due_date: '', review_cycle: 'annual' });
      else setForm({ employee_id: '', reviewer_id: '', review_cycle: 'annual', review_period: '', review_date: new Date().toISOString().split('T')[0], overall_rating: '', strengths: '', areas_for_improvement: '', goals: '', reviewer_comments: '', employee_comments: '', status: 'draft' });
    }
  }, [item, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const table = type === 'kpis' ? 'performance_kpis' : type === 'objectives' ? 'performance_objectives' : 'performance_reviews';
      const payload: Record<string, unknown> = { ...form };
      if (type === 'kpis') { payload.weight = Number(form.weight) || 100; }
      if (type === 'objectives') { payload.progress = Number(form.progress) || 0; }
      if (type === 'reviews') { payload.overall_rating = form.overall_rating ? Number(form.overall_rating) : null; }
      ['position_id', 'department_id', 'employee_id', 'kpi_id', 'reviewer_id', 'due_date', 'target_value'].forEach((k) => { if (payload[k] === '') payload[k] = null; });

      if (item) {
        await supabase.from(table).update(payload).eq('id', (item as { id: string }).id);
        await logAudit('update', type, (item as { id: string }).id, form.name || form.title || 'review');
      } else {
        const { data } = await supabase.from(table).insert(payload).select().single();
        if (data) await logAudit('create', type, data.id, form.name || form.title || 'review');
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const title = type === 'kpis' ? (item ? 'Edit KPI' : 'Add KPI') : type === 'objectives' ? (item ? 'Edit Objective' : 'Add Objective') : (item ? 'Edit Review' : 'Add Review');

  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="lg">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'kpis' && (
          <>
            <div><label className="label">Name *</label><input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="form-grid">
              <div><label className="label">Department</label><select className="input" value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: e.target.value })}><option value="">All Departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className="label">Position</label><select className="input" value={form.position_id || ''} onChange={(e) => setForm({ ...form, position_id: e.target.value })}><option value="">All Positions</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Weight (%)</label><input type="number" className="input" value={form.weight || '100'} onChange={(e) => setForm({ ...form, weight: e.target.value })} min={0} max={100} /></div>
              <div><label className="label">Measurement Unit</label><input className="input" value={form.measurement_unit || ''} onChange={(e) => setForm({ ...form, measurement_unit: e.target.value })} placeholder="e.g. %, count, RWF" /></div>
            </div>
            <div><label className="label">Target Value</label><input className="input" value={form.target_value || ''} onChange={(e) => setForm({ ...form, target_value: e.target.value })} /></div>
          </>
        )}
        {type === 'objectives' && (
          <>
            <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            <div><label className="label">Title *</label><input className="input" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="form-grid">
              <div><label className="label">KPI</label><select className="input" value={form.kpi_id || ''} onChange={(e) => setForm({ ...form, kpi_id: e.target.value })}><option value="">None</option>{kpis.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}</select></div>
              <div><label className="label">Status</label><select className="input" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{OBJECTIVE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Progress (%)</label><input type="number" className="input" value={form.progress || '0'} onChange={(e) => setForm({ ...form, progress: e.target.value })} min={0} max={100} /></div>
              <div><label className="label">Due Date</label><input type="date" className="input" value={form.due_date || ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
            <div><label className="label">Target</label><input className="input" value={form.target || ''} onChange={(e) => setForm({ ...form, target: e.target.value })} /></div>
            <div><label className="label">Achievement</label><input className="input" value={form.achievement || ''} onChange={(e) => setForm({ ...form, achievement: e.target.value })} /></div>
          </>
        )}
        {type === 'reviews' && (
          <>
            <div className="form-grid">
              <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
              <div><label className="label">Reviewer</label><select className="input" value={form.reviewer_id || ''} onChange={(e) => setForm({ ...form, reviewer_id: e.target.value })}><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Review Cycle</label><select className="input" value={form.review_cycle || 'annual'} onChange={(e) => setForm({ ...form, review_cycle: e.target.value })}><option value="annual">Annual</option><option value="semi_annual">Semi-Annual</option><option value="quarterly">Quarterly</option><option value="monthly">Monthly</option><option value="probation">Probation</option></select></div>
              <div><label className="label">Status</label><select className="input" value={form.status || 'draft'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{REVIEW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Review Date *</label><input type="date" className="input" value={form.review_date || ''} onChange={(e) => setForm({ ...form, review_date: e.target.value })} required /></div>
              <div><label className="label">Overall Rating (1-5)</label><select className="input" value={form.overall_rating || ''} onChange={(e) => setForm({ ...form, overall_rating: e.target.value })}><option value="">Not rated</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
            </div>
            <div><label className="label">Review Period</label><input className="input" value={form.review_period || ''} onChange={(e) => setForm({ ...form, review_period: e.target.value })} placeholder="e.g. Jan-Jun 2026" /></div>
            <div><label className="label">Strengths</label><textarea className="input" rows={2} value={form.strengths || ''} onChange={(e) => setForm({ ...form, strengths: e.target.value })} /></div>
            <div><label className="label">Areas for Improvement</label><textarea className="input" rows={2} value={form.areas_for_improvement || ''} onChange={(e) => setForm({ ...form, areas_for_improvement: e.target.value })} /></div>
            <div><label className="label">Goals</label><textarea className="input" rows={2} value={form.goals || ''} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></div>
            <div><label className="label">Reviewer Comments</label><textarea className="input" rows={2} value={form.reviewer_comments || ''} onChange={(e) => setForm({ ...form, reviewer_comments: e.target.value })} /></div>
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
