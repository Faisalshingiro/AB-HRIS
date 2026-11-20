import {
  Briefcase,
  CalendarClock,
  ClipboardList,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Star,
  UserPlus,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/common/EmptyState';
import { ExportMenu } from '@/components/common/ExportMenu';
import { PageHeader } from '@/components/common/PageHeader';
import { StatCard } from '@/components/common/StatCard';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import type { ExportColumn } from '@/lib/export';
import { formatDate, formatDateTime, fullName, initials, titleCase, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import { departmentsApi, employeesApi, positionsApi, recruitmentApi } from '@/services/api';
import type {
  Candidate,
  CandidateStage,
  Department,
  EmployeeWithRelations,
  EmploymentType,
  Interview,
  JobOpening,
  JobStatus,
  Position,
} from '@/types/types';

/* ------------------------------- constants ------------------------------- */

const EMPLOYMENT_TYPES: EmploymentType[] = ['permanent', 'fixed_term', 'probation', 'intern', 'consultant'];
const JOB_STATUSES: JobStatus[] = ['draft', 'open', 'on_hold', 'closed'];

const STAGES: { value: CandidateStage; label: string; rule: string }[] = [
  { value: 'applied', label: 'Applied', rule: 'bg-muted-foreground' },
  { value: 'screening', label: 'Screening', rule: 'bg-warning' },
  { value: 'interview', label: 'Interview', rule: 'bg-info' },
  { value: 'offer', label: 'Offer', rule: 'bg-accent' },
  { value: 'hired', label: 'Hired', rule: 'bg-success' },
  { value: 'rejected', label: 'Rejected', rule: 'bg-destructive' },
];

const INTERVIEW_MODES = ['in_person', 'video', 'phone', 'panel'];
const INTERVIEW_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'];
const CANDIDATE_SOURCES = ['career_page', 'referral', 'linkedin', 'job_board', 'walk_in', 'agency', 'other'];

const JOB_EXPORT_COLUMNS: ExportColumn<JobOpening>[] = [
  { header: 'Reference', accessor: (row) => row.reference },
  { header: 'Title', accessor: (row) => row.title },
  { header: 'Department', accessor: (row) => row.department?.name ?? '' },
  { header: 'Employment type', accessor: (row) => titleCase(row.employment_type) },
  { header: 'Location', accessor: (row) => row.location },
  { header: 'Vacancies', accessor: (row) => row.vacancies },
  { header: 'Closing date', accessor: (row) => formatDate(row.closing_date) },
  { header: 'Status', accessor: (row) => titleCase(row.status) },
];

/* --------------------------------- types --------------------------------- */

interface JobFormState {
  reference: string;
  title: string;
  department_id: string;
  position_id: string;
  employment_type: EmploymentType;
  location: string;
  vacancies: string;
  salary_range: string;
  description: string;
  requirements: string;
  closing_date: string;
  status: JobStatus;
}

interface CandidateFormState {
  job_opening_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  source: string;
  notes: string;
}

interface InterviewFormState {
  candidate_id: string;
  scheduled_at: string;
  mode: string;
  interviewer_id: string;
  location: string;
}

interface ScoreFormState {
  score: string;
  feedback: string;
  status: string;
}

const EMPTY_JOB_FORM: JobFormState = {
  reference: '',
  title: '',
  department_id: 'none',
  position_id: 'none',
  employment_type: 'permanent',
  location: 'Kigali',
  vacancies: '1',
  salary_range: '',
  description: '',
  requirements: '',
  closing_date: '',
  status: 'draft',
};

const EMPTY_CANDIDATE_FORM: CandidateFormState = {
  job_opening_id: '',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  source: 'career_page',
  notes: '',
};

const EMPTY_INTERVIEW_FORM: InterviewFormState = {
  candidate_id: '',
  scheduled_at: '',
  mode: 'in_person',
  interviewer_id: 'none',
  location: '',
};

const EMPTY_SCORE_FORM: ScoreFormState = { score: '', feedback: '', status: 'completed' };

/* -------------------------------- helpers -------------------------------- */

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Something went wrong. Please try again.';

const nextReference = (jobs: JobOpening[]): string => {
  const year = new Date().getFullYear();
  const prefix = `REQ-${year}-`;
  const highest = jobs.reduce((acc, job) => {
    if (!job.reference?.startsWith(prefix)) return acc;
    const parsed = Number.parseInt(job.reference.slice(prefix.length), 10);
    return Number.isNaN(parsed) ? acc : Math.max(acc, parsed);
  }, 0);
  return `${prefix}${String(highest + 1).padStart(3, '0')}`;
};

const toDateTimeInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
};

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="ed-label">{label}</Label>
      {children}
    </div>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          className={cn('h-3 w-3', step <= value ? 'fill-current text-accent' : 'text-muted-foreground/30')}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

/* --------------------------------- page ---------------------------------- */

export default function RecruitmentPage() {
  const { isHR, isManager } = useAuth();
  const canEdit = isHR || isManager;

  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<JobOpening[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null);
  const [jobForm, setJobForm] = useState<JobFormState>(EMPTY_JOB_FORM);
  const [savingJob, setSavingJob] = useState(false);

  const [candidateDialogOpen, setCandidateDialogOpen] = useState(false);
  const [candidateForm, setCandidateForm] = useState<CandidateFormState>(EMPTY_CANDIDATE_FORM);
  const [savingCandidate, setSavingCandidate] = useState(false);
  const [movingCandidate, setMovingCandidate] = useState<string | null>(null);

  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [interviewForm, setInterviewForm] = useState<InterviewFormState>(EMPTY_INTERVIEW_FORM);
  const [savingInterview, setSavingInterview] = useState(false);

  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [scoringInterview, setScoringInterview] = useState<Interview | null>(null);
  const [scoreForm, setScoreForm] = useState<ScoreFormState>(EMPTY_SCORE_FORM);
  const [savingScore, setSavingScore] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [jobRows, candidateRows, interviewRows, departmentRows, positionRows, employeeRows] = await Promise.all([
        recruitmentApi.jobs(),
        recruitmentApi.candidates(),
        recruitmentApi.interviews(),
        departmentsApi.list(),
        positionsApi.list(),
        employeesApi.list({ limit: 200 }),
      ]);
      setJobs(jobRows);
      setCandidates(candidateRows);
      setInterviews(interviewRows);
      setDepartments(departmentRows);
      setPositions(positionRows);
      setEmployees(employeeRows);
    } catch (error) {
      toast.error('Could not load recruitment data', { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredJobs = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
      if (!matchesStatus) return false;
      if (!term) return true;
      return [job.reference, job.title, job.department?.name, job.location]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [jobs, search, statusFilter]);

  const openRoles = jobs.filter((job) => job.status === 'open');
  const totalVacancies = openRoles.reduce((sum, job) => sum + (job.vacancies ?? 0), 0);
  const inPipeline = candidates.filter((candidate) => candidate.stage !== 'hired' && candidate.stage !== 'rejected');
  const offersOutstanding = candidates.filter((candidate) => candidate.stage === 'offer');

  const positionsForDepartment = useMemo(() => {
    if (jobForm.department_id === 'none') return positions;
    return positions.filter((position) => position.department_id === jobForm.department_id);
  }, [positions, jobForm.department_id]);

  /* ------------------------------ job actions ----------------------------- */

  const openCreateJob = () => {
    setEditingJob(null);
    setJobForm({ ...EMPTY_JOB_FORM, reference: nextReference(jobs) });
    setJobDialogOpen(true);
  };

  const openEditJob = (job: JobOpening) => {
    setEditingJob(job);
    setJobForm({
      reference: job.reference,
      title: job.title,
      department_id: job.department_id ?? 'none',
      position_id: job.position_id ?? 'none',
      employment_type: job.employment_type,
      location: job.location ?? '',
      vacancies: String(job.vacancies ?? 1),
      salary_range: job.salary_range ?? '',
      description: job.description ?? '',
      requirements: job.requirements ?? '',
      closing_date: job.closing_date ?? '',
      status: job.status,
    });
    setJobDialogOpen(true);
  };

  const submitJob = async () => {
    if (!jobForm.title.trim()) {
      toast.error('A requisition title is required');
      return;
    }
    if (!jobForm.reference.trim()) {
      toast.error('A requisition reference is required');
      return;
    }
    setSavingJob(true);
    try {
      const payload: Partial<JobOpening> = {
        reference: jobForm.reference.trim(),
        title: jobForm.title.trim(),
        department_id: jobForm.department_id === 'none' ? null : jobForm.department_id,
        position_id: jobForm.position_id === 'none' ? null : jobForm.position_id,
        employment_type: jobForm.employment_type,
        location: jobForm.location.trim() || 'Kigali',
        vacancies: Number(jobForm.vacancies) > 0 ? Number(jobForm.vacancies) : 1,
        salary_range: jobForm.salary_range.trim() || null,
        description: jobForm.description.trim() || null,
        requirements: jobForm.requirements.trim() || null,
        closing_date: jobForm.closing_date || null,
        status: jobForm.status,
        posted_date:
          jobForm.status === 'open' ? (editingJob?.posted_date ?? todayISO()) : (editingJob?.posted_date ?? null),
      };
      if (editingJob) {
        await recruitmentApi.updateJob(editingJob.id, payload);
        toast.success('Requisition updated');
      } else {
        await recruitmentApi.createJob(payload);
        toast.success('Requisition created');
      }
      setJobDialogOpen(false);
      await load();
    } catch (error) {
      toast.error('Could not save the requisition', { description: errorMessage(error) });
    } finally {
      setSavingJob(false);
    }
  };

  const changeJobStatus = async (job: JobOpening, status: JobStatus) => {
    try {
      await recruitmentApi.updateJob(job.id, {
        status,
        posted_date: status === 'open' ? (job.posted_date ?? todayISO()) : job.posted_date,
      });
      toast.success(`${job.reference} marked as ${titleCase(status).toLowerCase()}`);
      await load();
    } catch (error) {
      toast.error('Could not change the requisition status', { description: errorMessage(error) });
    }
  };

  /* --------------------------- candidate actions -------------------------- */

  const submitCandidate = async () => {
    if (!candidateForm.job_opening_id) {
      toast.error('Select the job opening this candidate applied for');
      return;
    }
    if (!candidateForm.first_name.trim() || !candidateForm.last_name.trim()) {
      toast.error('First and last name are required');
      return;
    }
    if (!candidateForm.email.trim()) {
      toast.error('An email address is required');
      return;
    }
    setSavingCandidate(true);
    try {
      await recruitmentApi.createCandidate({
        job_opening_id: candidateForm.job_opening_id,
        first_name: candidateForm.first_name.trim(),
        last_name: candidateForm.last_name.trim(),
        email: candidateForm.email.trim(),
        phone: candidateForm.phone.trim() || null,
        source: candidateForm.source || null,
        notes: candidateForm.notes.trim() || null,
        stage: 'applied',
        rating: 0,
      });
      toast.success('Candidate added to the pipeline');
      setCandidateDialogOpen(false);
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      await load();
    } catch (error) {
      toast.error('Could not add the candidate', { description: errorMessage(error) });
    } finally {
      setSavingCandidate(false);
    }
  };

  const moveCandidate = async (candidate: Candidate, stage: CandidateStage) => {
    if (candidate.stage === stage) return;
    setMovingCandidate(candidate.id);
    try {
      await recruitmentApi.updateCandidate(candidate.id, { stage });
      setCandidates((current) =>
        current.map((row) => (row.id === candidate.id ? { ...row, stage } : row)),
      );
      toast.success(`${candidate.first_name} ${candidate.last_name} moved to ${titleCase(stage).toLowerCase()}`);
    } catch (error) {
      toast.error('Could not move the candidate', { description: errorMessage(error) });
    } finally {
      setMovingCandidate(null);
    }
  };

  /* --------------------------- interview actions -------------------------- */

  const submitInterview = async () => {
    if (!interviewForm.candidate_id) {
      toast.error('Select a candidate');
      return;
    }
    if (!interviewForm.scheduled_at) {
      toast.error('Pick the interview date and time');
      return;
    }
    setSavingInterview(true);
    try {
      await recruitmentApi.createInterview({
        candidate_id: interviewForm.candidate_id,
        scheduled_at: new Date(interviewForm.scheduled_at).toISOString(),
        mode: interviewForm.mode,
        interviewer_id: interviewForm.interviewer_id === 'none' ? null : interviewForm.interviewer_id,
        location: interviewForm.location.trim() || null,
        status: 'scheduled',
      });
      toast.success('Interview scheduled');
      setInterviewDialogOpen(false);
      setInterviewForm(EMPTY_INTERVIEW_FORM);
      await load();
    } catch (error) {
      toast.error('Could not schedule the interview', { description: errorMessage(error) });
    } finally {
      setSavingInterview(false);
    }
  };

  const openScoreDialog = (interview: Interview) => {
    setScoringInterview(interview);
    setScoreForm({
      score: interview.score != null ? String(interview.score) : '',
      feedback: interview.feedback ?? '',
      status: interview.status || 'completed',
    });
    setScoreDialogOpen(true);
  };

  const submitScore = async () => {
    if (!scoringInterview) return;
    const numeric = Number(scoreForm.score);
    if (scoreForm.score.trim() && (Number.isNaN(numeric) || numeric < 0 || numeric > 100)) {
      toast.error('Score must be a number between 0 and 100');
      return;
    }
    setSavingScore(true);
    try {
      await recruitmentApi.updateInterview(scoringInterview.id, {
        score: scoreForm.score.trim() ? numeric : null,
        feedback: scoreForm.feedback.trim() || null,
        status: scoreForm.status,
      });
      toast.success('Interview evaluation saved');
      setScoreDialogOpen(false);
      setScoringInterview(null);
      await load();
    } catch (error) {
      toast.error('Could not save the evaluation', { description: errorMessage(error) });
    } finally {
      setSavingScore(false);
    }
  };

  /* --------------------------------- render -------------------------------- */

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Talent acquisition"
        title="Recruitment"
        description="Requisitions, candidate pipeline and interview scheduling for AB Rwanda."
        actions={
          canEdit ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setInterviewDialogOpen(true)}>
                <CalendarClock className="mr-2 h-4 w-4" />
                Schedule interview
              </Button>
              <Button size="sm" onClick={openCreateJob}>
                <Plus className="mr-2 h-4 w-4" />
                New requisition
              </Button>
            </>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard label="Open roles" value={openRoles.length} hint="Requisitions accepting applications" icon={Briefcase} />
        <StatCard label="Total vacancies" value={totalVacancies} hint="Seats across open requisitions" icon={Users} />
        <StatCard
          label="In pipeline"
          value={inPipeline.length}
          hint="Candidates not yet hired or rejected"
          icon={ClipboardList}
          tone="accent"
        />
        <StatCard label="Offers outstanding" value={offersOutstanding.length} hint="Awaiting candidate decision" icon={UserPlus} />
      </div>

      <Tabs defaultValue="openings" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted p-1 md:w-auto">
          <TabsTrigger value="openings" className="whitespace-nowrap">
            Job openings
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="whitespace-nowrap">
            Candidate pipeline
          </TabsTrigger>
          <TabsTrigger value="interviews" className="whitespace-nowrap">
            Interviews
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------ openings ----------------------------- */}
        <TabsContent value="openings" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
              <div className="relative md:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search reference, title, department"
                  className="pl-9"
                  aria-label="Search requisitions"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="md:w-44" aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {JOB_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleCase(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ExportMenu
              filename="ab-rwanda-requisitions"
              title="Job requisitions"
              subtitle={`${filteredJobs.length} requisitions`}
              columns={JOB_EXPORT_COLUMNS}
              rows={filteredJobs}
            />
          </div>

          {loading ? (
            <TableSkeleton />
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Briefcase}
                title="No requisitions found"
                description={
                  jobs.length === 0
                    ? 'Create the first requisition to start building the talent pipeline.'
                    : 'Adjust the search or status filter to see more requisitions.'
                }
                action={
                  canEdit && jobs.length === 0 ? (
                    <Button size="sm" onClick={openCreateJob}>
                      <Plus className="mr-2 h-4 w-4" />
                      New requisition
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Reference</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Title</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Department</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Type</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Vacancies</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Closing</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                    {canEdit ? <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((job) => (
                    <tr key={job.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 font-medium text-foreground">
                        {job.reference}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="font-medium text-foreground">{job.title}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{job.location}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {job.department?.name ?? ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {titleCase(job.employment_type)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">{job.vacancies}</td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDate(job.closing_date)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={job.status} />
                      </td>
                      {canEdit ? (
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={`Actions for ${job.reference}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Requisition</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => openEditJob(job)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel>Change status</DropdownMenuLabel>
                              {JOB_STATUSES.map((status) => (
                                <DropdownMenuItem
                                  key={status}
                                  disabled={job.status === status}
                                  onClick={() => void changeJobStatus(job, status)}
                                >
                                  {titleCase(status)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------ pipeline ----------------------------- */}
        <TabsContent value="pipeline" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              {candidates.length} candidate{candidates.length === 1 ? '' : 's'} across {STAGES.length} stages
            </p>
            {canEdit ? (
              <Button size="sm" onClick={() => setCandidateDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Add candidate
              </Button>
            ) : null}
          </div>

          {loading ? (
            <div className="grid gap-3 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-64 w-full" />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={Users}
                title="The pipeline is empty"
                description="Add candidates to a requisition to start tracking them through the hiring stages."
                action={
                  canEdit ? (
                    <Button size="sm" onClick={() => setCandidateDialogOpen(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add candidate
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-max gap-3">
                {STAGES.map((stage) => {
                  const stageCandidates = candidates.filter((candidate) => candidate.stage === stage.value);
                  return (
                    <div
                      key={stage.value}
                      className="flex w-[272px] shrink-0 flex-col rounded-lg border border-border bg-card"
                    >
                      <div className={cn('h-0.5 w-full rounded-t-lg', stage.rule)} aria-hidden="true" />
                      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                        <p className="ed-label">{stage.label}</p>
                        <span className="ed-table-num rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {stageCandidates.length}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-2">
                        {stageCandidates.length === 0 ? (
                          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No candidates</p>
                        ) : (
                          stageCandidates.map((candidate) => (
                            <div
                              key={candidate.id}
                              className="rounded-md border border-border bg-background p-3 shadow-sm"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {candidate.first_name} {candidate.last_name}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {candidate.job_opening?.title ?? 'Unassigned requisition'}
                                  </p>
                                </div>
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10px] font-semibold text-muted-foreground">
                                  {initials(candidate.first_name, candidate.last_name)}
                                </div>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <Rating value={candidate.rating ?? 0} />
                                <span className="text-[11px] text-muted-foreground">
                                  {formatDate(candidate.applied_at)}
                                </span>
                              </div>
                              <p className="mt-1.5 text-[11px] text-muted-foreground">
                                Source: {titleCase(candidate.source ?? 'unknown')}
                              </p>
                              <div className="mt-2.5">
                                {canEdit ? (
                                  <Select
                                    value={candidate.stage}
                                    onValueChange={(value) => void moveCandidate(candidate, value as CandidateStage)}
                                    disabled={movingCandidate === candidate.id}
                                  >
                                    <SelectTrigger className="h-8 text-xs" aria-label="Move candidate stage">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STAGES.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <StatusBadge status={candidate.stage} />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ----------------------------- interviews ---------------------------- */}
        <TabsContent value="interviews" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-muted-foreground">
              {interviews.length} interview{interviews.length === 1 ? '' : 's'} on record
            </p>
            {canEdit ? (
              <Button size="sm" onClick={() => setInterviewDialogOpen(true)}>
                <CalendarClock className="mr-2 h-4 w-4" />
                Schedule interview
              </Button>
            ) : null}
          </div>

          {loading ? (
            <TableSkeleton rows={5} />
          ) : interviews.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon={CalendarClock}
                title="No interviews scheduled"
                description="Schedule an interview to coordinate candidates and interviewers."
                action={
                  canEdit ? (
                    <Button size="sm" onClick={() => setInterviewDialogOpen(true)}>
                      <CalendarClock className="mr-2 h-4 w-4" />
                      Schedule interview
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/60">
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Candidate</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Scheduled</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Mode</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Interviewer</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Score</th>
                    <th className="ed-label whitespace-nowrap px-4 py-3 text-left">Status</th>
                    {canEdit ? <th className="ed-label whitespace-nowrap px-4 py-3 text-right">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {interviews.map((interview) => (
                    <tr key={interview.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                        {fullName(interview.candidate)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {formatDateTime(interview.scheduled_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {titleCase(interview.mode)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {fullName(interview.interviewer)}
                      </td>
                      <td className="ed-table-num whitespace-nowrap px-4 py-3 text-right">
                        {interview.score != null ? `${interview.score}/100` : ''}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={interview.status} />
                      </td>
                      {canEdit ? (
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => openScoreDialog(interview)}>
                            Record score
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* --------------------------- job dialog --------------------------- */}
      <Dialog open={jobDialogOpen} onOpenChange={setJobDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingJob ? 'Edit requisition' : 'New requisition'}</DialogTitle>
            <DialogDescription>
              {editingJob
                ? 'Update the requisition details and hiring status.'
                : 'Open a new position and publish it to the careers page.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Reference">
              <Input
                value={jobForm.reference}
                onChange={(event) => setJobForm({ ...jobForm, reference: event.target.value })}
                placeholder="REQ-2026-018"
              />
            </Field>
            <Field label="Status">
              <Select
                value={jobForm.status}
                onValueChange={(value) => setJobForm({ ...jobForm, status: value as JobStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleCase(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Title" className="md:col-span-2">
              <Input
                value={jobForm.title}
                onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })}
                placeholder="Senior Accountant"
              />
            </Field>
            <Field label="Department">
              <Select
                value={jobForm.department_id}
                onValueChange={(value) => setJobForm({ ...jobForm, department_id: value, position_id: 'none' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Position">
              <Select
                value={jobForm.position_id}
                onValueChange={(value) => setJobForm({ ...jobForm, position_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {positionsForDepartment.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Employment type">
              <Select
                value={jobForm.employment_type}
                onValueChange={(value) => setJobForm({ ...jobForm, employment_type: value as EmploymentType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {titleCase(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Location">
              <Input
                value={jobForm.location}
                onChange={(event) => setJobForm({ ...jobForm, location: event.target.value })}
                placeholder="Kigali"
              />
            </Field>
            <Field label="Vacancies">
              <Input
                type="number"
                min={1}
                value={jobForm.vacancies}
                onChange={(event) => setJobForm({ ...jobForm, vacancies: event.target.value })}
              />
            </Field>
            <Field label="Salary range">
              <Input
                value={jobForm.salary_range}
                onChange={(event) => setJobForm({ ...jobForm, salary_range: event.target.value })}
                placeholder="RWF 800,000 – 1,200,000"
              />
            </Field>
            <Field label="Closing date">
              <Input
                type="date"
                value={jobForm.closing_date}
                onChange={(event) => setJobForm({ ...jobForm, closing_date: event.target.value })}
              />
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea
                rows={3}
                value={jobForm.description}
                onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })}
                placeholder="Role summary and responsibilities"
              />
            </Field>
            <Field label="Requirements" className="md:col-span-2">
              <Textarea
                rows={3}
                value={jobForm.requirements}
                onChange={(event) => setJobForm({ ...jobForm, requirements: event.target.value })}
                placeholder="Qualifications, experience and skills"
              />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setJobDialogOpen(false)} disabled={savingJob}>
              Cancel
            </Button>
            <Button onClick={() => void submitJob()} disabled={savingJob}>
              {savingJob ? 'Saving…' : editingJob ? 'Save changes' : 'Create requisition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------- candidate dialog ------------------------ */}
      <Dialog open={candidateDialogOpen} onOpenChange={setCandidateDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add candidate</DialogTitle>
            <DialogDescription>Register an applicant against an open requisition.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Job opening" className="md:col-span-2">
              <Select
                value={candidateForm.job_opening_id}
                onValueChange={(value) => setCandidateForm({ ...candidateForm, job_opening_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select requisition" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.reference} · {job.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="First name">
              <Input
                value={candidateForm.first_name}
                onChange={(event) => setCandidateForm({ ...candidateForm, first_name: event.target.value })}
              />
            </Field>
            <Field label="Last name">
              <Input
                value={candidateForm.last_name}
                onChange={(event) => setCandidateForm({ ...candidateForm, last_name: event.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={candidateForm.email}
                onChange={(event) => setCandidateForm({ ...candidateForm, email: event.target.value })}
                placeholder="name@example.com"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={candidateForm.phone}
                onChange={(event) => setCandidateForm({ ...candidateForm, phone: event.target.value })}
                placeholder="+250 7XX XXX XXX"
              />
            </Field>
            <Field label="Source" className="md:col-span-2">
              <Select
                value={candidateForm.source}
                onValueChange={(value) => setCandidateForm({ ...candidateForm, source: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANDIDATE_SOURCES.map((source) => (
                    <SelectItem key={source} value={source}>
                      {titleCase(source)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Notes" className="md:col-span-2">
              <Textarea
                rows={3}
                value={candidateForm.notes}
                onChange={(event) => setCandidateForm({ ...candidateForm, notes: event.target.value })}
                placeholder="Screening notes, referral context"
              />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCandidateDialogOpen(false)} disabled={savingCandidate}>
              Cancel
            </Button>
            <Button onClick={() => void submitCandidate()} disabled={savingCandidate}>
              {savingCandidate ? 'Saving…' : 'Add candidate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------- interview dialog ------------------------ */}
      <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule interview</DialogTitle>
            <DialogDescription>Book a slot and assign the interviewer.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Candidate" className="md:col-span-2">
              <Select
                value={interviewForm.candidate_id}
                onValueChange={(value) => setInterviewForm({ ...interviewForm, candidate_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.first_name} {candidate.last_name}
                      {candidate.job_opening?.title ? ` · ${candidate.job_opening.title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date & time">
              <Input
                type="datetime-local"
                value={interviewForm.scheduled_at}
                onChange={(event) => setInterviewForm({ ...interviewForm, scheduled_at: event.target.value })}
              />
            </Field>
            <Field label="Mode">
              <Select
                value={interviewForm.mode}
                onValueChange={(value) => setInterviewForm({ ...interviewForm, mode: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {titleCase(mode)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Interviewer">
              <Select
                value={interviewForm.interviewer_id}
                onValueChange={(value) => setInterviewForm({ ...interviewForm, interviewer_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interviewer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Location">
              <Input
                value={interviewForm.location}
                onChange={(event) => setInterviewForm({ ...interviewForm, location: event.target.value })}
                placeholder="Boardroom / Google Meet"
              />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setInterviewDialogOpen(false)} disabled={savingInterview}>
              Cancel
            </Button>
            <Button onClick={() => void submitInterview()} disabled={savingInterview}>
              {savingInterview ? 'Scheduling…' : 'Schedule interview'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------- score dialog -------------------------- */}
      <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record interview evaluation</DialogTitle>
            <DialogDescription>
              {scoringInterview
                ? `${fullName(scoringInterview.candidate)} · ${formatDateTime(scoringInterview.scheduled_at)}`
                : 'Capture the interviewer score and feedback.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Score (0–100)">
              <Input
                type="number"
                min={0}
                max={100}
                value={scoreForm.score}
                onChange={(event) => setScoreForm({ ...scoreForm, score: event.target.value })}
                placeholder="78"
              />
            </Field>
            <Field label="Status">
              <Select
                value={scoreForm.status}
                onValueChange={(value) => setScoreForm({ ...scoreForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVIEW_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleCase(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Feedback" className="md:col-span-2">
              <Textarea
                rows={4}
                value={scoreForm.feedback}
                onChange={(event) => setScoreForm({ ...scoreForm, feedback: event.target.value })}
                placeholder="Strengths, concerns and recommendation"
              />
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setScoreDialogOpen(false)} disabled={savingScore}>
              Cancel
            </Button>
            <Button onClick={() => void submitScore()} disabled={savingScore}>
              {savingScore ? 'Saving…' : 'Save evaluation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
