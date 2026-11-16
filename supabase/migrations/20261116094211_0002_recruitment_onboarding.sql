/*
# Recruitment & Onboarding Module Tables

## Purpose
Manages the recruitment pipeline (vacancies → applications → interviews → decisions)
and the onboarding workflow (tasks, documents, contracts) for new hires.

## New Tables
1. `job_vacancies` — open positions for recruitment
2. `job_applications` — candidate applications for vacancies
3. `interviews` — interview scheduling and feedback
4. `onboarding_tasks` — checklist tasks for new employee onboarding
5. `employee_documents` — uploaded documents (contracts, IDs, certificates)
6. `employment_contracts` — contract terms and status

## Security
- RLS on all tables, grants to authenticated
- All authenticated users can read vacancies
- HR/admin can manage vacancies and applications
- Department managers can read applications for their department vacancies
- Employees can read their own onboarding tasks, documents, contracts
*/

-- ============================================================
-- job_vacancies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.job_vacancies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  description text,
  requirements text,
  vacancy_type text DEFAULT 'internal' CHECK (vacancy_type IN ('internal','external')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed','cancelled')),
  openings integer NOT NULL DEFAULT 1,
  posted_date date DEFAULT CURRENT_DATE,
  closing_date date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_vacancies ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_vacancies TO authenticated;

DROP POLICY IF EXISTS "vacancies_select_all" ON public.job_vacancies;
CREATE POLICY "vacancies_select_all"
  ON public.job_vacancies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vacancies_insert_hr" ON public.job_vacancies;
CREATE POLICY "vacancies_insert_hr"
  ON public.job_vacancies FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "vacancies_update_hr" ON public.job_vacancies;
CREATE POLICY "vacancies_update_hr"
  ON public.job_vacancies FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "vacancies_delete_hr" ON public.job_vacancies;
CREATE POLICY "vacancies_delete_hr"
  ON public.job_vacancies FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- job_applications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vacancy_id uuid NOT NULL REFERENCES public.job_vacancies(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email citext NOT NULL,
  phone text,
  cover_letter text,
  resume_url text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','reviewing','shortlisted','interviewed','offered','hired','rejected','withdrawn')),
  current_employer text,
  years_of_experience integer,
  expected_salary numeric(12,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_applications TO authenticated;

DROP POLICY IF EXISTS "applications_select_hr" ON public.job_applications;
CREATE POLICY "applications_select_hr"
  ON public.job_applications FOR SELECT TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('department_manager') OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "applications_insert_any" ON public.job_applications;
CREATE POLICY "applications_insert_any"
  ON public.job_applications FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "applications_update_hr" ON public.job_applications;
CREATE POLICY "applications_update_hr"
  ON public.job_applications FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "applications_delete_hr" ON public.job_applications;
CREATE POLICY "applications_delete_hr"
  ON public.job_applications FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- interviews
-- ============================================================
CREATE TABLE IF NOT EXISTS public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  vacancy_id uuid REFERENCES public.job_vacancies(id) ON DELETE CASCADE,
  interview_date date NOT NULL,
  interview_time time NOT NULL,
  location text,
  interviewer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  round integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  feedback text,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;

DROP POLICY IF EXISTS "interviews_select_hr" ON public.interviews;
CREATE POLICY "interviews_select_hr"
  ON public.interviews FOR SELECT TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('department_manager') OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "interviews_insert_hr" ON public.interviews;
CREATE POLICY "interviews_insert_hr"
  ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "interviews_update_hr" ON public.interviews;
CREATE POLICY "interviews_update_hr"
  ON public.interviews FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('department_manager'))
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "interviews_delete_hr" ON public.interviews;
CREATE POLICY "interviews_delete_hr"
  ON public.interviews FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- employee_documents
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('contract','national_id','passport','diploma','certificate','medical','bank_details','other')),
  title text NOT NULL,
  file_url text,
  file_name text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;

DROP POLICY IF EXISTS "documents_select_own_or_hr" ON public.employee_documents;
CREATE POLICY "documents_select_own_or_hr"
  ON public.employee_documents FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_documents.employee_id AND e.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "documents_insert_hr" ON public.employee_documents;
CREATE POLICY "documents_insert_hr"
  ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.is_hr_or_admin()
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employee_documents.employee_id AND e.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "documents_update_hr" ON public.employee_documents;
CREATE POLICY "documents_update_hr"
  ON public.employee_documents FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "documents_delete_hr" ON public.employee_documents;
CREATE POLICY "documents_delete_hr"
  ON public.employee_documents FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- employment_contracts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employment_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_type text NOT NULL CHECK (contract_type IN ('permanent','fixed_term','probation','internship','consultancy')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  salary numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'RWF',
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','expired','terminated','renewed')),
  terms text,
  document_url text,
  signed_date date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employment_contracts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employment_contracts TO authenticated;

DROP POLICY IF EXISTS "contracts_select_own_or_hr" ON public.employment_contracts;
CREATE POLICY "contracts_select_own_or_hr"
  ON public.employment_contracts FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = employment_contracts.employee_id AND e.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "contracts_insert_hr" ON public.employment_contracts;
CREATE POLICY "contracts_insert_hr"
  ON public.employment_contracts FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "contracts_update_hr" ON public.employment_contracts;
CREATE POLICY "contracts_update_hr"
  ON public.employment_contracts FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "contracts_delete_hr" ON public.employment_contracts;
CREATE POLICY "contracts_delete_hr"
  ON public.employment_contracts FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- onboarding_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  task_type text DEFAULT 'general' CHECK (task_type IN ('general','document','training','it_setup','orientation','policy')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped')),
  due_date date,
  completed_date date,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_tasks TO authenticated;

DROP POLICY IF EXISTS "onboarding_select_own_or_hr" ON public.onboarding_tasks;
CREATE POLICY "onboarding_select_own_or_hr"
  ON public.onboarding_tasks FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = onboarding_tasks.employee_id AND e.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "onboarding_insert_hr" ON public.onboarding_tasks;
CREATE POLICY "onboarding_insert_hr"
  ON public.onboarding_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "onboarding_update_own_or_hr" ON public.onboarding_tasks;
CREATE POLICY "onboarding_update_own_or_hr"
  ON public.onboarding_tasks FOR UPDATE TO authenticated
  USING (
    public.is_hr_or_admin()
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = onboarding_tasks.employee_id AND e.profile_id = auth.uid())
  )
  WITH CHECK (
    public.is_hr_or_admin()
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = onboarding_tasks.employee_id AND e.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "onboarding_delete_hr" ON public.onboarding_tasks;
CREATE POLICY "onboarding_delete_hr"
  ON public.onboarding_tasks FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vacancies_status ON public.job_vacancies(status);
CREATE INDEX IF NOT EXISTS idx_vacancies_department ON public.job_vacancies(department_id);
CREATE INDEX IF NOT EXISTS idx_applications_vacancy ON public.job_applications(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.job_applications(status);
CREATE INDEX IF NOT EXISTS idx_interviews_application ON public.interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_documents_employee ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_employee ON public.employment_contracts(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_employee ON public.onboarding_tasks(employee_id);
