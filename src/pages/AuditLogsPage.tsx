import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarClock, RefreshCw, ScrollText, Search, ShieldAlert, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ExportMenu } from '@/components/common/ExportMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import type { ExportColumn } from '@/lib/export';
import { formatDateTime, titleCase, todayISO } from '@/lib/format';
import { auditApi } from '@/services/api';
import type { AuditLog } from '@/types/types';

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

const detailsText = (log: AuditLog): string => {
  if (!log.details) return '';
  try {
    return JSON.stringify(log.details);
  } catch {
    return '';
  }
};

export default function AuditLogsPage() {
  const { isAdmin, isHR } = useAuth();
  const allowed = isAdmin || isHR;

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [entityOptions, setEntityOptions] = useState<string[]>([]);

  const load = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const rows = await auditApi.list({ search: term.trim() || undefined, limit: 300 });
      setLogs(rows);
      setEntityOptions((current) => Array.from(new Set([...current, ...rows.map((row) => row.entity)])).sort());
    } catch (error) {
      toast.error('Could not load the audit trail', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      void load(search);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [allowed, search, load]);

  const filtered = useMemo(
    () => (entityFilter === 'all' ? logs : logs.filter((log) => log.entity === entityFilter)),
    [logs, entityFilter],
  );

  const stats = useMemo(() => {
    const today = todayISO();
    return {
      total: logs.length,
      today: logs.filter((log) => log.created_at.slice(0, 10) === today).length,
      actors: new Set(logs.map((log) => log.actor_id ?? log.actor_name ?? 'system')).size,
      payroll: logs.filter((log) => log.entity.startsWith('payroll') || log.action.startsWith('payroll')).length,
    };
  }, [logs]);

  const exportColumns = useMemo<ExportColumn<AuditLog>[]>(
    () => [
      { header: 'Timestamp', accessor: (row) => formatDateTime(row.created_at) },
      { header: 'Actor', accessor: (row) => row.actor_name ?? 'System' },
      { header: 'Role', accessor: (row) => (row.actor_role ? titleCase(row.actor_role) : '') },
      { header: 'Action', accessor: (row) => row.action },
      { header: 'Entity', accessor: (row) => row.entity },
      { header: 'Entity id', accessor: (row) => row.entity_id ?? '' },
      { header: 'Details', accessor: (row) => detailsText(row) },
    ],
    [],
  );

  if (!allowed) {
    return (
      <div>
        <PageHeader
          eyebrow="Governance"
          title="Audit logs"
          description="A tamper-evident record of every change made across the HRIS."
        />
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={ShieldAlert}
            title="Restricted access"
            description="The audit trail is available to administrators and HR officers only. Contact an administrator if you need an extract for an investigation."
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Governance"
        title="Audit logs"
        description="Every create, update and deletion across the HRIS, with the actor, the entity and the payload that changed."
        actions={
          <>
            <ExportMenu
              filename="audit-trail"
              title="Audit trail"
              subtitle={`${filtered.length} event${filtered.length === 1 ? '' : 's'}`}
              columns={exportColumns}
              rows={filtered}
            />
            <Button variant="outline" onClick={() => void load(search)} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </>
        }
      />

      <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)
        ) : (
          <>
            <StatCard label="Total events" value={stats.total} hint="In the current view" icon={Activity} />
            <StatCard label="Events today" value={stats.today} hint="Since midnight" icon={CalendarClock} tone="accent" />
            <StatCard label="Distinct actors" value={stats.actors} hint="People and system jobs" icon={Users} />
            <StatCard label="Payroll events" value={stats.payroll} hint="Runs, items and payments" icon={Wallet} />
          </>
        )}
      </section>

      <section className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative md:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search action, entity or actor"
              className="pl-9"
              aria-label="Search audit events"
            />
          </div>
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-full md:w-52">
              <SelectValue placeholder="All entity types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entity types</SelectItem>
              {entityOptions.map((entity) => (
                <SelectItem key={entity} value={entity}>
                  {titleCase(entity)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          {filtered.length} of {logs.length} event{logs.length === 1 ? '' : 's'} shown
        </p>
      </section>

      {loading ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={ScrollText}
            title={logs.length === 0 ? 'No audit events found' : 'No events match this entity filter'}
            description={
              logs.length === 0
                ? 'Changes made in the system will be recorded here automatically. Try a different search term.'
                : 'Choose another entity type to widen the view.'
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/60">
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Timestamp</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Actor</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Role</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Action</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Entity</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Entity id</th>
                <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {formatDateTime(log.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                    {log.actor_name ?? 'System'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {log.actor_role ? (
                      <StatusBadge status={log.actor_role} label={titleCase(log.actor_role)} tone="neutral" />
                    ) : (
                      <span className="text-xs text-muted-foreground"></span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-mono text-xs text-foreground">{log.action}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{titleCase(log.entity)}</td>
                  <td className="max-w-[10rem] truncate whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                    {log.entity_id ?? ''}
                  </td>
                  <td
                    className="max-w-[18rem] truncate whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground"
                    title={detailsText(log)}
                  >
                    {detailsText(log)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
