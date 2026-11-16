import { useEffect, useState, useCallback } from 'react';
import { Plus, Settings as SettingsIcon, Edit, Trash2, Calendar, DollarSign, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, DataTable, Modal, StatusBadge, ConfirmDialog, StatCard } from '@/components/ui';
import { isHrOrAdmin, logAudit } from '@/lib/utils';
import type { LeaveType, Allowance, Deduction } from '@/types';

export function Settings() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'employee';
  const canManage = isHrOrAdmin(role);

  const [tab, setTab] = useState<'leave_types' | 'system'>('leave_types');
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LeaveType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('leave_types').select('*').order('name');
    setLeaveTypes((data as LeaveType[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Configure leave types, allowances, deductions, and system preferences" actions={canManage && tab === 'leave_types' && <button onClick={() => { setEditingItem(null); setModalOpen(true); }} className="btn-primary btn-sm"><Plus size={16} /> Add Leave Type</button>} />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {(['leave_types', 'system'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{t.replace(/_/g, ' ')}</button>
        ))}
      </div>

      {tab === 'leave_types' && (
        loading ? <LoadingSpinner /> :
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leaveTypes.map((lt) => (
            <div key={lt.id} className="card-hover p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg" style={{ backgroundColor: lt.color ?? '#3b82f6' }} />
                  <div>
                    <h3 className="font-semibold text-slate-900">{lt.name}</h3>
                    <p className="text-xs text-slate-500">{lt.code}</p>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingItem(lt); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
                    <button onClick={() => setDeleteTarget({ id: lt.id, name: lt.name })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
              {lt.description && <p className="mt-3 text-sm text-slate-600">{lt.description}</p>}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs">
                <span className="badge-neutral">{lt.default_days} days</span>
                {lt.is_paid && <span className="badge-success">Paid</span>}
                {lt.requires_approval && <span className="badge-info">Approval required</span>}
                {lt.carry_forward && <span className="badge-warning">Carry forward</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="System Version" value="1.0.0" icon={<SettingsIcon size={24} />} color="blue" />
            <StatCard label="Tender Reference" value="010/2026" icon={<Building2 size={24} />} color="teal" />
            <StatCard label="Organization" value="AB Rwanda PLC" icon={<Building2 size={24} />} color="green" />
          </div>

          <div className="card p-6">
            <h3 className="mb-4 font-semibold text-slate-900">System Information</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoRow label="System Name" value="AB Rwanda HRIS" />
              <InfoRow label="Version" value="1.0.0" />
              <InfoRow label="Tender Reference" value="010/2026" />
              <InfoRow label="Implementation Period" value="90 days" />
              <InfoRow label="Currency" value="RWF (Rwandan Franc)" />
              <InfoRow label="Country" value="Rwanda" />
              <InfoRow label="Database" value="Supabase (PostgreSQL)" />
              <InfoRow label="Compliance" value="Rwandan Data Protection & Employment Law" />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-4 font-semibold text-slate-900">Modules</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {['Recruitment', 'Onboarding', 'Employee Mgmt', 'Performance', 'Development', 'Payroll', 'Succession', 'Exit'].map((m) => (
                <div key={m} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <div className="h-2 w-2 rounded-full bg-green-500" /> {m}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="mb-4 font-semibold text-slate-900">Role-Based Access</h3>
            <div className="space-y-2">
              {['System Administrator', 'HR Administrator', 'HR Officer', 'Department Manager', 'Finance Officer', 'Employee'].map((r) => (
                <div key={r} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2">
                  <span className="text-sm font-medium text-slate-700">{r}</span>
                  <span className="badge-success">Active</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalOpen && <LeaveTypeModal item={editingItem} onClose={() => { setModalOpen(false); setEditingItem(null); }} onSaved={() => { setModalOpen(false); setEditingItem(null); fetchData(); }} />}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => {
        if (!deleteTarget) return;
        await supabase.from('leave_types').delete().eq('id', deleteTarget.id);
        await logAudit('delete', 'leave_type', deleteTarget.id, deleteTarget.name);
        fetchData();
      }} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"?`} confirmLabel="Delete" danger />
    </div>
  );
}

function LeaveTypeModal({ item, onClose, onSaved }: { item: LeaveType | null; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (item) {
      const obj: Record<string, string> = {};
      Object.keys(item).forEach((k) => { const val = (item as Record<string, unknown>)[k]; obj[k] = val === null || val === undefined ? '' : String(val); });
      setForm(obj);
    } else {
      setForm({ name: '', code: '', description: '', default_days: '0', is_paid: 'true', requires_approval: 'true', carry_forward: 'false', color: '#3b82f6' });
    }
  }, [item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, default_days: Number(form.default_days) || 0, is_paid: form.is_paid === 'true', requires_approval: form.requires_approval === 'true', carry_forward: form.carry_forward === 'true' };
      if (item) {
        await supabase.from('leave_types').update(payload).eq('id', item.id);
        await logAudit('update', 'leave_type', item.id, form.name);
      } else {
        const { data } = await supabase.from('leave_types').insert(payload).select().single();
        if (data) await logAudit('create', 'leave_type', data.id, form.name);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={item ? 'Edit Leave Type' : 'Add Leave Type'} size="md">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-grid">
          <div><label className="label">Name *</label><input className="input" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Code *</label><input className="input" value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value })} required placeholder="LT-001" /></div>
        </div>
        <div><label className="label">Description</label><input className="input" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="form-grid">
          <div><label className="label">Default Days</label><input type="number" className="input" value={form.default_days || '0'} onChange={(e) => setForm({ ...form, default_days: e.target.value })} /></div>
          <div><label className="label">Color</label><input type="color" className="input h-10" value={form.color || '#3b82f6'} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
        </div>
        <div className="form-grid">
          <div><label className="label">Paid</label><select className="input" value={form.is_paid || 'true'} onChange={(e) => setForm({ ...form, is_paid: e.target.value })}><option value="true">Yes</option><option value="false">No</option></select></div>
          <div><label className="label">Requires Approval</label><select className="input" value={form.requires_approval || 'true'} onChange={(e) => setForm({ ...form, requires_approval: e.target.value })}><option value="true">Yes</option><option value="false">No</option></select></div>
        </div>
        <div><label className="label">Carry Forward</label><select className="input" value={form.carry_forward || 'false'} onChange={(e) => setForm({ ...form, carry_forward: e.target.value })}><option value="false">No</option><option value="true">Yes</option></select></div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-slate-100 py-2"><span className="text-sm text-slate-500">{label}</span><span className="text-sm font-medium text-slate-900">{value}</span></div>;
}

function LoadingSpinner() {
  return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
}
