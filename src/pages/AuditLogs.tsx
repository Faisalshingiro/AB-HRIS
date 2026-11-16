import { useEffect, useState, useCallback } from 'react';
import { FileText, Download, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, DataTable } from '@/components/ui';
import { exportToExcel } from '@/lib/export';
import { formatDateTime } from '@/lib/utils';
import type { AuditLog } from '@/types';

export function AuditLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (search) query = query.or(`user_email.ilike.%${search}%,action.ilike.%${search}%,entity_name.ilike.%${search}%`);
    if (actionFilter) query = query.eq('action', actionFilter);
    if (entityFilter) query = query.eq('entity_type', entityFilter);
    const { data } = await query;
    setLogs((data as AuditLog[]) ?? []);
    setLoading(false);
  }, [search, actionFilter, entityFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = () => {
    const cols = [
      { header: 'Timestamp', key: 'created_at', format: (v: unknown) => formatDateTime(v as string) },
      { header: 'User', key: 'user_email' },
      { header: 'Action', key: 'action' },
      { header: 'Entity Type', key: 'entity_type' },
      { header: 'Entity Name', key: 'entity_name', format: (v: unknown) => v as string || '—' },
    ];
    exportToExcel('audit_logs', 'Audit Logs', cols, logs as unknown as Record<string, unknown>[]);
  };

  const actions = [...new Set(logs.map((l) => l.action))];
  const entities = [...new Set(logs.map((l) => l.entity_type))];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Audit Logs"
        description="System activity log tracking all significant actions and changes"
        actions={<button onClick={handleExport} className="btn-secondary btn-sm"><Download size={16} /> Excel</button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by user, action, or entity..." className="input pl-10" />
        </div>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input sm:w-40">
          <option value="">All Actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="input sm:w-40">
          <option value="">All Entities</option>
          {entities.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'created_at', header: 'Timestamp', render: (l) => <span className="text-xs text-slate-600">{formatDateTime(l.created_at)}</span> },
          { key: 'user_email', header: 'User', render: (l) => l.user_email ?? '—' },
          { key: 'action', header: 'Action', render: (l) => <span className={`badge ${l.action === 'delete' ? 'badge-danger' : l.action === 'create' ? 'badge-success' : 'badge-info'}`}>{l.action}</span> },
          { key: 'entity_type', header: 'Entity', render: (l) => l.entity_type },
          { key: 'entity_name', header: 'Name', render: (l) => l.entity_name ?? '—' },
        ]}
        data={logs}
        loading={loading}
        emptyMessage="No audit logs found."
      />
    </div>
  );
}
