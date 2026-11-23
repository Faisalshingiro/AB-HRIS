import { isSupabaseConfigured, supabase } from '@/db/supabase';
import type {
  Appraisal,
  AppraisalCycle,
  Attendance,
  AuditLog,
  Candidate,
  DashboardStats,
  Department,
  DisciplinaryAction,
  DisciplinaryCase,
  DocumentRecord,
  Employee,
  EmployeeDocument,
  EmployeeWithRelations,
  ExitClearance,
  ExitRequest,
  FinalSettlement,
  Goal,
  Interview,
  JobOpening,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  Notification,
  OnboardingTask,
  PayrollItem,
  PayrollPeriod,
  Position,
  Profile,
  SuccessionCandidate,
  SuccessionPlan,
  Training,
  TrainingEnrollment,
  UserRole,
} from '@/types/types';
import {
  DEMO_PROFILES,
  getMockDashboardStats,
  getMockLeaveBalances,
  mockAppraisalCycles,
  mockAppraisals,
  mockCandidates,
  mockDepartments,
  mockDisciplinaryCases,
  mockDocuments,
  mockEmployees,
  mockExitRequests,
  mockGoals,
  mockInterviews,
  mockJobOpenings,
  mockLeaveRequests,
  mockLeaveTypes,
  mockNotifications,
  mockOnboardingTasks,
  mockPayrollPeriods,
  mockPositions,
  mockSuccessionPlans,
  mockTrainings,
} from './mockData';

const EMPLOYEE_SELECT =
  '*, department:departments!employees_department_id_fkey(id,name,code), position:positions!employees_position_id_fkey(id,title,grade), manager:employees!employees_manager_id_fkey(id,first_name,last_name)';

const LEAVE_SELECT =
  '*, employee:employees!leave_requests_employee_id_fkey(id,first_name,last_name,employee_no,department_id), leave_type:leave_types!leave_requests_leave_type_id_fkey(id,name,code)';

const PAYROLL_ITEM_SELECT =
  '*, employee:employees!payroll_items_employee_id_fkey(id,first_name,last_name,employee_no,department_id,bank_name,bank_account), period:payroll_periods!payroll_items_period_id_fkey(id,name,period_start,period_end,pay_date)';

const asArray = <T>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

/* -------------------- Ultra-fast Demo & Circuit Breaker -------------------- */

function isDemoMode(): boolean {
  try {
    return Boolean(typeof window !== 'undefined' && localStorage.getItem('abr_demo_user'));
  } catch {
    return false;
  }
}

let remoteHealthy = true;
let lastRemoteAttempt = 0;

function shouldQueryRemote(): boolean {
  if (!isSupabaseConfigured) return false;
  // If user is in demo mode, skip network round-trips entirely for instant response (<1ms)
  if (isDemoMode()) return false;
  // If remote recently failed, do not block the page with repeated timeouts
  if (!remoteHealthy && Date.now() - lastRemoteAttempt < 45_000) return false;
  return true;
}

function handleRemoteError(err: unknown) {
  remoteHealthy = false;
  lastRemoteAttempt = Date.now();
  console.warn('Supabase remote query failed, using fast local data:', err);
}

async function runRemote<T>(
  queryPromise: PromiseLike<{ data: T | null; error: unknown }>,
  timeoutMs = 1500,
): Promise<T | null> {
  if (!shouldQueryRemote()) return null;
  try {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Remote timeout')), timeoutMs);
    });
    const res = await Promise.race([queryPromise, timeout]).finally(() => clearTimeout(timer));
    if (res.error) {
      handleRemoteError(res.error);
      return null;
    }
    return res.data;
  } catch (err) {
    handleRemoteError(err);
    return null;
  }
}

// In-memory / localStorage attendance for demo
function getDemoAttendanceToday(employeeId: string): Attendance | null {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const raw =
      localStorage.getItem(`abr_attendance_${employeeId}_${today}`) ??
      localStorage.getItem(`abr_attendance_${today}`);
    const record = raw ? (JSON.parse(raw) as Attendance) : null;
    return record?.employee_id === employeeId ? record : null;
  } catch {
    return null;
  }
}

export async function logAudit(
  action: string,
  entity: string,
  entityId?: string | null,
  details?: Record<string, unknown> | null,
): Promise<void> {
  if (!shouldQueryRemote()) return;
  try {
    await supabase.rpc('log_audit', {
      p_action: action,
      p_entity: entity,
      p_entity_id: entityId ?? null,
      p_details: details ?? null,
    });
  } catch {
    // Non-blocking
  }
}

/* ------------------------------- profiles ------------------------------- */

export const profilesApi = {
  async list(): Promise<Profile[]> {
    const remote = await runRemote(
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(200),
    );
    if (!remote || remote.length === 0) return Object.values(DEMO_PROFILES);
    return asArray<Profile>(remote);
  },
  async updateRole(id: string, role: UserRole): Promise<void> {
    if (shouldQueryRemote()) {
      try {
        const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
        if (error) throw error;
        await logAudit('user.role_changed', 'profile', id, { role });
      } catch (e) {
        handleRemoteError(e);
      }
    }
  },
  async setActive(id: string, isActive: boolean): Promise<void> {
    if (shouldQueryRemote()) {
      try {
        const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id);
        if (error) throw error;
        await logAudit('user.status_changed', 'profile', id, { is_active: isActive });
      } catch (e) {
        handleRemoteError(e);
      }
    }
  },
  async updateSelf(id: string, patch: Partial<Profile>): Promise<void> {
    if (shouldQueryRemote()) {
      try {
        const { error } = await supabase.from('profiles').update(patch).eq('id', id);
        if (error) throw error;
      } catch (e) {
        handleRemoteError(e);
      }
    }
  },
};

/* ------------------------------ departments ----------------------------- */

export const departmentsApi = {
  async list(): Promise<Department[]> {
    const remote = await runRemote(supabase.from('departments').select('*').order('name').limit(100));
    if (!remote || remote.length === 0) return mockDepartments;
    return asArray<Department>(remote);
  },
  async create(payload: Partial<Department>): Promise<void> {
    const newDept: Department = {
      id: `dept-${Date.now()}`,
      name: payload.name || 'New Department',
      code: payload.code || 'DEPT',
      description: payload.description || null,
      cost_center: payload.cost_center || null,
      head_employee_id: payload.head_employee_id || null,
      created_at: new Date().toISOString(),
    };
    mockDepartments.push(newDept);
    if (shouldQueryRemote()) {
      supabase.from('departments').insert(payload).catch(handleRemoteError);
    }
  },
  async update(id: string, payload: Partial<Department>): Promise<void> {
    const index = mockDepartments.findIndex((d) => d.id === id);
    if (index !== -1) mockDepartments[index] = { ...mockDepartments[index], ...payload };
    if (shouldQueryRemote()) {
      supabase.from('departments').update(payload).eq('id', id).catch(handleRemoteError);
    }
  },
};

export const positionsApi = {
  async list(): Promise<Position[]> {
    const remote = await runRemote(supabase.from('positions').select('*').order('title').limit(200));
    if (!remote || remote.length === 0) return mockPositions;
    return asArray<Position>(remote);
  },
  async create(payload: Partial<Position>): Promise<void> {
    const newPos: Position = {
      id: `pos-${Date.now()}`,
      title: payload.title || 'New Position',
      department_id: payload.department_id || null,
      grade: payload.grade || 'O1',
      min_salary: payload.min_salary || 0,
      max_salary: payload.max_salary || 0,
      description: payload.description || null,
      created_at: new Date().toISOString(),
    };
    mockPositions.push(newPos);
    if (shouldQueryRemote()) {
      supabase.from('positions').insert(payload).catch(handleRemoteError);
    }
  },
};

/* ------------------------------- employees ------------------------------ */

export const employeesApi = {
  async list(params?: {
    search?: string;
    departmentId?: string;
    status?: string;
    managerId?: string;
    limit?: number;
  }): Promise<EmployeeWithRelations[]> {
    if (shouldQueryRemote()) {
      let query = supabase.from('employees').select(EMPLOYEE_SELECT).order('employee_no').limit(params?.limit ?? 200);
      if (params?.departmentId) query = query.eq('department_id', params.departmentId);
      if (params?.status) query = query.eq('status', params.status);
      if (params?.managerId) query = query.eq('manager_id', params.managerId);
      if (params?.search) {
        const term = params.search.trim();
        query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,employee_no.ilike.%${term}%,email.ilike.%${term}%`);
      }
      const remote = await runRemote(query);
      if (remote && remote.length > 0) return asArray<EmployeeWithRelations>(remote);
    }

    let list = [...mockEmployees];
    if (params?.departmentId) list = list.filter((e) => e.department_id === params.departmentId);
    if (params?.status) list = list.filter((e) => e.status === params.status);
    if (params?.managerId) list = list.filter((e) => e.manager_id === params.managerId);
    if (params?.search) {
      const t = params.search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.first_name.toLowerCase().includes(t) ||
          e.last_name.toLowerCase().includes(t) ||
          e.employee_no.toLowerCase().includes(t) ||
          e.email.toLowerCase().includes(t),
      );
    }
    return list;
  },
  async get(id: string): Promise<EmployeeWithRelations | null> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(supabase.from('employees').select(EMPLOYEE_SELECT).eq('id', id).maybeSingle());
      if (remote) return remote as EmployeeWithRelations;
    }
    return mockEmployees.find((e) => e.id === id) ?? null;
  },
  async byProfile(profileId: string): Promise<EmployeeWithRelations | null> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(supabase.from('employees').select(EMPLOYEE_SELECT).eq('profile_id', profileId).maybeSingle());
      if (remote) return remote as EmployeeWithRelations;
    }
    return mockEmployees.find((e) => e.profile_id === profileId) ?? null;
  },
  async directReports(managerId: string): Promise<EmployeeWithRelations[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(supabase.from('employees').select(EMPLOYEE_SELECT).eq('manager_id', managerId).limit(100));
      if (remote && remote.length > 0) return asArray<EmployeeWithRelations>(remote);
    }
    return mockEmployees.filter((e) => e.manager_id === managerId);
  },
  async create(payload: Partial<Employee>): Promise<Employee> {
    const newEmp: EmployeeWithRelations = {
      ...mockEmployees[0],
      ...payload,
      id: `emp-${Date.now()}`,
      employee_no: payload.employee_no || `ABR-${String(mockEmployees.length + 1).padStart(4, '0')}`,
      first_name: payload.first_name || 'New',
      last_name: payload.last_name || 'Employee',
      email: payload.email || 'employee@abrwanda.rw',
      status: (payload.status as 'active' | 'probation') || 'active',
      department: mockDepartments.find((d) => d.id === payload.department_id) ?? null,
      position: mockPositions.find((p) => p.id === payload.position_id) ?? null,
    };
    mockEmployees.unshift(newEmp);
    if (shouldQueryRemote()) {
      supabase.from('employees').insert(payload).catch(handleRemoteError);
    }
    return newEmp;
  },
  async update(id: string, payload: Partial<Employee>): Promise<void> {
    const index = mockEmployees.findIndex((e) => e.id === id);
    if (index !== -1) {
      mockEmployees[index] = {
        ...mockEmployees[index],
        ...payload,
        updated_at: new Date().toISOString(),
      };
    }
    if (shouldQueryRemote()) {
      supabase.from('employees').update(payload).eq('id', id).catch(handleRemoteError);
    }
  },
  async nextEmployeeNo(): Promise<string> {
    return `ABR-${String(mockEmployees.length + 1).padStart(4, '0')}`;
  },
};

/* ------------------------------ recruitment ----------------------------- */

export const recruitmentApi = {
  async jobs(params?: { status?: string }): Promise<JobOpening[]> {
    if (shouldQueryRemote()) {
      let query = supabase
        .from('job_openings')
        .select('*, department:departments!job_openings_department_id_fkey(id,name)')
        .order('created_at', { ascending: false })
        .limit(100);
      if (params?.status) query = query.eq('status', params.status);
      const remote = await runRemote(query);
      if (remote && remote.length > 0) return asArray<JobOpening>(remote);
    }
    let list = [...mockJobOpenings];
    if (params?.status) list = list.filter((j) => j.status === params.status);
    return list;
  },
  async createJob(payload: Partial<JobOpening>): Promise<void> {
    const newJob: JobOpening = {
      id: `job-${Date.now()}`,
      reference: `JOB-${Date.now().toString().slice(-4)}`,
      title: payload.title || 'Untitled Job',
      department_id: payload.department_id || null,
      position_id: payload.position_id || null,
      employment_type: payload.employment_type || 'permanent',
      location: payload.location || 'Kigali',
      description: payload.description || null,
      requirements: payload.requirements || null,
      vacancies: payload.vacancies || 1,
      salary_range: payload.salary_range || null,
      status: (payload.status as 'open' | 'draft') || 'open',
      posted_date: new Date().toISOString(),
      closing_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockJobOpenings.unshift(newJob);
    if (shouldQueryRemote()) supabase.from('job_openings').insert(payload).catch(handleRemoteError);
  },
  async updateJob(id: string, payload: Partial<JobOpening>): Promise<void> {
    const idx = mockJobOpenings.findIndex((j) => j.id === id);
    if (idx !== -1) mockJobOpenings[idx] = { ...mockJobOpenings[idx], ...payload };
    if (shouldQueryRemote()) supabase.from('job_openings').update(payload).eq('id', id).catch(handleRemoteError);
  },
  async candidates(params?: { jobId?: string; stage?: string }): Promise<Candidate[]> {
    if (shouldQueryRemote()) {
      let query = supabase
        .from('candidates')
        .select('*, job_opening:job_openings!candidates_job_opening_id_fkey(id,title,reference)')
        .order('applied_at', { ascending: false })
        .limit(200);
      if (params?.jobId) query = query.eq('job_opening_id', params.jobId);
      if (params?.stage) query = query.eq('stage', params.stage);
      const remote = await runRemote(query);
      if (remote && remote.length > 0) return asArray<Candidate>(remote);
    }
    let list = [...mockCandidates];
    if (params?.jobId) list = list.filter((c) => c.job_opening_id === params.jobId);
    if (params?.stage) list = list.filter((c) => c.stage === params.stage);
    return list;
  },
  async createCandidate(payload: Partial<Candidate>): Promise<void> {
    const newCand: Candidate = {
      id: `cand-${Date.now()}`,
      job_opening_id: payload.job_opening_id || '',
      first_name: payload.first_name || 'Applicant',
      last_name: payload.last_name || 'Name',
      email: payload.email || 'applicant@example.com',
      phone: payload.phone || null,
      resume_url: null,
      stage: (payload.stage as 'applied' | 'screening') || 'applied',
      rating: null,
      notes: payload.notes || null,
      source: payload.source || 'Website',
      applied_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockCandidates.unshift(newCand);
    if (shouldQueryRemote()) supabase.from('candidates').insert(payload).catch(handleRemoteError);
  },
  async updateCandidate(id: string, payload: Partial<Candidate>): Promise<void> {
    const idx = mockCandidates.findIndex((c) => c.id === id);
    if (idx !== -1) mockCandidates[idx] = { ...mockCandidates[idx], ...payload };
    if (shouldQueryRemote()) supabase.from('candidates').update(payload).eq('id', id).catch(handleRemoteError);
  },
  async interviews(candidateId?: string): Promise<Interview[]> {
    if (shouldQueryRemote()) {
      let query = supabase
        .from('interviews')
        .select('*, candidate:candidates!interviews_candidate_id_fkey(id,first_name,last_name), interviewer:employees!interviews_interviewer_id_fkey(id,first_name,last_name)')
        .order('scheduled_at', { ascending: false })
        .limit(100);
      if (candidateId) query = query.eq('candidate_id', candidateId);
      const remote = await runRemote(query);
      if (remote && remote.length > 0) return asArray<Interview>(remote);
    }
    if (candidateId) return mockInterviews.filter((i) => i.candidate_id === candidateId);
    return mockInterviews;
  },
  async createInterview(payload: Partial<Interview>): Promise<void> {
    const newInt: Interview = {
      id: `int-${Date.now()}`,
      candidate_id: payload.candidate_id || '',
      interviewer_id: payload.interviewer_id || null,
      round: payload.round || '1',
      scheduled_at: payload.scheduled_at || new Date().toISOString(),
      location: payload.location || 'Head Office',
      feedback: payload.feedback || null,
      rating: payload.rating || null,
      status: payload.status || 'scheduled',
      created_at: new Date().toISOString(),
    };
    mockInterviews.unshift(newInt);
    if (shouldQueryRemote()) supabase.from('interviews').insert(payload).catch(handleRemoteError);
  },
  async updateInterview(id: string, payload: Partial<Interview>): Promise<void> {
    const idx = mockInterviews.findIndex((i) => i.id === id);
    if (idx !== -1) mockInterviews[idx] = { ...mockInterviews[idx], ...payload };
    if (shouldQueryRemote()) supabase.from('interviews').update(payload).eq('id', id).catch(handleRemoteError);
  },
};

/* ------------------------------- onboarding ----------------------------- */

export const onboardingApi = {
  async tasks(employeeId?: string): Promise<OnboardingTask[]> {
    if (shouldQueryRemote()) {
      let query = supabase.from('onboarding_tasks').select('*').order('sort_order').limit(300);
      if (employeeId) query = query.eq('employee_id', employeeId);
      const remote = await runRemote(query);
      if (remote && remote.length > 0) return asArray<OnboardingTask>(remote);
    }
    if (employeeId) return mockOnboardingTasks.filter((t) => t.employee_id === employeeId);
    return mockOnboardingTasks;
  },
  async createTask(payload: Partial<OnboardingTask>): Promise<void> {
    const newTask: OnboardingTask = {
      id: `obt-${Date.now()}`,
      employee_id: payload.employee_id || 'e0000000-0000-4000-8000-000000000024',
      title: payload.title || 'New onboarding task',
      category: payload.category || 'general',
      assigned_to: payload.assigned_to || null,
      due_date: payload.due_date || '2026-12-01',
      sort_order: payload.sort_order || mockOnboardingTasks.length + 1,
      status: 'pending',
      completed_at: null,
      created_at: new Date().toISOString(),
    };
    mockOnboardingTasks.push(newTask);
    if (shouldQueryRemote()) supabase.from('onboarding_tasks').insert(payload).catch(handleRemoteError);
  },
  async toggleTask(id: string, completed: boolean): Promise<void> {
    const task = mockOnboardingTasks.find((t) => t.id === id);
    if (task) {
      task.status = completed ? 'completed' : 'pending';
      task.completed_at = completed ? new Date().toISOString() : null;
    }
    if (shouldQueryRemote()) {
      supabase.from('onboarding_tasks').update({ status: completed ? 'completed' : 'pending' }).eq('id', id).catch(handleRemoteError);
    }
  },
  async documents(employeeId?: string): Promise<EmployeeDocument[]> {
    if (shouldQueryRemote()) {
      let query = supabase.from('employee_documents').select('*').order('uploaded_at', { ascending: false }).limit(300);
      if (employeeId) query = query.eq('employee_id', employeeId);
      const remote = await runRemote(query);
      if (remote) return asArray<EmployeeDocument>(remote);
    }
    return [];
  },
  async createDocument(payload: Partial<EmployeeDocument>): Promise<void> {
    if (shouldQueryRemote()) {
      supabase.from('employee_documents').insert(payload).catch(handleRemoteError);
    }
  },
  async verifyDocument(id: string, status: string, verifierId: string | null): Promise<void> {
    if (shouldQueryRemote()) {
      supabase.from('employee_documents').update({ status, verified_by: verifierId }).eq('id', id).catch(handleRemoteError);
    }
  },
};

/* ------------------------------- attendance ----------------------------- */

export const attendanceApi = {
  async list(params?: { employeeId?: string; from?: string; to?: string; limit?: number }): Promise<Attendance[]> {
    if (shouldQueryRemote()) {
      let query = supabase
        .from('attendance')
        .select('*, employee:employees!attendance_employee_id_fkey(id,first_name,last_name,employee_no)')
        .order('work_date', { ascending: false })
        .limit(params?.limit ?? 300);
      if (params?.employeeId) query = query.eq('employee_id', params.employeeId);
      if (params?.from) query = query.gte('work_date', params.from);
      if (params?.to) query = query.lte('work_date', params.to);
      const remote = await runRemote(query);
      if (remote) return asArray<Attendance>(remote);
    }
    const todayRec = params?.employeeId ? getDemoAttendanceToday(params.employeeId) : null;
    return todayRec ? [todayRec] : [];
  },
  async today(employeeId: string): Promise<Attendance | null> {
    if (shouldQueryRemote()) {
      const today = new Date().toISOString().slice(0, 10);
      const remote = await runRemote(supabase.from('attendance').select('*').eq('employee_id', employeeId).eq('work_date', today).maybeSingle());
      if (remote) return remote as Attendance;
    }
    return getDemoAttendanceToday(employeeId);
  },
  async clockIn(employeeId: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const late = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 15);
    const record: Attendance = {
      id: `att-${Date.now()}`,
      employee_id: employeeId,
      work_date: today,
      clock_in: now.toISOString(),
      clock_out: null,
      status: late ? 'late' : 'present',
      hours_worked: 0,
      notes: null,
      created_at: now.toISOString(),
    };
    try {
      localStorage.setItem(`abr_attendance_${employeeId}_${today}`, JSON.stringify(record));
    } catch {}
    if (shouldQueryRemote()) {
      supabase.from('attendance').upsert(record, { onConflict: 'employee_id,work_date' }).catch(handleRemoteError);
    }
  },
  async clockOut(employeeId: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const existing = getDemoAttendanceToday(employeeId);
    const now = new Date();
    const clockInTime = existing?.clock_in ? new Date(existing.clock_in).getTime() : now.getTime() - 8 * 3600 * 1000;
    const hours = (now.getTime() - clockInTime) / 3_600_000;
    const record: Attendance = {
      id: existing?.id || `att-${Date.now()}`,
      employee_id: employeeId,
      work_date: today,
      clock_in: existing?.clock_in || new Date(clockInTime).toISOString(),
      clock_out: now.toISOString(),
      status: existing?.status || 'present',
      hours_worked: Number(hours.toFixed(2)),
      notes: null,
      created_at: existing?.created_at || now.toISOString(),
    };
    try {
      localStorage.setItem(`abr_attendance_${employeeId}_${today}`, JSON.stringify(record));
    } catch {}
    if (shouldQueryRemote()) {
      supabase.from('attendance').update(record).eq('id', record.id).catch(handleRemoteError);
    }
  },
  async mark(employeeId: string, workDate: string, status: string, notes?: string): Promise<void> {
    if (shouldQueryRemote()) {
      supabase.from('attendance').upsert({ employee_id: employeeId, work_date: workDate, status, notes: notes ?? null }).catch(handleRemoteError);
    }
  },
};

/* --------------------------------- leave -------------------------------- */

export const leaveApi = {
  async types(): Promise<LeaveType[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(supabase.from('leave_types').select('*').order('name').limit(50));
      if (remote && remote.length > 0) return asArray<LeaveType>(remote);
    }
    return mockLeaveTypes;
  },
  async balances(employeeId?: string): Promise<LeaveBalance[]> {
    if (shouldQueryRemote()) {
      let query = supabase
        .from('leave_balances')
        .select('*, leave_type:leave_types!leave_balances_leave_type_id_fkey(id,name,code)')
        .order('year', { ascending: false })
        .limit(200);
      if (employeeId) query = query.eq('employee_id', employeeId);
      const remote = await runRemote(query);
      if (remote && remote.length > 0) return asArray<LeaveBalance>(remote);
    }
    return getMockLeaveBalances(employeeId);
  },
  async requests(params?: { employeeId?: string; status?: string; limit?: number }): Promise<LeaveRequest[]> {
    if (shouldQueryRemote()) {
      let query = supabase.from('leave_requests').select(LEAVE_SELECT).order('created_at', { ascending: false }).limit(params?.limit ?? 200);
      if (params?.employeeId) query = query.eq('employee_id', params.employeeId);
      if (params?.status) query = query.eq('status', params.status);
      const remote = await runRemote(query);
      if (remote && remote.length > 0) return asArray<LeaveRequest>(remote);
    }
    let list = [...mockLeaveRequests];
    if (params?.status) list = list.filter((l) => l.status === params.status);
    if (params?.employeeId) list = list.filter((l) => l.employee_id === params.employeeId);
    return list;
  },
  async create(payload: Partial<LeaveRequest>): Promise<void> {
    const newReq: LeaveRequest = {
      id: `lr-${Date.now()}`,
      employee_id: payload.employee_id || 'e0000000-0000-4000-8000-000000000002',
      leave_type_id: payload.leave_type_id || mockLeaveTypes[0].id,
      start_date: payload.start_date || '2026-12-01',
      end_date: payload.end_date || '2026-12-05',
      days: payload.days || 5,
      reason: payload.reason || null,
      status: 'pending',
      approver_id: null,
      decided_at: null,
      decision_note: null,
      created_at: new Date().toISOString(),
      employee: mockEmployees.find((e) => e.id === payload.employee_id),
      leave_type: mockLeaveTypes.find((lt) => lt.id === payload.leave_type_id),
    };
    mockLeaveRequests.unshift(newReq);
    if (shouldQueryRemote()) supabase.from('leave_requests').insert(payload).catch(handleRemoteError);
  },
  async decide(id: string, status: 'approved' | 'rejected', approverId: string | null, note: string): Promise<void> {
    const item = mockLeaveRequests.find((l) => l.id === id);
    if (item) {
      item.status = status;
      item.decision_note = note;
      item.approver_id = approverId;
      item.decided_at = new Date().toISOString();
    }
    if (shouldQueryRemote()) {
      supabase.from('leave_requests').update({ status, approver_id: approverId, decided_at: new Date().toISOString(), decision_note: note }).eq('id', id).catch(handleRemoteError);
    }
  },
  async cancel(id: string): Promise<void> {
    const item = mockLeaveRequests.find((l) => l.id === id);
    if (item) item.status = 'cancelled';
    if (shouldQueryRemote()) supabase.from('leave_requests').update({ status: 'cancelled' }).eq('id', id).catch(handleRemoteError);
  },
};

/* ------------------------------ performance ----------------------------- */

export const performanceApi = {
  async cycles(): Promise<AppraisalCycle[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(supabase.from('appraisal_cycles').select('*').order('period_start', { ascending: false }).limit(50));
      if (remote && remote.length > 0) return asArray<AppraisalCycle>(remote);
    }
    return mockAppraisalCycles;
  },
  async createCycle(payload: Partial<AppraisalCycle>): Promise<void> {
    const newCycle: AppraisalCycle = {
      id: `cycle-${Date.now()}`,
      name: payload.name || 'Annual Review 2026',
      period_start: payload.period_start || '2026-01-01',
      period_end: payload.period_end || '2026-12-31',
      status: payload.status || 'active',
      created_at: new Date().toISOString(),
    };
    mockAppraisalCycles.unshift(newCycle);
    if (shouldQueryRemote()) supabase.from('appraisal_cycles').insert(payload).catch(handleRemoteError);
  },
  async updateCycle(id: string, payload: Partial<AppraisalCycle>): Promise<void> {
    const idx = mockAppraisalCycles.findIndex((c) => c.id === id);
    if (idx !== -1) mockAppraisalCycles[idx] = { ...mockAppraisalCycles[idx], ...payload };
    if (shouldQueryRemote()) supabase.from('appraisal_cycles').update(payload).eq('id', id).catch(handleRemoteError);
  },
  async goals(params?: { employeeId?: string; cycleId?: string }): Promise<Goal[]> {
    if (shouldQueryRemote()) {
      let query = supabase.from('goals').select('*').order('created_at', { ascending: false }).limit(200);
      if (params?.employeeId) query = query.eq('employee_id', params.employeeId);
      if (params?.cycleId) query = query.eq('cycle_id', params.cycleId);
      const remote = await runRemote(query);
      if (remote && remote.length > 0) return asArray<Goal>(remote);
    }
    let list = [...mockGoals];
    if (params?.employeeId) list = list.filter((g) => g.employee_id === params.employeeId);
    if (params?.cycleId) list = list.filter((g) => g.cycle_id === params.cycleId);
    return list;
  },
  async createGoal(payload: Partial<Goal>): Promise<void> {
    const newGoal: Goal = {
      id: `goal-${Date.now()}`,
      employee_id: payload.employee_id || 'e0000000-0000-4000-8000-000000000002',
      cycle_id: payload.cycle_id || mockAppraisalCycles[0].id,
      title: payload.title || 'Goal title',
      description: payload.description || null,
      weight: payload.weight || 20,
      target_date: payload.target_date || '2026-12-31',
      progress: payload.progress || 0,
      status: payload.status || 'in_progress',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockGoals.unshift(newGoal);
    if (shouldQueryRemote()) supabase.from('goals').insert(payload).catch(handleRemoteError);
  },
  async updateGoal(id: string, payload: Partial<Goal>): Promise<void> {
    const idx = mockGoals.findIndex((g) => g.id === id);
    if (idx !== -1) mockGoals[idx] = { ...mockGoals[idx], ...payload };
    if (shouldQueryRemote()) supabase.from('goals').update(payload).eq('id', id).catch(handleRemoteError);
  },
  async deleteGoal(id: string): Promise<void> {
    const idx = mockGoals.findIndex((g) => g.id === id);
    if (idx !== -1) mockGoals.splice(idx, 1);
    if (shouldQueryRemote()) supabase.from('goals').delete().eq('id', id).catch(handleRemoteError);
  },
  async appraisals(params?: { employeeId?: string; cycleId?: string }): Promise<Appraisal[]> {
    if (shouldQueryRemote()) {
      let query = supabase
        .from('appraisals')
        .select('*, employee:employees!appraisals_employee_id_fkey(id,first_name,last_name,employee_no), cycle:appraisal_cycles!appraisals_cycle_id_fkey(id,name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (params?.employeeId) query = query.eq('employee_id', params.employeeId);
      if (params?.cycleId) query = query.eq('cycle_id', params.cycleId);
      const remote = await runRemote(query);
      if (remote && remote.length > 0) return asArray<Appraisal>(remote);
    }
    let list = [...mockAppraisals];
    if (params?.employeeId) list = list.filter((a) => a.employee_id === params.employeeId);
    if (params?.cycleId) list = list.filter((a) => a.cycle_id === params.cycleId);
    return list;
  },
  async createAppraisal(payload: Partial<Appraisal>): Promise<void> {
    if (shouldQueryRemote()) supabase.from('appraisals').insert(payload).catch(handleRemoteError);
  },
  async updateAppraisal(id: string, payload: Partial<Appraisal>): Promise<void> {
    if (shouldQueryRemote()) supabase.from('appraisals').update(payload).eq('id', id).catch(handleRemoteError);
  },
};

/* ----------------------------- development ------------------------------ */

export const developmentApi = {
  async trainings(): Promise<Training[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(supabase.from('trainings').select('*').order('start_date', { ascending: false }).limit(100));
      if (remote && remote.length > 0) return asArray<Training>(remote);
    }
    return mockTrainings;
  },
  async createTraining(payload: Partial<Training>): Promise<void> {
    const newTr: Training = {
      id: `tr-${Date.now()}`,
      title: payload.title || 'New Training Programme',
      code: payload.code || `TRN-${Date.now().toString().slice(-3)}`,
      description: payload.description || null,
      provider: payload.provider || 'Internal',
      start_date: payload.start_date || '2026-12-01',
      end_date: payload.end_date || '2026-12-05',
      budget: payload.budget || 0,
      status: payload.status || 'planned',
      created_at: new Date().toISOString(),
    };
    mockTrainings.unshift(newTr);
    if (shouldQueryRemote()) supabase.from('trainings').insert(payload).catch(handleRemoteError);
  },
  async updateTraining(id: string, payload: Partial<Training>): Promise<void> {
    const idx = mockTrainings.findIndex((t) => t.id === id);
    if (idx !== -1) mockTrainings[idx] = { ...mockTrainings[idx], ...payload };
    if (shouldQueryRemote()) supabase.from('trainings').update(payload).eq('id', id).catch(handleRemoteError);
  },
  async enrollments(params?: { employeeId?: string; trainingId?: string }): Promise<TrainingEnrollment[]> {
    if (shouldQueryRemote()) {
      let query = supabase
        .from('training_enrollments')
        .select('*, employee:employees!training_enrollments_employee_id_fkey(id,first_name,last_name,employee_no), training:trainings!training_enrollments_training_id_fkey(id,title,code)')
        .order('enrolled_at', { ascending: false })
        .limit(200);
      if (params?.employeeId) query = query.eq('employee_id', params.employeeId);
      if (params?.trainingId) query = query.eq('training_id', params.trainingId);
      const remote = await runRemote(query);
      if (remote) return asArray<TrainingEnrollment>(remote);
    }
    return [];
  },
  async enroll(payload: Partial<TrainingEnrollment>): Promise<void> {
    if (shouldQueryRemote()) supabase.from('training_enrollments').insert(payload).catch(handleRemoteError);
  },
  async updateEnrollment(id: string, payload: Partial<TrainingEnrollment>): Promise<void> {
    if (shouldQueryRemote()) supabase.from('training_enrollments').update(payload).eq('id', id).catch(handleRemoteError);
  },
};

/* -------------------------------- payroll ------------------------------- */

export const payrollApi = {
  async periods(): Promise<PayrollPeriod[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(supabase.from('payroll_periods').select('*').order('period_start', { ascending: false }).limit(50));
      if (remote && remote.length > 0) return asArray<PayrollPeriod>(remote);
    }
    return mockPayrollPeriods;
  },
  async createPeriod(payload: Partial<PayrollPeriod>): Promise<void> {
    const newPeriod: PayrollPeriod = {
      id: `period-${Date.now()}`,
      name: payload.name || 'New Payroll Period',
      period_start: payload.period_start || '2026-12-01',
      period_end: payload.period_end || '2026-12-31',
      pay_date: payload.pay_date || '2026-12-28',
      status: 'draft',
      total_gross: 0,
      total_deductions: 0,
      total_net: 0,
      employee_count: 24,
      created_by: null,
      approved_by: null,
      approved_at: null,
      notes: payload.notes || null,
      created_at: new Date().toISOString(),
    };
    mockPayrollPeriods.unshift(newPeriod);
    if (shouldQueryRemote()) supabase.from('payroll_periods').insert(payload).catch(handleRemoteError);
  },
  async items(periodId: string): Promise<PayrollItem[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(
        supabase.from('payroll_items').select(PAYROLL_ITEM_SELECT).eq('period_id', periodId).order('employee_id').limit(500),
      );
      if (remote) return asArray<PayrollItem>(remote);
    }
    return [];
  },
  async myPayslips(employeeId: string): Promise<PayrollItem[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(
        supabase.from('payroll_items').select(PAYROLL_ITEM_SELECT).eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(24),
      );
      if (remote) return asArray<PayrollItem>(remote);
    }
    return [];
  },
  async run(_periodId: string): Promise<{ employees: number; total_net: number }> {
    return { employees: 24, total_net: 14500000 };
  },
  async approve(periodId: string): Promise<void> {
    const period = mockPayrollPeriods.find((p) => p.id === periodId);
    if (period) period.status = 'approved';
    if (shouldQueryRemote()) supabase.from('payroll_periods').update({ status: 'approved' }).eq('id', periodId).catch(handleRemoteError);
  },
  async markPaid(periodId: string): Promise<void> {
    const period = mockPayrollPeriods.find((p) => p.id === periodId);
    if (period) period.status = 'paid';
    if (shouldQueryRemote()) supabase.from('payroll_periods').update({ status: 'paid' }).eq('id', periodId).catch(handleRemoteError);
  },
  async updateItem(id: string, payload: Partial<PayrollItem>): Promise<void> {
    if (shouldQueryRemote()) supabase.from('payroll_items').update(payload).eq('id', id).catch(handleRemoteError);
  },
};

/* ------------------------------ disciplinary ---------------------------- */

export const disciplinaryApi = {
  async cases(): Promise<DisciplinaryCase[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(
        supabase
          .from('disciplinary_cases')
          .select('*, employee:employees!disciplinary_cases_employee_id_fkey(id,first_name,last_name,employee_no)')
          .order('created_at', { ascending: false })
          .limit(100),
      );
      if (remote && remote.length > 0) return asArray<DisciplinaryCase>(remote);
    }
    return mockDisciplinaryCases;
  },
  async createCase(payload: Partial<DisciplinaryCase>): Promise<void> {
    const newCase: DisciplinaryCase = {
      id: `disc-${Date.now()}`,
      case_no: payload.case_no || `DISC-2026-${String(mockDisciplinaryCases.length + 1).padStart(3, '0')}`,
      employee_id: payload.employee_id || 'e0000000-0000-4000-8000-000000000002',
      incident_date: payload.incident_date || '2026-11-01',
      category: payload.category || 'conduct',
      description: payload.description || 'Description of the case',
      status: 'open',
      hearing_date: payload.hearing_date || null,
      panel_members: payload.panel_members || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockDisciplinaryCases.unshift(newCase);
    if (shouldQueryRemote()) supabase.from('disciplinary_cases').insert(payload).catch(handleRemoteError);
  },
  async updateCase(id: string, payload: Partial<DisciplinaryCase>): Promise<void> {
    const idx = mockDisciplinaryCases.findIndex((c) => c.id === id);
    if (idx !== -1) mockDisciplinaryCases[idx] = { ...mockDisciplinaryCases[idx], ...payload };
    if (shouldQueryRemote()) supabase.from('disciplinary_cases').update(payload).eq('id', id).catch(handleRemoteError);
  },
  async nextCaseNo(): Promise<string> {
    return `DISC-2026-${String(mockDisciplinaryCases.length + 1).padStart(3, '0')}`;
  },
  async actions(caseId: string): Promise<DisciplinaryAction[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(supabase.from('disciplinary_actions').select('*').eq('case_id', caseId).order('action_date', { ascending: false }).limit(50));
      if (remote) return asArray<DisciplinaryAction>(remote);
    }
    return [];
  },
  async createAction(payload: Partial<DisciplinaryAction>): Promise<void> {
    if (shouldQueryRemote()) supabase.from('disciplinary_actions').insert(payload).catch(handleRemoteError);
  },
};

/* ------------------------------- succession ----------------------------- */

export const successionApi = {
  async plans(): Promise<SuccessionPlan[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(
        supabase
          .from('succession_plans')
          .select('*, key_position:positions!succession_plans_key_position_id_fkey(id,title,department_id), current_incumbent:employees!succession_plans_current_incumbent_id_fkey(id,first_name,last_name)')
          .order('created_at', { ascending: false })
          .limit(100),
      );
      if (remote && remote.length > 0) return asArray<SuccessionPlan>(remote);
    }
    return mockSuccessionPlans;
  },
  async createPlan(payload: Partial<SuccessionPlan>): Promise<void> {
    const newPlan: SuccessionPlan = {
      id: `plan-${Date.now()}`,
      position_id: payload.position_id || null,
      title: payload.title || 'Succession Plan',
      incumbent_employee_id: payload.incumbent_employee_id || null,
      criticality: payload.criticality || 'high',
      risk_of_loss: payload.risk_of_loss || 'medium',
      notes: payload.notes || null,
      created_at: new Date().toISOString(),
    };
    mockSuccessionPlans.unshift(newPlan);
    if (shouldQueryRemote()) supabase.from('succession_plans').insert(payload).catch(handleRemoteError);
  },
  async updatePlan(id: string, payload: Partial<SuccessionPlan>): Promise<void> {
    const idx = mockSuccessionPlans.findIndex((p) => p.id === id);
    if (idx !== -1) mockSuccessionPlans[idx] = { ...mockSuccessionPlans[idx], ...payload };
    if (shouldQueryRemote()) supabase.from('succession_plans').update(payload).eq('id', id).catch(handleRemoteError);
  },
  async candidates(planId?: string): Promise<SuccessionCandidate[]> {
    if (shouldQueryRemote()) {
      let query = supabase
        .from('succession_candidates')
        .select('*, candidate_employee:employees!succession_candidates_candidate_employee_id_fkey(id,first_name,last_name,employee_no)')
        .order('readiness')
        .limit(100);
      if (planId) query = query.eq('plan_id', planId);
      const remote = await runRemote(query);
      if (remote) return asArray<SuccessionCandidate>(remote);
    }
    return [];
  },
  async addCandidate(payload: Partial<SuccessionCandidate>): Promise<void> {
    if (shouldQueryRemote()) supabase.from('succession_candidates').insert(payload).catch(handleRemoteError);
  },
  async removeCandidate(id: string): Promise<void> {
    if (shouldQueryRemote()) supabase.from('succession_candidates').delete().eq('id', id).catch(handleRemoteError);
  },
};

/* --------------------------------- exit --------------------------------- */

export const exitApi = {
  async requests(employeeId?: string, options?: { financeScoped?: boolean }): Promise<ExitRequest[]> {
    if (shouldQueryRemote()) {
      if (options?.financeScoped) {
        const remote = await runRemote(supabase.rpc('finance_exit_requests'));
        if (remote) {
          const rows = asArray<{
            id: string;
            employee_id: string;
            exit_type: string;
            notice_date: string;
            last_working_day: string;
            status: string;
            created_at: string;
            first_name: string;
            last_name: string;
            employee_no: string;
            department_id: string | null;
            base_salary: number;
          }>(remote);
          return rows.map((row) => ({
            id: row.id,
            employee_id: row.employee_id,
            exit_type: row.exit_type,
            notice_date: row.notice_date,
            last_working_day: row.last_working_day,
            reason: null,
            status: row.status,
            approved_by: null,
            approved_at: null,
            created_at: row.created_at,
            employee: {
              id: row.employee_id,
              first_name: row.first_name,
              last_name: row.last_name,
              employee_no: row.employee_no,
              department_id: row.department_id,
              base_salary: row.base_salary,
            },
          }));
        }
      }
      let query = supabase
          .from('exit_requests')
          .select('*, employee:employees!exit_requests_employee_id_fkey(id,first_name,last_name,employee_no)')
          .order('created_at', { ascending: false })
          .limit(100);
      if (employeeId) query = query.eq('employee_id', employeeId);
      const remote = await runRemote(query);
      if (remote) return asArray<ExitRequest>(remote);
    }
    if (options?.financeScoped) {
      return mockExitRequests
        .filter((request) => request.status !== 'completed')
        .map((request) => ({ ...request, reason: null }));
    }
    return employeeId ? mockExitRequests.filter((request) => request.employee_id === employeeId) : mockExitRequests;
  },
  async createRequest(payload: Partial<ExitRequest>): Promise<void> {
    const newReq: ExitRequest = {
      id: `exit-${Date.now()}`,
      employee_id: payload.employee_id || 'e0000000-0000-4000-8000-000000000002',
      reason: payload.reason || 'Resignation',
      notice_date: payload.notice_date || new Date().toISOString().slice(0, 10),
      intended_last_day: payload.intended_last_day || '2026-12-31',
      actual_last_day: null,
      status: 'submitted',
      exit_interview_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockExitRequests.unshift(newReq);
    if (shouldQueryRemote()) supabase.from('exit_requests').insert(payload).catch(handleRemoteError);
  },
  async updateRequest(id: string, payload: Partial<ExitRequest>): Promise<void> {
    const idx = mockExitRequests.findIndex((e) => e.id === id);
    if (idx !== -1) mockExitRequests[idx] = { ...mockExitRequests[idx], ...payload };
    if (shouldQueryRemote()) supabase.from('exit_requests').update(payload).eq('id', id).catch(handleRemoteError);
  },
  async clearances(exitRequestId: string): Promise<ExitClearance[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(
        supabase
          .from('exit_clearances')
          .select('*')
          .eq('exit_request_id', exitRequestId)
          .order('department')
          .limit(50),
      );
      if (remote) return asArray<ExitClearance>(remote);
    }
    return [];
  },
  async createClearance(payload: Partial<ExitClearance>): Promise<void> {
    if (shouldQueryRemote()) supabase.from('exit_clearances').insert(payload).catch(handleRemoteError);
  },
  async clearItem(clearanceId: string, status: 'cleared' | 'waived', note?: string): Promise<void> {
    if (shouldQueryRemote()) {
      supabase.from('exit_clearances').update({ status, notes: note ?? null, cleared_at: new Date().toISOString() }).eq('id', clearanceId).catch(handleRemoteError);
    }
  },
  async updateClearance(id: string, payload: Partial<ExitClearance>): Promise<void> {
    if (shouldQueryRemote()) supabase.from('exit_clearances').update(payload).eq('id', id).catch(handleRemoteError);
  },
  async settlement(exitRequestId: string): Promise<FinalSettlement | null> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(supabase.from('final_settlements').select('*').eq('exit_request_id', exitRequestId).maybeSingle());
      if (remote) return remote as FinalSettlement;
    }
    return null;
  },
  async saveSettlement(payload: Partial<FinalSettlement>): Promise<void> {
    if (shouldQueryRemote()) supabase.from('final_settlements').upsert(payload, { onConflict: 'exit_request_id' }).catch(handleRemoteError);
  },
  async upsertSettlement(payload: Partial<FinalSettlement>): Promise<void> {
    if (shouldQueryRemote()) supabase.from('final_settlements').upsert(payload, { onConflict: 'exit_request_id' }).catch(handleRemoteError);
  },
};

/* ------------------------------- documents ------------------------------ */

export const documentsApi = {
  async list(params?: { category?: string; search?: string }): Promise<DocumentRecord[]> {
    if (shouldQueryRemote()) {
      let query = supabase.from('documents').select('*').order('created_at', { ascending: false }).limit(200);
      if (params?.category) query = query.eq('category', params.category);
      if (params?.search) {
        const term = params.search.trim();
        query = query.or(`title.ilike.%${term}%,file_name.ilike.%${term}%`);
      }
      const remote = await runRemote(query);
      if (remote && remote.length > 0) return asArray<DocumentRecord>(remote);
    }
    let list = [...mockDocuments];
    if (params?.category) list = list.filter((d) => d.category === params.category);
    if (params?.search) {
      const t = params.search.trim().toLowerCase();
      list = list.filter((d) => d.title.toLowerCase().includes(t) || d.file_name.toLowerCase().includes(t));
    }
    return list;
  },
  async create(payload: Partial<DocumentRecord>): Promise<void> {
    const newDoc: DocumentRecord = {
      id: `doc-${Date.now()}`,
      title: payload.title || 'Document',
      category: payload.category || 'general',
      file_name: payload.file_name || 'document.pdf',
      file_url: payload.file_url || null,
      file_size: payload.file_size || 1024,
      visibility: payload.visibility || 'all',
      owner_employee_id: payload.owner_employee_id || null,
      uploaded_by: payload.uploaded_by || null,
      created_at: new Date().toISOString(),
    };
    mockDocuments.unshift(newDoc);
    if (shouldQueryRemote()) supabase.from('documents').insert(payload).catch(handleRemoteError);
  },
  async upload(file: File, folder = 'documents'): Promise<string> {
    if (shouldQueryRemote()) {
      try {
        const ext = file.name.split('.').pop() || 'dat';
        const path = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
        const { data, error } = await supabase.storage.from('documents').upload(path, file);
        if (!error && data) {
          const { data: pubUrl } = supabase.storage.from('documents').getPublicUrl(data.path);
          return pubUrl.publicUrl;
        }
      } catch {}
    }
    return `/documents/${file.name}`;
  },
  async remove(id: string): Promise<void> {
    const idx = mockDocuments.findIndex((d) => d.id === id);
    if (idx !== -1) mockDocuments.splice(idx, 1);
    if (shouldQueryRemote()) supabase.from('documents').delete().eq('id', id).catch(handleRemoteError);
  },
};

/* ----------------------------- notifications ---------------------------- */

export const notificationsApi = {
  async list(userId: string): Promise<Notification[]> {
    if (shouldQueryRemote()) {
      const remote = await runRemote(
        supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
      );
      if (remote) return asArray<Notification>(remote);
    }
    return mockNotifications.filter((notification) => notification.user_id === userId);
  },
  async markRead(id: string, userId: string): Promise<void> {
    const n = mockNotifications.find((notif) => notif.id === id && notif.user_id === userId);
    if (n) n.is_read = true;
    if (shouldQueryRemote()) {
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', userId)
        .catch(handleRemoteError);
    }
  },
  async markAllRead(userId: string): Promise<void> {
    mockNotifications.forEach((n) => {
      if (n.user_id === userId) n.is_read = true;
    });
    if (shouldQueryRemote()) supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).catch(handleRemoteError);
  },
  async push(payload: { user_id: string; title: string; message?: string; type?: string; link?: string }): Promise<void> {
    const newNotif: Notification = {
      id: `notif-${Date.now()}`,
      user_id: payload.user_id,
      title: payload.title,
      message: payload.message || null,
      type: (payload.type as 'info' | 'leave') || 'info',
      link: payload.link || null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    mockNotifications.unshift(newNotif);
    if (shouldQueryRemote()) supabase.from('notifications').insert(payload).catch(handleRemoteError);
  },
};

/* -------------------------------- audit --------------------------------- */

export const auditApi = {
  async list(params?: { search?: string; limit?: number }): Promise<AuditLog[]> {
    if (shouldQueryRemote()) {
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(params?.limit ?? 200);
      if (params?.search) {
        const term = params.search.trim();
        query = query.or(`action.ilike.%${term}%,entity.ilike.%${term}%,actor_name.ilike.%${term}%`);
      }
      const remote = await runRemote(query);
      if (remote) return asArray<AuditLog>(remote);
    }
    return [
      {
        id: 'audit-mock-1',
        actor_id: 'd0000000-0000-4000-8000-000000000002',
        actor_name: 'Alice Uwimana',
        actor_role: 'admin',
        action: 'system.login',
        entity: 'auth',
        entity_id: 'd0000000-0000-4000-8000-000000000002',
        details: { method: 'demo' },
        created_at: new Date().toISOString(),
      },
    ];
  },
};

/* ------------------------------- dashboard ------------------------------ */

export const dashboardApi = {
  async stats(options?: { includePayroll?: boolean }): Promise<DashboardStats> {
    const includePayroll = options?.includePayroll ?? true;
    const fallbackStats = (): DashboardStats => {
      const stats = getMockDashboardStats();
      return includePayroll ? stats : { ...stats, payrollStatus: null, payrollNet: 0 };
    };

    // If in demo mode or remote unavailable, return the mock stats in <1ms without 10 network calls
    if (!shouldQueryRemote()) {
      return fallbackStats();
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      const employeesRes = await runRemote(supabase.from('employees').select('id,status,department_id,hire_date').limit(500));
      if (!employeesRes || employeesRes.length === 0) {
        return fallbackStats();
      }

      // If remote has data, calculate live stats
      const [jobsRes, candidatesRes, leaveRes, appraisalsRes, casesRes, exitsRes, attendanceRes, departmentsRes] =
        await Promise.all([
          runRemote(supabase.from('job_openings').select('id,status').limit(200)),
          runRemote(supabase.from('candidates').select('id,stage').limit(500)),
          runRemote(supabase.from('leave_requests').select('id,status').limit(500)),
          runRemote(supabase.from('appraisals').select('id,status').limit(500)),
          runRemote(supabase.from('disciplinary_cases').select('id,status').limit(200)),
          runRemote(supabase.from('exit_requests').select('id,status').limit(200)),
          runRemote(supabase.from('attendance').select('id,status,work_date').eq('work_date', today).limit(500)),
          runRemote(supabase.from('departments').select('id,name').limit(100)),
        ]);
      const periodsRes = includePayroll
        ? await runRemote(
            supabase
              .from('payroll_periods')
              .select('id,name,status,total_net,period_start')
              .order('period_start', { ascending: false })
              .limit(1),
          )
        : null;

      const employees = asArray<{ id: string; status: string; department_id: string | null; hire_date: string }>(employeesRes);
      const jobs = asArray<{ id: string; status: string }>(jobsRes);
      const candidates = asArray<{ id: string; stage: string }>(candidatesRes);
      const leave = asArray<{ id: string; status: string }>(leaveRes);
      const appraisals = asArray<{ id: string; status: string }>(appraisalsRes);
      const cases = asArray<{ id: string; status: string }>(casesRes);
      const exits = asArray<{ id: string; status: string }>(exitsRes);
      const periods = asArray<{ id: string; name: string; status: string; total_net: number }>(periodsRes);
      const attendance = asArray<{ id: string; status: string }>(attendanceRes);
      const departments = asArray<{ id: string; name: string }>(departmentsRes);

      const active = employees.filter((e) => e.status === 'active' || e.status === 'probation' || e.status === 'on_leave');
      const present = attendance.filter((a) => a.status === 'present' || a.status === 'remote').length;
      const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;

      const departmentBreakdown = departments
        .map((dept) => ({
          name: dept.name,
          count: active.filter((e) => e.department_id === dept.id).length,
        }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count);

      const headcountTrend: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i -= 1) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const cutoff = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().slice(0, 10);
        headcountTrend.push({
          month: date.toLocaleDateString('en-GB', { month: 'short' }),
          count: active.filter((e) => e.hire_date <= cutoff).length,
        });
      }

      return {
        headcount: employees.length,
        activeEmployees: active.length,
        onProbation: employees.filter((e) => e.status === 'probation').length,
        openRoles: jobs.filter((j) => j.status === 'open').length,
        candidates: candidates.filter((c) => !['hired', 'rejected'].includes(c.stage)).length,
        pendingLeave: leave.filter((l) => l.status === 'pending').length,
        pendingAppraisals: appraisals.filter((a) => a.status !== 'finalized').length,
        openCases: cases.filter((c) => c.status !== 'closed').length,
        exitsInProgress: exits.filter((e) => e.status !== 'completed').length,
        payrollStatus: periods[0]?.status ?? null,
        payrollNet: Number(periods[0]?.total_net ?? 0),
        attendanceRate,
        presentToday: attendance.filter((a) => a.status === 'present').length,
        absentToday: attendance.filter((a) => a.status === 'absent').length,
        lateToday: attendance.filter((a) => a.status === 'late').length,
        remoteToday: attendance.filter((a) => a.status === 'remote').length,
        departmentBreakdown,
        headcountTrend,
      };
    } catch {
      return fallbackStats();
    }
  },
};
