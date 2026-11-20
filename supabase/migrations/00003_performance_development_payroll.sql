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
