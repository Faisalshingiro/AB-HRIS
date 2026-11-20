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
