CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT role IN ('admin', 'manager') FROM public.profiles WHERE id = auth.uid()), false); $$;

CREATE OR REPLACE FUNCTION public.can_view_employee(emp uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_hr()
      OR emp = public.current_employee_id()
      OR public.manages_employee(emp);
$$;

DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
CREATE POLICY "profiles_select_self_or_hr"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_hr());

DROP POLICY IF EXISTS "employees_select_scoped" ON public.employees;
DROP POLICY IF EXISTS "employees_select_all" ON public.employees;
CREATE POLICY "employees_select_scoped"
  ON public.employees FOR SELECT TO authenticated
  USING (public.can_view_employee(id) OR public.is_finance());

DROP POLICY IF EXISTS "job_openings_select_auth" ON public.job_openings;
CREATE POLICY "job_openings_select_hr"
  ON public.job_openings FOR SELECT TO authenticated
  USING (public.is_hr());

DROP POLICY IF EXISTS "candidates_select_hr" ON public.candidates;
CREATE POLICY "candidates_select_hr"
  ON public.candidates FOR SELECT TO authenticated
  USING (public.is_hr());
DROP POLICY IF EXISTS "candidates_update_hr" ON public.candidates;
CREATE POLICY "candidates_update_hr"
  ON public.candidates FOR UPDATE TO authenticated
  USING (public.is_hr()) WITH CHECK (public.is_hr());

DROP POLICY IF EXISTS "interviews_select_hr" ON public.interviews;
CREATE POLICY "interviews_select_hr"
  ON public.interviews FOR SELECT TO authenticated
  USING (public.is_hr());
DROP POLICY IF EXISTS "interviews_insert_hr" ON public.interviews;
CREATE POLICY "interviews_insert_hr"
  ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (public.is_hr());
DROP POLICY IF EXISTS "interviews_update_hr" ON public.interviews;
CREATE POLICY "interviews_update_hr"
  ON public.interviews FOR UPDATE TO authenticated
  USING (public.is_hr()) WITH CHECK (public.is_hr());

DROP POLICY IF EXISTS "onboarding_select_scoped" ON public.onboarding_tasks;
CREATE POLICY "onboarding_select_scoped"
  ON public.onboarding_tasks FOR SELECT TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "onboarding_update_scoped" ON public.onboarding_tasks;
CREATE POLICY "onboarding_update_scoped"
  ON public.onboarding_tasks FOR UPDATE TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id())
  WITH CHECK (public.is_hr() OR employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "emp_docs_select_scoped" ON public.employee_documents;
CREATE POLICY "emp_docs_select_scoped"
  ON public.employee_documents FOR SELECT TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "emp_docs_insert_scoped" ON public.employee_documents;
CREATE POLICY "emp_docs_insert_scoped"
  ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (public.is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "emp_docs_update_scoped" ON public.employee_documents;
CREATE POLICY "emp_docs_update_scoped"
  ON public.employee_documents FOR UPDATE TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id())
  WITH CHECK (public.is_hr() OR employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "trainings_select_all" ON public.trainings;
CREATE POLICY "trainings_select_team"
  ON public.trainings FOR SELECT TO authenticated
  USING (public.is_hr() OR public.is_manager());

DROP POLICY IF EXISTS "disc_select_scoped" ON public.disciplinary_cases;
CREATE POLICY "disc_select_scoped"
  ON public.disciplinary_cases FOR SELECT TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "disc_insert_hr" ON public.disciplinary_cases;
CREATE POLICY "disc_insert_hr"
  ON public.disciplinary_cases FOR INSERT TO authenticated
  WITH CHECK (public.is_hr());
DROP POLICY IF EXISTS "disc_update_hr" ON public.disciplinary_cases;
CREATE POLICY "disc_update_hr"
  ON public.disciplinary_cases FOR UPDATE TO authenticated
  USING (public.is_hr()) WITH CHECK (public.is_hr());

DROP POLICY IF EXISTS "disc_act_select" ON public.disciplinary_actions;
CREATE POLICY "disc_act_select"
  ON public.disciplinary_actions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.disciplinary_cases c
      WHERE c.id = case_id
        AND (public.is_hr() OR c.employee_id = public.current_employee_id())
    )
  );
DROP POLICY IF EXISTS "disc_act_insert" ON public.disciplinary_actions;
CREATE POLICY "disc_act_insert"
  ON public.disciplinary_actions FOR INSERT TO authenticated
  WITH CHECK (public.is_hr());

DROP POLICY IF EXISTS "succ_select_hr" ON public.succession_plans;
CREATE POLICY "succ_select_hr"
  ON public.succession_plans FOR SELECT TO authenticated
  USING (public.is_hr());
DROP POLICY IF EXISTS "succ_cand_select" ON public.succession_candidates;
CREATE POLICY "succ_cand_select"
  ON public.succession_candidates FOR SELECT TO authenticated
  USING (public.is_hr());

DROP POLICY IF EXISTS "periods_select_finance" ON public.payroll_periods;
CREATE POLICY "periods_select_finance"
  ON public.payroll_periods FOR SELECT TO authenticated
  USING (public.is_finance());
DROP POLICY IF EXISTS "items_select_scoped" ON public.payroll_items;
CREATE POLICY "items_select_scoped"
  ON public.payroll_items FOR SELECT TO authenticated
  USING (public.is_finance() OR employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "docs_select" ON public.documents;
CREATE POLICY "docs_select"
  ON public.documents FOR SELECT TO authenticated
  USING (
    visibility = 'all'
    OR public.is_hr()
    OR owner_employee_id = public.current_employee_id()
    OR (public.is_finance() AND category = 'finance' AND visibility = 'finance')
  );
DROP POLICY IF EXISTS "docs_insert" ON public.documents;
CREATE POLICY "docs_insert"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (
    public.is_hr()
    OR (public.is_finance() AND category = 'finance' AND visibility = 'finance')
  );
DROP POLICY IF EXISTS "docs_update" ON public.documents;
CREATE POLICY "docs_update"
  ON public.documents FOR UPDATE TO authenticated
  USING (public.is_hr() OR (public.is_finance() AND category = 'finance' AND visibility = 'finance'))
  WITH CHECK (public.is_hr() OR (public.is_finance() AND category = 'finance' AND visibility = 'finance'));

DROP POLICY IF EXISTS "exit_select_scoped" ON public.exit_requests;
CREATE POLICY "exit_select_scoped"
  ON public.exit_requests FOR SELECT TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id());
DROP POLICY IF EXISTS "exit_update_scoped" ON public.exit_requests;
CREATE POLICY "exit_update_scoped"
  ON public.exit_requests FOR UPDATE TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id())
  WITH CHECK (public.is_hr() OR employee_id = public.current_employee_id());

DROP POLICY IF EXISTS "clear_select" ON public.exit_clearances;
CREATE POLICY "clear_select"
  ON public.exit_clearances FOR SELECT TO authenticated
  USING (
    public.is_hr()
    OR (public.is_finance() AND lower(trim(department)) LIKE 'finance%')
    OR EXISTS (
      SELECT 1 FROM public.exit_requests r
      WHERE r.id = exit_request_id AND r.employee_id = public.current_employee_id()
    )
  );
DROP POLICY IF EXISTS "clear_update" ON public.exit_clearances;
CREATE POLICY "clear_update"
  ON public.exit_clearances FOR UPDATE TO authenticated
  USING (public.is_hr() OR (public.is_finance() AND lower(trim(department)) LIKE 'finance%'))
  WITH CHECK (public.is_hr() OR (public.is_finance() AND lower(trim(department)) LIKE 'finance%'));

CREATE OR REPLACE FUNCTION public.finance_exit_requests()
RETURNS TABLE (
  id uuid,
  employee_id uuid,
  exit_type text,
  notice_date date,
  last_working_day date,
  status text,
  created_at timestamptz,
  first_name text,
  last_name text,
  employee_no text,
  department_id uuid,
  base_salary numeric
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.employee_id, r.exit_type, r.notice_date, r.last_working_day,
         r.status, r.created_at, e.first_name, e.last_name, e.employee_no,
         e.department_id, e.base_salary
  FROM public.exit_requests r
  JOIN public.employees e ON e.id = r.employee_id
  WHERE public.is_finance();
$$;

GRANT EXECUTE ON FUNCTION public.finance_exit_requests() TO authenticated;

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
