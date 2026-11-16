import { useEffect, useState, useCallback } from 'react';
import { Plus, LogOut, Download, FileText, Edit, Trash2, CheckCircle2, Circle, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, DataTable, Modal, StatusBadge, ConfirmDialog, EmptyState } from '@/components/ui';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { formatCurrency, formatDate, fullName, isHrOrAdmin, canManagePayroll, logAudit } from '@/lib/utils';
import type { ExitRequest, ExitInterview, ExitClearance, FinalSettlement, Employee } from '@/types';

const EXIT_TYPES = ['resignation', 'termination', 'retirement', 'contract_expiry', 'mutual_agreement'];
const EXIT_STATUSES = ['pending', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled'];
const SETTLEMENT_STATUSES = ['pending', 'approved', 'paid', 'disputed'];
const CLEARANCE_STATUSES = ['pending', 'completed', 'not_applicable'];

export function Exit() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'employee';
  const canManage = isHrOrAdmin(role);
  const canFinance = canManagePayroll(role);

  const [tab, setTab] = useState<'requests' | 'interviews' | 'clearances' | 'settlements'>('requests');
  const [requests, setRequests] = useState<ExitRequest[]>([]);
  const [interviews, setInterviews] = useState<ExitInterview[]>([]);
  const [clearances, setClearances] = useState<ExitClearance[]>([]);
  const [settlements, setSettlements] = useState<FinalSettlement[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExitRequest | ExitInterview | ExitClearance | FinalSettlement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [reqData, intData, clrData, setData, empData] = await Promise.all([
      supabase.from('exit_requests').select('*, employee:employees(first_name, last_name, employee_number, department:departments(name), position:positions(title))').order('created_at', { ascending: false }),
      supabase.from('exit_interviews').select('*, employee:employees(first_name, last_name, employee_number)').order('created_at', { ascending: false }),
      supabase.from('exit_clearances').select('*, employee:employees(first_name, last_name, employee_number)').order('created_at', { ascending: false }),
      supabase.from('final_settlements').select('*, employee:employees(first_name, last_name, employee_number)').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name, employee_number').order('first_name'),
    ]);
    setRequests((reqData.data as ExitRequest[]) ?? []);
    setInterviews((intData.data as ExitInterview[]) ?? []);
    setClearances((clrData.data as ExitClearance[]) ?? []);
    setSettlements((setData.data as FinalSettlement[]) ?? []);
    setEmployees((empData.data as Employee[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = (format: 'excel' | 'pdf') => {
    if (tab === 'requests') {
      const cols = [
        { header: 'Employee', key: 'employee', format: (_v: unknown, r: Record<string, unknown>) => { const e = r.employee as { first_name?: string; last_name?: string } | null; return e ? `${e.first_name} ${e.last_name}` : '—'; } },
        { header: 'Exit Type', key: 'exit_type' },
        { header: 'Last Day', key: 'last_working_date', format: (v: unknown) => formatDate(v as string) },
        { header: 'Status', key: 'status' },
      ];
      if (format === 'excel') exportToExcel('exit_requests', 'Exit Requests', cols, requests as unknown as Record<string, unknown>[]);
      else exportToPDF('exit_requests', 'AB Rwanda PLC - Exit Requests', cols, requests as unknown as Record<string, unknown>[]);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Employee Exit"
        description="Resignation, termination, exit interviews, clearance, and final settlements"
        actions={
          <>
            <button onClick={() => handleExport('excel')} className="btn-secondary btn-sm"><Download size={16} /> Excel</button>
            {canManage && <button onClick={() => { setEditingItem(null); setModalOpen(true); }} className="btn-primary btn-sm"><Plus size={16} /> {tab === 'requests' ? 'Add Request' : tab === 'interviews' ? 'Add Interview' : tab === 'clearances' ? 'Add Clearance' : 'Add Settlement'}</button>}
          </>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
        {([['requests', 'Exit Requests'], ['interviews', 'Interviews'], ['clearances', 'Clearances'], ['settlements', 'Settlements']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'requests' && (
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (r) => r.employee ? fullName(r.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'exit_type', header: 'Type', render: (r) => <span className="badge-info">{r.exit_type.replace(/_/g, ' ')}</span> },
            { key: 'requested_date', header: 'Requested', render: (r) => formatDate(r.requested_date) },
            { key: 'last_working_date', header: 'Last Day', render: (r) => formatDate(r.last_working_date) },
            { key: 'notice_given', header: 'Notice', render: (r) => r.notice_given ? <span className="badge-success">Given</span> : <span className="badge-warning">Not given</span> },
            { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          ]}
          data={requests}
          loading={loading}
          emptyMessage="No exit requests recorded."
          actions={(r) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(r); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              <button onClick={() => setDeleteTarget({ id: r.id, name: 'exit request', type: 'request' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ) : null}
        />
      )}

      {tab === 'interviews' && (
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (i) => i.employee ? fullName(i.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'interview_date', header: 'Date', render: (i) => formatDate(i.interview_date) },
            { key: 'reason_for_leaving', header: 'Reason', render: (i) => i.reason_for_leaving ?? '—' },
            { key: 'satisfaction_rating', header: 'Rating', render: (i) => i.satisfaction_rating ? `${i.satisfaction_rating}/5` : '—' },
            { key: 'would_recommend', header: 'Recommend', render: (i) => i.would_recommend === null ? '—' : i.would_recommend ? 'Yes' : 'No' },
          ]}
          data={interviews}
          loading={loading}
          emptyMessage="No exit interviews recorded."
          actions={(i) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(i); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              <button onClick={() => setDeleteTarget({ id: i.id, name: 'interview', type: 'interview' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ) : null}
        />
      )}

      {tab === 'clearances' && (
        loading ? <LoadingSpinner /> :
        clearances.length === 0 ? <EmptyState icon={<CheckCircle2 size={48} />} title="No clearances" description="Add clearance items for departing employees" /> :
        <div className="space-y-3">
          {clearances.map((c) => (
            <div key={c.id} className="card-hover flex items-center gap-4 p-4">
              {c.status === 'completed' ? <CheckCircle2 size={20} className="text-green-600" /> : <Circle size={20} className="text-slate-300" />}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{c.clearance_item}</p>
                <p className="text-sm text-slate-500">{c.employee ? fullName(c.employee as unknown as { first_name: string; last_name: string }) : '—'} · {c.department ?? '—'}</p>
              </div>
              <StatusBadge status={c.status} />
              {canManage && (
                <div className="flex gap-1">
                  <button onClick={() => { setEditingItem(c); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
                  <button onClick={() => setDeleteTarget({ id: c.id, name: c.clearance_item, type: 'clearance' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'settlements' && (
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (s) => s.employee ? fullName(s.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'salary_due', header: 'Salary Due', render: (s) => formatCurrency(s.salary_due) },
            { key: 'leave_encashment', header: 'Leave Encashment', render: (s) => formatCurrency(s.leave_encashment) },
            { key: 'total_earnings', header: 'Total Earnings', render: (s) => formatCurrency(s.total_earnings) },
            { key: 'total_deductions', header: 'Deductions', render: (s) => formatCurrency(s.total_deductions) },
            { key: 'net_settlement', header: 'Net Settlement', render: (s) => <span className="font-semibold text-slate-900">{formatCurrency(s.net_settlement)}</span> },
            { key: 'status', header: 'Status', render: (s) => <StatusBadge status={s.status} /> },
          ]}
          data={settlements}
          loading={loading}
          emptyMessage="No final settlements recorded."
          actions={(s) => canFinance ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(s); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              <button onClick={() => setDeleteTarget({ id: s.id, name: 'settlement', type: 'settlement' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ) : null}
        />
      )}

      {modalOpen && (
        <ExitModal type={tab} item={editingItem} employees={employees} requests={requests} onClose={() => { setModalOpen(false); setEditingItem(null); }} onSaved={() => { setModalOpen(false); setEditingItem(null); fetchData(); }} />
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => {
        if (!deleteTarget) return;
        const tableMap: Record<string, string> = { request: 'exit_requests', interview: 'exit_interviews', clearance: 'exit_clearances', settlement: 'final_settlements' };
        await supabase.from(tableMap[deleteTarget.type]).delete().eq('id', deleteTarget.id);
        await logAudit('delete', deleteTarget.type, deleteTarget.id, deleteTarget.name);
        fetchData();
      }} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"?`} confirmLabel="Delete" danger />
    </div>
  );
}

function ExitModal({ type, item, employees, requests, onClose, onSaved }: {
  type: 'requests' | 'interviews' | 'clearances' | 'settlements';
  item: ExitRequest | ExitInterview | ExitClearance | FinalSettlement | null;
  employees: Employee[];
  requests: ExitRequest[];
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
      if (type === 'requests') setForm({ employee_id: '', exit_type: 'resignation', requested_date: new Date().toISOString().split('T')[0], last_working_date: '', reason: '', notice_given: 'true', notice_period_days: '30', status: 'pending' });
      else if (type === 'interviews') setForm({ exit_request_id: '', employee_id: '', interview_date: new Date().toISOString().split('T')[0], reason_for_leaving: '', satisfaction_rating: '', would_recommend: 'true', feedback: '', suggestions: '' });
      else if (type === 'clearances') setForm({ exit_request_id: '', employee_id: '', clearance_item: '', department: '', status: 'pending', notes: '' });
      else setForm({ exit_request_id: '', employee_id: '', salary_due: '0', leave_encashment: '0', bonuses: '0', total_earnings: '0', total_deductions: '0', net_settlement: '0', currency: 'RWF', status: 'pending', notes: '' });
    }
  }, [item, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tableMap: Record<string, string> = { requests: 'exit_requests', interviews: 'exit_interviews', clearances: 'exit_clearances', settlements: 'final_settlements' };
      const table = tableMap[type];
      const payload: Record<string, unknown> = { ...form };
      if (type === 'interviews') { payload.satisfaction_rating = form.satisfaction_rating ? Number(form.satisfaction_rating) : null; payload.would_recommend = form.would_recommend === 'true'; }
      if (type === 'requests') { payload.notice_given = form.notice_given === 'true'; payload.notice_period_days = form.notice_period_days ? Number(form.notice_period_days) : null; }
      if (type === 'settlements') { ['salary_due', 'leave_encashment', 'bonuses', 'total_earnings', 'total_deductions', 'net_settlement'].forEach((k) => { payload[k] = Number(form[k]) || 0; }); }
      ['employee_id', 'exit_request_id', 'responsible_person_id'].forEach((k) => { if (payload[k] === '') payload[k] = null; });

      if (item) {
        await supabase.from(table).update(payload).eq('id', (item as { id: string }).id);
        await logAudit('update', type, (item as { id: string }).id, type);
      } else {
        const { data } = await supabase.from(table).insert(payload).select().single();
        if (data) await logAudit('create', type, data.id, type);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const title = type === 'requests' ? (item ? 'Edit Request' : 'Add Exit Request') : type === 'interviews' ? (item ? 'Edit Interview' : 'Add Exit Interview') : type === 'clearances' ? (item ? 'Edit Clearance' : 'Add Clearance') : (item ? 'Edit Settlement' : 'Add Settlement');

  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="lg">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'requests' && (
          <>
            <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            <div className="form-grid">
              <div><label className="label">Exit Type</label><select className="input" value={form.exit_type || 'resignation'} onChange={(e) => setForm({ ...form, exit_type: e.target.value })}>{EXIT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="label">Status</label><select className="input" value={form.status || 'pending'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{EXIT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Requested Date</label><input type="date" className="input" value={form.requested_date || ''} onChange={(e) => setForm({ ...form, requested_date: e.target.value })} /></div>
              <div><label className="label">Last Working Date *</label><input type="date" className="input" value={form.last_working_date || ''} onChange={(e) => setForm({ ...form, last_working_date: e.target.value })} required /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Notice Given</label><select className="input" value={form.notice_given || 'true'} onChange={(e) => setForm({ ...form, notice_given: e.target.value })}><option value="true">Yes</option><option value="false">No</option></select></div>
              <div><label className="label">Notice Period (days)</label><input type="number" className="input" value={form.notice_period_days || ''} onChange={(e) => setForm({ ...form, notice_period_days: e.target.value })} /></div>
            </div>
            <div><label className="label">Reason</label><textarea className="input" rows={3} value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          </>
        )}
        {type === 'interviews' && (
          <>
            <div className="form-grid">
              <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
              <div><label className="label">Interview Date</label><input type="date" className="input" value={form.interview_date || ''} onChange={(e) => setForm({ ...form, interview_date: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Satisfaction (1-5)</label><select className="input" value={form.satisfaction_rating || ''} onChange={(e) => setForm({ ...form, satisfaction_rating: e.target.value })}><option value="">Not rated</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
              <div><label className="label">Would Recommend</label><select className="input" value={form.would_recommend || 'true'} onChange={(e) => setForm({ ...form, would_recommend: e.target.value })}><option value="true">Yes</option><option value="false">No</option></select></div>
            </div>
            <div><label className="label">Reason for Leaving</label><textarea className="input" rows={2} value={form.reason_for_leaving || ''} onChange={(e) => setForm({ ...form, reason_for_leaving: e.target.value })} /></div>
            <div><label className="label">Feedback</label><textarea className="input" rows={3} value={form.feedback || ''} onChange={(e) => setForm({ ...form, feedback: e.target.value })} /></div>
            <div><label className="label">Suggestions</label><textarea className="input" rows={2} value={form.suggestions || ''} onChange={(e) => setForm({ ...form, suggestions: e.target.value })} /></div>
          </>
        )}
        {type === 'clearances' && (
          <>
            <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            <div><label className="label">Clearance Item *</label><input className="input" value={form.clearance_item || ''} onChange={(e) => setForm({ ...form, clearance_item: e.target.value })} required placeholder="e.g. Return laptop, Hand over files" /></div>
            <div className="form-grid">
              <div><label className="label">Department</label><input className="input" value={form.department || ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
              <div><label className="label">Status</label><select className="input" value={form.status || 'pending'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{CLEARANCE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></div>
            </div>
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </>
        )}
        {type === 'settlements' && (
          <>
            <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            <div className="form-grid">
              <div><label className="label">Salary Due (RWF)</label><input type="number" className="input" value={form.salary_due || '0'} onChange={(e) => setForm({ ...form, salary_due: e.target.value })} /></div>
              <div><label className="label">Leave Encashment (RWF)</label><input type="number" className="input" value={form.leave_encashment || '0'} onChange={(e) => setForm({ ...form, leave_encashment: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Bonuses (RWF)</label><input type="number" className="input" value={form.bonuses || '0'} onChange={(e) => setForm({ ...form, bonuses: e.target.value })} /></div>
              <div><label className="label">Total Deductions (RWF)</label><input type="number" className="input" value={form.total_deductions || '0'} onChange={(e) => setForm({ ...form, total_deductions: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Total Earnings (RWF)</label><input type="number" className="input" value={form.total_earnings || '0'} onChange={(e) => setForm({ ...form, total_earnings: e.target.value })} /></div>
              <div><label className="label">Net Settlement (RWF)</label><input type="number" className="input" value={form.net_settlement || '0'} onChange={(e) => setForm({ ...form, net_settlement: e.target.value })} /></div>
            </div>
            <div><label className="label">Status</label><select className="input" value={form.status || 'pending'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{SETTLEMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
