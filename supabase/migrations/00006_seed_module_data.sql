-- ============ RECRUITMENT ============
INSERT INTO public.job_openings (id, reference, title, department_id, position_id, employment_type, location, description, requirements, vacancies, salary_range, status, posted_date, closing_date) VALUES
('f0000000-0000-4000-8000-000000000001','REQ-2026-014','Senior Software Engineer','d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000015','permanent','Kigali, Rwanda','Design and deliver internal HR and finance platforms, mentor junior engineers and own service reliability.','BSc in Computer Science or related field, 5+ years experience with TypeScript and PostgreSQL, strong API design skills.',2,'RWF 900,000 - 1,300,000','open',CURRENT_DATE - 18, CURRENT_DATE + 12),
('f0000000-0000-4000-8000-000000000002','REQ-2026-015','Payroll Accountant','d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000006','permanent','Kigali, Rwanda','Own monthly payroll computation, statutory filings with RRA and RSSB, and reconciliation of payroll ledger accounts.','Bachelor degree in Accounting, CPA Part 2, 3 years payroll experience, deep knowledge of Rwandan PAYE and RSSB rules.',1,'RWF 600,000 - 800,000','open',CURRENT_DATE - 11, CURRENT_DATE + 19),
('f0000000-0000-4000-8000-000000000003','REQ-2026-016','Production Supervisor','d0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000018','fixed_term','Kigali, Rwanda','Supervise the second shift production line, enforce safety standards and report daily output.','Diploma in industrial engineering, 2 years supervisory experience in manufacturing.',3,'RWF 350,000 - 480,000','open',CURRENT_DATE - 6, CURRENT_DATE + 24),
('f0000000-0000-4000-8000-000000000004','REQ-2026-017','Customer Experience Officer','d0000000-0000-4000-8000-000000000009','b0000000-0000-4000-8000-000000000023','permanent','Kigali, Rwanda','Handle inbound client requests across phone and email, maintain the service knowledge base.','A0 in business administration, excellent Kinyarwanda and English communication.',2,'RWF 300,000 - 420,000','on_hold',CURRENT_DATE - 30, CURRENT_DATE - 2),
('f0000000-0000-4000-8000-000000000005','REQ-2026-013','Marketing Officer','d0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000013','permanent','Kigali, Rwanda','Plan and execute brand campaigns across digital and field channels.','2 years digital marketing experience, portfolio of campaigns.',1,'RWF 450,000 - 620,000','closed',CURRENT_DATE - 60, CURRENT_DATE - 20);

INSERT INTO public.candidates (id, job_opening_id, first_name, last_name, email, phone, source, stage, rating, notes, applied_at) VALUES
('a0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','Kevin','Gatete','kevin.gatete@example.rw','+250788200001','LinkedIn','interview',4,'Strong system design round, moving to panel','2026-10-28'),
('a0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000001','Nadia','Uwimana','nadia.uwimana@example.rw','+250788200002','Referral','screening',3,'Good backend background, needs frontend depth','2026-11-01'),
('a0000000-0000-4000-8000-000000000003','f0000000-0000-4000-8000-000000000001','Thierry','Mugabo','thierry.mugabo@example.rw','+250788200003','Job board','applied',0,'Portfolio shared, awaiting screening','2026-11-08'),
('a0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000001','Aline','Nyiraneza','aline.nyiraneza@example.rw','+250788200004','LinkedIn','offer',5,'Offer issued, awaiting candidate signature','2026-10-20'),
('a0000000-0000-4000-8000-000000000005','f0000000-0000-4000-8000-000000000002','Pascal','Rukundo','pascal.rukundo@example.rw','+250788200005','Referral','interview',4,'Excellent statutory knowledge','2026-11-03'),
('a0000000-0000-4000-8000-000000000006','f0000000-0000-4000-8000-000000000002','Josiane','Mutesi','josiane.mutesi@example.rw','+250788200006','Job board','screening',3,'CPA Part 2 completed','2026-11-06'),
('a0000000-0000-4000-8000-000000000007','f0000000-0000-4000-8000-000000000002','Bernard','Ntaganda','bernard.ntaganda@example.rw','+250788200007','Job board','rejected',2,'Lacks RSSB filing experience','2026-10-30'),
('a0000000-0000-4000-8000-000000000008','f0000000-0000-4000-8000-000000000003','Clarisse','Uwamariya','clarisse.uwamariya@example.rw','+250788200008','Walk-in','applied',0,'Shift availability confirmed','2026-11-10'),
('a0000000-0000-4000-8000-000000000009','f0000000-0000-4000-8000-000000000003','Jean Paul','Nkusi','jp.nkusi@example.rw','+250788200009','Walk-in','screening',3,'Previous line supervision experience','2026-11-09'),
('a0000000-0000-4000-8000-000000000010','f0000000-0000-4000-8000-000000000005','Divine','Mukeshimana','divine.mukeshimana@example.rw','+250788200010','LinkedIn','hired',5,'Accepted offer, onboarding scheduled','2026-09-15');

INSERT INTO public.interviews (candidate_id, scheduled_at, mode, interviewer_id, location, score, feedback, status) VALUES
('a0000000-0000-4000-8000-000000000001', now() + interval '2 days', 'in_person','e0000000-0000-4000-8000-000000000005','HQ Boardroom',NULL,NULL,'scheduled'),
('a0000000-0000-4000-8000-000000000005', now() + interval '1 day', 'video','e0000000-0000-4000-8000-000000000003','Google Meet',NULL,NULL,'scheduled'),
('a0000000-0000-4000-8000-000000000004', now() - interval '6 days', 'in_person','e0000000-0000-4000-8000-000000000005','HQ Boardroom',5,'Excellent architecture reasoning and clear communication','completed'),
('a0000000-0000-4000-8000-000000000002', now() - interval '3 days', 'video','e0000000-0000-4000-8000-000000000011','Google Meet',3,'Solid fundamentals, limited React experience','completed');

-- ============ ONBOARDING ============
INSERT INTO public.onboarding_tasks (employee_id, title, category, due_date, assigned_to, status, completed_at, sort_order) VALUES
('e0000000-0000-4000-8000-000000000024','Sign employment contract','documentation',CURRENT_DATE + 2,'e0000000-0000-4000-8000-000000000004','completed',now() - interval '3 days',1),
('e0000000-0000-4000-8000-000000000024','Submit national ID copy','documentation',CURRENT_DATE + 2,'e0000000-0000-4000-8000-000000000024','completed',now() - interval '2 days',2),
('e0000000-0000-4000-8000-000000000024','Submit academic certificates','documentation',CURRENT_DATE + 4,'e0000000-0000-4000-8000-000000000024','pending',NULL,3),
('e0000000-0000-4000-8000-000000000024','Provide bank account details','payroll',CURRENT_DATE + 4,'e0000000-0000-4000-8000-000000000006','pending',NULL,4),
('e0000000-0000-4000-8000-000000000024','Complete RSSB registration form','compliance',CURRENT_DATE + 6,'e0000000-0000-4000-8000-000000000004','pending',NULL,5),
('e0000000-0000-4000-8000-000000000024','IT equipment allocation','it',CURRENT_DATE + 1,'e0000000-0000-4000-8000-000000000021','completed',now() - interval '1 day',6),
('e0000000-0000-4000-8000-000000000024','HR induction and policy briefing','orientation',CURRENT_DATE + 3,'e0000000-0000-4000-8000-000000000002','pending',NULL,7),
('e0000000-0000-4000-8000-000000000024','Departmental orientation with line manager','orientation',CURRENT_DATE + 5,'e0000000-0000-4000-8000-000000000010','pending',NULL,8);

INSERT INTO public.employee_documents (employee_id, doc_type, file_name, status, verified_by, verified_at, notes) VALUES
('e0000000-0000-4000-8000-000000000024','National ID','national_id_yvonne_umutoni.pdf','verified','e0000000-0000-4000-8000-000000000004',now() - interval '2 days','Clear scan'),
('e0000000-0000-4000-8000-000000000024','Employment Contract','contract_yvonne_umutoni.pdf','verified','e0000000-0000-4000-8000-000000000004',now() - interval '3 days','Signed copy on file'),
('e0000000-0000-4000-8000-000000000024','Academic Certificate','diploma_yvonne_umutoni.pdf','pending',NULL,NULL,'Awaiting submission'),
('e0000000-0000-4000-8000-000000000024','Bank Details','bank_letter_yvonne_umutoni.pdf','pending',NULL,NULL,'Awaiting submission'),
('e0000000-0000-4000-8000-000000000011','National ID','national_id_olivier_mugisha.pdf','verified','e0000000-0000-4000-8000-000000000004',now() - interval '400 days','On file'),
('e0000000-0000-4000-8000-000000000012','Academic Certificate','degree_sandrine_uwera.pdf','verified','e0000000-0000-4000-8000-000000000004',now() - interval '300 days','On file');

-- ============ PERFORMANCE ============
INSERT INTO public.appraisal_cycles (id, name, period_start, period_end, status, description) VALUES
('a1000000-0000-4000-8000-000000000001','FY2026 Mid-Year Review','2026-01-01','2026-06-30','closed','Mid-year performance and goal review for all staff'),
('a1000000-0000-4000-8000-000000000002','FY2026 Annual Review','2026-07-01','2026-12-31','active','Annual appraisal cycle covering goal achievement and competencies'),
('a1000000-0000-4000-8000-000000000003','FY2027 Goal Setting','2027-01-01','2027-12-31','draft','Goal setting cycle for the next financial year');

INSERT INTO public.goals (employee_id, cycle_id, title, description, category, weight, target_value, progress, status, due_date) VALUES
('e0000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000002','Deliver HRIS payroll module','Ship payroll processing with statutory deductions and payslip generation','business',30,'Production release',75,'active','2026-12-15'),
('e0000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000002','Reduce API latency','Bring p95 API response time below 300ms','business',25,'p95 < 300ms',60,'active','2026-12-31'),
('e0000000-0000-4000-8000-000000000011','a1000000-0000-4000-8000-000000000002','Mentor two junior engineers','Structured mentoring with monthly reviews','development',20,'2 mentees',50,'active','2026-12-31'),
('e0000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000002','Complete TypeScript certification','Finish advanced TypeScript programme','development',20,'Certificate',100,'completed','2026-10-30'),
('e0000000-0000-4000-8000-000000000012','a1000000-0000-4000-8000-000000000002','Ship employee self-service portal','Deliver profile, leave and payslip self-service','business',40,'Live for all staff',85,'active','2026-12-20'),
('e0000000-0000-4000-8000-000000000017','a1000000-0000-4000-8000-000000000002','Grow enterprise accounts','Close 12 new enterprise contracts','business',40,'12 contracts',70,'active','2026-12-31'),
('e0000000-0000-4000-8000-000000000017','a1000000-0000-4000-8000-000000000002','Improve client retention','Raise renewal rate to 92%','business',30,'92% renewal',65,'active','2026-12-31'),
('e0000000-0000-4000-8000-000000000015','a1000000-0000-4000-8000-000000000002','Reduce line defects','Cut defect rate below 1.5%','business',35,'< 1.5% defects',80,'active','2026-12-31'),
('e0000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000002','Digitise employee files','Move 100% of active employee files to the HRIS','business',30,'100% digitised',90,'active','2026-11-30'),
('e0000000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000002','Automate statutory filings','Automate RRA and RSSB monthly submissions','business',35,'Fully automated',55,'active','2026-12-31');

INSERT INTO public.appraisals (cycle_id, employee_id, manager_id, self_score, manager_score, final_score, rating, self_comments, manager_comments, status, submitted_at, finalized_at) VALUES
('a1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000011','e0000000-0000-4000-8000-000000000005',4.2,4.0,4.1,'Exceeds expectations','Delivered the attendance module ahead of schedule.','Consistent delivery, strong ownership of production issues.','finalized',now() - interval '120 days',now() - interval '110 days'),
('a1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000012','e0000000-0000-4000-8000-000000000005',4.0,3.8,3.9,'Meets expectations','Shipped the leave workflow and improved test coverage.','Reliable contributor, encouraged to take more design ownership.','finalized',now() - interval '120 days',now() - interval '110 days'),
('a1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000011','e0000000-0000-4000-8000-000000000005',4.3,NULL,NULL,NULL,'Payroll module is 75% complete, latency work in progress.',NULL,'self_submitted',now() - interval '5 days',NULL),
('a1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000012','e0000000-0000-4000-8000-000000000005',4.1,NULL,NULL,NULL,'Self-service portal nearly ready for release.',NULL,'self_submitted',now() - interval '4 days',NULL),
('a1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000017','e0000000-0000-4000-8000-000000000008',3.9,4.0,3.95,'Exceeds expectations','Closed 8 of 12 enterprise targets so far.','Strong pipeline discipline, on track for the annual target.','manager_reviewed',now() - interval '6 days',NULL),
('a1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000015','e0000000-0000-4000-8000-000000000007',3.6,NULL,NULL,NULL,'Defect rate reduced to 1.7%.',NULL,'draft',NULL,NULL),
('a1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000002',4.4,NULL,NULL,NULL,'Employee files 90% digitised.',NULL,'self_submitted',now() - interval '3 days',NULL);

-- ============ DEVELOPMENT ============
INSERT INTO public.trainings (id, title, provider, category, description, start_date, end_date, cost, capacity, mode, status) VALUES
('b1000000-0000-4000-8000-000000000001','Rwandan Labour Law & Compliance','RSSB Training Centre','compliance','Statutory obligations, PAYE, RSSB contributions and disciplinary procedure under Rwandan law.',CURRENT_DATE + 10, CURRENT_DATE + 12, 450000, 25,'in_person','planned'),
('b1000000-0000-4000-8000-000000000002','Advanced TypeScript for Enterprise Apps','Kigali Tech Hub','technical','Type-safe architecture, generics and large-scale React patterns.',CURRENT_DATE - 20, CURRENT_DATE - 15, 600000, 15,'online','completed'),
('b1000000-0000-4000-8000-000000000003','People Leadership Essentials','Corporate Training Rwanda','leadership','Coaching, feedback and performance conversations for new managers.',CURRENT_DATE + 25, CURRENT_DATE + 28, 750000, 12,'in_person','planned'),
('b1000000-0000-4000-8000-000000000004','Occupational Health & Safety','RSSB Training Centre','compliance','Workplace safety standards and incident reporting for production staff.',CURRENT_DATE - 45, CURRENT_DATE - 43, 300000, 30,'in_person','completed'),
('b1000000-0000-4000-8000-000000000005','Financial Reporting under IFRS','Institute of Certified Public Accountants','finance','IFRS updates and statutory reporting for finance teams.',CURRENT_DATE + 40, CURRENT_DATE + 44, 900000, 10,'online','planned'),
('b1000000-0000-4000-8000-000000000006','Customer Service Excellence','Service Academy Rwanda','customer','Service standards, complaint handling and client communication.',CURRENT_DATE - 8, CURRENT_DATE - 7, 250000, 20,'in_person','in_progress');

INSERT INTO public.training_enrollments (training_id, employee_id, status, score, completed_at) VALUES
('b1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000004','enrolled',NULL,NULL),
('b1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000002','enrolled',NULL,NULL),
('b1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000014','enrolled',NULL,NULL),
('b1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000011','completed',92,now() - interval '15 days'),
('b1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000012','completed',88,now() - interval '15 days'),
('b1000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000005','enrolled',NULL,NULL),
('b1000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000008','enrolled',NULL,NULL),
('b1000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000015','completed',85,now() - interval '43 days'),
('b1000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000016','completed',90,now() - interval '43 days'),
('b1000000-0000-4000-8000-000000000006','e0000000-0000-4000-8000-000000000024','in_progress',NULL,NULL),
('b1000000-0000-4000-8000-000000000006','e0000000-0000-4000-8000-000000000010','in_progress',NULL,NULL);

-- ============ PAYROLL ============
INSERT INTO public.payroll_periods (id, name, period_start, period_end, pay_date, status, notes) VALUES
('c1000000-0000-4000-8000-000000000001','September 2026','2026-09-01','2026-09-30','2026-09-28','paid','Closed and paid'),
('c1000000-0000-4000-8000-000000000002','October 2026','2026-10-01','2026-10-31','2026-10-28','approved','Approved by finance manager'),
('c1000000-0000-4000-8000-000000000003','November 2026','2026-11-01','2026-11-30','2026-11-27','draft','Current open period');

-- ============ DISCIPLINARY ============
INSERT INTO public.disciplinary_cases (id, case_no, employee_id, category, incident_date, description, severity, status, outcome, sanction, reported_by, decided_at) VALUES
('d1000000-0000-4000-8000-000000000001','DC-2026-007','e0000000-0000-4000-8000-000000000023','attendance',CURRENT_DATE - 25,'Repeated late arrival without prior notification on three consecutive days.','minor','closed','Substantiated','Written warning issued','e0000000-0000-4000-8000-000000000019',now() - interval '18 days'),
('d1000000-0000-4000-8000-000000000002','DC-2026-008','e0000000-0000-4000-8000-000000000015','safety',CURRENT_DATE - 12,'Failure to wear mandatory protective equipment on the production floor.','moderate','hearing','Pending hearing','','e0000000-0000-4000-8000-000000000007',NULL),
('d1000000-0000-4000-8000-000000000003','DC-2026-009','e0000000-0000-4000-8000-000000000018','misconduct',CURRENT_DATE - 5,'Unauthorised disclosure of campaign pricing to an external party.','serious','investigation','Under investigation','','e0000000-0000-4000-8000-000000000008',NULL);

INSERT INTO public.disciplinary_actions (case_id, action_type, description, action_date, issued_by) VALUES
('d1000000-0000-4000-8000-000000000001','verbal_warning','Verbal counselling recorded with the employee.','2026-10-20','e0000000-0000-4000-8000-000000000019'),
('d1000000-0000-4000-8000-000000000001','written_warning','Formal written warning placed on file for six months.','2026-10-28','e0000000-0000-4000-8000-000000000002'),
('d1000000-0000-4000-8000-000000000002','query_issued','Formal query issued, employee response due within five working days.','2026-11-04','e0000000-0000-4000-8000-000000000007');

-- ============ SUCCESSION ============
INSERT INTO public.succession_plans (id, position_id, title, incumbent_employee_id, criticality, risk_of_loss, notes) VALUES
('e1000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000014','IT Manager succession','e0000000-0000-4000-8000-000000000005','critical','medium','Single point of failure for core platform knowledge'),
('e1000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000005','Finance Manager succession','e0000000-0000-4000-8000-000000000003','critical','low','Strong internal bench identified'),
('e1000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000017','Production Manager succession','e0000000-0000-4000-8000-000000000007','high','high','Retirement expected within three years'),
('e1000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000002','HR Manager succession','e0000000-0000-4000-8000-000000000002','high','low','Two ready-now candidates');

INSERT INTO public.succession_candidates (plan_id, employee_id, readiness, potential, notes) VALUES
('e1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000011','ready_1_2_years','high','Needs exposure to budget ownership'),
('e1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000021','ready_2_3_years','medium','Strong infrastructure depth, limited people leadership'),
('e1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000006','ready_now','high','Already covers statutory reporting end to end'),
('e1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000013','ready_1_2_years','medium','Needs treasury exposure'),
('e1000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000016','ready_1_2_years','high','Quality leadership track record'),
('e1000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000004','ready_now','high','Handles full employee lifecycle'),
('e1000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000014','ready_1_2_years','high','Strong recruitment specialism');

-- ============ EXIT ============
INSERT INTO public.exit_requests (id, employee_id, exit_type, notice_date, last_working_day, reason, status, approved_by, approved_at) VALUES
('f1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000023','resignation',CURRENT_DATE - 10, CURRENT_DATE + 20,'Relocating to another province for family reasons','clearance','e0000000-0000-4000-8000-000000000019',now() - interval '8 days'),
('f1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000018','resignation',CURRENT_DATE - 3, CURRENT_DATE + 27,'Accepted an external offer','submitted',NULL,NULL);

INSERT INTO public.exit_clearances (exit_request_id, department, item, owner_id, status, cleared_at, notes, sort_order) VALUES
('f1000000-0000-4000-8000-000000000001','IT','Return laptop, phone and access badge','e0000000-0000-4000-8000-000000000021','cleared',now() - interval '4 days','All assets returned in working order',1),
('f1000000-0000-4000-8000-000000000001','Finance','Settle outstanding imprest and advances','e0000000-0000-4000-8000-000000000003','cleared',now() - interval '3 days','No outstanding balance',2),
('f1000000-0000-4000-8000-000000000001','HR','Complete exit interview','e0000000-0000-4000-8000-000000000004','pending',NULL,NULL,3),
('f1000000-0000-4000-8000-000000000001','Operations','Handover of vehicle logbook and keys','e0000000-0000-4000-8000-000000000019','pending',NULL,NULL,4),
('f1000000-0000-4000-8000-000000000002','IT','Return laptop and revoke system access','e0000000-0000-4000-8000-000000000021','pending',NULL,NULL,1),
('f1000000-0000-4000-8000-000000000002','Finance','Clear outstanding travel advance','e0000000-0000-4000-8000-000000000003','pending',NULL,NULL,2),
('f1000000-0000-4000-8000-000000000002','HR','Complete exit interview','e0000000-0000-4000-8000-000000000004','pending',NULL,NULL,3);

-- ============ DOCUMENTS ============
INSERT INTO public.documents (title, category, file_name, file_url, file_size, visibility, uploaded_by) VALUES
('Employee Handbook 2026','policy','employee_handbook_2026.pdf',NULL,1843200,'all',NULL),
('Leave and Attendance Policy','policy','leave_attendance_policy.pdf',NULL,524288,'all',NULL),
('Code of Conduct','policy','code_of_conduct.pdf',NULL,412000,'all',NULL),
('Payroll Calendar FY2026','finance','payroll_calendar_fy2026.pdf',NULL,204800,'hr',NULL),
('Performance Management Framework','policy','performance_framework.pdf',NULL,760000,'all',NULL),
('RSSB Contribution Guide','compliance','rssb_contribution_guide.pdf',NULL,340000,'all',NULL),
('Recruitment and Selection Procedure','policy','recruitment_procedure.pdf',NULL,290000,'hr',NULL),
('Disciplinary Procedure','policy','disciplinary_procedure.pdf',NULL,255000,'all',NULL);

-- ============ NOTIFICATIONS (broadcast to all existing profiles) ============
INSERT INTO public.notifications (user_id, title, message, type, link, is_read)
SELECT p.id, 'November payroll open', 'The November 2026 payroll period is open for processing. Finance officers should review attendance exceptions before running payroll.', 'info', '/payroll', false
FROM public.profiles p;
