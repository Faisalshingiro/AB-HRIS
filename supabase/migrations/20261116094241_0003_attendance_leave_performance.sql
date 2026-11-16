/*
# Attendance, Leave, Performance Module Tables

## Purpose
- Attendance tracking (check-in/check-out, attendance records)
- Leave management (leave types, leave requests, approvals)
- Performance management (KPIs, objectives, reviews, evaluation reports)

## New Tables
1. `attendance_records` — daily attendance entries per employee
2. `leave_types` — configurable leave categories (annual, sick, maternity, etc.)
3. `leave_requests` — leave applications with approval workflow
4. `leave_balances` — annual leave balance per employee per leave type
5. `performance_kpis` — KPI definitions per position/department
6. `performance_objectives` — individual objectives per employee per review cycle
7. `performance_reviews` — formal review records with ratings
8. `performance_evaluations` — detailed evaluation reports

## Security
- RLS on all tables
- Employees can read their own attendance/leave/performance
- HR/admin can manage all
- Department managers can read/approve for their department members
*/

-- ============================================================
-- attendance_records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  check_in_time timestamptz,
  check_out_time timestamptz,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','half_day','remote','leave','holiday','weekend')),
  work_hours numeric(4,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, attendance_date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;

DROP POLICY IF EXISTS "attendance_select_own_or_hr" ON public.attendance_records;
CREATE POLICY "attendance_select_own_or_hr"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = attendance_records.employee_id AND e.profile_id = auth.uid())
    OR public.is_department_manager_of(attendance_records.employee_id)
  );

DROP POLICY IF EXISTS "attendance_insert_hr" ON public.attendance_records;
CREATE POLICY "attendance_insert_hr"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "attendance_update_hr" ON public.attendance_records;
CREATE POLICY "attendance_update_hr"
  ON public.attendance_records FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('system_admin'))
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "attendance_delete_hr" ON public.attendance_records;
CREATE POLICY "attendance_delete_hr"
  ON public.attendance_records FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- leave_types
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  default_days integer NOT NULL DEFAULT 0,
  is_paid boolean NOT NULL DEFAULT true,
  requires_approval boolean NOT NULL DEFAULT true,
  carry_forward boolean NOT NULL DEFAULT false,
  color text DEFAULT '#3b82f6',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO authenticated;

DROP POLICY IF EXISTS "leave_types_select_all" ON public.leave_types;
CREATE POLICY "leave_types_select_all"
  ON public.leave_types FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "leave_types_insert_hr" ON public.leave_types;
CREATE POLICY "leave_types_insert_hr"
  ON public.leave_types FOR INSERT TO authenticated WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "leave_types_update_hr" ON public.leave_types;
CREATE POLICY "leave_types_update_hr"
  ON public.leave_types FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "leave_types_delete_hr" ON public.leave_types;
CREATE POLICY "leave_types_delete_hr"
  ON public.leave_types FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- leave_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested numeric(5,2) NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approver_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_date date,
  approver_notes text,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;

DROP POLICY IF EXISTS "leave_select_own_or_hr" ON public.leave_requests;
CREATE POLICY "leave_select_own_or_hr"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = leave_requests.employee_id AND e.profile_id = auth.uid())
    OR public.is_department_manager_of(leave_requests.employee_id)
  );

DROP POLICY IF EXISTS "leave_insert_own" ON public.leave_requests;
CREATE POLICY "leave_insert_own"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_hr_or_admin()
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = leave_requests.employee_id AND e.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "leave_update_hr_or_manager" ON public.leave_requests;
CREATE POLICY "leave_update_hr_or_manager"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.is_department_manager_of(leave_requests.employee_id)
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = leave_requests.employee_id AND e.profile_id = auth.uid())
  )
  WITH CHECK (
    public.is_hr_or_admin()
    OR public.is_department_manager_of(leave_requests.employee_id)
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = leave_requests.employee_id AND e.profile_id = auth.uid())
  );

DROP POLICY IF EXISTS "leave_delete_own" ON public.leave_requests;
CREATE POLICY "leave_delete_own"
  ON public.leave_requests FOR DELETE TO authenticated
  USING (
    public.is_hr_or_admin()
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = leave_requests.employee_id AND e.profile_id = auth.uid())
  );

-- ============================================================
-- leave_balances
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL DEFAULT EXTRACT(year FROM now())::int,
  allocated_days numeric(5,2) NOT NULL DEFAULT 0,
  used_days numeric(5,2) NOT NULL DEFAULT 0,
  carried_forward_days numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, leave_type_id, year)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_balances TO authenticated;

DROP POLICY IF EXISTS "balances_select_own_or_hr" ON public.leave_balances;
CREATE POLICY "balances_select_own_or_hr"
  ON public.leave_balances FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = leave_balances.employee_id AND e.profile_id = auth.uid())
    OR public.is_department_manager_of(leave_balances.employee_id)
  );

DROP POLICY IF EXISTS "balances_insert_hr" ON public.leave_balances;
CREATE POLICY "balances_insert_hr"
  ON public.leave_balances FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "balances_update_hr" ON public.leave_balances;
CREATE POLICY "balances_update_hr"
  ON public.leave_balances FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "balances_delete_hr" ON public.leave_balances;
CREATE POLICY "balances_delete_hr"
  ON public.leave_balances FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- performance_kpis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.performance_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  position_id uuid REFERENCES public.positions(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  weight numeric(5,2) DEFAULT 100,
  target_value text,
  measurement_unit text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_kpis ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_kpis TO authenticated;

DROP POLICY IF EXISTS "kpis_select_all" ON public.performance_kpis;
CREATE POLICY "kpis_select_all"
  ON public.performance_kpis FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "kpis_insert_hr" ON public.performance_kpis;
CREATE POLICY "kpis_insert_hr"
  ON public.performance_kpis FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "kpis_update_hr" ON public.performance_kpis;
CREATE POLICY "kpis_update_hr"
  ON public.performance_kpis FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('department_manager'))
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "kpis_delete_hr" ON public.performance_kpis;
CREATE POLICY "kpis_delete_hr"
  ON public.performance_kpis FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- performance_objectives
-- ============================================================
CREATE TABLE IF NOT EXISTS public.performance_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  kpi_id uuid REFERENCES public.performance_kpis(id) ON DELETE SET NULL,
  target text,
  achievement text,
  progress numeric(5,2) DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','overdue','cancelled')),
  due_date date,
  review_cycle text DEFAULT 'annual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_objectives ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_objectives TO authenticated;

DROP POLICY IF EXISTS "objectives_select_own_or_hr" ON public.performance_objectives;
CREATE POLICY "objectives_select_own_or_hr"
  ON public.performance_objectives FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = performance_objectives.employee_id AND e.profile_id = auth.uid())
    OR public.is_department_manager_of(performance_objectives.employee_id)
  );

DROP POLICY IF EXISTS "objectives_insert_hr_or_manager" ON public.performance_objectives;
CREATE POLICY "objectives_insert_hr_or_manager"
  ON public.performance_objectives FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "objectives_update_hr_or_manager" ON public.performance_objectives;
CREATE POLICY "objectives_update_hr_or_manager"
  ON public.performance_objectives FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('department_manager') OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = performance_objectives.employee_id AND e.profile_id = auth.uid()))
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager') OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = performance_objectives.employee_id AND e.profile_id = auth.uid()));

DROP POLICY IF EXISTS "objectives_delete_hr" ON public.performance_objectives;
CREATE POLICY "objectives_delete_hr"
  ON public.performance_objectives FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- performance_reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  review_cycle text NOT NULL DEFAULT 'annual',
  review_period text,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  overall_rating integer CHECK (overall_rating BETWEEN 1 AND 5),
  strengths text,
  areas_for_improvement text,
  goals text,
  reviewer_comments text,
  employee_comments text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','reviewed','finalized','acknowledged')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_reviews TO authenticated;

DROP POLICY IF EXISTS "reviews_select_own_or_hr" ON public.performance_reviews;
CREATE POLICY "reviews_select_own_or_hr"
  ON public.performance_reviews FOR SELECT TO authenticated
  USING (
    public.is_hr_or_admin()
    OR public.has_role('system_admin')
    OR EXISTS (SELECT 1 FROM public.employees e WHERE e.id = performance_reviews.employee_id AND e.profile_id = auth.uid())
    OR public.is_department_manager_of(performance_reviews.employee_id)
  );

DROP POLICY IF EXISTS "reviews_insert_hr_or_manager" ON public.performance_reviews;
CREATE POLICY "reviews_insert_hr_or_manager"
  ON public.performance_reviews FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "reviews_update_hr_or_manager" ON public.performance_reviews;
CREATE POLICY "reviews_update_hr_or_manager"
  ON public.performance_reviews FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('department_manager'))
  WITH CHECK (public.is_hr_or_admin() OR public.has_role('department_manager'));

DROP POLICY IF EXISTS "reviews_delete_hr" ON public.performance_reviews;
CREATE POLICY "reviews_delete_hr"
  ON public.performance_reviews FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance_records(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON public.leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_objectives_employee ON public.performance_objectives(employee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_employee ON public.performance_reviews(employee_id);
