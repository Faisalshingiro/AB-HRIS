export type UserRole = 'admin' | 'hr' | 'manager' | 'finance' | 'employee';
export type EmploymentType = 'permanent' | 'fixed_term' | 'probation' | 'intern' | 'consultant';
export type EmployeeStatus = 'active' | 'probation' | 'on_leave' | 'suspended' | 'exited';
export type GenderType = 'male' | 'female' | 'other';
export type JobStatus = 'draft' | 'open' | 'on_hold' | 'closed';
export type CandidateStage = 'applied' | 'screening' | 'interview' | 'offer' | 'hired' | 'rejected';
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'remote' | 'leave' | 'holiday';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: UserRole;
  employee_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  head_employee_id: string | null;
  cost_center: string | null;
  created_at: string;
}

export interface Position {
  id: string;
  title: string;
  department_id: string | null;
  grade: string | null;
  min_salary: number;
  max_salary: number;
  description: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  employee_no: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  gender: GenderType | null;
  date_of_birth: string | null;
  national_id: string | null;
  address: string | null;
  district: string | null;
  department_id: string | null;
  position_id: string | null;
  manager_id: string | null;
  employment_type: EmploymentType;
  hire_date: string;
  contract_end_date: string | null;
  status: EmployeeStatus;
  base_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowance: number;
  bank_name: string | null;
  bank_account: string | null;
  nid_number: string | null;
  rssb_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeWithRelations extends Employee {
  department?: Pick<Department, 'id' | 'name' | 'code'> | null;
  position?: Pick<Position, 'id' | 'title' | 'grade'> | null;
  manager?: Pick<Employee, 'id' | 'first_name' | 'last_name'> | null;
}

export interface JobOpening {
  id: string;
  reference: string;
  title: string;
  department_id: string | null;
  position_id: string | null;
  employment_type: EmploymentType;
  location: string;
  description: string | null;
  requirements: string | null;
  vacancies: number;
  salary_range: string | null;
  status: JobStatus;
  posted_date: string | null;
  closing_date: string | null;
  created_by: string | null;
  created_at: string;
  department?: Pick<Department, 'id' | 'name'> | null;
}

export interface Candidate {
  id: string;
  job_opening_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  resume_url: string | null;
  source: string | null;
  stage: CandidateStage;
  rating: number;
  notes: string | null;
  applied_at: string;
  updated_at: string;
  job_opening?: Pick<JobOpening, 'id' | 'title' | 'reference'> | null;
}

export interface Interview {
  id: string;
  candidate_id: string;
  scheduled_at: string;
  mode: string;
  interviewer_id: string | null;
  location: string | null;
  score: number | null;
  feedback: string | null;
  status: string;
  created_at: string;
  candidate?: Pick<Candidate, 'id' | 'first_name' | 'last_name'> | null;
  interviewer?: Pick<Employee, 'id' | 'first_name' | 'last_name'> | null;
}

export interface OnboardingTask {
  id: string;
  employee_id: string;
  title: string;
  category: string;
  due_date: string | null;
  assigned_to: string | null;
  status: string;
  completed_at: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  doc_type: string;
  file_name: string;
  file_url: string | null;
  status: string;
  uploaded_at: string;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
}

export interface Attendance {
  id: string;
  employee_id: string;
  work_date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: AttendanceStatus;
  hours_worked: number;
  notes: string | null;
  created_at: string;
  employee?: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_no'> | null;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  days_per_year: number;
  is_paid: boolean;
  requires_document: boolean;
  description: string | null;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  entitled_days: number;
  used_days: number;
  carried_over: number;
  leave_type?: Pick<LeaveType, 'id' | 'name' | 'code'> | null;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  approver_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  employee?: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_no' | 'department_id'> | null;
  leave_type?: Pick<LeaveType, 'id' | 'name' | 'code'> | null;
}

export interface AppraisalCycle {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: string;
  description: string | null;
  created_at: string;
}

export interface Goal {
  id: string;
  employee_id: string;
  cycle_id: string | null;
  title: string;
  description: string | null;
  category: string;
  weight: number;
  target_value: string | null;
  progress: number;
  status: string;
  due_date: string | null;
  created_at: string;
  employee?: Pick<Employee, 'id' | 'first_name' | 'last_name'> | null;
}

export interface Appraisal {
  id: string;
  cycle_id: string;
  employee_id: string;
  manager_id: string | null;
  self_score: number | null;
  manager_score: number | null;
  final_score: number | null;
  rating: string | null;
  self_comments: string | null;
  manager_comments: string | null;
  status: string;
  submitted_at: string | null;
  finalized_at: string | null;
  created_at: string;
  employee?: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_no'> | null;
  cycle?: Pick<AppraisalCycle, 'id' | 'name'> | null;
}

export interface Training {
  id: string;
  title: string;
  provider: string | null;
  category: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  cost: number;
  capacity: number;
  mode: string;
  status: string;
  created_at: string;
}

export interface TrainingEnrollment {
  id: string;
  training_id: string;
  employee_id: string;
  status: string;
  score: number | null;
  certificate_url: string | null;
  completed_at: string | null;
  created_at: string;
  employee?: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_no'> | null;
  training?: Pick<Training, 'id' | 'title' | 'provider'> | null;
}

export interface PayrollPeriod {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  pay_date: string;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  employee_count: number;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface PayrollItem {
  id: string;
  period_id: string;
  employee_id: string;
  basic_salary: number;
  allowances: number;
  overtime: number;
  gross_pay: number;
  paye: number;
  pension_employee: number;
  pension_employer: number;
  maternity_employee: number;
  maternity_employer: number;
  cbhi: number;
  other_deductions: number;
  total_deductions: number;
  net_pay: number;
  days_absent: number;
  status: string;
  notes: string | null;
  created_at: string;
  employee?: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_no' | 'department_id' | 'bank_name' | 'bank_account'> | null;
  period?: Pick<PayrollPeriod, 'id' | 'name' | 'period_start' | 'period_end' | 'pay_date'> | null;
}

export interface DisciplinaryCase {
  id: string;
  case_no: string;
  employee_id: string;
  category: string;
  incident_date: string;
  description: string;
  severity: string;
  status: string;
  outcome: string | null;
  sanction: string | null;
  reported_by: string | null;
  decided_at: string | null;
  created_at: string;
  employee?: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_no'> | null;
}

export interface DisciplinaryAction {
  id: string;
  case_id: string;
  action_type: string;
  description: string | null;
  action_date: string;
  issued_by: string | null;
  created_at: string;
}

export interface SuccessionPlan {
  id: string;
  position_id: string | null;
  title: string;
  incumbent_employee_id: string | null;
  criticality: string;
  risk_of_loss: string;
  notes: string | null;
  created_at: string;
  incumbent?: Pick<Employee, 'id' | 'first_name' | 'last_name'> | null;
  position?: Pick<Position, 'id' | 'title'> | null;
}

export interface SuccessionCandidate {
  id: string;
  plan_id: string;
  employee_id: string;
  readiness: string;
  potential: string;
  notes: string | null;
  created_at: string;
  employee?: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_no'> | null;
}

export interface ExitRequest {
  id: string;
  employee_id: string;
  exit_type: string;
  notice_date: string;
  last_working_day: string;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  employee?: Pick<Employee, 'id' | 'first_name' | 'last_name' | 'employee_no' | 'department_id' | 'base_salary'> | null;
}

export interface ExitClearance {
  id: string;
  exit_request_id: string;
  department: string;
  item: string;
  owner_id: string | null;
  status: string;
  cleared_at: string | null;
  notes: string | null;
  sort_order: number;
}

export interface FinalSettlement {
  id: string;
  exit_request_id: string;
  final_salary: number;
  leave_encashment: number;
  severance: number;
  deductions: number;
  net_settlement: number;
  status: string;
  computed_at: string;
  notes: string | null;
}

export interface DocumentRecord {
  id: string;
  title: string;
  category: string;
  file_name: string;
  file_url: string | null;
  file_size: number;
  visibility: string;
  owner_employee_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardStats {
  headcount: number;
  activeEmployees: number;
  onProbation: number;
  openRoles: number;
  candidates: number;
  pendingLeave: number;
  pendingAppraisals: number;
  openCases: number;
  exitsInProgress: number;
  payrollStatus: string | null;
  payrollNet: number;
  attendanceRate: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  remoteToday: number;
  departmentBreakdown: { name: string; count: number }[];
  headcountTrend: { month: string; count: number }[];
}
