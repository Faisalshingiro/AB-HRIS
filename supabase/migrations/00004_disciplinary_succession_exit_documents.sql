-- ============ DISCIPLINARY ============
CREATE TABLE public.disciplinary_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_no text NOT NULL UNIQUE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'misconduct',
  incident_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'minor',
  status text NOT NULL DEFAULT 'open',
  outcome text,
  sanction text,
  reported_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_disc_employee ON public.disciplinary_cases(employee_id);

CREATE TABLE public.disciplinary_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.disciplinary_cases(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  description text,
  action_date date NOT NULL DEFAULT CURRENT_DATE,
  issued_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.disciplinary_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc_select_scoped" ON public.disciplinary_cases FOR SELECT TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id() OR public.manages_employee(employee_id));
CREATE POLICY "disc_insert_hr" ON public.disciplinary_cases FOR INSERT TO authenticated WITH CHECK (public.is_hr() OR public.is_manager());
CREATE POLICY "disc_update_hr" ON public.disciplinary_cases FOR UPDATE TO authenticated
  USING (public.is_hr() OR public.manages_employee(employee_id)) WITH CHECK (public.is_hr() OR public.manages_employee(employee_id));
CREATE POLICY "disc_delete_hr" ON public.disciplinary_cases FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.disciplinary_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc_act_select" ON public.disciplinary_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.disciplinary_cases c WHERE c.id = case_id
    AND (public.is_hr() OR c.employee_id = public.current_employee_id() OR public.manages_employee(c.employee_id))));
CREATE POLICY "disc_act_insert" ON public.disciplinary_actions FOR INSERT TO authenticated WITH CHECK (public.is_hr() OR public.is_manager());
CREATE POLICY "disc_act_update" ON public.disciplinary_actions FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "disc_act_delete" ON public.disciplinary_actions FOR DELETE TO authenticated USING (public.is_hr());

-- ============ SUCCESSION ============
CREATE TABLE public.succession_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  title text NOT NULL,
  incumbent_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  criticality text NOT NULL DEFAULT 'high',
  risk_of_loss text NOT NULL DEFAULT 'medium',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.succession_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.succession_plans(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  readiness text NOT NULL DEFAULT 'ready_1_2_years',
  potential text NOT NULL DEFAULT 'high',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, employee_id)
);

ALTER TABLE public.succession_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "succ_select_hr" ON public.succession_plans FOR SELECT TO authenticated USING (public.is_hr() OR public.is_manager());
CREATE POLICY "succ_insert_hr" ON public.succession_plans FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "succ_update_hr" ON public.succession_plans FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "succ_delete_hr" ON public.succession_plans FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.succession_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "succ_cand_select" ON public.succession_candidates FOR SELECT TO authenticated USING (public.is_hr() OR public.is_manager());
CREATE POLICY "succ_cand_insert" ON public.succession_candidates FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "succ_cand_update" ON public.succession_candidates FOR UPDATE TO authenticated USING (public.is_hr()) WITH CHECK (public.is_hr());
CREATE POLICY "succ_cand_delete" ON public.succession_candidates FOR DELETE TO authenticated USING (public.is_hr());

-- ============ EXIT ============
CREATE TABLE public.exit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  exit_type text NOT NULL DEFAULT 'resignation',
  notice_date date NOT NULL DEFAULT CURRENT_DATE,
  last_working_day date NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'submitted',
  approved_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_exit_employee ON public.exit_requests(employee_id);

CREATE TABLE public.exit_clearances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_request_id uuid NOT NULL REFERENCES public.exit_requests(id) ON DELETE CASCADE,
  department text NOT NULL,
  item text NOT NULL,
  owner_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  cleared_at timestamptz,
  notes text,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE public.final_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exit_request_id uuid NOT NULL UNIQUE REFERENCES public.exit_requests(id) ON DELETE CASCADE,
  final_salary numeric(14,2) NOT NULL DEFAULT 0,
  leave_encashment numeric(14,2) NOT NULL DEFAULT 0,
  severance numeric(14,2) NOT NULL DEFAULT 0,
  deductions numeric(14,2) NOT NULL DEFAULT 0,
  net_settlement numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  computed_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.exit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exit_select_scoped" ON public.exit_requests FOR SELECT TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id() OR public.manages_employee(employee_id));
CREATE POLICY "exit_insert_scoped" ON public.exit_requests FOR INSERT TO authenticated
  WITH CHECK (public.is_hr() OR employee_id = public.current_employee_id());
CREATE POLICY "exit_update_scoped" ON public.exit_requests FOR UPDATE TO authenticated
  USING (public.is_hr() OR employee_id = public.current_employee_id() OR public.manages_employee(employee_id))
  WITH CHECK (public.is_hr() OR employee_id = public.current_employee_id() OR public.manages_employee(employee_id));
CREATE POLICY "exit_delete_hr" ON public.exit_requests FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.exit_clearances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clear_select" ON public.exit_clearances FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exit_requests r WHERE r.id = exit_request_id
    AND (public.is_hr() OR r.employee_id = public.current_employee_id() OR public.manages_employee(r.employee_id))));
CREATE POLICY "clear_insert" ON public.exit_clearances FOR INSERT TO authenticated WITH CHECK (public.is_hr());
CREATE POLICY "clear_update" ON public.exit_clearances FOR UPDATE TO authenticated
  USING (public.is_hr() OR public.is_finance()) WITH CHECK (public.is_hr() OR public.is_finance());
CREATE POLICY "clear_delete" ON public.exit_clearances FOR DELETE TO authenticated USING (public.is_hr());

ALTER TABLE public.final_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settle_select" ON public.final_settlements FOR SELECT TO authenticated
  USING (public.is_hr() OR public.is_finance() OR EXISTS (
    SELECT 1 FROM public.exit_requests r WHERE r.id = exit_request_id AND r.employee_id = public.current_employee_id()));
CREATE POLICY "settle_insert" ON public.final_settlements FOR INSERT TO authenticated WITH CHECK (public.is_hr() OR public.is_finance());
CREATE POLICY "settle_update" ON public.final_settlements FOR UPDATE TO authenticated
  USING (public.is_hr() OR public.is_finance()) WITH CHECK (public.is_hr() OR public.is_finance());
CREATE POLICY "settle_delete" ON public.final_settlements FOR DELETE TO authenticated USING (public.is_hr());

-- ============ DOCUMENT REPOSITORY ============
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'policy',
  file_name text NOT NULL,
  file_url text,
  file_size bigint DEFAULT 0,
  visibility text NOT NULL DEFAULT 'all',
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs_select" ON public.documents FOR SELECT TO authenticated
  USING (visibility = 'all' OR public.is_hr() OR public.is_finance()
    OR owner_employee_id = public.current_employee_id());
CREATE POLICY "docs_insert" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.is_hr() OR public.is_finance());
CREATE POLICY "docs_update" ON public.documents FOR UPDATE TO authenticated
  USING (public.is_hr() OR public.is_finance()) WITH CHECK (public.is_hr() OR public.is_finance());
CREATE POLICY "docs_delete" ON public.documents FOR DELETE TO authenticated USING (public.is_hr());

-- ============ STORAGE ============
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('hris-documents', 'hris-documents', true, 5242880);

CREATE POLICY "hris_docs_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'hris-documents');
CREATE POLICY "hris_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'hris-documents');
CREATE POLICY "hris_docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'hris-documents') WITH CHECK (bucket_id = 'hris-documents');
CREATE POLICY "hris_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'hris-documents');
