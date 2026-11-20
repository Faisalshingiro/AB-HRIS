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
