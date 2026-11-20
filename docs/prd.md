# Requirements Document

## 1. Application Overview

### 1.1 Application Name
AB Rwanda Human Resources Information System (HRIS)

### 1.2 Application Description
An integrated, centralized human resources information management web system designed for AB Rwanda PLC to manage the end-to-end employee lifecycle, encompassing recruitment, onboarding, core employee administration, attendance and leave, performance evaluation, training and development, payroll processing, succession and disciplinary actions, and exit management, while adhering to Rwandan statutory standards and enterprise compliance.

## 2. Users and Core Scenarios

### 2.1 Target Users
- **Employees**: View personal profile, submit leave requests, log attendance, submit performance reviews, view payslips, and access company documents.
- **Managers / Supervisors**: Review and approve leave, track team attendance, conduct performance appraisals, manage development plans, and review team succession recommendations.
- **HR Officers / HR Managers**: Manage job postings, recruitment, candidate onboarding, employee records, disciplinary cases, exit processes, and company-wide policies.
- **Finance Officers**: Manage payroll components, deductions, tax and statutory contributions, approve payroll runs, and generate financial reports.
- **System Administrators**: Manage role-based access control, user accounts, system configuration, audit logs, and data security.

### 2.2 Core Scenarios
- **Talent Acquisition & Onboarding**: HR posts job openings, tracks applicants through screening stages, issues offers, and converts hired candidates directly into onboarding workflows with required document collection.
- **Daily Workforce Operations**: Employees log daily attendance and request time off; managers review and approve requests via structured multi-level workflows.
- **Payroll Execution**: Finance and HR collaborate to calculate earnings, allowances, statutory deductions according to Rwandan regulations, run approvals, and generate payslips and payroll export sheets.
- **Performance & Development**: Managers set goals and KPIs, conduct formal review cycles, and track employee training and succession pipelines.
- **Disciplinary & Exit Lifecycle**: Tracking disciplinary cases, managing resignation/termination workflows, clearance procedures, and final settlement generation.

## 3. Page Structure and Functional Description

### 3.1 Site Map

```
AB Rwanda HRIS
├── Authentication & Profile
│   ├── Login
│   ├── Password Reset
│   └── User Profile
├── Dashboard
│   ├── Executive / Admin Dashboard
│   └── Employee Self-Service Dashboard
├── Recruitment & Onboarding Module
│   ├── Job Openings & Applications
│   ├── Candidate Tracking & Interview Pipeline
│   └── Onboarding Checklist & Document Submission
├── Employee Management Module
│   ├── Employee Directory & Profiles
│   ├── Attendance & Time Tracking
│   └── Leave Management & Approvals
├── Performance & Development Module
│   ├── KPI & Goal Setting
│   ├── Performance Appraisals
│   └── Training & Development Tracking
├── Payroll Module
│   ├── Salary Structures & Statutory Rates
│   ├── Payroll Processing & Calculation
│   ├── Payslips
│   └── Payroll Reports (Excel/PDF)
├── Succession & Disciplinary Module
│   ├── Disciplinary Incident Cases
│   └── Succession Planning Matrix
├── Employee Exit Module
│   ├── Resignation & Termination Requests
│   ├── Offboarding Clearance Checklist
│   └── Final Settlement Calculation
├── Document Management & Notifications
│   ├── Organization Documents Repository
│   └── System Notifications Center
└── Administration & Security
    ├── User & Role Management (RBAC)
    └── System Audit Logs
```

### 3.2 Page Descriptions

#### 3.2.1 Authentication & Profile
- **Login Page**: Secure authentication via email/username and password with role-based redirection.
- **Password Reset**: Self-service secure password recovery process.
- **User Profile Page**: Personal details, assigned role, contact info, and security credentials update.

#### 3.2.2 Dashboard
- **Executive / Admin Dashboard**: Centralized widgets displaying total headcount, recruitment funnel metrics, pending approvals, attendance summaries, upcoming performance reviews, and payroll statuses.
- **Employee Self-Service Dashboard**: Quick actions for clock-in/out, leave balance counters, upcoming tasks, assigned training, and latest payslip overview.

#### 3.2.3 Recruitment & Onboarding Module
- **Job Openings & Applications**: List and creation of internal and external job requisitions, candidate resume submission, and applicant list.
- **Candidate Tracking & Interview Pipeline**: Kanban or list view of recruitment stages (Applied, Screening, Interview, Offered, Rejected) and offer letter issuance.
- **Onboarding Checklist**: Automated task checklist for newly hired employees, mandatory document uploads (identity proof, academic certificates, bank details), and equipment allocation tracking.

#### 3.2.4 Employee Management Module
- **Employee Directory & Profiles**: Comprehensive employee records including employment contracts, job titles, department assignments, emergency contacts, and historical logs.
- **Attendance & Time Tracking**: Daily clock-in/out records, timesheets, shift logging, and monthly attendance summaries.
- **Leave Management & Approvals**: Leave balance calculation (annual, sick, maternity, unpaid), leave request submission, and multi-tier manager approval workflow.

#### 3.2.5 Performance & Development Module
- **KPI & Goal Setting**: Form-based goal creation linked to employees and departments with measurable targets.
- **Performance Appraisals**: Self-evaluation, manager evaluation forms, score calculation, appraisal cycle tracking, and review finalization.
- **Training & Development Tracking**: Training catalog, course enrollment, certification tracking, and skill matrix updates.

#### 3.2.6 Payroll Module
- **Salary Structures & Statutory Rates**: Configuration of base salary, allowances, overtime rates, and statutory contributions (PAYE tax, RSSB pension, maternity fund).
- **Payroll Processing**: Automated monthly payroll computation based on attendance, approved leave, allowances, and statutory deductions.
- **Payslips**: Automated generation and delivery of digital payslips accessible by individual employees.
- **Payroll Reports**: Export of monthly payroll summaries, statutory deduction reports, and bank transfer schedules in Excel and PDF formats.

#### 3.2.7 Succession & Disciplinary Module
- **Disciplinary Incident Cases**: Incident recording, formal query issuance, employee defense submission, disciplinary hearing logs, and outcome tracking.
- **Succession Planning Matrix**: Talent identification, critical role mapping, readiness ratings (ready now, 1-2 years), and successor assignment.

#### 3.2.8 Employee Exit Module
- **Resignation & Termination Requests**: Initiation of exit processes by employee resignation or management termination notice.
- **Offboarding Clearance Checklist**: Multi-department clearance tracking (IT assets, Finance, HR, Departmental handovers).
- **Final Settlement Calculation**: Automated calculation of final pay, untaken leave encashment, severance pay, and certificate of service generation.

#### 3.2.9 Document Management & Notifications
- **Organization Documents Repository**: Centralized storage for company policies, contracts, employee-uploaded verification files, and exit documents.
- **Notification Center**: In-app alerts for pending approvals, appraisal deadlines, document expiration, and payroll publication.

#### 3.2.10 Administration & Security
- **User & Role Management**: Creation of system users and assignment of granular permissions across HR, Manager, Finance, Employee, and Administrator roles.
- **Audit Logs**: Comprehensive logs recording user logins, data modifications, approval actions, and export activities.

## 4. Business Rules and Core Logic

### 4.1 Role-Based Access Control (RBAC)
- Permissions are strictly enforced: Employees can only view their own records; Managers can view and act on direct reports; HR and Finance access respective functional modules; Administrators manage access and platform configuration.

### 4.2 Leave and Attendance Approval Workflows
- Submitting a leave request automatically routes the task to the designated line manager.
- Approved leave deductions immediately update the employee leave balance counter; rejected requests require a mandatory reason.

### 4.3 Statutory Payroll Deductions (Rwandan Compliance)
- Net pay computation must incorporate basic pay, taxable benefits, statutory deductions according to Rwanda tax brackets (PAYE), pension contributions (RSSB), and other mandatory levies before net salary payout.
- Finalized payroll batches are locked to prevent retroactive alterations without administrative unfreeze and audit justification.

### 4.4 End-to-End Lifecycle State Transitions
- Candidate (Hired) -> Employee Onboarding -> Active Employee -> Exiting / Clearance -> Inactive / Offboarded.
- Offboarded employees retain historical records in the system with immediate revocation of active login privileges.

## 5. Exceptions and Boundary Cases

| Scenario | Condition | System Action |
| :--- | :--- | :--- |
| **Insufficient Leave Balance** | Employee requests more leave days than available in category balance | Prevent submission, display balance error alert |
| **Overlapping Leave Requests** | Employee submits leave for dates already covered by an existing pending or approved request | Prevent form submission with conflict notification |
| **Unapproved Payroll Finalization** | Finance officer attempts to finalize a payroll batch with unreviewed exceptions | Block batch completion until all flagged items are resolved or overridden |
| **Incomplete Exit Clearance** | HR attempts final exit settlement closure while department clearances remain open | Display pending clearance warning, require explicit confirmation or resolution |
| **Unauthorized Data Access** | User attempts direct URL or API access to restricted employee or salary records | Block access and return unauthorized error; write event to audit log |

## 6. Acceptance Criteria

1. **User Authentication & Authorization**: Users can log in with their credentials and access only the features and data corresponding to their assigned roles (HR, Manager, Finance, Employee, Admin).
2. **Recruitment & Onboarding Lifecycle**: HR can create job requisitions, advance candidates through interview stages, mark them as hired, and automatically initiate an onboarding workflow with document uploads.
3. **Attendance & Leave Management**: Employees can log daily time, view remaining leave balances, and submit leave requests which successfully trigger manager approval workflows and update balances upon approval.
4. **Performance Reviews**: Managers and employees can complete appraisal forms during active review cycles and calculate final appraisal ratings.
5. **Payroll Processing & Exports**: Finance officers can run payroll with automated statutory deductions, generate individual payslips, and export consolidated payroll reports in Excel and PDF formats.
6. **Disciplinary & Exit Clearance**: HR can log disciplinary cases, initiate termination/resignation workflows, track multi-department clearance items, and calculate final settlement amounts.
7. **Audit Logs & Security**: All administrative actions, payroll approvals, and data edits are permanently logged in the audit trail viewable by Administrators.

## 7. Out of Scope for Current Phase

- Public job board / external career portal hosting.
- Integration with biometric hardware devices for attendance tracking.
- Automated AI-based CV parsing and resume scoring.
- Direct bank payment gateway API execution (payments handled via generated export schedules).