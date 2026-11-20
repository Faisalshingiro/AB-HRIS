-- ============ DEPARTMENTS ============
INSERT INTO public.departments (id, name, code, description, cost_center) VALUES
('d0000000-0000-4000-8000-000000000001','Executive Office','EXEC','Corporate leadership and strategy','CC-100'),
('d0000000-0000-4000-8000-000000000002','Human Resources','HR','People operations, recruitment and payroll administration','CC-200'),
('d0000000-0000-4000-8000-000000000003','Finance','FIN','Accounting, treasury and statutory reporting','CC-300'),
('d0000000-0000-4000-8000-000000000004','Operations','OPS','Logistics, facilities and field operations','CC-400'),
('d0000000-0000-4000-8000-000000000005','Sales & Marketing','SAL','Revenue generation and brand management','CC-500'),
('d0000000-0000-4000-8000-000000000006','Information Technology','IT','Systems, infrastructure and digital products','CC-600'),
('d0000000-0000-4000-8000-000000000007','Production','PRD','Manufacturing and quality assurance','CC-700'),
('d0000000-0000-4000-8000-000000000008','Legal & Compliance','LEG','Contracts, regulatory affairs and risk','CC-800'),
('d0000000-0000-4000-8000-000000000009','Customer Service','CS','Client support and service delivery','CC-900');

-- ============ POSITIONS ============
INSERT INTO public.positions (id, title, department_id, grade, min_salary, max_salary, description) VALUES
('b0000000-0000-4000-8000-000000000001','Managing Director','d0000000-0000-4000-8000-000000000001','E1',2000000,3500000,'Overall accountability for company performance'),
('b0000000-0000-4000-8000-000000000002','HR Manager','d0000000-0000-4000-8000-000000000002','M1',900000,1400000,'Leads the human resources function'),
('b0000000-0000-4000-8000-000000000003','HR Officer','d0000000-0000-4000-8000-000000000002','O2',450000,700000,'Employee records, onboarding and leave administration'),
('b0000000-0000-4000-8000-000000000004','Recruitment Officer','d0000000-0000-4000-8000-000000000002','O2',450000,700000,'Talent acquisition and candidate management'),
('b0000000-0000-4000-8000-000000000005','Finance Manager','d0000000-0000-4000-8000-000000000003','M1',900000,1400000,'Financial control and statutory compliance'),
('b0000000-0000-4000-8000-000000000006','Payroll Officer','d0000000-0000-4000-8000-000000000003','O2',500000,750000,'Payroll processing and statutory deductions'),
('b0000000-0000-4000-8000-000000000007','Accountant','d0000000-0000-4000-8000-000000000003','O2',450000,700000,'General ledger and reconciliations'),
('b0000000-0000-4000-8000-000000000008','Operations Manager','d0000000-0000-4000-8000-000000000004','M1',850000,1300000,'Facilities and logistics management'),
('b0000000-0000-4000-8000-000000000009','Logistics Officer','d0000000-0000-4000-8000-000000000004','O1',350000,550000,'Fleet and supply chain coordination'),
('b0000000-0000-4000-8000-000000000010','Administrative Assistant','d0000000-0000-4000-8000-000000000004','O1',300000,480000,'Office administration support'),
('b0000000-0000-4000-8000-000000000011','Sales Manager','d0000000-0000-4000-8000-000000000005','M1',850000,1300000,'Revenue targets and key accounts'),
('b0000000-0000-4000-8000-000000000012','Sales Executive','d0000000-0000-4000-8000-000000000005','O2',400000,650000,'Field sales and client acquisition'),
('b0000000-0000-4000-8000-000000000013','Marketing Officer','d0000000-0000-4000-8000-000000000005','O2',400000,650000,'Brand campaigns and communications'),
('b0000000-0000-4000-8000-000000000014','IT Manager','d0000000-0000-4000-8000-000000000006','M1',950000,1450000,'Technology strategy and systems'),
('b0000000-0000-4000-8000-000000000015','Software Engineer','d0000000-0000-4000-8000-000000000006','O3',700000,1100000,'Application development'),
('b0000000-0000-4000-8000-000000000016','Network Administrator','d0000000-0000-4000-8000-000000000006','O2',550000,850000,'Infrastructure and network security'),
('b0000000-0000-4000-8000-000000000017','Production Manager','d0000000-0000-4000-8000-000000000007','M1',850000,1300000,'Plant operations and output'),
('b0000000-0000-4000-8000-000000000018','Machine Operator','d0000000-0000-4000-8000-000000000007','W1',220000,340000,'Production line operation'),
('b0000000-0000-4000-8000-000000000019','Quality Controller','d0000000-0000-4000-8000-000000000007','O1',320000,500000,'Quality assurance and inspection'),
('b0000000-0000-4000-8000-000000000020','Legal Counsel','d0000000-0000-4000-8000-000000000008','M1',900000,1400000,'Legal advisory and contracts'),
('b0000000-0000-4000-8000-000000000021','Compliance Officer','d0000000-0000-4000-8000-000000000008','O2',500000,800000,'Regulatory compliance monitoring'),
('b0000000-0000-4000-8000-000000000022','Customer Service Lead','d0000000-0000-4000-8000-000000000009','O2',450000,700000,'Service desk supervision'),
('b0000000-0000-4000-8000-000000000023','Customer Support Agent','d0000000-0000-4000-8000-000000000009','O1',280000,450000,'Client ticket resolution'),
('b0000000-0000-4000-8000-000000000024','Driver','d0000000-0000-4000-8000-000000000004','W1',200000,320000,'Transport and delivery');

-- ============ EMPLOYEES ============
INSERT INTO public.employees (id, employee_no, first_name, last_name, email, phone, gender, date_of_birth, national_id, address, district, department_id, position_id, manager_id, employment_type, hire_date, status, base_salary, housing_allowance, transport_allowance, other_allowance, bank_name, bank_account, nid_number, rssb_number, emergency_contact_name, emergency_contact_phone) VALUES
('e0000000-0000-4000-8000-000000000001','ABR-0001','Jean Bosco','Habimana','jb.habimana@abrwanda.rw','+250788100001','male','1978-03-14','1197870012345678','KG 11 Ave, Kacyiru','Gasabo','d0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001',NULL,'permanent','2012-01-09','active',2500000,400000,150000,200000,'Bank of Kigali','000123456789','1197870012345678','RSSB-100001','Marie Habimana','+250788100101'),
('e0000000-0000-4000-8000-000000000002','ABR-0002','Alice','Uwimana','alice.uwimana@abrwanda.rw','+250788100002','female','1985-07-22','1198570023456789','KG 45 St, Remera','Gasabo','d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001','permanent','2015-04-01','active',1150000,180000,80000,60000,'Bank of Kigali','000123456790','1198570023456789','RSSB-100002','Peter Uwimana','+250788100102'),
('e0000000-0000-4000-8000-000000000003','ABR-0003','Eric','Nshimiyimana','eric.nshimiyimana@abrwanda.rw','+250788100003','male','1983-11-05','1198370034567890','KG 7 Ave, Nyarutarama','Gasabo','d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000005','e0000000-0000-4000-8000-000000000001','permanent','2014-06-16','active',1200000,180000,80000,60000,'I&M Bank','000223456789','1198370034567890','RSSB-100003','Josiane Nshimiyimana','+250788100103'),
('e0000000-0000-4000-8000-000000000004','ABR-0004','Claudine','Mukamana','claudine.mukamana@abrwanda.rw','+250788100004','female','1990-02-18','1199070045678901','KG 22 St, Kimironko','Gasabo','d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000002','permanent','2018-09-03','active',620000,100000,50000,30000,'Bank of Kigali','000123456791','1199070045678901','RSSB-100004','Emmanuel Mukamana','+250788100104'),
('e0000000-0000-4000-8000-000000000005','ABR-0005','Patrick','Rwigema','patrick.rwigema@abrwanda.rw','+250788100005','male','1986-05-30','1198670056789012','KG 3 Ave, Kicukiro','Kicukiro','d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000014','e0000000-0000-4000-8000-000000000001','permanent','2016-02-15','active',1250000,180000,80000,60000,'Ecobank','000323456789','1198670056789012','RSSB-100005','Diane Rwigema','+250788100105'),
('e0000000-0000-4000-8000-000000000006','ABR-0006','Diane','Ingabire','diane.ingabire@abrwanda.rw','+250788100006','female','1992-08-11','1199270067890123','KG 18 St, Gisozi','Gasabo','d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000006','e0000000-0000-4000-8000-000000000003','permanent','2019-03-11','active',680000,100000,50000,30000,'Bank of Kigali','000123456792','1199270067890123','RSSB-100006','Fabrice Ingabire','+250788100106'),
('e0000000-0000-4000-8000-000000000007','ABR-0007','Samuel','Nkurunziza','samuel.nkurunziza@abrwanda.rw','+250788100007','male','1981-12-02','1198170078901234','KG 9 Ave, Nyamirambo','Nyarugenge','d0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000017','e0000000-0000-4000-8000-000000000001','permanent','2013-07-22','active',1100000,180000,80000,60000,'Bank of Kigali','000123456793','1198170078901234','RSSB-100007','Grace Nkurunziza','+250788100107'),
('e0000000-0000-4000-8000-000000000008','ABR-0008','Grace','Uwase','grace.uwase@abrwanda.rw','+250788100008','female','1988-04-25','1198870089012345','KG 30 St, Kibagabaga','Gasabo','d0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000011','e0000000-0000-4000-8000-000000000001','permanent','2017-01-30','active',1050000,180000,80000,60000,'I&M Bank','000223456790','1198870089012345','RSSB-100008','Olivier Uwase','+250788100108'),
('e0000000-0000-4000-8000-000000000009','ABR-0009','Emmanuel','Bizimana','emmanuel.bizimana@abrwanda.rw','+250788100009','male','1984-09-17','1198470090123456','KG 14 Ave, Kacyiru','Gasabo','d0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000020','e0000000-0000-4000-8000-000000000001','permanent','2015-11-09','active',1150000,180000,80000,60000,'Bank of Kigali','000123456794','1198470090123456','RSSB-100009','Chantal Bizimana','+250788100109'),
('e0000000-0000-4000-8000-000000000010','ABR-0010','Josiane','Nyirahabimana','josiane.nyirahabimana@abrwanda.rw','+250788100010','female','1991-06-08','1199170101234567','KG 5 St, Nyabugogo','Nyarugenge','d0000000-0000-4000-8000-000000000009','b0000000-0000-4000-8000-000000000022','e0000000-0000-4000-8000-000000000001','permanent','2018-05-21','active',640000,100000,50000,30000,'Bank of Kigali','000123456795','1199170101234567','RSSB-100010','Aimable Nyirahabimana','+250788100110'),
('e0000000-0000-4000-8000-000000000011','ABR-0011','Olivier','Mugisha','olivier.mugisha@abrwanda.rw','+250788100011','male','1993-01-19','1199370112345678','KG 27 St, Kicukiro','Kicukiro','d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000015','e0000000-0000-4000-8000-000000000005','permanent','2020-02-03','active',880000,120000,60000,40000,'Ecobank','000323456790','1199370112345678','RSSB-100011','Sandrine Mugisha','+250788100111'),
('e0000000-0000-4000-8000-000000000012','ABR-0012','Sandrine','Uwera','sandrine.uwera@abrwanda.rw','+250788100012','female','1995-10-27','1199570123456789','KG 41 St, Kanombe','Kicukiro','d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000015','e0000000-0000-4000-8000-000000000005','permanent','2021-08-16','active',820000,120000,60000,40000,'Bank of Kigali','000123456796','1199570123456789','RSSB-100012','Gilbert Uwera','+250788100112'),
('e0000000-0000-4000-8000-000000000013','ABR-0013','Fabrice','Hakizimana','fabrice.hakizimana@abrwanda.rw','+250788100013','male','1994-03-06','1199470134567890','KG 12 Ave, Remera','Gasabo','d0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000007','e0000000-0000-4000-8000-000000000003','permanent','2020-10-05','active',600000,100000,50000,30000,'I&M Bank','000223456791','1199470134567890','RSSB-100013','Vestine Hakizimana','+250788100113'),
('e0000000-0000-4000-8000-000000000014','ABR-0014','Chantal','Mukandayisenga','chantal.mukandayisenga@abrwanda.rw','+250788100014','female','1989-12-14','1198970145678901','KG 8 St, Gikondo','Kicukiro','d0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000004','e0000000-0000-4000-8000-000000000002','permanent','2019-07-15','active',580000,100000,50000,30000,'Bank of Kigali','000123456797','1198970145678901','RSSB-100014','Innocent Mukandayisenga','+250788100114'),
('e0000000-0000-4000-8000-000000000015','ABR-0015','Innocent','Ndayisaba','innocent.ndayisaba@abrwanda.rw','+250788100015','male','1996-05-23','1199670156789012','KG 33 St, Masaka','Kicukiro','d0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000018','e0000000-0000-4000-8000-000000000007','permanent','2022-01-10','active',300000,60000,30000,20000,'Bank of Kigali','000123456798','1199670156789012','RSSB-100015','Beata Ndayisaba','+250788100115'),
('e0000000-0000-4000-8000-000000000016','ABR-0016','Vestine','Uwamahoro','vestine.uwamahoro@abrwanda.rw','+250788100016','female','1992-07-31','1199270167890123','KG 19 St, Niboye','Kicukiro','d0000000-0000-4000-8000-000000000007','b0000000-0000-4000-8000-000000000019','e0000000-0000-4000-8000-000000000007','permanent','2020-04-20','active',420000,80000,40000,25000,'Bank of Kigali','000123456799','1199270167890123','RSSB-100016','Théophile Uwamahoro','+250788100116'),
('e0000000-0000-4000-8000-000000000017','ABR-0017','Aimable','Nsengimana','aimable.nsengimana@abrwanda.rw','+250788100017','male','1991-09-09','1199170178901234','KG 24 Ave, Kimihurura','Gasabo','d0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000012','e0000000-0000-4000-8000-000000000008','permanent','2019-11-25','active',520000,90000,45000,30000,'I&M Bank','000223456792','1199170178901234','RSSB-100017','Solange Nsengimana','+250788100117'),
('e0000000-0000-4000-8000-000000000018','ABR-0018','Solange','Iradukunda','solange.iradukunda@abrwanda.rw','+250788100018','female','1997-02-12','1199770189012345','KG 16 St, Kibagabaga','Gasabo','d0000000-0000-4000-8000-000000000005','b0000000-0000-4000-8000-000000000013','e0000000-0000-4000-8000-000000000008','permanent','2022-06-13','active',480000,90000,45000,30000,'Bank of Kigali','000123456800','1199770189012345','RSSB-100018','Damascène Iradukunda','+250788100118'),
('e0000000-0000-4000-8000-000000000019','ABR-0019','Théophile','Munyaneza','theophile.munyaneza@abrwanda.rw','+250788100019','male','1987-11-28','1198770190123456','KG 6 Ave, Nyamirambo','Nyarugenge','d0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000009','e0000000-0000-4000-8000-000000000001','permanent','2018-03-05','active',480000,90000,45000,30000,'Bank of Kigali','000123456801','1198770190123456','RSSB-100019','Immaculée Munyaneza','+250788100119'),
('e0000000-0000-4000-8000-000000000020','ABR-0020','Beata','Nyiransabimana','beata.nyiransabimana@abrwanda.rw','+250788100020','female','1998-04-04','1199870201234567','KG 21 St, Gisozi','Gasabo','d0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000010','e0000000-0000-4000-8000-000000000019','permanent','2023-02-06','active',340000,70000,35000,20000,'Bank of Kigali','000123456802','1199870201234567','RSSB-100020','Gilbert Nyiransabimana','+250788100120'),
('e0000000-0000-4000-8000-000000000021','ABR-0021','Gilbert','Twagirayezu','gilbert.twagirayezu@abrwanda.rw','+250788100021','male','1990-08-16','1199070212345678','KG 13 Ave, Kicukiro','Kicukiro','d0000000-0000-4000-8000-000000000006','b0000000-0000-4000-8000-000000000016','e0000000-0000-4000-8000-000000000005','permanent','2019-05-27','active',700000,110000,55000,35000,'Ecobank','000323456791','1199070212345678','RSSB-100021','Yvonne Twagirayezu','+250788100121'),
('e0000000-0000-4000-8000-000000000022','ABR-0022','Immaculée','Mukarugwiza','immaculee.mukarugwiza@abrwanda.rw','+250788100022','female','1993-06-21','1199370223456789','KG 28 St, Kacyiru','Gasabo','d0000000-0000-4000-8000-000000000008','b0000000-0000-4000-8000-000000000021','e0000000-0000-4000-8000-000000000009','permanent','2021-01-18','active',620000,100000,50000,30000,'Bank of Kigali','000123456803','1199370223456789','RSSB-100022','Patrick Mukarugwiza','+250788100122'),
('e0000000-0000-4000-8000-000000000023','ABR-0023','Damascène','Nizeyimana','damascene.nizeyimana@abrwanda.rw','+250788100023','male','1985-01-07','1198570234567890','KG 2 St, Nyabugogo','Nyarugenge','d0000000-0000-4000-8000-000000000004','b0000000-0000-4000-8000-000000000024','e0000000-0000-4000-8000-000000000019','fixed_term','2021-09-06','active',280000,60000,30000,20000,'Bank of Kigali','000123456804','1198570234567890','RSSB-100023','Josiane Nizeyimana','+250788100123'),
('e0000000-0000-4000-8000-000000000024','ABR-0024','Yvonne','Umutoni','yvonne.umutoni@abrwanda.rw','+250788100024','female','1999-03-29','1199970245678901','KG 37 St, Kanombe','Kicukiro','d0000000-0000-4000-8000-000000000009','b0000000-0000-4000-8000-000000000023','e0000000-0000-4000-8000-000000000010','probation','2026-09-01','probation',320000,60000,30000,20000,'Bank of Kigali','000123456805','1199970245678901','RSSB-100024','Alice Umutoni','+250788100124');

UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000002' WHERE id = 'd0000000-0000-4000-8000-000000000002';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000003' WHERE id = 'd0000000-0000-4000-8000-000000000003';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000005' WHERE id = 'd0000000-0000-4000-8000-000000000006';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000007' WHERE id = 'd0000000-0000-4000-8000-000000000007';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000008' WHERE id = 'd0000000-0000-4000-8000-000000000005';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000009' WHERE id = 'd0000000-0000-4000-8000-000000000008';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000010' WHERE id = 'd0000000-0000-4000-8000-000000000009';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000019' WHERE id = 'd0000000-0000-4000-8000-000000000004';
UPDATE public.departments SET head_employee_id = 'e0000000-0000-4000-8000-000000000001' WHERE id = 'd0000000-0000-4000-8000-000000000001';

-- ============ LEAVE TYPES ============
INSERT INTO public.leave_types (id, name, code, days_per_year, is_paid, requires_document, description) VALUES
('c0000000-0000-4000-8000-000000000001','Annual Leave','ANNUAL',18,true,false,'Statutory annual leave entitlement under Rwandan labour law'),
('c0000000-0000-4000-8000-000000000002','Sick Leave','SICK',15,true,true,'Medical leave, certificate required for absences over two days'),
('c0000000-0000-4000-8000-000000000003','Maternity Leave','MATERNITY',90,true,true,'Maternity leave per Rwandan labour regulations'),
('c0000000-0000-4000-8000-000000000004','Paternity Leave','PATERNITY',4,true,false,'Paternity leave entitlement'),
('c0000000-0000-4000-8000-000000000005','Compassionate Leave','COMPASSION',5,true,false,'Bereavement and family emergencies'),
('c0000000-0000-4000-8000-000000000006','Unpaid Leave','UNPAID',30,false,false,'Leave without pay subject to management approval');

-- ============ LEAVE BALANCES ============
INSERT INTO public.leave_balances (employee_id, leave_type_id, year, entitled_days, used_days, carried_over)
SELECT e.id, lt.id, 2026, lt.days_per_year,
  CASE WHEN lt.code = 'ANNUAL' THEN (abs(hashtext(e.employee_no || lt.code)) % 8) ELSE 0 END,
  CASE WHEN lt.code = 'ANNUAL' THEN 2 ELSE 0 END
FROM public.employees e CROSS JOIN public.leave_types lt;

-- ============ ATTENDANCE (last 30 days, weekdays) ============
INSERT INTO public.attendance (employee_id, work_date, clock_in, clock_out, status, hours_worked)
SELECT e.id, d::date,
  (d::date + time '08:00') + ((abs(hashtext(e.employee_no || d::text)) % 25) || ' minutes')::interval,
  (d::date + time '17:00') + ((abs(hashtext(e.employee_no || d::text)) % 40) || ' minutes')::interval,
  CASE WHEN abs(hashtext(e.employee_no || d::text)) % 23 = 0 THEN 'absent'::public.attendance_status
       WHEN abs(hashtext(e.employee_no || d::text)) % 17 = 0 THEN 'remote'::public.attendance_status
       WHEN abs(hashtext(e.employee_no || d::text)) % 11 = 0 THEN 'late'::public.attendance_status
       ELSE 'present'::public.attendance_status END,
  8.5
FROM public.employees e
CROSS JOIN generate_series(CURRENT_DATE - 30, CURRENT_DATE - 1, interval '1 day') d
WHERE extract(isodow from d) < 6 AND e.status <> 'exited';

-- ============ LEAVE REQUESTS ============
INSERT INTO public.leave_requests (employee_id, leave_type_id, start_date, end_date, days, reason, status, approver_id, decided_at, decision_note) VALUES
('e0000000-0000-4000-8000-000000000011','c0000000-0000-4000-8000-000000000001',CURRENT_DATE + 7, CURRENT_DATE + 11, 5,'Family visit upcountry','pending',NULL,NULL,NULL),
('e0000000-0000-4000-8000-000000000012','c0000000-0000-4000-8000-000000000002',CURRENT_DATE - 3, CURRENT_DATE - 2, 2,'Medical appointment with certificate attached','approved','e0000000-0000-4000-8000-000000000005',now() - interval '4 days','Approved, certificate verified'),
('e0000000-0000-4000-8000-000000000015','c0000000-0000-4000-8000-000000000001',CURRENT_DATE + 14, CURRENT_DATE + 20, 7,'Annual leave','pending',NULL,NULL,NULL),
('e0000000-0000-4000-8000-000000000017','c0000000-0000-4000-8000-000000000005',CURRENT_DATE - 10, CURRENT_DATE - 8, 3,'Bereavement in the family','approved','e0000000-0000-4000-8000-000000000008',now() - interval '11 days','Condolences, approved'),
('e0000000-0000-4000-8000-000000000018','c0000000-0000-4000-8000-000000000001',CURRENT_DATE + 3, CURRENT_DATE + 5, 3,'Personal matters','rejected','e0000000-0000-4000-8000-000000000008',now() - interval '2 days','Conflicts with product launch week'),
('e0000000-0000-4000-8000-000000000020','c0000000-0000-4000-8000-000000000002',CURRENT_DATE - 1, CURRENT_DATE, 2,'Flu symptoms','pending',NULL,NULL,NULL),
('e0000000-0000-4000-8000-000000000021','c0000000-0000-4000-8000-000000000001',CURRENT_DATE + 21, CURRENT_DATE + 25, 5,'Planned vacation','pending',NULL,NULL,NULL),
('e0000000-0000-4000-8000-000000000013','c0000000-0000-4000-8000-000000000004',CURRENT_DATE - 20, CURRENT_DATE - 17, 4,'Paternity leave','approved','e0000000-0000-4000-8000-000000000003',now() - interval '21 days','Congratulations, approved');
