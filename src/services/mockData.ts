import seedData from './mockSeedData.json';
import type {
  Appraisal,
  AppraisalCycle,
  Candidate,
  DashboardStats,
  Department,
  DisciplinaryCase,
  DocumentRecord,
  EmployeeWithRelations,
  ExitRequest,
  Goal,
  Interview,
  JobOpening,
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  Notification,
  OnboardingTask,
  PayrollPeriod,
  Position,
  Profile,
  SuccessionPlan,
  Training,
} from '@/types/types';

export const mockDepartments: Department[] = (seedData.departments || []).map((d) => ({
  ...d,
  head_employee_id: null,
  created_at: '2026-01-01T00:00:00Z',
})) as Department[];

export const mockPositions: Position[] = (seedData.positions || []).map((p) => ({
  ...p,
  created_at: '2026-01-01T00:00:00Z',
})) as Position[];

const deptMap = new Map(mockDepartments.map((d) => [d.id, d]));
const posMap = new Map(mockPositions.map((p) => [p.id, p]));

const rawEmployees = seedData.employees || [];
const empMap = new Map(rawEmployees.map((e) => [e.id, e]));

export const mockEmployees: EmployeeWithRelations[] = rawEmployees.map((e) => {
  const dept = e.department_id ? deptMap.get(e.department_id) : undefined;
  const pos = e.position_id ? posMap.get(e.position_id) : undefined;
  const mgr = e.manager_id ? empMap.get(e.manager_id) : undefined;

  return {
    ...e,
    profile_id: e.id === 'e0000000-0000-4000-8000-000000000002' ? 'd0000000-0000-4000-8000-000000000002' : null,
    contract_end_date: null,
    photo_url: null,
    notes: null,
    created_at: `${e.hire_date}T08:00:00Z`,
    updated_at: '2026-11-20T00:00:00Z',
    department: dept ? { id: dept.id, name: dept.name, code: dept.code } : null,
    position: pos ? { id: pos.id, title: pos.title, grade: pos.grade } : null,
    manager: mgr ? { id: mgr.id, first_name: mgr.first_name, last_name: mgr.last_name } : null,
  } as unknown as EmployeeWithRelations;
});

export const mockLeaveTypes: LeaveType[] = (seedData.leave_types || []).map((lt) => ({
  ...lt,
  created_at: '2026-01-01T00:00:00Z',
})) as LeaveType[];

const leaveTypeMap = new Map(mockLeaveTypes.map((lt) => [lt.id, lt]));

export const mockLeaveRequests: LeaveRequest[] = (seedData.leave_requests || []).map((lr, index) => {
  const emp = mockEmployees.find((e) => e.id === lr.employee_id);
  const lt = leaveTypeMap.get(lr.leave_type_id);

  return {
    id: `lr-mock-${index + 1}`,
    employee_id: lr.employee_id,
    leave_type_id: lr.leave_type_id,
    start_date: typeof lr.start_date === 'string' ? lr.start_date : '2026-11-25',
    end_date: typeof lr.end_date === 'string' ? lr.end_date : '2026-11-30',
    days: Number(lr.days) || 5,
    reason: lr.reason || null,
    status: (lr.status as 'pending' | 'approved' | 'rejected' | 'cancelled') || 'pending',
    approver_id: lr.approver_id || null,
    decided_at: lr.decided_at || null,
    decision_note: lr.decision_note || null,
    created_at: '2026-11-15T09:00:00Z',
    employee: emp
      ? {
          id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          employee_no: emp.employee_no,
          department_id: emp.department_id,
        }
      : null,
    leave_type: lt ? { id: lt.id, name: lt.name, code: lt.code } : null,
  };
});

export function getMockLeaveBalances(employeeId?: string): LeaveBalance[] {
  const annual = mockLeaveTypes.find((lt) => lt.code === 'ANNUAL') ?? mockLeaveTypes[0];
  const sick = mockLeaveTypes.find((lt) => lt.code === 'SICK') ?? mockLeaveTypes[1];

  return [
    {
      id: `lb-mock-1-${employeeId ?? 'self'}`,
      employee_id: employeeId ?? 'e0000000-0000-4000-8000-000000000002',
      leave_type_id: annual?.id ?? 'c0000000-0000-4000-8000-000000000001',
      year: new Date().getFullYear(),
      entitled_days: annual?.days_per_year ?? 18,
      used_days: 2,
      carried_over: 2,
      leave_type: annual ? { id: annual.id, name: annual.name, code: annual.code } : undefined,
    },
    {
      id: `lb-mock-2-${employeeId ?? 'self'}`,
      employee_id: employeeId ?? 'e0000000-0000-4000-8000-000000000002',
      leave_type_id: sick?.id ?? 'c0000000-0000-4000-8000-000000000002',
      year: new Date().getFullYear(),
      entitled_days: sick?.days_per_year ?? 15,
      used_days: 0,
      carried_over: 0,
      leave_type: sick ? { id: sick.id, name: sick.name, code: sick.code } : undefined,
    },
  ];
}

export const mockJobOpenings: JobOpening[] = (seedData.job_openings || []).map((j) => {
  const dept = j.department_id ? deptMap.get(j.department_id) : undefined;
  return {
    ...j,
    department: dept ? { id: dept.id, name: dept.name } : null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };
}) as unknown as JobOpening[];

export const mockCandidates: Candidate[] = (seedData.candidates || []).map((c) => {
  const job = mockJobOpenings.find((j) => j.id === c.job_opening_id);
  return {
    ...c,
    job_opening: job ? { id: job.id, title: job.title, reference: job.reference } : null,
    created_at: '2026-10-15T00:00:00Z',
    updated_at: '2026-11-10T00:00:00Z',
  };
}) as unknown as Candidate[];

export const mockInterviews: Interview[] = (seedData.interviews || []).map((i) => {
  const candidate = mockCandidates.find((c) => c.id === i.candidate_id);
  const interviewer = mockEmployees.find((e) => e.id === i.interviewer_id);
  return {
    ...i,
    candidate: candidate ? { id: candidate.id, first_name: candidate.first_name, last_name: candidate.last_name } : null,
    interviewer: interviewer ? { id: interviewer.id, first_name: interviewer.first_name, last_name: interviewer.last_name } : null,
    created_at: '2026-10-20T00:00:00Z',
  };
}) as unknown as Interview[];

export const mockOnboardingTasks: OnboardingTask[] = (seedData.onboarding_tasks || []).map((t: Record<string, unknown>, idx: number) => ({
  id: (t.id as string) || `obt-${idx + 1}`,
  employee_id: (t.employee_id as string) || 'e0000000-0000-4000-8000-000000000024',
  title: (t.title as string) || 'Onboarding task',
  category: (t.category as string) || 'general',
  assigned_to: (t.assigned_to as string) || null,
  due_date: (t.due_date as string) || '2026-12-01',
  sort_order: (t.sort_order as number) || idx + 1,
  status: (t.status as 'pending' | 'completed') || 'pending',
  completed_at: (t.completed_at as string) || null,
  created_at: '2026-09-01T00:00:00Z',
})) as OnboardingTask[];

export const mockAppraisalCycles: AppraisalCycle[] = (seedData.appraisal_cycles || []).map((c) => ({
  ...c,
  created_at: '2026-01-01T00:00:00Z',
})) as AppraisalCycle[];

export const mockGoals: Goal[] = (seedData.goals || []).map((g) => ({
  ...g,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
})) as unknown as Goal[];

export const mockAppraisals: Appraisal[] = (seedData.appraisals || []).map((a) => {
  const emp = mockEmployees.find((e) => e.id === a.employee_id);
  const cycle = mockAppraisalCycles.find((c) => c.id === a.cycle_id);
  return {
    ...a,
    employee: emp ? { id: emp.id, first_name: emp.first_name, last_name: emp.last_name, employee_no: emp.employee_no } : null,
    cycle: cycle ? { id: cycle.id, name: cycle.name } : null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };
}) as unknown as Appraisal[];

export const mockTrainings: Training[] = (seedData.trainings || []).map((t) => ({
  ...t,
  created_at: '2026-01-01T00:00:00Z',
})) as Training[];

export const mockPayrollPeriods: PayrollPeriod[] = (seedData.payroll_periods || []).map((p) => ({
  ...p,
  total_gross: 0,
  total_deductions: 0,
  total_paye: 0,
  total_employee_rssb: 0,
  total_employer_rssb: 0,
  total_employee_maternity: 0,
  total_employer_maternity: 0,
  total_net: 0,
  employee_count: 24,
  created_by: null,
  approved_by: null,
  approved_at: null,
  closed_at: null,
  closed_by: null,
  created_at: '2026-09-01T00:00:00Z',
})) as PayrollPeriod[];

export const mockDisciplinaryCases: DisciplinaryCase[] = (seedData.disciplinary_cases || []).map((c) => {
  const emp = mockEmployees.find((e) => e.id === c.employee_id);
  return {
    ...c,
    employee: emp ? { id: emp.id, first_name: emp.first_name, last_name: emp.last_name, employee_no: emp.employee_no } : null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };
}) as unknown as DisciplinaryCase[];

export const mockSuccessionPlans: SuccessionPlan[] = (seedData.succession_plans || []).map((p) => {
  const inc = p.incumbent_employee_id ? mockEmployees.find((e) => e.id === p.incumbent_employee_id) : undefined;
  const pos = p.position_id ? posMap.get(p.position_id) : undefined;
  return {
    ...p,
    incumbent: inc ? { id: inc.id, first_name: inc.first_name, last_name: inc.last_name } : null,
    position: pos ? { id: pos.id, title: pos.title } : null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  };
}) as unknown as SuccessionPlan[];

export const mockExitRequests: ExitRequest[] = (seedData.exit_requests || []).map((e) => {
  const emp = mockEmployees.find((emp) => emp.id === e.employee_id);
  return {
    ...e,
    employee: emp ? { id: emp.id, first_name: emp.first_name, last_name: emp.last_name, employee_no: emp.employee_no } : null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  };
}) as unknown as ExitRequest[];

export const mockDocuments: DocumentRecord[] = (seedData.documents || []).map((d) => ({
  ...d,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
})) as unknown as DocumentRecord[];

export const mockNotifications: Notification[] = [
  {
    id: 'n-mock-1',
    user_id: 'd0000000-0000-4000-8000-000000000002',
    title: '4 Pending Leave Approvals',
    message: 'There are 4 leave requests awaiting approval from line managers.',
    type: 'leave',
    link: '/leave',
    is_read: false,
    created_at: '2026-11-20T08:00:00Z',
  },
  {
    id: 'n-mock-2',
    user_id: 'd0000000-0000-4000-8000-000000000002',
    title: 'New Candidate Applied',
    message: 'New application received for Software Engineer position.',
    type: 'recruitment',
    link: '/recruitment',
    is_read: false,
    created_at: '2026-11-19T14:30:00Z',
  },
];

export const DEMO_PROFILES: Record<string, Profile> = {
  admin: {
    id: 'd0000000-0000-4000-8000-000000000002',
    username: 'admin',
    email: 'admin@abbk.com',
    phone: '+250788100002',
    full_name: 'Alice Uwimana',
    role: 'admin',
    employee_id: 'e0000000-0000-4000-8000-000000000002',
    is_active: true,
    last_login_at: new Date().toISOString(),
    created_at: '2026-01-01T00:00:00Z',
  },
  hr: {
    id: 'd0000000-0000-4000-8000-000000000004',
    username: 'hr',
    email: 'hr@abbk.com',
    phone: '+250788100004',
    full_name: 'Claudine Mukamana',
    role: 'hr',
    employee_id: 'e0000000-0000-4000-8000-000000000004',
    is_active: true,
    last_login_at: new Date().toISOString(),
    created_at: '2026-01-01T00:00:00Z',
  },
  manager: {
    id: 'd0000000-0000-4000-8000-000000000001',
    username: 'manager',
    email: 'manager@abbk.com',
    phone: '+250788100001',
    full_name: 'Jean Bosco Habimana',
    role: 'manager',
    employee_id: 'e0000000-0000-4000-8000-000000000001',
    is_active: true,
    last_login_at: new Date().toISOString(),
    created_at: '2026-01-01T00:00:00Z',
  },
  finance: {
    id: 'd0000000-0000-4000-8000-000000000003',
    username: 'finance',
    email: 'finance@abbk.com',
    phone: '+250788100003',
    full_name: 'Eric Nshimiyimana',
    role: 'finance',
    employee_id: 'e0000000-0000-4000-8000-000000000003',
    is_active: true,
    last_login_at: new Date().toISOString(),
    created_at: '2026-01-01T00:00:00Z',
  },
  employee: {
    id: 'd0000000-0000-4000-8000-000000000015',
    username: 'employee',
    email: 'employee@abbk.com',
    phone: '+250788100015',
    full_name: 'Innocent Ndayisaba',
    role: 'employee',
    employee_id: 'e0000000-0000-4000-8000-000000000015',
    is_active: true,
    last_login_at: new Date().toISOString(),
    created_at: '2026-01-01T00:00:00Z',
  },
};

export function getMockDashboardStats(): DashboardStats {
  const active = mockEmployees.filter((e) => e.status === 'active' || e.status === 'probation' || e.status === 'on_leave');

  const deptCounts: Record<string, number> = {};
  for (const emp of active) {
    const deptName = emp.department?.name || 'Unassigned';
    deptCounts[deptName] = (deptCounts[deptName] || 0) + 1;
  }

  const departmentBreakdown = Object.entries(deptCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const headcountTrend: { month: string; count: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = date.toLocaleDateString('en-GB', { month: 'short' });
    headcountTrend.push({
      month: monthName,
      count: 24,
    });
  }

  return {
    headcount: 24,
    activeEmployees: 24,
    onProbation: 1,
    openRoles: mockJobOpenings.filter((j) => j.status === 'open').length,
    candidates: mockCandidates.filter((c) => !['hired', 'rejected'].includes(c.stage)).length,
    pendingLeave: 4,
    pendingAppraisals: mockAppraisals.filter((a) => a.status !== 'finalized').length,
    openCases: mockDisciplinaryCases.filter((c) => c.status !== 'closed').length,
    exitsInProgress: mockExitRequests.filter((e) => e.status !== 'completed').length,
    payrollStatus: 'draft',
    payrollNet: 0,
    attendanceRate: 0,
    presentToday: 0,
    absentToday: 0,
    lateToday: 0,
    remoteToday: 0,
    departmentBreakdown,
    headcountTrend,
  };
}
