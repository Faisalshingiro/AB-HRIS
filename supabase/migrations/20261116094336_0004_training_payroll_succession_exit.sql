/*
# Training, Payroll, Succession, Disciplinary, Exit Module Tables

## Purpose
Completes the eight HRIS modules:
- Employee Development: training programmes, skills, career progression
- Payroll: salary structures, allowances, deductions, payroll runs, payslips
- Succession & Disciplinary: succession plans, disciplinary cases
- Employee Exit: resignations, exit interviews, clearance, final settlements

## New Tables
1. `training_programmes` — training courses/programmes
2. `training_enrollments` — employee enrollment in training
3. `employee_skills` — skills per employee with proficiency
4. `skills` — master skill catalog
5. `career_progressions` — career history/promotions
6. `salary_structures` — salary components config (base, allowances, deductions)
7. `allowances` — configurable allowance types
8. `deductions` — configurable deduction types
9. `employee_salary_components` — per-employee salary components
10. `payroll_runs` — payroll processing batches
11. `payslips` — individual payslip records
12. `succession_plans` — succession planning for key positions
13. `disciplinary_cases` — disciplinary incidents and actions
14. `exit_requests` — resignation/termination requests
15. `exit_interviews` — exit interview records
16. `exit_clearances` — clearance checklist for departing employees
17. `final_settlements` — final payment calculations

## Security
- RLS on all tables, grants to authenticated
- Payroll tables restricted to finance_officer, hr_admin, system_admin
- Employees can read their own payslips, training, skills, career, exit records
*/

-- ============================================================
-- skills (master catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;

DROP POLICY IF EXISTS "skills_select_all" ON public.skills;
CREATE POLICY "skills_select_all"
  ON public.skills FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "skills_insert_hr" ON public.skills;
CREATE POLICY "skills_insert_hr"
  ON public.skills FOR INSERT TO authenticated WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "skills_update_hr" ON public.skills;
CREATE POLICY "skills_update_hr"
  ON public.skills FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "skills_delete_hr" ON public.skills;
CREATE POLICY "skills_delete_hr"
  ON public.skills FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- employee_skills
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  proficiency_level integer NOT NULL DEFAULT 1 CHECK (proficiency_level BETWEEN 1 AND 5),
  years_of_experience numeric(4,1),
  certified boolean DEFAULT false,
  last_assessed date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, skill_id)
);

ALTER TABLE public.employee_skills ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_skills TO authenticated;

DROP POLICY IF EXISTS "emp_skills_select_own_or_hr" ON public.employee_skills;
CREATE POLICY "emp_skills_select_own_or_hr"
  ON public.employee_skills FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_skills.employee_id AND e.profile_id = auth.uid())
    OR public.is_department_manager_of(employee_skills.employee_id)
  );

DROP POLICY IF EXISTS "emp_skills_insert_hr" ON public.employee_skills;
CREATE POLICY "emp_skills_insert_hr"
  ON public.employee_skills FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_skills.employee_id AND e.profile_id = auth.uid()));

DROP POLICY IF EXISTS "emp_skills_update_hr" ON public.employee_skills;
CREATE POLICY "emp_skills_update_hr"
  ON public.employee_skills FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_skills.employee_id AND e.profile_id = auth.uid()))
  WITH CHECK (public.is_hr_or_admin() OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_skills.employee_id AND e.profile_id = auth.uid()));

DROP POLICY IF EXISTS "emp_skills_delete_hr" ON public.employee_skills;
CREATE POLICY "emp_skills_delete_hr"
  ON public.employee_skills FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- training_programmes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.training_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  provider text,
  category text,
  training_type text CHECK (training_type IN ('internal','external','online','on_the_job')),
  start_date date,
  end_date date,
  duration_hours numeric(6,2),
  cost numeric(12,2),
  currency text DEFAULT 'RWF',
  max_participants integer,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','ongoing','completed','cancelled')),
  certification boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_programmes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_programmes TO authenticated;

DROP POLICY IF EXISTS "training_select_all" ON public.training_programmes;
CREATE POLICY "training_select_all"
  ON public.training_programmes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "training_insert_hr" ON public.training_programmes;
CREATE POLICY "training_insert_hr"
  ON public.training_programmes FOR INSERT TO authenticated WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "training_update_hr" ON public.training_programmes;
CREATE POLICY "training_update_hr"
  ON public.training_programmes FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "training_delete_hr" ON public.training_programmes;
CREATE POLICY "training_delete_hr"
  ON public.training_programmes FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- training_enrollments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.training_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id uuid NOT NULL REFERENCES public.training_programmes(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  enrollment_date date DEFAULT CURRENT_DATE,
  completion_date date,
  status text NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled','in_progress','completed','withdrawn','failed')),
  score numeric(5,2),
  certificate_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(programme_id, employee_id)
);

ALTER TABLE public.training_enrollments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_enrollments TO authenticated;

DROP POLICY IF EXISTS "enrollments_select_own_or_hr" ON public.training_enrollments;
CREATE POLICY "enrollments_select_own_or_hr"
  ON public.training_enrollments FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = training_enrollments.employee_id AND e.profile_id = auth.uid())
    OR public.is_department_manager_of(training_enrollments.employee_id)
  );

DROP POLICY IF EXISTS "enrollments_insert_hr" ON public.training_enrollments;
CREATE POLICY "enrollments_insert_hr"
  ON public.training_enrollments FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "enrollments_update_hr" ON public.training_enrollments;
CREATE POLICY "enrollments_update_hr"
  ON public.training_enrollments FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "enrollments_delete_hr" ON public.training_enrollments;
CREATE POLICY "enrollments_delete_hr"
  ON public.training_enrollments FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- career_progressions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.career_progressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  from_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  to_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  from_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  to_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  change_type text NOT NULL CHECK (change_type IN ('promotion','transfer','demotion','reassignment','grade_change')),
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  old_salary numeric(12,2),
  new_salary numeric(12,2),
  reason text,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.career_progressions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_progressions TO authenticated;

DROP POLICY IF EXISTS "career_select_own_or_hr" ON public.career_progressions;
CREATE POLICY "career_select_own_or_hr"
  ON public.career_progressions FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = career_progressions.employee_id AND e.profile_id = auth.uid())
    OR public.is_department_manager_of(career_progressions.employee_id)
  );

DROP POLICY IF EXISTS "career_insert_hr" ON public.career_progressions;
CREATE POLICY "career_insert_hr"
  ON public.career_progressions FOR INSERT TO authenticated WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "career_update_hr" ON public.career_progressions;
CREATE POLICY "career_update_hr"
  ON public.career_progressions FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "career_delete_hr" ON public.career_progressions;
CREATE POLICY "career_delete_hr"
  ON public.career_progressions FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- allowances
-- ============================================================
CREATE TABLE IF NOT EXISTS public.allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  allowance_type text CHECK (allowance_type IN ('housing','transport','medical','meal','communication','education','risk','overtime','other')),
  default_amount numeric(12,2) NOT NULL DEFAULT 0,
  is_percentage boolean DEFAULT false,
  is_taxable boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allowances ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.allowances TO authenticated;

DROP POLICY IF EXISTS "allowances_select_all" ON public.allowances;
CREATE POLICY "allowances_select_all"
  ON public.allowances FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "allowances_insert_hr" ON public.allowances;
CREATE POLICY "allowances_insert_hr"
  ON public.allowances FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer());

DROP POLICY IF EXISTS "allowances_update_hr" ON public.allowances;
CREATE POLICY "allowances_update_hr"
  ON public.allowances FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer())
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer());

DROP POLICY IF EXISTS "allowances_delete_hr" ON public.allowances;
CREATE POLICY "allowances_delete_hr"
  ON public.allowances FOR DELETE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer());

-- ============================================================
-- deductions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  deduction_type text CHECK (deduction_type IN ('tax','pension','social_security','loan','insurance','advance','other')),
  default_amount numeric(12,2) NOT NULL DEFAULT 0,
  is_percentage boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.deductions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deductions TO authenticated;

DROP POLICY IF EXISTS "deductions_select_all" ON public.deductions;
CREATE POLICY "deductions_select_all"
  ON public.deductions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "deductions_insert_hr" ON public.deductions;
CREATE POLICY "deductions_insert_hr"
  ON public.deductions FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer());

DROP POLICY IF EXISTS "deductions_update_hr" ON public.deductions;
CREATE POLICY "deductions_update_hr"
  ON public.deductions FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer())
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer());

DROP POLICY IF EXISTS "deductions_delete_hr" ON public.deductions;
CREATE POLICY "deductions_delete_hr"
  ON public.deductions FOR DELETE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer());

-- ============================================================
-- employee_salary_components
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_salary_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  component_type text NOT NULL CHECK (component_type IN ('base_salary','allowance','deduction')),
  component_id uuid,
  component_name text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  is_percentage boolean DEFAULT false,
  is_active boolean DEFAULT true,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_salary_components ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_salary_components TO authenticated;

DROP POLICY IF EXISTS "salary_components_select_own_or_hr" ON public.employee_salary_components;
CREATE POLICY "salary_components_select_own_or_hr"
  ON public.employee_salary_components FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.is_finance_officer()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_salary_components.employee_id AND e.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "salary_components_insert_hr" ON public.employee_salary_components;
CREATE POLICY "salary_components_insert_hr"
  ON public.employee_salary_components FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer());

DROP POLICY IF EXISTS "salary_components_update_hr" ON public.employee_salary_components;
CREATE POLICY "salary_components_update_hr"
  ON public.employee_salary_components FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer())
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer());

DROP POLICY IF EXISTS "salary_components_delete_hr" ON public.employee_salary_components;
CREATE POLICY "salary_components_delete_hr"
  ON public.employee_salary_components FOR DELETE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer());

-- ============================================================
-- payroll_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period_month integer NOT NULL CHECK (pay_period_month BETWEEN 1 AND 12),
  pay_period_year integer NOT NULL,
  run_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','processing','completed','approved','rejected','paid')),
  total_gross numeric(14,2) DEFAULT 0,
  total_deductions numeric(14,2) DEFAULT 0,
  total_net numeric(14,2) DEFAULT 0,
  employee_count integer DEFAULT 0,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_date date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pay_period_month, pay_period_year)
);

ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;

DROP POLICY IF EXISTS "payroll_runs_select_hr_finance" ON public.payroll_runs;
CREATE POLICY "payroll_runs_select_hr_finance"
  ON public.payroll_runs FOR SELECT TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer() OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "payroll_runs_insert_finance" ON public.payroll_runs;
CREATE POLICY "payroll_runs_insert_finance"
  ON public.payroll_runs FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer() OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "payroll_runs_update_finance" ON public.payroll_runs;
CREATE POLICY "payroll_runs_update_finance"
  ON public.payroll_runs FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer() OR public.has_role('system_admin'))
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer() OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "payroll_runs_delete_finance" ON public.payroll_runs;
CREATE POLICY "payroll_runs_delete_finance"
  ON public.payroll_runs FOR DELETE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer());

-- ============================================================
-- payslips
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  pay_period_month integer NOT NULL,
  pay_period_year integer NOT NULL,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  total_allowances numeric(12,2) NOT NULL DEFAULT 0,
  gross_pay numeric(12,2) NOT NULL DEFAULT 0,
  total_deductions numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  net_pay numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RWF',
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated','approved','paid','disputed')),
  payment_date date,
  payment_method text,
  bank_reference text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payslips TO authenticated;

DROP POLICY IF EXISTS "payslips_select_own_or_hr_finance" ON public.payslips;
CREATE POLICY "payslips_select_own_or_hr_finance"
  ON public.payslips FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.is_finance_officer()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = payslips.employee_id AND e.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "payslips_insert_finance" ON public.payslips;
CREATE POLICY "payslips_insert_finance"
  ON public.payslips FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer() OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "payslips_update_finance" ON public.payslips;
CREATE POLICY "payslips_update_finance"
  ON public.payslips FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer() OR public.has_role('system_admin'))
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer() OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "payslips_delete_finance" ON public.payslips;
CREATE POLICY "payslips_delete_finance"
  ON public.payslips FOR DELETE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer());

-- ============================================================
-- succession_plans
-- ============================================================
CREATE TABLE IF NOT EXISTS public.succession_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  current_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  successor_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  readiness_level text CHECK (readiness_level IN ('ready_now','ready_1_2_years','ready_3_5_years','development_needed')),
  notes text,
  risk_level text DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
  status text DEFAULT 'active' CHECK (status IN ('active','reviewed','archived')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.succession_plans ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.succession_plans TO authenticated;

DROP POLICY IF EXISTS "succession_select_hr" ON public.succession_plans;
CREATE POLICY "succession_select_hr"
  ON public.succession_plans FOR SELECT TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('system_admin') OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "succession_insert_hr" ON public.succession_plans;
CREATE POLICY "succession_insert_hr"
  ON public.succession_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "succession_update_hr" ON public.succession_plans;
CREATE POLICY "succession_update_hr"
  ON public.succession_plans FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('department_manager'))
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "succession_delete_hr" ON public.succession_plans;
CREATE POLICY "succession_delete_hr"
  ON public.succession_plans FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- disciplinary_cases
-- ============================================================
CREATE TABLE IF NOT EXISTS public.disciplinary_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL UNIQUE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  incident_date date NOT NULL,
  reported_date date NOT NULL DEFAULT CURRENT_DATE,
  reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  offence_type text,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','moderate','major','gross')),
  action_taken text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','under_investigation','hearing_scheduled','resolved','dismissed','appealed')),
  hearing_date date,
  outcome text,
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disciplinary_cases ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disciplinary_cases TO authenticated;

DROP POLICY IF EXISTS "disciplinary_select_hr" ON public.disciplinary_cases;
CREATE POLICY "disciplinary_select_hr"
  ON public.disciplinary_cases FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.has_role('system_admin')
    OR public.has_role('department_manager')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = disciplinary_cases.employee_id AND e.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "disciplinary_insert_hr" ON public.disciplinary_cases;
CREATE POLICY "disciplinary_insert_hr"
  ON public.disciplinary_cases FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "disciplinary_update_hr" ON public.disciplinary_cases;
CREATE POLICY "disciplinary_update_hr"
  ON public.disciplinary_cases FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('department_manager'))
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "disciplinary_delete_hr" ON public.disciplinary_cases;
CREATE POLICY "disciplinary_delete_hr"
  ON public.disciplinary_cases FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- exit_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  exit_type text NOT NULL CHECK (exit_type IN ('resignation','termination','retirement','contract_expiry','mutual_agreement')),
  requested_date date NOT NULL DEFAULT CURRENT_DATE,
  last_working_date date NOT NULL,
  reason text,
  notice_given boolean DEFAULT true,
  notice_period_days integer,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','in_progress','completed','cancelled')),
  approver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exit_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exit_requests TO authenticated;

DROP POLICY IF EXISTS "exit_select_own_or_hr" ON public.exit_requests;
CREATE POLICY "exit_select_own_or_hr"
  ON public.exit_requests FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = exit_requests.employee_id AND e.profile_id = auth.uid())
    OR public.is_department_manager_of(exit_requests.employee_id)
  );

DROP POLICY IF EXISTS "exit_insert_hr_or_own" ON public.exit_requests;
CREATE POLICY "exit_insert_hr_or_own"
  ON public.exit_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_hr_or_admin()
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = exit_requests.employee_id AND e.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "exit_update_hr" ON public.exit_requests;
CREATE POLICY "exit_update_hr"
  ON public.exit_requests FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "exit_delete_hr" ON public.exit_requests;
CREATE POLICY "exit_delete_hr"
  ON public.exit_requests FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- exit_interviews
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exit_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_request_id uuid NOT NULL REFERENCES public.exit_requests(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  interview_date date NOT NULL DEFAULT CURRENT_DATE,
  interviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason_for_leaving text,
  satisfaction_rating integer CHECK (satisfaction_rating BETWEEN 1 AND 5),
  would_recommend boolean,
  feedback text,
  suggestions text,
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exit_interviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exit_interviews TO authenticated;

DROP POLICY IF EXISTS "exit_interviews_select_hr" ON public.exit_interviews;
CREATE POLICY "exit_interviews_select_hr"
  ON public.exit_interviews FOR SELECT TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "exit_interviews_insert_hr" ON public.exit_interviews;
CREATE POLICY "exit_interviews_insert_hr"
  ON public.exit_interviews FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "exit_interviews_update_hr" ON public.exit_interviews;
CREATE POLICY "exit_interviews_update_hr"
  ON public.exit_interviews FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "exit_interviews_delete_hr" ON public.exit_interviews;
CREATE POLICY "exit_interviews_delete_hr"
  ON public.exit_interviews FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- exit_clearances
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exit_clearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_request_id uuid NOT NULL REFERENCES public.exit_requests(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  clearance_item text NOT NULL,
  department text,
  responsible_person_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','not_applicable')),
  completed_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exit_clearances ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exit_clearances TO authenticated;

DROP POLICY IF EXISTS "clearances_select_hr" ON public.exit_clearances;
CREATE POLICY "clearances_select_hr"
  ON public.exit_clearances FOR SELECT TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "clearances_insert_hr" ON public.exit_clearances;
CREATE POLICY "clearances_insert_hr"
  ON public.exit_clearances FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "clearances_update_hr" ON public.exit_clearances;
CREATE POLICY "clearances_update_hr"
  ON public.exit_clearances FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "clearances_delete_hr" ON public.exit_clearances;
CREATE POLICY "clearances_delete_hr"
  ON public.exit_clearances FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- final_settlements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.final_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_request_id uuid NOT NULL REFERENCES public.exit_requests(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary_due numeric(12,2) DEFAULT 0,
  leave_encashment numeric(12,2) DEFAULT 0,
  bonuses numeric(12,2) DEFAULT 0,
  total_earnings numeric(12,2) DEFAULT 0,
  total_deductions numeric(12,2) DEFAULT 0,
  net_settlement numeric(12,2) DEFAULT 0,
  currency text DEFAULT 'RWF',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','disputed')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_date date,
  payment_date date,
  notes text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.final_settlements ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.final_settlements TO authenticated;

DROP POLICY IF EXISTS "settlements_select_hr_finance" ON public.final_settlements;
CREATE POLICY "settlements_select_hr_finance"
  ON public.final_settlements FOR SELECT TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer() OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "settlements_insert_finance" ON public.final_settlements;
CREATE POLICY "settlements_insert_finance"
  ON public.final_settlements FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer());

DROP POLICY IF EXISTS "settlements_update_finance" ON public.final_settlements;
CREATE POLICY "settlements_update_finance"
  ON public.final_settlements FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_finance_officer())
  WITH CHECK (public.is_hr_or_admin() OR public.is_finance_officer());

DROP POLICY IF EXISTS "settlements_delete_finance" ON public.final_settlements;
CREATE POLICY "settlements_delete_finance"
  ON public.final_settlements FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_training_enrollments_employee ON public.training_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_programme ON public.training_enrollments(programme_id);
CREATE INDEX IF NOT EXISTS idx_emp_skills_employee ON public.employee_skills(employee_id);
CREATE INDEX IF NOT EXISTS idx_career_employee ON public.career_progressions(employee_id);
CREATE INDEX IF NOT EXISTS idx_salary_components_employee ON public.employee_salary_components(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON public.payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_run ON public.payslips(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_employee ON public.disciplinary_cases(employee_id);
CREATE INDEX IF NOT EXISTS idx_disciplinary_status ON public.disciplinary_cases(status);
CREATE INDEX IF NOT EXISTS idx_exit_requests_employee ON public.exit_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_exit_requests_status ON public.exit_requests(status);
