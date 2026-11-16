import { useEffect, useState, useCallback } from 'react';
import { Plus, UserPlus, FileText, CheckCircle2, Circle, Clock, Edit, Trash2, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, DataTable, Modal, StatusBadge, ConfirmDialog, EmptyState } from '@/components/ui';
import { formatDate, isHrOrAdmin, logAudit, fullName } from '@/lib/utils';
import type { OnboardingTask, EmployeeDocument, EmploymentContract, Employee } from '@/types';

const TASK_TYPES = ['general', 'document', 'training', 'it_setup', 'orientation', 'policy'];
const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'skipped'];
const DOC_TYPES = ['contract', 'national_id', 'passport', 'diploma', 'certificate', 'medical', 'bank_details', 'other'];
const DOC_STATUSES = ['pending', 'verified', 'rejected'];
const CONTRACT_TYPES = ['permanent', 'fixed_term', 'probation', 'internship', 'consultancy'];
const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated', 'renewed'];

export function Onboarding() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'employee';
  const canManage = isHrOrAdmin(role);

  const [tab, setTab] = useState<'tasks' | 'documents' | 'contracts'>('tasks');
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [contracts, setContracts] = useState<EmploymentContract[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OnboardingTask | EmployeeDocument | EmploymentContract | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [taskData, docData, contractData, empData] = await Promise.all([
      supabase.from('onboarding_tasks').select('*, employee:employees(first_name, last_name, employee_number)').order('created_at', { ascending: false }),
      supabase.from('employee_documents').select('*, employee:employees(first_name, last_name, employee_number)').order('created_at', { ascending: false }),
      supabase.from('employment_contracts').select('*, employee:employees(first_name, last_name, employee_number)').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name, employee_number').order('first_name'),
    ]);
    setTasks((taskData.data as OnboardingTask[]) ?? []);
    setDocuments((docData.data as EmployeeDocument[]) ?? []);
    setContracts((contractData.data as EmploymentContract[]) ?? []);
    setEmployees((empData.data as Employee[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const taskIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle2 size={18} className="text-green-600" />;
    if (status === 'in_progress') return <Clock size={18} className="text-amber-600" />;
    return <Circle size={18} className="text-slate-300" />;
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Onboarding"
        description="Employee registration, document uploads, employment contracts, and onboarding workflows"
        actions={canManage && <button onClick={() => { setEditingItem(null); setModalOpen(true); }} className="btn-primary btn-sm"><Plus size={16} /> {tab === 'tasks' ? 'Add Task' : tab === 'documents' ? 'Add Document' : 'Add Contract'}</button>}
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {(['tasks', 'documents', 'contracts'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {t} ({t === 'tasks' ? tasks.length : t === 'documents' ? documents.length : contracts.length})
          </button>
        ))}
      </div>

      {tab === 'tasks' && (
        loading ? <LoadingSpinner /> :
        tasks.length === 0 ? <EmptyState icon={<UserPlus size={48} />} title="No onboarding tasks" description="Add onboarding tasks for new employees" /> :
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="card-hover flex items-center gap-4 p-4">
              {taskIcon(task.status)}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{task.title}</p>
                <p className="text-sm text-slate-500">{task.employee ? fullName(task.employee as unknown as { first_name: string; last_name: string }) : '—'} · {task.task_type}</p>
              </div>
              <div className="flex items-center gap-3">
                {task.due_date && <span className="text-xs text-slate-500">Due: {formatDate(task.due_date)}</span>}
                <StatusBadge status={task.status} />
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingItem(task); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
                    <button onClick={() => setDeleteTarget({ id: task.id, name: task.title, type: 'task' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'documents' && (
        <DataTable
          columns={[
            { key: 'title', header: 'Title', render: (d) => <span className="font-medium text-slate-900">{d.title}</span> },
            { key: 'employee', header: 'Employee', render: (d) => d.employee ? fullName(d.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'document_type', header: 'Type', render: (d) => <span className="badge-neutral">{d.document_type.replace(/_/g, ' ')}</span> },
            { key: 'file_name', header: 'File', render: (d) => d.file_name ?? '—' },
            { key: 'created_at', header: 'Uploaded', render: (d) => formatDate(d.created_at) },
            { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
          ]}
          data={documents}
          loading={loading}
          emptyMessage="No documents uploaded yet."
          actions={(d) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(d); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              <button onClick={() => setDeleteTarget({ id: d.id, name: d.title, type: 'document' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ) : null}
        />
      )}

      {tab === 'contracts' && (
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (c) => c.employee ? fullName(c.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'contract_type', header: 'Type', render: (c) => <span className="badge-neutral">{c.contract_type.replace(/_/g, ' ')}</span> },
            { key: 'start_date', header: 'Start', render: (c) => formatDate(c.start_date) },
            { key: 'end_date', header: 'End', render: (c) => formatDate(c.end_date) },
            { key: 'salary', header: 'Salary', render: (c) => `${new Intl.NumberFormat('en-RW').format(c.salary)} ${c.currency}` },
            { key: 'status', header: 'Status', render: (c) => <StatusBadge status={c.status} /> },
          ]}
          data={contracts}
          loading={loading}
          emptyMessage="No contracts created yet."
          actions={(c) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(c); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              <button onClick={() => setDeleteTarget({ id: c.id, name: 'contract', type: 'contract' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ) : null}
        />
      )}

      {modalOpen && (
        <OnboardingModal
          type={tab}
          item={editingItem}
          employees={employees}
          onClose={() => { setModalOpen(false); setEditingItem(null); }}
          onSaved={() => { setModalOpen(false); setEditingItem(null); fetchData(); }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const table = deleteTarget.type === 'task' ? 'onboarding_tasks' : deleteTarget.type === 'document' ? 'employee_documents' : 'employment_contracts';
          await supabase.from(table).delete().eq('id', deleteTarget.id);
          await logAudit('delete', deleteTarget.type, deleteTarget.id, deleteTarget.name);
          fetchData();
        }}
        title="Confirm Delete"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

function OnboardingModal({ type, item, employees, onClose, onSaved }: {
  type: 'tasks' | 'documents' | 'contracts';
  item: OnboardingTask | EmployeeDocument | EmploymentContract | null;
  employees: Employee[];
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
      if (type === 'tasks') setForm({ employee_id: '', title: '', description: '', task_type: 'general', status: 'pending', due_date: '' });
      else if (type === 'documents') setForm({ employee_id: '', document_type: 'contract', title: '', file_url: '', file_name: '', status: 'pending' });
      else setForm({ employee_id: '', contract_type: 'permanent', start_date: new Date().toISOString().split('T')[0], end_date: '', salary: '', currency: 'RWF', status: 'active', terms: '', document_url: '', signed_date: '' });
    }
  }, [item, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const table = type === 'tasks' ? 'onboarding_tasks' : type === 'documents' ? 'employee_documents' : 'employment_contracts';
      const payload: Record<string, unknown> = { ...form };
      if (type === 'contracts') { payload.salary = Number(form.salary) || 0; }
      ['employee_id', 'due_date', 'end_date', 'file_url', 'document_url', 'signed_date', 'assigned_to'].forEach((k) => { if (payload[k] === '') payload[k] = null; });

      if (item) {
        await supabase.from(table).update(payload).eq('id', (item as { id: string }).id);
        await logAudit('update', type, (item as { id: string }).id, form.title || 'contract');
      } else {
        const { data } = await supabase.from(table).insert(payload).select().single();
        if (data) await logAudit('create', type, data.id, form.title || 'contract');
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const title = type === 'tasks' ? (item ? 'Edit Task' : 'Add Task') : type === 'documents' ? (item ? 'Edit Document' : 'Add Document') : (item ? 'Edit Contract' : 'Add Contract');

  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="lg">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
        {type === 'tasks' && (
          <>
            <div><label className="label">Title *</label><input className="input" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="form-grid">
              <div><label className="label">Task Type</label><select className="input" value={form.task_type || 'general'} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>{TASK_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="label">Status</label><select className="input" value={form.status || 'pending'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{TASK_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></div>
            </div>
            <div><label className="label">Due Date</label><input type="date" className="input" value={form.due_date || ''} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          </>
        )}
        {type === 'documents' && (
          <>
            <div><label className="label">Title *</label><input className="input" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="form-grid">
              <div><label className="label">Document Type</label><select className="input" value={form.document_type || 'contract'} onChange={(e) => setForm({ ...form, document_type: e.target.value })}>{DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="label">Status</label><select className="input" value={form.status || 'pending'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{DOC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div><label className="label">File Name</label><input className="input" value={form.file_name || ''} onChange={(e) => setForm({ ...form, file_name: e.target.value })} /></div>
            <div><label className="label">File URL</label><input className="input" value={form.file_url || ''} onChange={(e) => setForm({ ...form, file_url: e.target.value })} placeholder="https://..." /></div>
          </>
        )}
        {type === 'contracts' && (
          <>
            <div className="form-grid">
              <div><label className="label">Contract Type</label><select className="input" value={form.contract_type || 'permanent'} onChange={(e) => setForm({ ...form, contract_type: e.target.value })}>{CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="label">Status</label><select className="input" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Start Date *</label><input type="date" className="input" value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required /></div>
              <div><label className="label">End Date</label><input type="date" className="input" value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Salary *</label><input type="number" className="input" value={form.salary || ''} onChange={(e) => setForm({ ...form, salary: e.target.value })} required /></div>
              <div><label className="label">Currency</label><select className="input" value={form.currency || 'RWF'} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="RWF">RWF</option><option value="USD">USD</option><option value="EUR">EUR</option></select></div>
            </div>
            <div><label className="label">Terms</label><textarea className="input" rows={3} value={form.terms || ''} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></div>
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
