import { useEffect, useState, useCallback } from 'react';
import { Plus, GraduationCap, Download, FileText, Edit, Trash2, TrendingUp, Award, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, DataTable, Modal, StatusBadge, ConfirmDialog, EmptyState } from '@/components/ui';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { formatCurrency, formatDate, fullName, isHrOrAdmin, logAudit } from '@/lib/utils';
import type { TrainingProgramme, TrainingEnrollment, Skill, EmployeeSkill, CareerProgression, Employee } from '@/types';

const TRAINING_STATUSES = ['planned', 'ongoing', 'completed', 'cancelled'];
const TRAINING_TYPES = ['internal', 'external', 'online', 'on_the_job'];
const ENROLLMENT_STATUSES = ['enrolled', 'in_progress', 'completed', 'withdrawn', 'failed'];
const CHANGE_TYPES = ['promotion', 'transfer', 'demotion', 'reassignment', 'grade_change'];

export function Development() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'employee';
  const canManage = isHrOrAdmin(role) || role === 'department_manager';

  const [tab, setTab] = useState<'training' | 'enrollments' | 'skills' | 'career'>('training');
  const [programmes, setProgrammes] = useState<TrainingProgramme[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [empSkills, setEmpSkills] = useState<EmployeeSkill[]>([]);
  const [career, setCareer] = useState<CareerProgression[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TrainingProgramme | TrainingEnrollment | Skill | EmployeeSkill | CareerProgression | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: string } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [progData, enrData, skillData, empSkillData, careerData, empData] = await Promise.all([
      supabase.from('training_programmes').select('*').order('created_at', { ascending: false }),
      supabase.from('training_enrollments').select('*, programme:training_programmes(title, start_date, end_date), employee:employees(first_name, last_name, employee_number)').order('created_at', { ascending: false }),
      supabase.from('skills').select('*').order('name'),
      supabase.from('employee_skills').select('*, skill:skills(name, category), employee:employees(first_name, last_name, employee_number)').order('created_at', { ascending: false }),
      supabase.from('career_progressions').select('*, employee:employees(first_name, last_name, employee_number), from_position:positions(title), to_position:positions!to_position_id(title)').order('effective_date', { ascending: false }),
      supabase.from('employees').select('id, first_name, last_name, employee_number').order('first_name'),
    ]);
    setProgrammes((progData.data as TrainingProgramme[]) ?? []);
    setEnrollments((enrData.data as TrainingEnrollment[]) ?? []);
    setSkills((skillData.data as Skill[]) ?? []);
    setEmpSkills((empSkillData.data as EmployeeSkill[]) ?? []);
    setCareer((careerData.data as CareerProgression[]) ?? []);
    setEmployees((empData.data as Employee[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = (format: 'excel' | 'pdf') => {
    if (tab === 'training') {
      const cols = [
        { header: 'Title', key: 'title' }, { header: 'Provider', key: 'provider', format: (v: unknown) => v as string || '—' },
        { header: 'Type', key: 'training_type', format: (v: unknown) => v as string || '—' },
        { header: 'Start', key: 'start_date', format: (v: unknown) => formatDate(v as string) },
        { header: 'End', key: 'end_date', format: (v: unknown) => formatDate(v as string) },
        { header: 'Cost', key: 'cost', format: (v: unknown) => v ? formatCurrency(v as number) : '—' },
        { header: 'Status', key: 'status' },
      ];
      if (format === 'excel') exportToExcel('training', 'Training', cols, programmes as unknown as Record<string, unknown>[]);
      else exportToPDF('training', 'AB Rwanda PLC - Training Programmes', cols, programmes as unknown as Record<string, unknown>[]);
    }
  };

  const ProficiencyBar = ({ level }: { level: number }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className={`h-2 w-6 rounded-full ${n <= level ? 'bg-blue-500' : 'bg-slate-200'}`} />
      ))}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Employee Development"
        description="Training programmes, skills management, career progression, and professional development"
        actions={
          <>
            <button onClick={() => handleExport('excel')} className="btn-secondary btn-sm"><Download size={16} /> Excel</button>
            {canManage && <button onClick={() => { setEditingItem(null); setModalOpen(true); }} className="btn-primary btn-sm"><Plus size={16} /> {tab === 'training' ? 'Add Programme' : tab === 'enrollments' ? 'Add Enrollment' : tab === 'skills' ? 'Add Skill' : tab === 'career' ? 'Add Progression' : 'Add'}</button>}
          </>
        }
      />

      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
        {([['training', 'Training'], ['enrollments', 'Enrollments'], ['skills', 'Skills'], ['career', 'Career']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={`flex-1 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {label} ({key === 'training' ? programmes.length : key === 'enrollments' ? enrollments.length : key === 'skills' ? empSkills.length : career.length})
          </button>
        ))}
      </div>

      {tab === 'training' && (
        loading ? <LoadingSpinner /> :
        programmes.length === 0 ? <EmptyState icon={<GraduationCap size={48} />} title="No training programmes" description="Create a training programme to develop your workforce" /> :
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programmes.map((p) => (
            <div key={p.id} className="card-hover p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><GraduationCap size={24} /></div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{p.title}</h3>
                    <p className="text-xs text-slate-500">{p.provider ?? '—'}</p>
                  </div>
                </div>
                <StatusBadge status={p.status} />
              </div>
              {p.description && <p className="mt-3 text-sm text-slate-600 line-clamp-2">{p.description}</p>}
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                {p.training_type && <span className="badge-neutral">{p.training_type}</span>}
                {p.cost ? <span>{formatCurrency(p.cost, p.currency)}</span> : null}
                {p.certification && <span className="flex items-center gap-1 text-amber-600"><Award size={12} /> Certified</span>}
                <span>{formatDate(p.start_date)} - {formatDate(p.end_date)}</span>
              </div>
              {canManage && (
                <div className="mt-3 flex justify-end gap-1">
                  <button onClick={() => { setEditingItem(p); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
                  {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: p.id, name: p.title, type: 'programme' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'enrollments' && (
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (e) => e.employee ? fullName(e.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'programme', header: 'Programme', render: (e) => e.programme?.title ?? '—' },
            { key: 'enrollment_date', header: 'Enrolled', render: (e) => formatDate(e.enrollment_date) },
            { key: 'completion_date', header: 'Completed', render: (e) => formatDate(e.completion_date) },
            { key: 'score', header: 'Score', render: (e) => e.score ? `${e.score}%` : '—' },
            { key: 'status', header: 'Status', render: (e) => <StatusBadge status={e.status} /> },
          ]}
          data={enrollments}
          loading={loading}
          emptyMessage="No enrollments yet."
          actions={(e) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(e); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: e.id, name: 'enrollment', type: 'enrollment' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
            </div>
          ) : null}
        />
      )}

      {tab === 'skills' && (
        loading ? <LoadingSpinner /> :
        empSkills.length === 0 ? <EmptyState icon={<Award size={48} />} title="No skills recorded" description="Add skills to track employee competencies" /> :
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (s) => s.employee ? fullName(s.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'skill', header: 'Skill', render: (s) => s.skill?.name ?? '—' },
            { key: 'category', header: 'Category', render: (s) => s.skill?.category ?? '—' },
            { key: 'proficiency', header: 'Proficiency', render: (s) => <ProficiencyBar level={s.proficiency_level} /> },
            { key: 'experience', header: 'Experience', render: (s) => s.years_of_experience ? `${s.years_of_experience} yrs` : '—' },
            { key: 'certified', header: 'Certified', render: (s) => s.certified ? <span className="badge-success">Yes</span> : <span className="badge-neutral">No</span> },
          ]}
          data={empSkills}
          loading={loading}
          emptyMessage="No skills recorded."
          actions={(s) => canManage ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(s); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              {isHrOrAdmin(role) && <button onClick={() => setDeleteTarget({ id: s.id, name: s.skill?.name ?? 'skill', type: 'emp_skill' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>}
            </div>
          ) : null}
        />
      )}

      {tab === 'career' && (
        <DataTable
          columns={[
            { key: 'employee', header: 'Employee', render: (c) => c.employee ? fullName(c.employee as unknown as { first_name: string; last_name: string }) : '—' },
            { key: 'change_type', header: 'Type', render: (c) => <span className="badge-info">{c.change_type}</span> },
            { key: 'from', header: 'From', render: (c) => c.from_position?.title ?? '—' },
            { key: 'to', header: 'To', render: (c) => c.to_position?.title ?? '—' },
            { key: 'effective_date', header: 'Effective', render: (c) => formatDate(c.effective_date) },
            { key: 'old_salary', header: 'Old Salary', render: (c) => c.old_salary ? formatCurrency(c.old_salary) : '—' },
            { key: 'new_salary', header: 'New Salary', render: (c) => c.new_salary ? formatCurrency(c.new_salary) : '—' },
          ]}
          data={career}
          loading={loading}
          emptyMessage="No career progressions recorded."
          actions={(c) => isHrOrAdmin(role) ? (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => { setEditingItem(c); setModalOpen(true); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Edit size={16} /></button>
              <button onClick={() => setDeleteTarget({ id: c.id, name: 'progression', type: 'career' })} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ) : null}
        />
      )}

      {modalOpen && (
        <DevelopmentModal type={tab} item={editingItem} employees={employees} programmes={programmes} skills={skills} onClose={() => { setModalOpen(false); setEditingItem(null); }} onSaved={() => { setModalOpen(false); setEditingItem(null); fetchData(); }} />
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={async () => {
        if (!deleteTarget) return;
        const tableMap: Record<string, string> = { programme: 'training_programmes', enrollment: 'training_enrollments', skill: 'skills', emp_skill: 'employee_skills', career: 'career_progressions' };
        await supabase.from(tableMap[deleteTarget.type]).delete().eq('id', deleteTarget.id);
        await logAudit('delete', deleteTarget.type, deleteTarget.id, deleteTarget.name);
        fetchData();
      }} title="Confirm Delete" message={`Delete "${deleteTarget?.name}"?`} confirmLabel="Delete" danger />
    </div>
  );
}

function DevelopmentModal({ type, item, employees, programmes, skills, onClose, onSaved }: {
  type: 'training' | 'enrollments' | 'skills' | 'career';
  item: TrainingProgramme | TrainingEnrollment | Skill | EmployeeSkill | CareerProgression | null;
  employees: Employee[];
  programmes: TrainingProgramme[];
  skills: Skill[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [newSkillName, setNewSkillName] = useState('');

  useEffect(() => {
    if (item) {
      const obj: Record<string, string> = {};
      Object.keys(item as Record<string, unknown>).forEach((k) => {
        const val = (item as Record<string, unknown>)[k];
        obj[k] = val === null || val === undefined ? '' : String(val);
      });
      setForm(obj);
    } else {
      if (type === 'training') setForm({ title: '', description: '', provider: '', category: '', training_type: 'internal', start_date: new Date().toISOString().split('T')[0], end_date: '', duration_hours: '', cost: '', currency: 'RWF', max_participants: '', status: 'planned', certification: 'false' });
      else if (type === 'enrollments') setForm({ programme_id: '', employee_id: '', enrollment_date: new Date().toISOString().split('T')[0], completion_date: '', status: 'enrolled', score: '', notes: '' });
      else if (type === 'skills') setForm({ employee_id: '', skill_id: '', proficiency_level: '1', years_of_experience: '', certified: 'false', last_assessed: '' });
      else setForm({ employee_id: '', from_position_id: '', to_position_id: '', change_type: 'promotion', effective_date: new Date().toISOString().split('T')[0], old_salary: '', new_salary: '', reason: '' });
    }
  }, [item, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (type === 'skills' && newSkillName && !form.skill_id) {
        const { data: newSkill } = await supabase.from('skills').insert({ name: newSkillName }).select().single();
        if (newSkill) form.skill_id = newSkill.id;
      }

      const tableMap: Record<string, string> = { training: 'training_programmes', enrollments: 'training_enrollments', skills: 'employee_skills', career: 'career_progressions' };
      const table = tableMap[type];
      const payload: Record<string, unknown> = { ...form };
      if (type === 'training') { payload.cost = form.cost ? Number(form.cost) : null; payload.duration_hours = form.duration_hours ? Number(form.duration_hours) : null; payload.max_participants = form.max_participants ? Number(form.max_participants) : null; payload.certification = form.certification === 'true'; }
      if (type === 'enrollments') { payload.score = form.score ? Number(form.score) : null; }
      if (type === 'skills') { payload.proficiency_level = Number(form.proficiency_level) || 1; payload.years_of_experience = form.years_of_experience ? Number(form.years_of_experience) : null; payload.certified = form.certified === 'true'; }
      if (type === 'career') { payload.old_salary = form.old_salary ? Number(form.old_salary) : null; payload.new_salary = form.new_salary ? Number(form.new_salary) : null; }
      ['employee_id', 'programme_id', 'skill_id', 'from_position_id', 'to_position_id', 'end_date', 'completion_date', 'last_assessed'].forEach((k) => { if (payload[k] === '') payload[k] = null; });

      if (item) {
        await supabase.from(table).update(payload).eq('id', (item as { id: string }).id);
        await logAudit('update', type, (item as { id: string }).id, form.title || form.name || type);
      } else {
        const { data } = await supabase.from(table).insert(payload).select().single();
        if (data) await logAudit('create', type, data.id, form.title || form.name || type);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const title = type === 'training' ? (item ? 'Edit Programme' : 'Add Programme') : type === 'enrollments' ? (item ? 'Edit Enrollment' : 'Add Enrollment') : type === 'skills' ? (item ? 'Edit Skill' : 'Add Skill') : (item ? 'Edit Progression' : 'Add Progression');

  return (
    <Modal isOpen={true} onClose={onClose} title={title} size="lg">
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        {type === 'training' && (
          <>
            <div><label className="label">Title *</label><input className="input" value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="form-grid">
              <div><label className="label">Provider</label><input className="input" value={form.provider || ''} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></div>
              <div><label className="label">Category</label><input className="input" value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Type</label><select className="input" value={form.training_type || 'internal'} onChange={(e) => setForm({ ...form, training_type: e.target.value })}>{TRAINING_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label className="label">Status</label><select className="input" value={form.status || 'planned'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{TRAINING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Start Date</label><input type="date" className="input" value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><label className="label">End Date</label><input type="date" className="input" value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Cost (RWF)</label><input type="number" className="input" value={form.cost || ''} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></div>
              <div><label className="label">Max Participants</label><input type="number" className="input" value={form.max_participants || ''} onChange={(e) => setForm({ ...form, max_participants: e.target.value })} /></div>
            </div>
            <div><label className="label">Certification</label><select className="input" value={form.certification || 'false'} onChange={(e) => setForm({ ...form, certification: e.target.value })}><option value="false">No</option><option value="true">Yes</option></select></div>
          </>
        )}
        {type === 'enrollments' && (
          <>
            <div><label className="label">Programme *</label><select className="input" value={form.programme_id || ''} onChange={(e) => setForm({ ...form, programme_id: e.target.value })} required><option value="">Select</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
            <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            <div className="form-grid">
              <div><label className="label">Status</label><select className="input" value={form.status || 'enrolled'} onChange={(e) => setForm({ ...form, status: e.target.value })}>{ENROLLMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><label className="label">Score (%)</label><input type="number" className="input" value={form.score || ''} onChange={(e) => setForm({ ...form, score: e.target.value })} min={0} max={100} /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Enrollment Date</label><input type="date" className="input" value={form.enrollment_date || ''} onChange={(e) => setForm({ ...form, enrollment_date: e.target.value })} /></div>
              <div><label className="label">Completion Date</label><input type="date" className="input" value={form.completion_date || ''} onChange={(e) => setForm({ ...form, completion_date: e.target.value })} /></div>
            </div>
            <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </>
        )}
        {type === 'skills' && (
          <>
            <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            <div><label className="label">Existing Skill</label><select className="input" value={form.skill_id || ''} onChange={(e) => setForm({ ...form, skill_id: e.target.value })}><option value="">Select existing or create new</option>{skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            {!form.skill_id && <div><label className="label">New Skill Name</label><input className="input" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} placeholder="Enter new skill name" /></div>}
            <div className="form-grid">
              <div><label className="label">Proficiency (1-5)</label><select className="input" value={form.proficiency_level || '1'} onChange={(e) => setForm({ ...form, proficiency_level: e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Level {n}</option>)}</select></div>
              <div><label className="label">Years of Experience</label><input type="number" className="input" value={form.years_of_experience || ''} onChange={(e) => setForm({ ...form, years_of_experience: e.target.value })} step="0.5" /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Certified</label><select className="input" value={form.certified || 'false'} onChange={(e) => setForm({ ...form, certified: e.target.value })}><option value="false">No</option><option value="true">Yes</option></select></div>
              <div><label className="label">Last Assessed</label><input type="date" className="input" value={form.last_assessed || ''} onChange={(e) => setForm({ ...form, last_assessed: e.target.value })} /></div>
            </div>
          </>
        )}
        {type === 'career' && (
          <>
            <div><label className="label">Employee *</label><select className="input" value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} required><option value="">Select</option>{employees.map((e) => <option key={e.id} value={e.id}>{fullName(e)}</option>)}</select></div>
            <div className="form-grid">
              <div><label className="label">Change Type</label><select className="input" value={form.change_type || 'promotion'} onChange={(e) => setForm({ ...form, change_type: e.target.value })}>{CHANGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div><label className="label">Effective Date *</label><input type="date" className="input" value={form.effective_date || ''} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} required /></div>
            </div>
            <div className="form-grid">
              <div><label className="label">Old Salary (RWF)</label><input type="number" className="input" value={form.old_salary || ''} onChange={(e) => setForm({ ...form, old_salary: e.target.value })} /></div>
              <div><label className="label">New Salary (RWF)</label><input type="number" className="input" value={form.new_salary || ''} onChange={(e) => setForm({ ...form, new_salary: e.target.value })} /></div>
            </div>
            <div><label className="label">Reason</label><textarea className="input" rows={2} value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
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
