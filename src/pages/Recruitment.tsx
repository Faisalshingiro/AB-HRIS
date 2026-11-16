import { useEffect, useState, useCallback } from 'react';
import { Plus, Briefcase, Users, Calendar, Download, FileText, Eye, Edit, Trash2, Video } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, DataTable, Modal, StatusBadge, ConfirmDialog, EmptyState } from '@/components/ui';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { formatDate, canManageRecruitment, isHrOrAdmin, logAudit, fullName } from '@/lib/utils';
import type { JobVacancy, JobApplication, Interview, Department, Position, Employee } from '@/types';

const VACANCY_STATUSES = ['draft', 'open', 'closed', 'cancelled'];
const APPLICATION_STATUSES = ['submitted', 'reviewing', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected', 'withdrawn'];

export function Recruitment() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'employee';
  const canManage = canManageRecruitment(role);

  const [tab, setTab] = useState<'vacancies' | 'applications' | 'interviews'>('vacancies');
  const [vacancies, setVacancies] = useState<JobVacancy[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<JobVacancy | JobApplication | Interview | null>(null);
  const [viewingApp, setViewingApp] = useState<JobApplication | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [vacData, appData, intData, deptData, posData, empData] = await Promise.all([
      supabase.from('job_vacancies').select('*, position:positions(*), department:departments(*)').order('created_at', { ascending: false }),
      supabase.from('job_applications').select('*, vacancy:job_vacancies(title), interviews(*)').order('created_at', { ascending: false }),
      supabase.from('interviews').select('*, application:job_applications(first_name, last_name), interviewer:employees(first_name, last_name)').order('interview_date', { ascending: false }),
      supabase.from('departments').select('*').order('name'),
      supabase.from('positions').select('*').order('title'),
      supabase.from('employees').select('id, first_name, last_name').order('first_name'),
    ]);
    setVacancies((vacData.data as JobVacancy[]) ?? []);
    setApplications((appData.data as JobApplication[]) ?? []);
    setInterviews((intData.data as Interview[]) ?? []);
    setDepartments((deptData.data as Department[]) ?? []);
    setPositions((posData.data as Position[]) ?? []);
    setEmployees((empData.data as Employee[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = (format: 'excel' | 'pdf') => {
    if (tab === 'vacancies') {
      const cols = [
        { header: 'Title', key: 'title' },
        { header: 'Department', key: 'department', format: (_v: unknown, r: Record<string, unknown>) => (r.department as { name?: string })?.name ?? '—' },
        { header: 'Type', key: 'vacancy_type' },
        { header: 'Status', key: 'status' },
        { header: 'Openings', key: 'openings' },
        { header: 'Posted', key: 'posted_date', format: (v: unknown) => formatDate(v as string) },
        { header: 'Closing', key: 'closing_date', format: (v: unknown) => formatDate(v as string) },
      ];
      if (format === 'excel') exportToExcel('vacancies', 'Vacancies', cols, vacancies as unknown as Record<string, unknown>[]);
      else exportToPDF('vacancies', 'AB Rwanda PLC - Job Vacancies', cols, vacancies as unknown as Record<string, unknown>[]);
    } else if (tab === 'applications') {
      const cols = [
        { header: 'Name', key: 'first_name', format: (_v: unknown, r: Record<string, unknown>) => `${r.first_name} ${r.last_name}` },
        { header: 'Email', key: 'email' },
        { header: 'Phone', key: 'phone' },
        { header: 'Vacancy', key: 'vacancy', format: (_v: unknown, r: Record<string, unknown>) => (r.vacancy as { title?: string })?.title ?? '—' },
        { header: 'Experience', key: 'years_of_experience' },
        { header: 'Status', key: 'status' },
        { header: 'Applied', key: 'created_at', format: (v: unknown) => formatDate(v as string) },
      ];
      if (format === 'excel') exportToExcel('applications', 'Applications', cols, applications as unknown as Record<string, unknown>[]);
      else exportToPDF('applications', 'AB Rwanda PLC - Job Applications', cols, applications as unknown as Record<string, unknown>[]);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Recruitment"
        description="Manage job vacancies, applications, interviews, and hiring decisions"
        actions={
          <>
            <button onClick={() => handleExport('excel')} className="btn-secondary btn-sm"><Download size={16} /> Excel</button>
            <button onClick={() => handleExport('pdf')} className="btn-secondary btn-sm"><FileText size={16} /> PDF</button>
            {canManage && (
              <button onClick={() => { setEditingItem(null); setModalOpen(true); }} className="btn-primary btn-sm">
                <Plus size={16} /> {tab === 'vacancies' ? 'New Vacancy' : tab === 'applications' ? 'Add Application' : 'Schedule Interview'}
              </button>
            )}
          </>
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
        {(['vacancies', 'applications', 'interviews'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {t} {t === 'vacancies' && `(${vacancies.length})`} {t === 'applications' && `(${applications.length})`} {t === 'interviews' && `(${interviews.length})`}
          </button>
        ))}
      </div>

      {tab === 'vacancies' && (
        loading ? <LoadingSpinner /> :
        vacancies.length === 0 ? <EmptyState icon={<Briefcase size={48} />} title="No vacancies yet" description="Create a job vacancy to start recruiting" /> :
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {vacancies.map((v) => (
            <div key={v.id} className="card-hover p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Briefcase size={24} /></div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{v.title}</h3>
                    <p className="text-sm text-slate-500">{v.department?.name ?? '—'} · {v.position?.title ?? '—'}</p>
                  </div>
                </div>
                <StatusBadge status={v.status} />
              </div>
              {v.description && <p className="mt-3 text-sm text-slate-600 line-clamp-2">{v.description}</p>}
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex gap-4 text-xs text-slate-500">
                  <span><Users size={14} className="inline mr-1" />{v.openings} openings</span>
                  <span><Calendar size={14} className="inline mr-1" />{formatDate(v.posted_date)}</span>
                  <span>Closes: {formatDate(v.closing_date)}</span>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingItem(v); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
                    {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: v.id, name: v.title, type: 'vacancy' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'applications' && (
        <DataTable
          columns={[
            { key: 'name', header: 'Candidate', render: (a) => <span className="font-medium text-slate-900">{a.first_name} {a.last_name}</span> },
            { key: 'vacancy', header: 'Vacancy', render: (a) => a.vacancy?.title ?? '—' },
            { key: 'email', header: 'Email' },
            { key: 'phone', header: 'Phone', render: (a) => a.phone ?? '—' },
            { key: 'experience', header: 'Experience', render: (a) => a.years_of_experience ? `${a.years_of_experience} yrs` : '—' },
            { key: 'created_at', header: 'Applied', render: (a) => formatDate(a.created_at) },
            { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
          ]}
          data={applications}
          loading={loading}
          emptyMessage="No applications received yet."
          actions={(a) => (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => setViewingApp(a)} className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"><Eye size={16} /></button>
              {canManage && <button onClick={() => { setEditingItem(a); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>}
            </div>
          )}
        />
      )}

      {tab === 'interviews' && (
        <DataTable
          columns={[
            { key: 'candidate', header: 'Candidate', render: (i) => i.application ? `${(i.application as { first_name: string; last_name: string }).first_name} ${(i.application as { first_name: string; last_name: string }).last_name}` : '—' },
            { key: 'interview_date', header: 'Date', render: (i) => formatDate(i.interview_date) },
            { key: 'interview_time', header: 'Time', render: (i) => i.interview_time },
            { key: 'location', header: 'Location', render: (i) => i.location ?? '—' },
            { key: 'round', header: 'Round', render: (i) => `Round ${i.round}` },
            { key: 'interviewer', header: 'Interviewer', render: (i) => i.interviewer ? fullName(i.interviewer as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'status', header: 'Status', render: (i) => <StatusBadge status={i.status} /> },
          ]}
          data={interviews}
          loading={loading}
          emptyMessage="No interviews scheduled."
          actions={(i) => canManage ? (
            <button onClick={() => { setEditingItem(i); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
          ) : null}
        />
      )}

      {modalOpen && (
        <RecruitmentModal
          type={tab}
          item={editingItem}
          vacancies={vacancies}
          applications={applications}
          departments={departments}
          positions={positions}
          employees={employees}
          onClose={() => { setModalOpen(false); setEditingItem(null); }}
          onSaved={() => { setModalOpen(false); setEditingItem(null); fetchData(); }}
        />
      )}

      {viewingApp && (
        <Modal isOpen={true} onClose={() => setViewingApp(null)} title="Application Details" size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-xs text-slate-500">Name</p><p className="font-medium text-slate-900">{viewingApp.first_name} {viewingApp.last_name}</p></div>
              <div><p className="text-xs text-slate-500">Status</p><StatusBadge status={viewingApp.status} /></div>
              <div><p className="text-xs text-slate-500">Email</p><p className="font-medium text-slate-900">{viewingApp.email}</p></div>
              <div><p className="text-xs text-slate-500">Phone</p><p className="font-medium text-slate-900">{viewingApp.phone ?? '—'}</p></div>
              <div><p className="text-xs text-slate-500">Experience</p><p className="font-medium text-slate-900">{viewingApp.years_of_experience ? `${viewingApp.years_of_experience} years` : '—'}</p></div>
              <div><p className="text-xs text-slate-500">Expected Salary</p><p className="font-medium text-slate-900">{viewingApp.expected_salary ? `${viewingApp.expected_salary} RWF` : '—'}</p></div>
            </div>
            {viewingApp.cover_letter && <div><p className="text-xs text-slate-500 mb-1">Cover Letter</p><p className="text-sm text-slate-700 whitespace-pre-wrap rounded-lg bg-slate-50 p-3">{viewingApp.cover_letter}</p></div>}
            {viewingApp.notes && <div><p className="text-xs text-slate-500 mb-1">Notes</p><p className="text-sm text-slate-700 whitespace-pre-wrap rounded-lg bg-slate-50 p-3">{viewingApp.notes}</p></div>}
            {viewingApp.interviews && viewingApp.interviews.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Interviews</p>
                <div className="space-y-2">
                  {viewingApp.interviews.map((int) => (
                    <div key={int.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                      <span className="text-sm text-slate-700">Round {int.round} · {formatDate(int.interview_date)} at {int.interview_time}</span>
                      <StatusBadge status={int.status} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const table = deleteTarget.type === 'vacancy' ? 'job_vacancies' : deleteTarget.type === 'application' ? 'job_applications' : 'interviews';
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

function RecruitmentModal({ type, item, vacancies, applications, departments, positions, employees, onClose, onSaved }: {
  type: 'vacancies' | 'applications' | 'interviews';
  item: JobVacancy | JobApplication | Interview | null;
  vacancies: JobVacancy[];
  applications: JobApplication[];
  departments: Department[];
  positions: Position[];
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
      if (type === 'vacancies') setForm({ title: '', position_id: '', department_id: '', description: '', requirements: '', vacancy_type: 'internal', status: 'open', openings: '1', posted_date: new Date().toISOString().split('T')[0], closing_date: '' });
      else if (type === 'applications') setForm({ vacancy_id: '', first_name: '', last_name: '', email: '', phone: '', cover_letter: '', resume_url: '', status: 'submitted', current_employer: '', years_of_experience: '', expected_salary: '', notes: '' });
      else setForm({ application_id: '', vacancy_id: '', interview_date: new Date().toISOString().split('T')[0], interview_time: '09:00', location: '', interviewer_id: '', round: '1', status: 'scheduled', feedback: '', rating: '' });
    }
  }, [item, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const table = type === 'vacancies' ? 'job_vacancies' : type === 'applications' ? 'job_applications' : 'interviews';
      const payload: Record<string, unknown> = { ...form };
      // Convert numeric fields
      if (type === 'vacancies') { payload.openings = Number(form.openings) || 1; }
      if (type === 'applications') { payload.years_of_experience = form.years_of_experience ? Number(form.years_of_experience) : null; payload.expected_salary = form.expected_salary ? Number(form.expected_salary) : null; }
      if (type === 'interviews') { payload.round = Number(form.round) || 1; payload.rating = form.rating ? Number(form.rating) : null; }
      // Null out empty IDs
      ['position_id', 'department_id', 'vacancy_id', 'application_id', 'interviewer_id', 'closing_date', 'posted_date', 'resume_url'].forEach((k) => { if (payload[k] === '') payload[k] = null; });

      if (item) {
        await supabase.from(table).update(payload).eq('id', (item as { id: string }).id);
        await logAudit('update', type, (item as { id: string }).id, form.title || form.first_name || 'interview');
      } else {
        const { data } = await supabase.from(table).insert(payload).select().single();
        if (data) await logAudit('create', type, data.id, form.title || form.first_name || 'interview');
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const title = type === 'vacancies' ? (item ? 'Edit Vacancy' : 'New Vacancy') : type === 'applications' ? (item ? 'Edit Application' : 'Add Application') : (item ? 'Edit Interview' : 'Schedule Interview');

  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="lg">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'vacancies' && (
          <>
            <div><label className="label">Title *</label><input className="input" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div className="form-grid">
              <div><label className="label">Department</label><select className="input" value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: e.target.value })}><option value="">Select</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
              <div><label className="label">Position</label><select className="input" value={form.position_id || ''} onChange={(e) => setForm({ ...form, position_id: e.target.value })}><option value="">Select</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Type</label><select className="input" value={form.vacancy_type || 'internal'} onChange={(e) => setForm({ ...form, vacancy_type: e.target.value })}><option value="internal">Internal</option><option value="external">External</option></select></div>
              <div><label className="label">Status</label><select className="input" value={form.status || 'open'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{VACANCY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Openings</label><input type="number" className="input" value={form.openings || '1'} onChange={(e) => setForm({ ...form, openings: e.target.value })} min={1} /></div>
              <div><label className="label">Closing Date</label><input type="date" className="input" value={form.closing_date || ''} onChange={(e) => setForm({ ...form, closing_date: e.target.value })} /></div>
            </div>
            <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><label className="label">Requirements</label><textarea className="input" rows={3} value={form.requirements || ''} onChange={(e) => setForm({ ...form, requirements: e.target.value })} /></div>
          </>
        )}
        {type === 'applications' && (
          <>
            <div><label className="label">Vacancy *</label><select className="input" value={form.vacancy_id || ''} onChange={(e) => setForm({ ...form, vacancy_id: e.target.value })} required><option value="">Select</option>{vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}</select></div>
            <div className="form-grid">
              <div><label className="label">First Name *</label><input className="input" value={form.first_name || ''} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
              <div><label className="label">Last Name *</label><input className="input" value={form.last_name || ''} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Email *</label><input type="email" className="input" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
              <div><label className="label">Phone</label><input className="input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Years of Experience</label><input type="number" className="input" value={form.years_of_experience || ''} onChange={(e) => setForm({ ...form, years_of_experience: e.target.value })} /></div>
              <div><label className="label">Expected Salary (RWF)</label><input type="number" className="input" value={form.expected_salary || ''} onChange={(e) => setForm({ ...form, expected_salary: e.target.value })} /></div>
            </div>
            <div><label className="label">Current Employer</label><input className="input" value={form.current_employer || ''} onChange={(e) => setForm({ ...form, current_employer: e.target.value })} /></div>
            <div><label className="label">Status</label><select className="input" value={form.status || 'submitted'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="label">Cover Letter</label><textarea className="input" rows={3} value={form.cover_letter || ''} onChange={(e) => setForm({ ...form, cover_letter: e.target.value })} /></div>
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </>
        )}
        {type === 'interviews' && (
          <>
            <div><label className="label">Application *</label><select className="input" value={form.application_id || ''} onChange={(e) => setForm({ ...form, application_id: e.target.value })} required><option value="">Select</option>{applications.map((a) => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}</select></div>
            <div className="form-grid">
              <div><label className="label">Date *</label><input type="date" className="input" value={form.interview_date || ''} onChange={(e) => setForm({ ...form, interview_date: e.target.value })} required /></div>
              <div><label className="label">Time *</label><input type="time" className="input" value={form.interview_time || '09:00'} onChange={(e) => setForm({ ...form, interview_time: e.target.value })} required /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Location</label><input className="input" value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
              <div><label className="label">Interviewer</label><select className="input" value={form.interviewer_id || ''} onChange={(e) => setForm({ ...form, interviewer_id: e.target.value })}><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Round</label><input type="number" className="input" value={form.round || '1'} onChange={(e) => setForm({ ...form, round: e.target.value })} min={1} /></div>
              <div><label className="label">Status</label><select className="input" value={form.status || 'scheduled'} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="no_show">No Show</option></select></div>
            </div>
            <div><label className="label">Feedback</label><textarea className="input" rows={3} value={form.feedback || ''} onChange={(e) => setForm({ ...form, feedback: e.target.value })} /></div>
            <div><label className="label">Rating (1-5)</label><input type="number" className="input" value={form.rating || ''} onChange={(e) => setForm({ ...form, rating: e.target.value })} min={1} max={5} /></div>
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
