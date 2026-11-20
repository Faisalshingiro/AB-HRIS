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
