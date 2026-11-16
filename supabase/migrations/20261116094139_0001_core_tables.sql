/*
# Core Tables: profiles, departments, positions, employees

## Purpose
Creates the foundational HRIS tables and the helper functions used by RLS policies.

## New Tables
1. `profiles` — extends auth.users with role and employee link
2. `departments` — org units with hierarchy and head
3. `positions` — job positions with salary bands
4. `employees` — central employee record

## Security
- RLS on all tables
- Helper functions for role checks (SECURITY DEFINER)
- All authenticated users can read directory data
- Only HR/admin can write departments, positions, employees
*/

CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- profiles (created first, no FK to employees yet)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email citext UNIQUE NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'employee',
  employee_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_all"
  ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- employees (no FK to profiles yet — added later)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number text NOT NULL UNIQUE,
  profile_id uuid,
  first_name text NOT NULL,
  last_name text NOT NULL,
  middle_name text,
  gender text CHECK (gender IN ('male','female','other')),
  date_of_birth date,
  national_id text UNIQUE,
  phone text,
  email citext,
  address text,
  city text,
  province text,
  marital_status text,
  nationality text DEFAULT 'Rwandan',
  department_id uuid,
  position_id uuid,
  employment_type text NOT NULL DEFAULT 'permanent' CHECK (employment_type IN ('permanent','contract','intern','probation')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','on_leave','suspended','terminated','resigned')),
  hire_date date NOT NULL DEFAULT CURRENT_DATE,
  contract_end_date date,
  reports_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  bank_account text,
  bank_name text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;

-- ============================================================
-- departments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  description text,
  head_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  parent_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;

-- ============================================================
-- positions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  code text NOT NULL UNIQUE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  grade text,
  min_salary numeric(12,2),
  max_salary numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;

-- Now add FKs that were circular: profiles -> employees, employees -> departments/positions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'profiles_employee_id_fkey') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_employee_id_fkey
      FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'employees_department_id_fkey' AND table_name = 'employees') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_department_id_fkey
      FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'employees_position_id_fkey' AND table_name = 'employees') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_position_id_fkey
      FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'employees_profile_id_fkey' AND table_name = 'employees') THEN
    ALTER TABLE public.employees ADD CONSTRAINT employees_profile_id_fkey
      FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- Helper functions (SECURITY DEFINER, STABLE)
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = required_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_hr_or_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('hr_admin','hr_officer','system_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_finance_officer()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'finance_officer'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_department_manager_of(emp_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.employees e ON e.id = p.employee_id
    JOIN public.departments d ON d.head_employee_id = e.id
    WHERE p.id = auth.uid()
    AND d.id = (SELECT emp.department_id FROM public.employees emp WHERE emp.id = emp_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION
  public.has_role(text),
  public.is_hr_or_admin(),
  public.is_finance_officer(),
  public.is_department_manager_of(uuid),
  public.current_user_role()
TO authenticated;

-- ============================================================
-- Policies: departments
-- ============================================================
DROP POLICY IF EXISTS "departments_select_all" ON public.departments;
CREATE POLICY "departments_select_all"
  ON public.departments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "departments_insert_hr" ON public.departments;
CREATE POLICY "departments_insert_hr"
  ON public.departments FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "departments_update_hr" ON public.departments;
CREATE POLICY "departments_update_hr"
  ON public.departments FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "departments_delete_hr" ON public.departments;
CREATE POLICY "departments_delete_hr"
  ON public.departments FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- Policies: positions
-- ============================================================
DROP POLICY IF EXISTS "positions_select_all" ON public.positions;
CREATE POLICY "positions_select_all"
  ON public.positions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "positions_insert_hr" ON public.positions;
CREATE POLICY "positions_insert_hr"
  ON public.positions FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "positions_update_hr" ON public.positions;
CREATE POLICY "positions_update_hr"
  ON public.positions FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin()) WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "positions_delete_hr" ON public.positions;
CREATE POLICY "positions_delete_hr"
  ON public.positions FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- Policies: employees
-- ============================================================
DROP POLICY IF EXISTS "employees_select_all" ON public.employees;
CREATE POLICY "employees_select_all"
  ON public.employees FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "employees_insert_hr" ON public.employees;
CREATE POLICY "employees_insert_hr"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (public.is_hr_or_admin());

DROP POLICY IF EXISTS "employees_update_hr_or_manager" ON public.employees;
CREATE POLICY "employees_update_hr_or_manager"
  ON public.employees FOR UPDATE TO authenticated
  USING (public.is_hr_or_admin() OR public.is_department_manager_of(employees.id))
  WITH CHECK (public.is_hr_or_admin() OR public.is_department_manager_of(employees.id));

DROP POLICY IF EXISTS "employees_delete_hr" ON public.employees;
CREATE POLICY "employees_delete_hr"
  ON public.employees FOR DELETE TO authenticated
  USING (public.is_hr_or_admin());

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_department ON public.employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_position ON public.employees(position_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_reports_to ON public.employees(reports_to);
CREATE INDEX IF NOT EXISTS idx_employees_profile ON public.employees(profile_id);
CREATE INDEX IF NOT EXISTS idx_positions_department ON public.positions(department_id);
CREATE INDEX IF NOT EXISTS idx_departments_parent ON public.departments(parent_department_id);
CREATE INDEX IF NOT EXISTS idx_profiles_employee ON public.profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ============================================================
-- Trigger: auto-create profile on auth.users insert
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), COALESCE(NEW.raw_user_meta_data->>'role', 'employee'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
