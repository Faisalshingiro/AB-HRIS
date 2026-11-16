export type UserRole =
  | 'system_admin'
  | 'hr_admin'
  | 'hr_officer'
  | 'department_manager'
  | 'finance_officer'
  | 'employee';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  employee_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  head_employee_id: string | null;
  parent_department_id: string | null;
  created_at: string;
  updated_at: string;
  head_employee?: Employee | null;
  parent_department?: Department | null;
}

export interface Position {
  id: string;
  title: string;
  code: string;
  department_id: string;
  grade: string | null;
  min_salary: number | null;
  max_salary: number | null;
  created_at: string;
  updated_at: string;
  department?: Department | null;
}

export interface Employee {
  id: string;
  employee_number: string;
  profile_id: string | null;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  gender: string | null;
  date_of_birth: string | null;
  national_id: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  marital_status: string | null;
  nationality: string;
  department_id: string | null;
  position_id: string | null;
  employment_type: string;
  status: string;
  hire_date: string;
  contract_end_date: string | null;
  reports_to: string | null;
  bank_account: string | null;
  bank_name: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
  department?: Department | null;
  position?: Position | null;
  reports_to_employee?: Employee | null;
}

export interface JobVacancy {
  id: string;
  title: string;
  position_id: string | null;
  department_id: string | null;
  description: string | null;
  requirements: string | null;
  vacancy_type: string;
  status: string;
  openings: number;
  posted_date: string | null;
  closing_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  position?: Position | null;
  department?: Department | null;
}

export interface JobApplication {
  id: string;
  vacancy_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  cover_letter: string | null;
  resume_url: string | null;
  status: string;
  current_employer: string | null;
  years_of_experience: number | null;
  expected_salary: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vacancy?: JobVacancy | null;
  interviews?: Interview[];
}

export interface Interview {
  id: string;
  application_id: string;
  vacancy_id: string | null;
  interview_date: string;
  interview_time: string;
  location: string | null;
  interviewer_id: string | null;
  round: number;
  status: string;
  feedback: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
  interviewer?: Employee | null;
}

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: string;
  title: string;
  file_url: string | null;
  file_name: string | null;
  status: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmploymentContract {
  id: string;
  employee_id: string;
  contract_type: string;
  start_date: string;
  end_date: string | null;
  salary: number;
  currency: string;
  position_id: string | null;
  department_id: string | null;
  status: string;
  terms: string | null;
  document_url: string | null;
  signed_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingTask {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  due_date: string | null;
  completed_date: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  work_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  default_days: number;
  is_paid: boolean;
  requires_approval: boolean;
  carry_forward: boolean;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: string;
  approver_id: string | null;
  approved_date: string | null;
  approver_notes: string | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  leave_type?: LeaveType;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  allocated_days: number;
  used_days: number;
  carried_forward_days: number;
  created_at: string;
  updated_at: string;
  leave_type?: LeaveType;
}

export interface PerformanceKpi {
  id: string;
  name: string;
  description: string | null;
  position_id: string | null;
  department_id: string | null;
  weight: number;
  target_value: string | null;
  measurement_unit: string | null;
  created_at: string;
  updated_at: string;
  position?: Position | null;
  department?: Department | null;
}

export interface PerformanceObjective {
  id: string;
  employee_id: string;
  title: string;
  description: string | null;
  kpi_id: string | null;
  target: string | null;
  achievement: string | null;
  progress: number;
  status: string;
  due_date: string | null;
  review_cycle: string;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  kpi?: PerformanceKpi | null;
}

export interface PerformanceReview {
  id: string;
  employee_id: string;
  reviewer_id: string | null;
  review_cycle: string;
  review_period: string | null;
  review_date: string;
  overall_rating: number | null;
  strengths: string | null;
  areas_for_improvement: string | null;
  goals: string | null;
  reviewer_comments: string | null;
  employee_comments: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  reviewer?: Employee | null;
}

export interface Skill {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  created_at: string;
}

export interface EmployeeSkill {
  id: string;
  employee_id: string;
  skill_id: string;
  proficiency_level: number;
  years_of_experience: number | null;
  certified: boolean;
  last_assessed: string | null;
  created_at: string;
  updated_at: string;
  skill?: Skill;
}

export interface TrainingProgramme {
  id: string;
  title: string;
  description: string | null;
  provider: string | null;
  category: string | null;
  training_type: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_hours: number | null;
  cost: number | null;
  currency: string;
  max_participants: number | null;
  status: string;
  certification: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrainingEnrollment {
  id: string;
  programme_id: string;
  employee_id: string;
  enrollment_date: string;
  completion_date: string | null;
  status: string;
  score: number | null;
  certificate_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  programme?: TrainingProgramme;
  employee?: Employee;
}

export interface CareerProgression {
  id: string;
  employee_id: string;
  from_position_id: string | null;
  to_position_id: string | null;
  from_department_id: string | null;
  to_department_id: string | null;
  change_type: string;
  effective_date: string;
  old_salary: number | null;
  new_salary: number | null;
  reason: string | null;
  approved_by: string | null;
  created_at: string;
  employee?: Employee;
  from_position?: Position | null;
  to_position?: Position | null;
}

export interface Allowance {
  id: string;
  name: string;
  code: string;
  description: string | null;
  allowance_type: string | null;
  default_amount: number;
  is_percentage: boolean;
  is_taxable: boolean;
  created_at: string;
  updated_at: string;
}

export interface Deduction {
  id: string;
  name: string;
  code: string;
  description: string | null;
  deduction_type: string | null;
  default_amount: number;
  is_percentage: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmployeeSalaryComponent {
  id: string;
  employee_id: string;
  component_type: string;
  component_id: string | null;
  component_name: string;
  amount: number;
  is_percentage: boolean;
  is_active: boolean;
  effective_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
}

export interface PayrollRun {
  id: string;
  pay_period_month: number;
  pay_period_year: number;
  run_date: string;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  employee_count: number;
  approved_by: string | null;
  approved_date: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payslip {
  id: string;
  payroll_run_id: string | null;
  employee_id: string;
  pay_period_month: number;
  pay_period_year: number;
  base_salary: number;
  total_allowances: number;
  gross_pay: number;
  total_deductions: number;
  tax_amount: number;
  net_pay: number;
  currency: string;
  status: string;
  payment_date: string | null;
  payment_method: string | null;
  bank_reference: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
  payroll_run?: PayrollRun | null;
}

export interface SuccessionPlan {
  id: string;
  position_id: string;
  current_employee_id: string | null;
  successor_id: string | null;
  readiness_level: string | null;
  notes: string | null;
  risk_level: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  position?: Position;
  current_employee?: Employee | null;
  successor?: Employee | null;
}

export interface DisciplinaryCase {
  id: string;
  case_number: string;
  employee_id: string;
  incident_date: string;
  reported_date: string;
  reported_by: string | null;
  offence_type: string | null;
  description: string;
  severity: string;
  action_taken: string | null;
  status: string;
  hearing_date: string | null;
  outcome: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
}

export interface ExitRequest {
  id: string;
  employee_id: string;
  exit_type: string;
  requested_date: string;
  last_working_date: string;
  reason: string | null;
  notice_given: boolean;
  notice_period_days: number | null;
  status: string;
  approver_id: string | null;
  approved_date: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
}

export interface ExitInterview {
  id: string;
  exit_request_id: string;
  employee_id: string;
  interview_date: string;
  interviewer_id: string | null;
  reason_for_leaving: string | null;
  satisfaction_rating: number | null;
  would_recommend: boolean | null;
  feedback: string | null;
  suggestions: string | null;
  document_url: string | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
}

export interface ExitClearance {
  id: string;
  exit_request_id: string;
  employee_id: string;
  clearance_item: string;
  department: string | null;
  responsible_person_id: string | null;
  status: string;
  completed_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinalSettlement {
  id: string;
  exit_request_id: string;
  employee_id: string;
  salary_due: number;
  leave_encashment: number;
  bonuses: number;
  total_earnings: number;
  total_deductions: number;
  net_settlement: number;
  currency: string;
  status: string;
  approved_by: string | null;
  approved_date: string | null;
  payment_date: string | null;
  notes: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  employee?: Employee;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  notification_type: string;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}
