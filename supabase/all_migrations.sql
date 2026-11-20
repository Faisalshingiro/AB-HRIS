-- ============================================
-- FILE: supabase/migrations\00001_core_schema_and_auth.sql
-- ============================================

-- ============ ENUMS ============
CREATE TYPE public.user_role AS ENUM ('admin', 'hr', 'manager', 'finance', 'employee');
CREATE TYPE public.employment_type AS ENUM ('permanent', 'fixed_term', 'probation', 'intern', 'consultant');
CREATE TYPE public.employee_status AS ENUM ('active', 'probation', 'on_leave', 'suspended', 'exited');
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'other');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  email text,
  phone text,
  full_name text,
  role public.user_role NOT NULL DEFAULT 'employee',
  employee_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    split_part(NEW.email, '@', 1),
    initcap(replace(split_part(NEW.email, '@', 1), '_', ' ')),
    'employee'::public.user_role
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ ORG STRUCTURE ============
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  head_employee_id uuid,
  cost_center text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  grade text,
  min_salary numeric(14,2) DEFAULT 0,
  max_salary numeric(14,2) DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no text NOT NULL UNIQUE,
  profile_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  gender public.gender_type,
  date_of_birth date,
  national_id text,
  address text,
  district text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  employment_type public.employment_type NOT NULL DEFAULT 'permanent',
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  contract_end_date date,
  status public.employee_status NOT NULL DEFAULT 'active',
  base_salary numeric(14,2) NOT NULL DEFAULT 0,
  housing_allowance numeric(14,2) NOT NULL DEFAULT 0,
  transport_allowance numeric(14,2) NOT NULL DEFAULT 0,
  other_allowance numeric(14,2) NOT NULL DEFAULT 0,
  bank_name text,
  bank_account text,
  nid_number text,
  rssb_number text,
  emergency_contact_name text,
  emergency_contact_phone text,
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments
  ADD CONSTRAINT departments_head_fk FOREIGN KEY (head_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE INDEX idx_employees_department ON public.employees(department_id);
CREATE INDEX idx_employees_manager ON public.employees(manager_id);
CREATE INDEX idx_employees_status ON public.employees(status);

-- ============ SECURITY HELPERS ============
CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid)
RETURNS public.user_role
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = uid; $$;

CREATE OR REPLACE FUNCTION public.current_employee_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT employee_id FROM public.profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()), false); $$;

CREATE OR REPLACE FUNCTION public.is_hr()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT role IN ('admin','hr') FROM public.profiles WHERE id = auth.uid()), false); $$;

CREATE OR REPLACE FUNCTION public.is_finance()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT role IN ('admin','finance') FROM public.profiles WHERE id = auth.uid()), false); $$;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT role IN ('admin','hr','manager') FROM public.profiles WHERE id = auth.uid()), false); $$;

CREATE OR REPLACE FUNCTION public.manages_employee(emp uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.employees e WHERE e.id = emp AND e.manager_id = public.current_employee_id()); $$;

CREATE OR REPLACE FUNCTION public.can_view_employee(emp uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_hr()
      OR public.is_finance()
      OR emp = public.current_employee_id()
      OR public.manages_employee(emp);
$$;

-- ============ PROFILES RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_self_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_hr() OR public.is_finance());

CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role IS NOT DISTINCT FROM public.get_user_role(auth.uid()));

CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE VIEW public.public_profiles AS
  SELECT p.id, p.username, p.full_name, p.role, p.employee_id
  FROM public.profiles p;

-- ============ DEPARTMENTS RLS ============
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments_select_all" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_write_hr" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "departments_update_hr" ON public.departments FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "departments_delete_admin" ON public.departments FOR DELETE TO authenticated USING (public.is_admin());

-- ============ POSITIONS RLS ============
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "positions_select_all" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "positions_write_hr" ON public.positions FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "positions_update_hr" ON public.positions FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "positions_delete_admin" ON public.positions FOR DELETE TO authenticated USING (public.is_admin());

-- ============ EMPLOYEES RLS ============
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees_select_scoped" ON public.employees FOR SELECT TO authenticated
  USING (public.can_view_employee(id));
CREATE POLICY "employees_insert_hr" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "employees_update_hr" ON public.employees FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "employees_update_self" ON public.employees FOR UPDATE TO authenticated
  USING (id = public.current_employee_id()) WITH CHECK (id = public.current_employee_id());
CREATE POLICY "employees_delete_admin" ON public.employees FOR DELETE TO authenticated USING (public.is_admin());

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_select_admin" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin() OR public.is_hr());
CREATE POLICY "audit_insert_auth" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text; v_role text;
BEGIN
  SELECT full_name, role::text INTO v_name, v_role FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.audit_logs (actor_id, actor_name, actor_role, action, entity, entity_id, details)
  VALUES (auth.uid(), COALESCE(v_name, 'System'), COALESCE(v_role, 'system'), p_action, p_entity, p_entity_id, p_details);
END;
$$;


-- ============================================
-- FILE: supabase/migrations\00002_recruitment_onboarding_attendance_leave.sql
-- ============================================

-- ============ RECRUITMENT ============
CREATE TYPE public.job_status AS ENUM ('draft', 'open', 'on_hold', 'closed');
CREATE TYPE public.candidate_stage AS ENUM ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected');

CREATE TABLE public.job_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  title text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  employment_type public.employment_type NOT NULL DEFAULT 'permanent',
  location text NOT NULL DEFAULT 'Kigali, Rwanda',
  description text,
  requirements text,
  vacancies integer NOT NULL DEFAULT 1,
  salary_range text,
  status public.job_status NOT NULL DEFAULT 'draft',
  posted_date date,
  closing_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_opening_id uuid NOT NULL REFERENCES public.job_openings(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text,
  resume_url text,
  source text,
  stage public.candidate_stage NOT NULL DEFAULT 'applied',
  rating integer DEFAULT 0,
  notes text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_candidates_job ON public.candidates(job_opening_id);

CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  mode text NOT NULL DEFAULT 'in_person',
  interviewer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  location text,
  score integer,
  feedback text,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_openings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_openings_select_auth" ON public.job_openings FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_openings_insert_hr" ON public.job_openings FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "job_openings_update_hr" ON public.job_openings FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "job_openings_delete_hr" ON public.job_openings FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_select_hr" ON public.candidates FOR SELECT TO authenticated USING (public.is_hr() OR public.is_manager());
CREATE POLICY "candidates_insert_hr" ON public.candidates FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "candidates_update_hr" ON public.candidates FOR UPDATE TO authenticated USING (public.is_hr() OR public.is_manager()) WITH CHECK (public.is_hr() OR public.is_manager());
CREATE POLICY "candidates_delete_hr" ON public.candidates FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "interviews_select_hr" ON public.interviews FOR SELECT TO authenticated USING (public.is_hr() OR public.is_manager());
CREATE POLICY "interviews_insert_hr" ON public.interviews FOR INSERT TO authenticated WITH CHECK (public.is_hr() OR public.is_manager());
CREATE POLICY "interviews_update_hr" ON public.interviews FOR UPDATE TO authenticated USING (public.is_hr() OR public.is_manager()) WITH CHECK (public.is_hr() OR public.is_manager());
CREATE POLICY "interviews_delete_hr" ON public.interviews FOR DELETE TO authenticated USING (public.is_hr());

-- ============ ONBOARDING ============
CREATE TABLE public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  due_date date,
  assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_onboarding_employee ON public.onboarding_tasks(employee_id);

CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_name text NOT NULL,
  file_url text,
  status text NOT NULL DEFAULT 'pending',
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  verified_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  verified_at timestamptz,
  notes text
);

ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding_select_scoped" ON public.onboarding_tasks FOR SELECT TO authenticated
  USING (public.can_view_employee(employee_id));
CREATE POLICY "onboarding_insert_hr" ON public.onboarding_tasks FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "onboarding_update_scoped" ON public.onboarding_tasks FOR UPDATE TO authenticated
  USING (public.can_view_employee(employee_id)) WITH CHECK (public.can_view_employee(employee_id));
CREATE POLICY "onboarding_delete_hr" ON public.onboarding_tasks FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emp_docs_select_scoped" ON public.employee_documents FOR SELECT TO authenticated
  USING (public.can_view_employee(employee_id));
CREATE POLICY "emp_docs_insert_scoped" ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (public.can_view_employee(employee_id));
CREATE POLICY "emp_docs_update_scoped" ON public.employee_documents FOR UPDATE TO authenticated
  USING (public.can_view_employee(employee_id)) WITH CHECK (public.can_view_employee(employee_id));
CREATE POLICY "emp_docs_delete_hr" ON public.employee_documents FOR DELETE TO authenticated USING (public.is_hr());

-- ============ ATTENDANCE ============
CREATE TYPE public.attendance_status AS ENUM ('present', 'late', 'absent', 'remote', 'leave', 'holiday');

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date date NOT NULL DEFAULT CURRENT_DATE,
  clock_in timestamptz,
  clock_out timestamptz,
  status public.attendance_status NOT NULL DEFAULT 'present',
  hours_worked numeric(5,2) DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);
CREATE INDEX idx_attendance_date ON public.attendance(work_date DESC);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_select_scoped" ON public.attendance FOR SELECT TO authenticated
  USING (public.can_view_employee(employee_id));
CREATE POLICY "attendance_insert_scoped" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (public.can_view_employee(employee_id));
CREATE POLICY "attendance_update_scoped" ON public.attendance FOR UPDATE TO authenticated
  USING (public.can_view_employee(employee_id)) WITH CHECK (public.can_view_employee(employee_id));
CREATE POLICY "attendance_delete_hr" ON public.attendance FOR DELETE TO authenticated USING (public.is_hr());

-- ============ LEAVE ============
CREATE TABLE public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  days_per_year integer NOT NULL DEFAULT 18,
  is_paid boolean NOT NULL DEFAULT true,
  requires_document boolean NOT NULL DEFAULT false,
  description text
);

CREATE TABLE public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL,
  entitled_days numeric(6,1) NOT NULL DEFAULT 0,
  used_days numeric(6,1) NOT NULL DEFAULT 0,
  carried_over numeric(6,1) NOT NULL DEFAULT 0,
  UNIQUE (employee_id, leave_type_id, year)
);

CREATE TYPE public.leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days numeric(6,1) NOT NULL,
  reason text,
  status public.leave_status NOT NULL DEFAULT 'pending',
  approver_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leave_employee ON public.leave_requests(employee_id);
CREATE INDEX idx_leave_status ON public.leave_requests(status);

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_types_select_all" ON public.leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave_types_write_hr" ON public.leave_types FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "leave_types_update_hr" ON public.leave_types FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "leave_types_delete_admin" ON public.leave_types FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_balances_select_scoped" ON public.leave_balances FOR SELECT TO authenticated
  USING (public.can_view_employee(employee_id));
CREATE POLICY "leave_balances_insert_hr" ON public.leave_balances FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "leave_balances_update_scoped" ON public.leave_balances FOR UPDATE TO authenticated
  USING (public.is_hr() OR public.manages_employee(employee_id)) WITH CHECK (public.is_hr() OR public.manages_employee(employee_id));
CREATE POLICY "leave_balances_delete_hr" ON public.leave_balances FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_select_scoped" ON public.leave_requests FOR SELECT TO authenticated
  USING (public.can_view_employee(employee_id));
CREATE POLICY "leave_insert_self" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = public.current_employee_id() OR public.is_hr());
CREATE POLICY "leave_update_scoped" ON public.leave_requests FOR UPDATE TO authenticated
  USING (public.can_view_employee(employee_id)) WITH CHECK (public.can_view_employee(employee_id));
CREATE POLICY "leave_delete_hr" ON public.leave_requests FOR DELETE TO authenticated USING (public.is_hr());

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'info',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_insert_auth" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());


-- ============================================
-- FILE: supabase/migrations\00003_performance_development_payroll.sql
-- ============================================

-- ============ PERFORMANCE ============
CREATE TABLE public.appraisal_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES public.appraisal_cycles(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'business',
  weight integer NOT NULL DEFAULT 20,
  target_value text,
  progress integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_goals_employee ON public.goals(employee_id);

CREATE TABLE public.appraisals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.appraisal_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  self_score numeric(4,2),
  manager_score numeric(4,2),
  final_score numeric(4,2),
  rating text,
  self_comments text,
  manager_comments text,
  status text NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

ALTER TABLE public.appraisal_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cycles_select_all" ON public.appraisal_cycles FOR SELECT TO authenticated USING (true);
CREATE POLICY "cycles_insert_hr" ON public.appraisal_cycles FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "cycles_update_hr" ON public.appraisal_cycles FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "cycles_delete_hr" ON public.appraisal_cycles FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_select_scoped" ON public.goals FOR SELECT TO authenticated USING (public.can_view_employee(employee_id));
CREATE POLICY "goals_insert_scoped" ON public.goals FOR INSERT TO authenticated
  WITH CHECK (public.can_view_employee(employee_id));
CREATE POLICY "goals_update_scoped" ON public.goals FOR UPDATE TO authenticated
  USING (public.can_view_employee(employee_id)) WITH CHECK (public.can_view_employee(employee_id));
CREATE POLICY "goals_delete_scoped" ON public.goals FOR DELETE TO authenticated USING (public.can_view_employee(employee_id));

ALTER TABLE public.appraisals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appraisals_select_scoped" ON public.appraisals FOR SELECT TO authenticated USING (public.can_view_employee(employee_id));
CREATE POLICY "appraisals_insert_hr" ON public.appraisals FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "appraisals_update_scoped" ON public.appraisals FOR UPDATE TO authenticated
  USING (public.can_view_employee(employee_id)) WITH CHECK (public.can_view_employee(employee_id));
CREATE POLICY "appraisals_delete_hr" ON public.appraisals FOR DELETE TO authenticated USING (public.is_hr());

-- ============ DEVELOPMENT ============
CREATE TABLE public.trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  provider text,
  category text NOT NULL DEFAULT 'technical',
  description text,
  start_date date,
  end_date date,
  cost numeric(14,2) NOT NULL DEFAULT 0,
  capacity integer NOT NULL DEFAULT 20,
  mode text NOT NULL DEFAULT 'in_person',
  status text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.training_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'enrolled',
  score integer,
  certificate_url text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (training_id, employee_id)
);

ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainings_select_all" ON public.trainings FOR SELECT TO authenticated USING (true);
CREATE POLICY "trainings_insert_hr" ON public.trainings FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "trainings_update_hr" ON public.trainings FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "trainings_delete_hr" ON public.trainings FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.training_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enroll_select_scoped" ON public.training_enrollments FOR SELECT TO authenticated USING (public.can_view_employee(employee_id));
CREATE POLICY "enroll_insert_scoped" ON public.training_enrollments FOR INSERT TO authenticated WITH CHECK (public.can_view_employee(employee_id));
CREATE POLICY "enroll_update_scoped" ON public.training_enrollments FOR UPDATE TO authenticated
  USING (public.can_view_employee(employee_id)) WITH CHECK (public.can_view_employee(employee_id));
CREATE POLICY "enroll_delete_scoped" ON public.training_enrollments FOR DELETE TO authenticated USING (public.can_view_employee(employee_id));

-- ============ PAYROLL ============
CREATE TABLE public.payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  pay_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  total_gross numeric(16,2) NOT NULL DEFAULT 0,
  total_deductions numeric(16,2) NOT NULL DEFAULT 0,
  total_net numeric(16,2) NOT NULL DEFAULT 0,
  employee_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  basic_salary numeric(14,2) NOT NULL DEFAULT 0,
  allowances numeric(14,2) NOT NULL DEFAULT 0,
  overtime numeric(14,2) NOT NULL DEFAULT 0,
  gross_pay numeric(14,2) NOT NULL DEFAULT 0,
  paye numeric(14,2) NOT NULL DEFAULT 0,
  pension_employee numeric(14,2) NOT NULL DEFAULT 0,
  pension_employer numeric(14,2) NOT NULL DEFAULT 0,
  maternity_employee numeric(14,2) NOT NULL DEFAULT 0,
  maternity_employer numeric(14,2) NOT NULL DEFAULT 0,
  cbhi numeric(14,2) NOT NULL DEFAULT 0,
  other_deductions numeric(14,2) NOT NULL DEFAULT 0,
  total_deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_pay numeric(14,2) NOT NULL DEFAULT 0,
  days_absent integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'computed',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, employee_id)
);
CREATE INDEX idx_payroll_items_period ON public.payroll_items(period_id);

ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "periods_select_finance" ON public.payroll_periods FOR SELECT TO authenticated
  USING (public.is_finance() OR public.is_hr());
CREATE POLICY "periods_insert_finance" ON public.payroll_periods FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "periods_update_finance" ON public.payroll_periods FOR UPDATE TO authenticated
  USING (public.is_finance()) WITH CHECK (public.is_finance());
CREATE POLICY "periods_delete_admin" ON public.payroll_periods FOR DELETE TO authenticated USING (public.is_admin());

ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items_select_scoped" ON public.payroll_items FOR SELECT TO authenticated
  USING (public.is_finance() OR public.is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "items_insert_finance" ON public.payroll_items FOR INSERT TO authenticated WITH CHECK (public.is_finance());
CREATE POLICY "items_update_finance" ON public.payroll_items FOR UPDATE TO authenticated
  USING (public.is_finance()) WITH CHECK (public.is_finance());
CREATE POLICY "items_delete_finance" ON public.payroll_items FOR DELETE TO authenticated USING (public.is_finance());

-- ============ PAYROLL CALCULATION ============
CREATE OR REPLACE FUNCTION public.calc_paye(taxable numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT ROUND(CASE
    WHEN taxable <= 60000 THEN 0
    WHEN taxable <= 100000 THEN (taxable - 60000) * 0.10
    WHEN taxable <= 200000 THEN 4000 + (taxable - 100000) * 0.20
    ELSE 24000 + (taxable - 200000) * 0.30
  END, 0);
$$;

CREATE OR REPLACE FUNCTION public.run_payroll(p_period_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_period public.payroll_periods;
  v_emp record;
  v_gross numeric;
  v_paye numeric;
  v_pen_e numeric;
  v_pen_r numeric;
  v_mat_e numeric;
  v_mat_r numeric;
  v_cbhi numeric;
  v_ded numeric;
  v_net numeric;
  v_absent integer;
  v_count integer := 0;
  v_tg numeric := 0;
  v_td numeric := 0;
  v_tn numeric := 0;
BEGIN
  IF NOT public.is_finance() THEN
    RAISE EXCEPTION 'Only finance officers may process payroll';
  END IF;

  SELECT * INTO v_period FROM public.payroll_periods WHERE id = p_period_id;
  IF v_period.id IS NULL THEN RAISE EXCEPTION 'Payroll period not found'; END IF;
  IF v_period.status IN ('approved', 'paid', 'locked') THEN
    RAISE EXCEPTION 'Payroll period is locked and cannot be recalculated';
  END IF;

  DELETE FROM public.payroll_items WHERE period_id = p_period_id;

  FOR v_emp IN
    SELECT e.* FROM public.employees e
    WHERE e.status IN ('active', 'probation', 'on_leave')
    ORDER BY e.employee_no
  LOOP
    SELECT COUNT(*) INTO v_absent FROM public.attendance a
      WHERE a.employee_id = v_emp.id AND a.status = 'absent'
        AND a.work_date BETWEEN v_period.period_start AND v_period.period_end;

    v_gross := v_emp.base_salary + v_emp.housing_allowance + v_emp.transport_allowance + v_emp.other_allowance;
    v_gross := v_gross - (v_emp.base_salary / 30.0 * v_absent);
    v_gross := GREATEST(ROUND(v_gross, 0), 0);

    v_paye := public.calc_paye(v_gross);
    v_pen_e := ROUND(v_gross * 0.03, 0);
    v_pen_r := ROUND(v_gross * 0.03, 0);
    v_mat_e := ROUND(v_gross * 0.003, 0);
    v_mat_r := ROUND(v_gross * 0.003, 0);
    v_cbhi := ROUND(v_gross * 0.005, 0);
    v_ded := v_paye + v_pen_e + v_mat_e + v_cbhi;
    v_net := v_gross - v_ded;

    INSERT INTO public.payroll_items (
      period_id, employee_id, basic_salary, allowances, overtime, gross_pay,
      paye, pension_employee, pension_employer, maternity_employee, maternity_employer,
      cbhi, other_deductions, total_deductions, net_pay, days_absent, status
    ) VALUES (
      p_period_id, v_emp.id, v_emp.base_salary,
      v_emp.housing_allowance + v_emp.transport_allowance + v_emp.other_allowance,
      0, v_gross, v_paye, v_pen_e, v_pen_r, v_mat_e, v_mat_r, v_cbhi, 0, v_ded, v_net, v_absent, 'computed'
    );

    v_count := v_count + 1;
    v_tg := v_tg + v_gross;
    v_td := v_td + v_ded;
    v_tn := v_tn + v_net;
  END LOOP;

  UPDATE public.payroll_periods SET
    total_gross = v_tg, total_deductions = v_td, total_net = v_tn,
    employee_count = v_count, status = 'pending_approval'
  WHERE id = p_period_id;

  PERFORM public.log_audit('payroll.processed', 'payroll_period', p_period_id::text,
    jsonb_build_object('employees', v_count, 'total_net', v_tn));

  RETURN jsonb_build_object('employees', v_count, 'total_gross', v_tg, 'total_deductions', v_td, 'total_net', v_tn);
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_payroll(p_period_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_finance() THEN RAISE EXCEPTION 'Only finance officers may approve payroll'; END IF;
  UPDATE public.payroll_periods
    SET status = 'approved', approved_by = auth.uid(), approved_at = now()
    WHERE id = p_period_id AND status = 'pending_approval';
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll period is not awaiting approval'; END IF;
  PERFORM public.log_audit('payroll.approved', 'payroll_period', p_period_id::text, NULL);
END;
$$;


-- ============================================
-- FILE: supabase/migrations\00004_disciplinary_succession_exit_documents.sql
-- ============================================

-- ============ DISCIPLINARY ============
CREATE TABLE public.disciplinary_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_no text NOT NULL UNIQUE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'misconduct',
  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'minor',
  status text NOT NULL DEFAULT 'open',
  outcome text,
  sanction text,
  reported_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_disc_employee ON public.disciplinary_cases(employee_id);

CREATE TABLE public.disciplinary_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.disciplinary_cases(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  description text,
  action_date date NOT NULL DEFAULT CURRENT_DATE,
  issued_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disciplinary_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc_select_scoped" ON public.disciplinary_cases FOR SELECT TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id() OR public.manages_employee(employee_id));
CREATE POLICY "disc_insert_hr" ON public.disciplinary_cases FOR INSERT TO authenticated WITH CHECK (public.is_hr() OR public.is_manager());
CREATE POLICY "disc_update_hr" ON public.disciplinary_cases FOR UPDATE TO authenticated
  USING (public.is_hr() OR public.manages_employee(employee_id)) WITH CHECK (public.is_hr() OR public.manages_employee(employee_id));
CREATE POLICY "disc_delete_hr" ON public.disciplinary_cases FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.disciplinary_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc_act_select" ON public.disciplinary_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.disciplinary_cases c WHERE c.id = case_id
    AND (public.is_hr() OR c.employee_id = public.current_employee_id() OR public.manages_employee(c.employee_id))));
CREATE POLICY "disc_act_insert" ON public.disciplinary_actions FOR INSERT TO authenticated WITH CHECK (public.is_hr() OR public.is_manager());
CREATE POLICY "disc_act_update" ON public.disciplinary_actions FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "disc_act_delete" ON public.disciplinary_actions FOR DELETE TO authenticated USING (public.is_hr());

-- ============ SUCCESSION ============
CREATE TABLE public.succession_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  title text NOT NULL,
  incumbent_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  criticality text NOT NULL DEFAULT 'high',
  risk_of_loss text NOT NULL DEFAULT 'medium',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.succession_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.succession_plans(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  readiness text NOT NULL DEFAULT 'ready_1_2_years',
  potential text NOT NULL DEFAULT 'high',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, employee_id)
);

ALTER TABLE public.succession_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "succ_select_hr" ON public.succession_plans FOR SELECT TO authenticated USING (public.is_hr() OR public.is_manager());
CREATE POLICY "succ_insert_hr" ON public.succession_plans FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "succ_update_hr" ON public.succession_plans FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "succ_delete_hr" ON public.succession_plans FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.succession_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "succ_cand_select" ON public.succession_candidates FOR SELECT TO authenticated USING (public.is_hr() OR public.is_manager());
CREATE POLICY "succ_cand_insert" ON public.succession_candidates FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "succ_cand_update" ON public.succession_candidates FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "succ_cand_delete" ON public.succession_candidates FOR DELETE TO authenticated USING (public.is_hr());

-- ============ EXIT ============
CREATE TABLE public.exit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  exit_type text NOT NULL DEFAULT 'resignation',
  notice_date date NOT NULL DEFAULT CURRENT_DATE,
  last_working_day date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'submitted',
  approved_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_exit_employee ON public.exit_requests(employee_id);

CREATE TABLE public.exit_clearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_request_id uuid NOT NULL REFERENCES public.exit_requests(id) ON DELETE CASCADE,
  department text NOT NULL,
  item text NOT NULL,
  owner_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  cleared_at timestamptz,
  notes text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.final_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_request_id uuid NOT NULL UNIQUE REFERENCES public.exit_requests(id) ON DELETE CASCADE,
  final_salary numeric(14,2) NOT NULL DEFAULT 0,
  leave_encashment numeric(14,2) NOT NULL DEFAULT 0,
  severance numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_settlement numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  computed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.exit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exit_select_scoped" ON public.exit_requests FOR SELECT TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id() OR public.manages_employee(employee_id));
CREATE POLICY "exit_insert_scoped" ON public.exit_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "exit_update_scoped" ON public.exit_requests FOR UPDATE TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id() OR public.manages_employee(employee_id))
  WITH CHECK (public.is_hr() OR employee_id = public.current_employee_id() OR public.manages_employee(employee_id));
CREATE POLICY "exit_delete_hr" ON public.exit_requests FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.exit_clearances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clear_select" ON public.exit_clearances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exit_requests r WHERE r.id = exit_request_id
    AND (public.is_hr() OR r.employee_id = public.current_employee_id() OR public.manages_employee(r.employee_id))));
CREATE POLICY "clear_insert" ON public.exit_clearances FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "clear_update" ON public.exit_clearances FOR UPDATE TO authenticated
  USING (public.is_hr() OR public.is_finance()) WITH CHECK (public.is_hr() OR public.is_finance());
CREATE POLICY "clear_delete" ON public.exit_clearances FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.final_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settle_select" ON public.final_settlements FOR SELECT TO authenticated
  USING (public.is_hr() OR public.is_finance() OR EXISTS (
    SELECT 1 FROM public.exit_requests r WHERE r.id = exit_request_id AND r.employee_id = public.current_employee_id()));
CREATE POLICY "settle_insert" ON public.final_settlements FOR INSERT TO authenticated WITH CHECK (public.is_hr() OR public.is_finance());
CREATE POLICY "settle_update" ON public.final_settlements FOR UPDATE TO authenticated
  USING (public.is_hr() OR public.is_finance()) WITH CHECK (public.is_hr() OR public.is_finance());
CREATE POLICY "settle_delete" ON public.final_settlements FOR DELETE TO authenticated USING (public.is_hr());

-- ============ DOCUMENT REPOSITORY ============
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'policy',
  file_name text NOT NULL,
  file_url text,
  file_size bigint DEFAULT 0,
  visibility text NOT NULL DEFAULT 'all',
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_select" ON public.documents FOR SELECT TO authenticated
  USING (visibility = 'all' OR public.is_hr() OR public.is_finance()
    OR owner_employee_id = public.current_employee_id());
CREATE POLICY "docs_insert" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_hr() OR public.is_finance());
CREATE POLICY "docs_update" ON public.documents FOR UPDATE TO authenticated
  USING (public.is_hr() OR public.is_finance()) WITH CHECK (public.is_hr() OR public.is_finance());
CREATE POLICY "docs_delete" ON public.documents FOR DELETE TO authenticated USING (public.is_hr());

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('hris-documents', 'hris-documents', true, 5242880);

CREATE POLICY "hris_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hris-documents');
CREATE POLICY "hris_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hris-documents');
CREATE POLICY "hris_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'hris-documents') WITH CHECK (bucket_id = 'hris-documents');
CREATE POLICY "hris_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hris-documents');


-- ============================================
-- FILE: supabase/migrations\00005_seed_org_data.sql
-- ============================================

-- ============ DEPARTMENTS ============
INSERT INTO public.departments (id, name, code, description, cost_center) VALUES
('d0000000-0000-4000-8000-000000000001','Executive Office','EXEC','Corporate leadership and strategy','CC-100'),
('d0000000-0000-4000-8000-000000000002','Human Resources','HR','People operations, recruitment and payroll administration','CC-200'),
('d0000000-0000-4000-8000-000000000003','Finance','FIN','Accounting, treasury and statutory reporting','CC-300'),
('d0000000-0000-4000-8000-000000000004','Operations','OPS','Logistics, facilities and field operations','CC-400'),
('d0000000-0000-4000-8000-000000000005','Sales & Marketing','SAL','Revenue generation and brand management','CC-500'),
('d0000000-0000-4000-8000-000000000006','Information Technology','IT','Systems, infrastructure and digital products','CC-600'),
('d0000000-0000-4000-8000-000000000007','Production','PRD','Manufacturing and quality assurance','CC-700'),
('d0000000-0000-4000-8000-000000000008','Legal & Compliance','LEG','Contracts, regulatory affairs and risk','CC-800'),
('d0000000-0000-4000-8000-000000000009','Customer Service','CS','Client support and service delivery','CC-900');

-- ============ POSITIONS ============
INSERT INTO public.positions (id, title, department_id, grade, min_salary, max_salary, description) VALUES
('b0000000-0000-4000-8000-000000000001','Managing Director','d0000000-0000-4000-8000-000000000001','E1',2000000,3500000,'Overall accountability for company performance'),
('b0000000-0000-4000-8000-000000000002','HR Manager','d0000000-0000-4000-8000-000000000002','M1',900000,1400000,'Leads the human resources function'),
('b0000000-0000-4000-8000-000000000003','HR Officer','d0000000-0000-4000-8000-000000000002','O2',450000,700000,'Employee records, onboarding and leave administration'),
('b0000000-0000-4000-8000-000000000004','Recruitment Officer','d0000000-0000-4000-8000-000000000002','O2',450000,700000,'Talent acquisition and candidate management'),
('b0000000-0000-4000-8000-000000000005','Finance Manager','d0000000-0000-4000-8000-000000000003','M1',900000,1400000,'Financial control and statutory compliance'),
('b0000000-0000-4000-8000-000000000006','Payroll Officer','d0000000-0000-4000-8000-000000000003','O2',500000,750000,'Payroll processing and statutory deductions'),
('b0000000-0000-4000-8000-000000000007','Accountant','d0000000-0000-4000-8000-000000000003','O2',450000,700000,'General ledger and reconciliations'),
('b0000000-0000-4000-8000-000000000008','Operations Manager','d0000000-0000-4000-8000-000000000004','M1',850000,1300000,'Facilities and logistics management'),
('b0000000-0000-4000-8000-000000000009','Logistics Officer','d0000000-0000-4000-8000-000000000004','O1',350000,550000,'Fleet and supply chain coordination'),
('b0000000-0000-4000-8000-000000000010','Administrative Assistant','d0000000-0000-4000-8000-000000000004','O1',300000,480000,'Office administration support'),
('b0000000-0000-4000-8000-000000000011','Sales Manager','d0000000-0000-4000-8000-000000000005','M1',850000,1300000,'Revenue targets and key accounts'),
('b0000000-0000-4000-8000-000000000012','Sales Executive','d0000000-0000-4000-8000-000000000005','O2',400000,650000,'Field sales and client acquisition'),
('b0000000-0000-4000-8000-000000000013','Marketing Officer','d0000000-0000-4000-8000-000000000005','O2',400000,650000,'Brand campaigns and communications'),
('b0000000-0000-4000-8000-000000000014','IT Manager','d0000000-0000-4000-8000-000000000006','M1',950000,1450000,'Technology strategy and systems'),
('b0000000-0000-4000-8000-000000000015','Software Engineer','d0000000-0000-4000-8000-000000000006','O3',700000,1100000,'Application development'),
('b0000000-0000-4000-8000-000000000016','Network Administrator','d0000000-0000-4000-8000-000000000006','O2',550000,850000,'Infrastructure and network security'),
('b0000000-0000-4000-8000-000000000017','Production Manager','d0000000-0000-4000-8000-000000000007','M1',850000,1300000,'Plant operations and output'),
('b0000000-0000-4000-8000-000000000018','Machine Operator','d0000000-0000-4000-8000-000000000007','W1',220000,340000,'Production line operation'),
('b0000000-0000-4000-8000-000000000019','Quality Controller','d0000000-0000-4000-8000-000000000007','O1',320000,500000,'Quality assurance and inspection'),
('b0000000-0000-4000-8000-000000000020','Legal Counsel','d0000000-0000-4000-8000-000000000008','M1',900000,1400000,'Legal advisory and contracts'),
('b0000000-0000-4000-8000-000000000021','Compliance Officer','d0000000-0000-4000-8000-000000000008','O2',500000,800000,'Regulatory compliance monitoring'),
('b0000000-0000-4000-8000-000000000022','Customer Service Lead','d0000000-0000-4000-8000-000000000009','O2',450000,700000,'Service desk supervision'),
('b0000000-0000-4000-8000-000000000023','Customer Support Agent','d0000000-0000-4000-8000-000000000009','O1',280000,450000,'Client ticket resolution'),
('b0000000-0000-4000-8000-000000000024','Driver','d0000000-0000-4000-8000-000000000004','W1',200000,320000,'Transport and delivery');

-- ============ EMPLOYEES ============
INSERT INTO public.employees (id, employee_no, first_name, last_name, email, phone, gender, date_of_birth, national_id, address, district, department_id, position_id, manager_id, employment_type, hire_date, status, base_salary, housing_allowance, transport_allowance, other_allowance, bank_name, bank_account, nid_number, rssb_number, emergency_contact_name, emergency_contact_phone) VALUES
('e0000000-0000-4000-8000-000000000001','ABR-0001','Jean Bosco','Habimana','jb.habimana@abrwanda.rw','+250788100001','male','1978-03-14','1197870012345678','KG 11 Ave, Kacyiru','Gasabo','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001',NULL,'permanent','2012-01-09','active',2500000,400000,150000,200000,'Bank of Kigali','000123456789','1197870012345678','RSSB-100001','Marie Habimana','+250788100101'),
('e0000000-0000-4000-8000-000000000002','ABR-0002','Alice','Uwimana','alice.uwimana@abrwanda.rw','+250788100002','female','1985-07-22','1198570023456789','KG 45 St, Remera','Gasabo','d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001','permanent','2015-04-01','active',1150000,180000,80000,60000,'Bank of Kigali','000123456790','1198570023456789','RSSB-100002','Peter Uwimana','+250788100102'),
('e0000000-0000-4000-8000-000000000003','ABR-0003','Eric','Nshimiyimana','eric.nshimiyimana@abrwanda.rw','+250788100003','male','1983-11-05','1198370034567890','KG 7 Ave, Nyarutarama','Gasabo','d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000005','e0000000-0000-4000-8000-000000000001','permanent','2014-06-16','active',1200000,180000,80000,60000,'I&M Bank','000223456789','1198370034567890','RSSB-100003','Josiane Nshimiyimana','+250788100103'),
('e0000000-0000-4000-8000-000000000004','ABR-0004','Claudine','Mukamana','claudine.mukamana@abrwanda.rw','+250788100004','female','1990-02-18','1199070045678901','KG 22 St, Kimironko','Gasabo','d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000002','permanent','2018-09-03','active',620000,100000,50000,30000,'Bank of Kigali','000123456791','1199070045678901','RSSB-100004','Emmanuel Mukamana','+250788100104'),
('e0000000-0000-4000-8000-000000000005','ABR-0005','Patrick','Rwigema','patrick.rwigema@abrwanda.rw','+250788100005','male','1986-05-30','1198670056789012','KG 3 Ave, Kicukiro','Kicukiro','d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000014','e0000000-0000-4000-8000-000000000001','permanent','2016-02-15','active',1250000,180000,80000,60000,'Ecobank','000323456789','1198670056789012','RSSB-100005','Diane Rwigema','+250788100105'),
('e0000000-0000-4000-8000-000000000006','ABR-0006','Diane','Ingabire','diane.ingabire@abrwanda.rw','+250788100006','female','1992-08-11','1199270067890123','KG 18 St, Gisozi','Gasabo','d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000006','e0000000-0000-4000-8000-000000000003','permanent','2019-03-11','active',680000,100000,50000,30000,'Bank of Kigali','000123456792','1199270067890123','RSSB-100006','Fabrice Ingabire','+250788100106'),
('e0000000-0000-4000-8000-000000000007','ABR-0007','Samuel','Nkurunziza','samuel.nkurunziza@abrwanda.rw','+250788100007','male','1981-12-02','1198170078901234','KG 9 Ave, Nyamirambo','Nyarugenge','d0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000017','e0000000-0000-4000-8000-000000000001','permanent','2013-07-22','active',1100000,180000,80000,60000,'Bank of Kigali','000123456793','1198170078901234','RSSB-100007','Grace Nkurunziza','+250788100107'),
('e0000000-0000-4000-8000-000000000008','ABR-0008','Grace','Uwase','grace.uwase@abrwanda.rw','+250788100008','female','1988-04-25','1198870089012345','KG 30 St, Kibagabaga','Gasabo','d0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000011','e0000000-0000-4000-8000-000000000001','permanent','2017-01-30','active',1050000,180000,80000,60000,'I&M Bank','000223456790','1198870089012345','RSSB-100008','Olivier Uwase','+250788100108'),
('e0000000-0000-4000-8000-000000000009','ABR-0009','Emmanuel','Bizimana','emmanuel.bizimana@abrwanda.rw','+250788100009','male','1984-09-17','1198470090123456','KG 14 Ave, Kacyiru','Gasabo','d0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000020','e0000000-0000-4000-8000-000000000001','permanent','2015-11-09','active',1150000,180000,80000,60000,'Bank of Kigali','000123456794','1198470090123456','RSSB-100009','Chantal Bizimana','+250788100109'),
('e0000000-0000-4000-8000-000000000010','ABR-0010','Josiane','Nyirahabimana','josiane.nyirahabimana@abrwanda.rw','+250788100010','female','1991-06-08','1199170101234567','KG 5 St, Nyabugogo','Nyarugenge','d0000000-0000-4000-8000-000000000009','b0000000-0000-4000-8000-000000000022','e0000000-0000-4000-8000-000000000001','permanent','2018-05-21','active',640000,100000,50000,30000,'Bank of Kigali','000123456795','1199170101234567','RSSB-100010','Aimable Nyirahabimana','+250788100110'),
('e0000000-0000-4000-8000-000000000011','ABR-0011','Olivier','Mugisha','olivier.mugisha@abrwanda.rw','+250788100011','male','1993-01-19','1199370112345678','KG 27 St, Kicukiro','Kicukiro','d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000015','e0000000-0000-4000-8000-000000000005','permanent','2020-02-03','active',880000,120000,60000,40000,'Ecobank','000323456790','1199370112345678','RSSB-100011','Sandrine Mugisha','+250788100111'),
('e0000000-0000-4000-8000-000000000012','ABR-0012','Sandrine','Uwera','sandrine.uwera@abrwanda.rw','+250788100012','female','1995-10-27','1199570123456789','KG 41 St, Kanombe','Kicukiro','d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000015','e0000000-0000-4000-8000-000000000005','permanent','2021-08-16','active',820000,120000,60000,40000,'Bank of Kigali','000123456796','1199570123456789','RSSB-100012','Gilbert Uwera','+250788100112'),
('e0000000-0000-4000-8000-000000000013','ABR-0013','Fabrice','Hakizimana','fabrice.hakizimana@abrwanda.rw','+250788100013','male','1994-03-06','1199470134567890','KG 12 Ave, Remera','Gasabo','d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000007','e0000000-0000-4000-8000-000000000003','permanent','2020-10-05','active',600000,100000,50000,30000,'I&M Bank','000223456791','1199470134567890','RSSB-100013','Vestine Hakizimana','+250788100113'),
('e0000000-0000-4000-8000-000000000014','ABR-0014','Chantal','Mukandayisenga','chantal.mukandayisenga@abrwanda.rw','+250788100014','female','1989-12-14','1198970145678901','KG 8 St, Gikondo','Kicukiro','d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000002','permanent','2019-07-15','active',580000,100000,50000,30000,'Bank of Kigali','000123456797','1198970145678901','RSSB-100014','Innocent Mukandayisenga','+250788100114'),
('e0000000-0000-4000-8000-000000000015','ABR-0015','Innocent','Ndayisaba','innocent.ndayisaba@abrwanda.rw','+250788100015','male','1996-05-23','1199670156789012','KG 33 St, Masaka','Kicukiro','d0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000018','e0000000-0000-4000-8000-000000000007','permanent','2022-01-10','active',300000,60000,30000,20000,'Bank of Kigali','000123456798','1199670156789012','RSSB-100015','Beata Ndayisaba','+250788100115'),
('e0000000-0000-4000-8000-000000000016','ABR-0016','Vestine','Uwamahoro','vestine.uwamahoro@abrwanda.rw','+250788100016','female','1992-07-31','1199270167890123','KG 19 St, Niboye','Kicukiro','d0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000019','e0000000-0000-4000-8000-000000000007','permanent','2020-04-20','active',420000,80000,40000,25000,'Bank of Kigali','000123456799','1199270167890123','RSSB-100016','Théophile Uwamahoro','+250788100116'),
('e0000000-0000-4000-8000-000000000017','ABR-0017','Aimable','Nsengimana','aimable.nsengimana@abrwanda.rw','+250788100017','male','1991-09-09','1199170178901234','KG 24 Ave, Kimihurura','Gasabo','d0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000012','e0000000-0000-4000-8000-000000000008','permanent','2019-11-25','active',520000,90000,45000,30000,'I&M Bank','000223456792','1199170178901234','RSSB-100017','Solange Nsengimana','+250788100117'),
('e0000000-0000-4000-8000-000000000018','ABR-0018','Solange','Iradukunda','solange.iradukunda@abrwanda.rw','+250788100018','female','1997-02-12','1199770189012345','KG 16 St, Kibagabaga','Gasabo','d0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000013','e0000000-0000-4000-8000-000000000008','permanent','2022-06-13','active',480000,90000,45000,30000,'Bank of Kigali','000123456800','1199770189012345','RSSB-100018','Damascène Iradukunda','+250788100118'),
('e0000000-0000-4000-8000-000000000019','ABR-0019','Théophile','Munyaneza','theophile.munyaneza@abrwanda.rw','+250788100019','male','1987-11-28','1198770190123456','KG 6 Ave, Nyamirambo','Nyarugenge','d0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000009','e0000000-0000-4000-8000-000000000001','permanent','2018-03-05','active',480000,90000,45000,30000,'Bank of Kigali','000123456801','1198770190123456','RSSB-100019','Immaculée Munyaneza','+250788100119'),
('e0000000-0000-4000-8000-000000000020','ABR-0020','Beata','Nyiransabimana','beata.nyiransabimana@abrwanda.rw','+250788100020','female','1998-04-04','1199870201234567','KG 21 St, Gisozi','Gasabo','d0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000010','e0000000-0000-4000-8000-000000000019','permanent','2023-02-06','active',340000,70000,35000,20000,'Bank of Kigali','000123456802','1199870201234567','RSSB-100020','Gilbert Nyiransabimana','+250788100120'),
('e0000000-0000-4000-8000-000000000021','ABR-0021','Gilbert','Twagirayezu','gilbert.twagirayezu@abrwanda.rw','+250788100021','male','1990-08-16','1199070212345678','KG 13 Ave, Kicukiro','Kicukiro','d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000016','e0000000-0000-4000-8000-000000000005','permanent','2019-05-27','active',700000,110000,55000,35000,'Ecobank','000323456791','1199070212345678','RSSB-100021','Yvonne Twagirayezu','+250788100121'),
('e0000000-0000-4000-8000-000000000022','ABR-0022','Immaculée','Mukarugwiza','immaculee.mukarugwiza@abrwanda.rw','+250788100022','female','1993-06-21','1199370223456789','KG 28 St, Kacyiru','Gasabo','d0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000021','e0000000-0000-4000-8000-000000000009','permanent','2021-01-18','active',620000,100000,50000,30000,'Bank of Kigali','000123456803','1199370223456789','RSSB-100022','Patrick Mukarugwiza','+250788100122'),
('e0000000-0000-4000-8000-000000000023','ABR-0023','Damascène','Nizeyimana','damascene.nizeyimana@abrwanda.rw','+250788100023','male','1985-01-07','1198570234567890','KG 2 St, Nyabugogo','Nyarugenge','d0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000024','e0000000-0000-4000-8000-000000000019','fixed_term','2021-09-06','active',280000,60000,30000,20000,'Bank of Kigali','000123456804','1198570234567890','RSSB-100023','Josiane Nizeyimana','+250788100123'),
('e0000000-0000-4000-8000-000000000024','ABR-0024','Yvonne','Umutoni','yvonne.umutoni@abrwanda.rw','+250788100024','female','1999-03-29','1199970245678901','KG 37 St, Kanombe','Kicukiro','d0000000-0000-4000-8000-000000000009','b0000000-0000-4000-8000-000000000023','e0000000-0000-4000-8000-000000000010','probation','2026-09-01','probation',320000,60000,30000,20000,'Bank of Kigali','000123456805','1199970245678901','RSSB-100024','Alice Umutoni','+250788100124');

UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000002' WHERE id = 'd0000000-0000-4000-8000-000000000002';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000003' WHERE id = 'd0000000-0000-4000-8000-000000000003';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000005' WHERE id = 'd0000000-0000-4000-8000-000000000006';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000007' WHERE id = 'd0000000-0000-4000-8000-000000000007';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000008' WHERE id = 'd0000000-0000-4000-8000-000000000005';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000009' WHERE id = 'd0000000-0000-4000-8000-000000000008';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000010' WHERE id = 'd0000000-0000-4000-8000-000000000009';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000019' WHERE id = 'd0000000-0000-4000-8000-000000000004';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000001' WHERE id = 'd0000000-0000-4000-8000-000000000001';

-- ============ LEAVE TYPES ============
INSERT INTO public.leave_types (id, name, code, days_per_year, is_paid, requires_document, description) VALUES
('c0000000-0000-4000-8000-000000000001','Annual Leave','ANNUAL',18,true,false,'Statutory annual leave entitlement under Rwandan labour law'),
('c0000000-0000-4000-8000-000000000002','Sick Leave','SICK',15,true,true,'Medical leave, certificate required for absences over two days'),
('c0000000-0000-4000-8000-000000000003','Maternity Leave','MATERNITY',90,true,true,'Maternity leave per Rwandan labour regulations'),
('c0000000-0000-4000-8000-000000000004','Paternity Leave','PATERNITY',4,true,false,'Paternity leave entitlement'),
('c0000000-0000-4000-8000-000000000005','Compassionate Leave','COMPASSION',5,true,false,'Bereavement and family emergencies'),
('c0000000-0000-4000-8000-000000000006','Unpaid Leave','UNPAID',30,false,false,'Leave without pay subject to management approval');

-- ============ LEAVE BALANCES ============
INSERT INTO public.leave_balances (employee_id, leave_type_id, year, entitled_days, used_days, carried_over)
SELECT e.id, lt.id, 2026, lt.days_per_year,
  CASE WHEN lt.code = 'ANNUAL' THEN (abs(hashtext(e.employee_no || lt.code)) % 8) ELSE 0 END,
  CASE WHEN lt.code = 'ANNUAL' THEN 2 ELSE 0 END
FROM public.employees e CROSS JOIN public.leave_types lt;

-- ============ ATTENDANCE (last 30 days, weekdays) ============
INSERT INTO public.attendance (employee_id, work_date, clock_in, clock_out, status, hours_worked)
SELECT e.id, d::date,
  (d::date + time '08:00') + ((abs(hashtext(e.employee_no || d::text)) % 25) || ' minutes')::interval,
  (d::date + time '17:00') + ((abs(hashtext(e.employee_no || d::text)) % 40) || ' minutes')::interval,
  CASE WHEN abs(hashtext(e.employee_no || d::text)) % 23 = 0 THEN 'absent'::public.attendance_status
       WHEN abs(hashtext(e.employee_no || d::text)) % 17 = 0 THEN 'remote'::public.attendance_status
       WHEN abs(hashtext(e.employee_no || d::text)) % 11 = 0 THEN 'late'::public.attendance_status
       ELSE 'present'::public.attendance_status END,
  8.5
FROM public.employees e
CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE - 1, interval '1 day') d
WHERE extract(isodow from d) < 6 AND e.status <> 'exited';

-- ============ LEAVE REQUESTS ============
INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date, days, reason, status, approver_id, decided_at, decision_note) VALUES
('e0000000-0000-4000-8000-000000000011','c0000000-0000-4000-8000-000000000001',CURRENT_DATE + 7, CURRENT_DATE + 11, 5,'Family visit upcountry','pending',NULL,NULL,NULL),
('e0000000-0000-4000-8000-000000000012','c0000000-0000-4000-8000-000000000002',CURRENT_DATE - 3, CURRENT_DATE - 2, 2,'Medical appointment with certificate attached','approved','e0000000-0000-4000-8000-000000000005',now() - interval '4 days','Approved, certificate verified'),
('e0000000-0000-4000-8000-000000000015','c0000000-0000-4000-8000-000000000001',CURRENT_DATE + 14, CURRENT_DATE + 20, 7,'Annual leave','pending',NULL,NULL,NULL),
('e0000000-0000-4000-8000-000000000017','c0000000-0000-4000-8000-000000000005',CURRENT_DATE - 10, CURRENT_DATE - 8, 3,'Bereavement in the family','approved','e0000000-0000-4000-8000-000000000008',now() - interval '11 days','Condolences, approved'),
('e0000000-0000-4000-8000-000000000018','c0000000-0000-4000-8000-000000000001',CURRENT_DATE + 3, CURRENT_DATE + 5, 3,'Personal matters','rejected','e0000000-0000-4000-8000-000000000008',now() - interval '2 days','Conflicts with product launch week'),
('e0000000-0000-4000-8000-000000000020','c0000000-0000-4000-8000-000000000002',CURRENT_DATE - 1, CURRENT_DATE, 2,'Flu symptoms','pending',NULL,NULL,NULL),
('e0000000-0000-4000-8000-000000000021','c0000000-0000-4000-8000-000000000001',CURRENT_DATE + 21, CURRENT_DATE + 25, 5,'Planned vacation','pending',NULL,NULL,NULL),
('e0000000-0000-4000-8000-000000000013','c0000000-0000-4000-8000-000000000004',CURRENT_DATE - 20, CURRENT_DATE - 17, 4,'Paternity leave','approved','e0000000-0000-4000-8000-000000000003',now() - interval '21 days','Congratulations, approved');


-- ============================================
-- FILE: supabase/migrations\00006_seed_module_data.sql
-- ============================================

-- ============ RECRUITMENT ============
INSERT INTO public.job_openings (id, reference, title, department_id, position_id, employment_type, location, description, requirements, vacancies, salary_range, status, posted_date, closing_date) VALUES
('f0000000-0000-4000-8000-000000000001','REQ-2026-014','Senior Software Engineer','d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000015','permanent','Kigali, Rwanda','Design and deliver internal HR and finance platforms, mentor junior engineers and own service reliability.','BSc in Computer Science or related field, 5+ years experience with TypeScript and PostgreSQL, strong API design skills.',2,'RWF 900,000 - 1,300,000','open',CURRENT_DATE - 18, CURRENT_DATE + 12),
('f0000000-0000-4000-8000-000000000002','REQ-2026-015','Payroll Accountant','d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000006','permanent','Kigali, Rwanda','Own monthly payroll computation, statutory filings with RRA and RSSB, and reconciliation of payroll ledger accounts.','Bachelor degree in Accounting, CPA Part 2, 3 years payroll experience, deep knowledge of Rwandan PAYE and RSSB rules.',1,'RWF 600,000 - 800,000','open',CURRENT_DATE - 11, CURRENT_DATE + 19),
('f0000000-0000-4000-8000-000000000003','REQ-2026-016','Production Supervisor','d0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000018','fixed_term','Kigali, Rwanda','Supervise the second shift production line, enforce safety standards and report daily output.','Diploma in industrial engineering, 2 years supervisory experience in manufacturing.',3,'RWF 350,000 - 480,000','open',CURRENT_DATE - 6, CURRENT_DATE + 24),
('f0000000-0000-4000-8000-000000000004','REQ-2026-017','Customer Experience Officer','d0000000-0000-4000-8000-000000000009','b0000000-0000-4000-8000-000000000023','permanent','Kigali, Rwanda','Handle inbound client requests across phone and email, maintain the service knowledge base.','A0 in business administration, excellent Kinyarwanda and English communication.',2,'RWF 300,000 - 420,000','on_hold',CURRENT_DATE - 30, CURRENT_DATE - 2),
('f0000000-0000-4000-8000-000000000005','REQ-2026-013','Marketing Officer','d0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000013','permanent','Kigali, Rwanda','Plan and execute brand campaigns across digital and field channels.','2 years digital marketing experience, portfolio of campaigns.',1,'RWF 450,000 - 620,000','closed',CURRENT_DATE - 60, CURRENT_DATE - 20);

INSERT INTO public.candidates (id, job_opening_id, first_name, last_name, email, phone, source, stage, rating, notes, applied_at) VALUES
('a0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','Kevin','Gatete','kevin.gatete@example.rw','+250788200001','LinkedIn','interview',4,'Strong system design round, moving to panel','2026-10-28'),
('a0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000001','Nadia','Uwimana','nadia.uwimana@example.rw','+250788200002','Referral','screening',3,'Good backend background, needs frontend depth','2026-11-01'),
('a0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000001','Thierry','Mugabo','thierry.mugabo@example.rw','+250788200003','Job board','applied',0,'Portfolio shared, awaiting screening','2026-11-08'),
('a0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000001','Aline','Nyiraneza','aline.nyiraneza@example.rw','+250788200004','LinkedIn','offer',5,'Offer issued, awaiting candidate signature','2026-10-20'),
('a0000000-0000-4000-8000-000000000005','f0000000-0000-4000-8000-000000000002','Pascal','Rukundo','pascal.rukundo@example.rw','+250788200005','Referral','interview',4,'Excellent statutory knowledge','2026-11-03'),
('a0000000-0000-4000-8000-000000000006','f0000000-0000-4000-8000-000000000002','Josiane','Mutesi','josiane.mutesi@example.rw','+250788200006','Job board','screening',3,'CPA Part 2 completed','2026-11-06'),
('a0000000-0000-4000-8000-000000000007','f0000000-0000-4000-8000-000000000002','Bernard','Ntaganda','bernard.ntaganda@example.rw','+250788200007','Job board','rejected',2,'Lacks RSSB filing experience','2026-10-30'),
('a0000000-0000-4000-8000-000000000008','f0000000-0000-4000-8000-000000000003','Clarisse','Uwamariya','clarisse.uwamariya@example.rw','+250788200008','Walk-in','applied',0,'Shift availability confirmed','2026-11-10'),
('a0000000-0000-4000-8000-000000000009','f0000000-0000-4000-8000-000000000003','Jean Paul','Nkusi','jp.nkusi@example.rw','+250788200009','Walk-in','screening',3,'Previous line supervision experience','2026-11-09'),
('a0000000-0000-4000-8000-000000000010','f0000000-0000-4000-8000-000000000005','Divine','Mukeshimana','divine.mukeshimana@example.rw','+250788200010','LinkedIn','hired',5,'Accepted offer, onboarding scheduled','2026-09-15');

INSERT INTO public.interviews (candidate_id, scheduled_at, mode, interviewer_id, location, score, feedback, status) VALUES
('a0000000-0000-4000-8000-000000000001', now() + interval '2 days', 'in_person','e0000000-0000-4000-8000-000000000005','HQ Boardroom',NULL,NULL,'scheduled'),
('a0000000-0000-4000-8000-000000000005', now() + interval '1 day', 'video','e0000000-0000-4000-8000-000000000003','Google Meet',NULL,NULL,'scheduled'),
('a0000000-0000-4000-8000-000000000004', now() - interval '6 days', 'in_person','e0000000-0000-4000-8000-000000000005','HQ Boardroom',5,'Excellent architecture reasoning and clear communication','completed'),
('a0000000-0000-4000-8000-000000000002', now() - interval '3 days', 'video','e0000000-0000-4000-8000-000000000011','Google Meet',3,'Solid fundamentals, limited React experience','completed');

-- ============ ONBOARDING ============
INSERT INTO public.onboarding_tasks (employee_id, title, category, due_date, assigned_to, status, completed_at, sort_order) VALUES
('e0000000-0000-4000-8000-000000000024','Sign employment contract','documentation',CURRENT_DATE + 2,'e0000000-0000-4000-8000-000000000004','completed',now() - interval '3 days',1),
('e0000000-0000-4000-8000-000000000024','Submit national ID copy','documentation',CURRENT_DATE + 2,'e0000000-0000-4000-8000-000000000024','completed',now() - interval '2 days',2),
('e0000000-0000-4000-8000-000000000024','Submit academic certificates','documentation',CURRENT_DATE + 4,'e0000000-0000-4000-8000-000000000024','pending',NULL,3),
('e0000000-0000-4000-8000-000000000024','Provide bank account details','payroll',CURRENT_DATE + 4,'e0000000-0000-4000-8000-000000000006','pending',NULL,4),
('e0000000-0000-4000-8000-000000000024','Complete RSSB registration form','compliance',CURRENT_DATE + 6,'e0000000-0000-4000-8000-000000000004','pending',NULL,5),
('e0000000-0000-4000-8000-000000000024','IT equipment allocation','it',CURRENT_DATE + 1,'e0000000-0000-4000-8000-000000000021','completed',now() - interval '1 day',6),
('e0000000-0000-4000-8000-000000000024','HR induction and policy briefing','orientation',CURRENT_DATE + 3,'e0000000-0000-4000-8000-000000000002','pending',NULL,7),
('e0000000-0000-4000-8000-000000000024','Departmental orientation with line manager','orientation',CURRENT_DATE + 5,'e0000000-0000-4000-8000-000000000010','pending',NULL,8);

INSERT INTO public.employee_documents (employee_id, doc_type, file_name, status, verified_by, verified_at, notes) VALUES
('e0000000-0000-4000-8000-000000000024','National ID','national_id_yvonne_umutoni.pdf','verified','e0000000-0000-4000-8000-000000000004',now() - interval '2 days','Clear scan'),
('e0000000-0000-4000-8000-000000000024','Employment Contract','contract_yvonne_umutoni.pdf','verified','e0000000-0000-4000-8000-000000000004',now() - interval '3 days','Signed copy on file'),
('e0000000-0000-4000-8000-000000000024','Academic Certificate','diploma_yvonne_umutoni.pdf','pending',NULL,NULL,'Awaiting submission'),
('e0000000-0000-4000-8000-000000000024','Bank Details','bank_letter_yvonne_umutoni.pdf','pending',NULL,NULL,'Awaiting submission'),
('e0000000-0000-4000-8000-000000000011','National ID','national_id_olivier_mugisha.pdf','verified','e0000000-0000-4000-8000-000000000004',now() - interval '400 days','On file'),
('e0000000-0000-4000-8000-000000000012','Academic Certificate','degree_sandrine_uwera.pdf','verified','e0000000-0000-4000-8000-000000000004',now() - interval '300 days','On file');

-- ============ PERFORMANCE ============
INSERT INTO public.appraisal_cycles (id, name, period_start, period_end, status, description) VALUES
('a1000000-0000-4000-8000-000000000001','FY2026 Mid-Year Review','2026-01-01','2026-06-30','closed','Mid-year performance and goal review for all staff'),
('a1000000-0000-4000-8000-000000000002','FY2026 Annual Review','2026-07-01','2026-12-31','active','Annual appraisal cycle covering goal achievement and competencies'),
('a1000000-0000-4000-8000-000000000003','FY2027 Goal Setting','2027-01-01','2027-12-31','draft','Goal setting cycle for the next financial year');

INSERT INTO public.goals (employee_id, cycle_id, title, description, category, weight, target_value, progress, status, due_date) VALUES
('e0000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000002','Deliver HRIS payroll module','Ship payroll processing with statutory deductions and payslip generation','business',30,'Production release',75,'active','2026-12-15'),
('e0000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000002','Reduce API latency','Bring p95 API response time below 300ms','business',25,'p95 < 300ms',60,'active','2026-12-31'),
('e0000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000002','Mentor two junior engineers','Structured mentoring with monthly reviews','development',20,'2 mentees',50,'active','2026-12-31'),
('e0000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000002','Complete TypeScript certification','Finish advanced TypeScript programme','development',20,'Certificate',100,'completed','2026-10-30'),
('e0000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000002','Ship employee self-service portal','Deliver profile, leave and payslip self-service','business',40,'Live for all staff',85,'active','2026-12-20'),
('e0000000-0000-4000-8000-000000000017','a1000000-0000-4000-8000-000000000002','Grow enterprise accounts','Close 12 new enterprise contracts','business',40,'12 contracts',70,'active','2026-12-31'),
('e0000000-0000-4000-8000-000000000017','a1000000-0000-4000-8000-000000000002','Improve client retention','Raise renewal rate to 92%','business',30,'92% renewal',65,'active','2026-12-31'),
('e0000000-0000-4000-8000-000000000015','a1000000-0000-4000-8000-000000000002','Reduce line defects','Cut defect rate below 1.5%','business',35,'< 1.5% defects',80,'active','2026-12-31'),
('e0000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000002','Digitise employee files','Move 100% of active employee files to the HRIS','business',30,'100% digitised',90,'active','2026-11-30'),
('e0000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000002','Automate statutory filings','Automate RRA and RSSB monthly submissions','business',35,'Fully automated',55,'active','2026-12-31');

INSERT INTO public.appraisals (cycle_id, employee_id, manager_id, self_score, manager_score, final_score, rating, self_comments, manager_comments, status, submitted_at, finalized_at) VALUES
('a1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000011','e0000000-0000-4000-8000-000000000005',4.2,4.0,4.1,'Exceeds expectations','Delivered the attendance module ahead of schedule.','Consistent delivery, strong ownership of production issues.','finalized',now() - interval '120 days',now() - interval '110 days'),
('a1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000012','e0000000-0000-4000-8000-000000000005',4.0,3.8,3.9,'Meets expectations','Shipped the leave workflow and improved test coverage.','Reliable contributor, encouraged to take more design ownership.','finalized',now() - interval '120 days',now() - interval '110 days'),
('a1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000011','e0000000-0000-4000-8000-000000000005',4.3,NULL,NULL,NULL,'Payroll module is 75% complete, latency work in progress.',NULL,'self_submitted',now() - interval '5 days',NULL),
('a1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000012','e0000000-0000-4000-8000-000000000005',4.1,NULL,NULL,NULL,'Self-service portal nearly ready for release.',NULL,'self_submitted',now() - interval '4 days',NULL),
('a1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000017','e0000000-0000-4000-8000-000000000008',3.9,4.0,3.95,'Exceeds expectations','Closed 8 of 12 enterprise targets so far.','Strong pipeline discipline, on track for the annual target.','manager_reviewed',now() - interval '6 days',NULL),
('a1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000015','e0000000-0000-4000-8000-000000000007',3.6,NULL,NULL,NULL,'Defect rate reduced to 1.7%.',NULL,'draft',NULL,NULL),
('a1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000002',4.4,NULL,NULL,NULL,'Employee files 90% digitised.',NULL,'self_submitted',now() - interval '3 days',NULL);

-- ============ DEVELOPMENT ============
INSERT INTO public.trainings (id, title, provider, category, description, start_date, end_date, cost, capacity, mode, status) VALUES
('b1000000-0000-4000-8000-000000000001','Rwandan Labour Law & Compliance','RSSB Training Centre','compliance','Statutory obligations, PAYE, RSSB contributions and disciplinary procedure under Rwandan law.',CURRENT_DATE + 10, CURRENT_DATE + 12, 450000, 25,'in_person','planned'),
('b1000000-0000-4000-8000-000000000002','Advanced TypeScript for Enterprise Apps','Kigali Tech Hub','technical','Type-safe architecture, generics and large-scale React patterns.',CURRENT_DATE - 20, CURRENT_DATE - 15, 600000, 15,'online','completed'),
('b1000000-0000-4000-8000-000000000003','People Leadership Essentials','Corporate Training Rwanda','leadership','Coaching, feedback and performance conversations for new managers.',CURRENT_DATE + 25, CURRENT_DATE + 28, 750000, 12,'in_person','planned'),
('b1000000-0000-4000-8000-000000000004','Occupational Health & Safety','RSSB Training Centre','compliance','Workplace safety standards and incident reporting for production staff.',CURRENT_DATE - 45, CURRENT_DATE - 43, 300000, 30,'in_person','completed'),
('b1000000-0000-4000-8000-000000000005','Financial Reporting under IFRS','Institute of Certified Public Accountants','finance','IFRS updates and statutory reporting for finance teams.',CURRENT_DATE + 40, CURRENT_DATE + 44, 900000, 10,'online','planned'),
('b1000000-0000-4000-8000-000000000006','Customer Service Excellence','Service Academy Rwanda','customer','Service standards, complaint handling and client communication.',CURRENT_DATE - 8, CURRENT_DATE - 7, 250000, 20,'in_person','in_progress');

INSERT INTO public.training_enrollments (training_id, employee_id, status, score, completed_at) VALUES
('b1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000004','enrolled',NULL,NULL),
('b1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000002','enrolled',NULL,NULL),
('b1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000014','enrolled',NULL,NULL),
('b1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000011','completed',92,now() - interval '15 days'),
('b1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000012','completed',88,now() - interval '15 days'),
('b1000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000005','enrolled',NULL,NULL),
('b1000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000008','enrolled',NULL,NULL),
('b1000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000015','completed',85,now() - interval '43 days'),
('b1000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000016','completed',90,now() - interval '43 days'),
('b1000000-0000-4000-8000-000000000006','e0000000-0000-4000-8000-000000000024','in_progress',NULL,NULL),
('b1000000-0000-4000-8000-000000000006','e0000000-0000-4000-8000-000000000010','in_progress',NULL,NULL);

-- ============ PAYROLL ============
INSERT INTO public.payroll_periods (id, name, period_start, period_end, pay_date, status, notes) VALUES
('c1000000-0000-4000-8000-000000000001','September 2026','2026-09-01','2026-09-30','2026-09-28','paid','Closed and paid'),
('c1000000-0000-4000-8000-000000000002','October 2026','2026-10-01','2026-10-31','2026-10-28','approved','Approved by finance manager'),
('c1000000-0000-4000-8000-000000000003','November 2026','2026-11-01','2026-11-30','2026-11-27','draft','Current open period');

-- ============ DISCIPLINARY ============
INSERT INTO public.disciplinary_cases (id, case_no, employee_id, category, incident_date, description, severity, status, outcome, sanction, reported_by, decided_at) VALUES
('d1000000-0000-4000-8000-000000000001','DC-2026-007','e0000000-0000-4000-8000-000000000023','attendance',CURRENT_DATE - 25,'Repeated late arrival without prior notification on three consecutive days.','minor','closed','Substantiated','Written warning issued','e0000000-0000-4000-8000-000000000019',now() - interval '18 days'),
('d1000000-0000-4000-8000-000000000002','DC-2026-008','e0000000-0000-4000-8000-000000000015','safety',CURRENT_DATE - 12,'Failure to wear mandatory protective equipment on the production floor.','moderate','hearing','Pending hearing','','e0000000-0000-4000-8000-000000000007',NULL),
('d1000000-0000-4000-8000-000000000003','DC-2026-009','e0000000-0000-4000-8000-000000000018','misconduct',CURRENT_DATE - 5,'Unauthorised disclosure of campaign pricing to an external party.','serious','investigation','Under investigation','','e0000000-0000-4000-8000-000000000008',NULL);

INSERT INTO public.disciplinary_actions (case_id, action_type, description, action_date, issued_by) VALUES
('d1000000-0000-4000-8000-000000000001','verbal_warning','Verbal counselling recorded with the employee.','2026-10-20','e0000000-0000-4000-8000-000000000019'),
('d1000000-0000-4000-8000-000000000001','written_warning','Formal written warning placed on file for six months.','2026-10-28','e0000000-0000-4000-8000-000000000002'),
('d1000000-0000-4000-8000-000000000002','query_issued','Formal query issued, employee response due within five working days.','2026-11-04','e0000000-0000-4000-8000-000000000007');

-- ============ SUCCESSION ============
INSERT INTO public.succession_plans (id, position_id, title, incumbent_employee_id, criticality, risk_of_loss, notes) VALUES
('e1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000014','IT Manager succession','e0000000-0000-4000-8000-000000000005','critical','medium','Single point of failure for core platform knowledge'),
('e1000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000005','Finance Manager succession','e0000000-0000-4000-8000-000000000003','critical','low','Strong internal bench identified'),
('e1000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000017','Production Manager succession','e0000000-0000-4000-8000-000000000007','high','high','Retirement expected within three years'),
('e1000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','HR Manager succession','e0000000-0000-4000-8000-000000000002','high','low','Two ready-now candidates');

INSERT INTO public.succession_candidates (plan_id, employee_id, readiness, potential, notes) VALUES
('e1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000011','ready_1_2_years','high','Needs exposure to budget ownership'),
('e1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000021','ready_2_3_years','medium','Strong infrastructure depth, limited people leadership'),
('e1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000006','ready_now','high','Already covers statutory reporting end to end'),
('e1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000013','ready_1_2_years','medium','Needs treasury exposure'),
('e1000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000016','ready_1_2_years','high','Quality leadership track record'),
('e1000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000004','ready_now','high','Handles full employee lifecycle'),
('e1000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000014','ready_1_2_years','high','Strong recruitment specialism');

-- ============ EXIT ============
INSERT INTO public.exit_requests (id, employee_id, exit_type, notice_date, last_working_day, reason, status, approved_by, approved_at) VALUES
('f1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000023','resignation',CURRENT_DATE - 10, CURRENT_DATE + 20,'Relocating to another province for family reasons','clearance','e0000000-0000-4000-8000-000000000019',now() - interval '8 days'),
('f1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000018','resignation',CURRENT_DATE - 3, CURRENT_DATE + 27,'Accepted an external offer','submitted',NULL,NULL);

INSERT INTO public.exit_clearances (exit_request_id, department, item, owner_id, status, cleared_at, notes, sort_order) VALUES
('f1000000-0000-4000-8000-000000000001','IT','Return laptop, phone and access badge','e0000000-0000-4000-8000-000000000021','cleared',now() - interval '4 days','All assets returned in working order',1),
('f1000000-0000-4000-8000-000000000001','Finance','Settle outstanding imprest and advances','e0000000-0000-4000-8000-000000000003','cleared',now() - interval '3 days','No outstanding balance',2),
('f1000000-0000-4000-8000-000000000001','HR','Complete exit interview','e0000000-0000-4000-8000-000000000004','pending',NULL,NULL,3),
('f1000000-0000-4000-8000-000000000001','Operations','Handover of vehicle logbook and keys','e0000000-0000-4000-8000-000000000019','pending',NULL,NULL,4),
('f1000000-0000-4000-8000-000000000002','IT','Return laptop and revoke system access','e0000000-0000-4000-8000-000000000021','pending',NULL,NULL,1),
('f1000000-0000-4000-8000-000000000002','Finance','Clear outstanding travel advance','e0000000-0000-4000-8000-000000000003','pending',NULL,NULL,2),
('f1000000-0000-4000-8000-000000000002','HR','Complete exit interview','e0000000-0000-4000-8000-000000000004','pending',NULL,NULL,3);

-- ============ DOCUMENTS ============
INSERT INTO public.documents (title, category, file_name, file_url, file_size, visibility, uploaded_by) VALUES
('Employee Handbook 2026','policy','employee_handbook_2026.pdf',NULL,1843200,'all',NULL),
('Leave and Attendance Policy','policy','leave_attendance_policy.pdf',NULL,524288,'all',NULL),
('Code of Conduct','policy','code_of_conduct.pdf',NULL,412000,'all',NULL),
('Payroll Calendar FY2026','finance','payroll_calendar_fy2026.pdf',NULL,204800,'hr',NULL),
('Performance Management Framework','policy','performance_framework.pdf',NULL,760000,'all',NULL),
('RSSB Contribution Guide','compliance','rssb_contribution_guide.pdf',NULL,340000,'all',NULL),
('Recruitment and Selection Procedure','policy','recruitment_procedure.pdf',NULL,290000,'hr',NULL),
('Disciplinary Procedure','policy','disciplinary_procedure.pdf',NULL,255000,'all',NULL);

-- ============ NOTIFICATIONS (broadcast to all existing profiles) ============
INSERT INTO public.notifications (user_id, title, message, type, link, is_read)
SELECT p.id, 'November payroll open', 'The November 2026 payroll period is open for processing. Finance officers should review attendance exceptions before running payroll.', 'info', '/payroll', false
FROM public.profiles p;


-- ============================================
-- FILE: supabase/migrations\00007_allow_hr_to_run_payroll.sql
-- ============================================

CREATE OR REPLACE FUNCTION public.run_payroll(p_period_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_period public.payroll_periods;
  v_emp record;
  v_gross numeric;
  v_paye numeric;
  v_pen_e numeric;
  v_pen_r numeric;
  v_mat_e numeric;
  v_mat_r numeric;
  v_cbhi numeric;
  v_ded numeric;
  v_net numeric;
  v_absent integer;
  v_count integer := 0;
  v_tg numeric := 0;
  v_td numeric := 0;
  v_tn numeric := 0;
BEGIN
  IF NOT (public.is_finance() OR public.is_hr()) THEN
    RAISE EXCEPTION 'Only finance officers or HR may process payroll';
  END IF;

  SELECT * INTO v_period FROM public.payroll_periods WHERE id = p_period_id;
  IF v_period.id IS NULL THEN RAISE EXCEPTION 'Payroll period not found'; END IF;
  IF v_period.status IN ('approved', 'paid', 'locked') THEN
    RAISE EXCEPTION 'Payroll period is locked and cannot be recalculated';
  END IF;

  DELETE FROM public.payroll_items WHERE period_id = p_period_id;

  FOR v_emp IN
    SELECT e.* FROM public.employees e
    WHERE e.status IN ('active', 'probation', 'on_leave')
    ORDER BY e.employee_no
  LOOP
    SELECT COUNT(*) INTO v_absent FROM public.attendance a
      WHERE a.employee_id = v_emp.id AND a.status = 'absent'
        AND a.work_date BETWEEN v_period.period_start AND v_period.period_end;

    v_gross := v_emp.base_salary + v_emp.housing_allowance + v_emp.transport_allowance + v_emp.other_allowance;
    v_gross := v_gross - (v_emp.base_salary / 30.0 * v_absent);
    v_gross := GREATEST(ROUND(v_gross, 0), 0);

    v_paye := public.calc_paye(v_gross);
    v_pen_e := ROUND(v_gross * 0.03, 0);
    v_pen_r := ROUND(v_gross * 0.03, 0);
    v_mat_e := ROUND(v_gross * 0.003, 0);
    v_mat_r := ROUND(v_gross * 0.003, 0);
    v_cbhi := ROUND(v_gross * 0.005, 0);
    v_ded := v_paye + v_pen_e + v_mat_e + v_cbhi;
    v_net := v_gross - v_ded;

    INSERT INTO public.payroll_items (
      period_id, employee_id, basic_salary, allowances, overtime, gross_pay,
      paye, pension_employee, pension_employer, maternity_employee, maternity_employer,
      cbhi, other_deductions, total_deductions, net_pay, days_absent, status
    ) VALUES (
      p_period_id, v_emp.id, v_emp.base_salary,
      v_emp.housing_allowance + v_emp.transport_allowance + v_emp.other_allowance,
      0, v_gross, v_paye, v_pen_e, v_pen_r, v_mat_e, v_mat_r, v_cbhi, 0, v_ded, v_net, v_absent, 'computed'
    );

    v_count := v_count + 1;
    v_tg := v_tg + v_gross;
    v_td := v_td + v_ded;
    v_tn := v_tn + v_net;
  END LOOP;

  UPDATE public.payroll_periods SET
    total_gross = v_tg, total_deductions = v_td, total_net = v_tn,
    employee_count = v_count, status = 'pending_approval'
  WHERE id = p_period_id;

  PERFORM public.log_audit('payroll.processed', 'payroll_period', p_period_id::text,
    jsonb_build_object('employees', v_count, 'total_net', v_tn));

  RETURN jsonb_build_object('employees', v_count, 'total_gross', v_tg, 'total_deductions', v_td, 'total_net', v_tn);
END;
$function$;

-- ============================================
-- FILE: supabase/migrations\00008_employee_payslip_period_access.sql
-- ============================================

CREATE POLICY periods_select_employee ON public.payroll_periods
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.payroll_items pi
        WHERE pi.period_id = payroll_periods.id
        AND pi.employee_id = public.current_employee_id()
    )
);


