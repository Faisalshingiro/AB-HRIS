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