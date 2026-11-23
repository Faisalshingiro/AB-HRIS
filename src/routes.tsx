import type { ReactNode } from 'react';
import type { UserRole } from '@/types/types';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import RecruitmentPage from './pages/RecruitmentPage';
import OnboardingPage from './pages/OnboardingPage';
import AttendancePage from './pages/AttendancePage';
import LeavePage from './pages/LeavePage';
import PerformancePage from './pages/PerformancePage';
import DevelopmentPage from './pages/DevelopmentPage';
import SuccessionPage from './pages/SuccessionPage';
import PayrollPage from './pages/PayrollPage';
import DisciplinaryPage from './pages/DisciplinaryPage';
import ExitPage from './pages/ExitPage';
import DocumentsPage from './pages/DocumentsPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import AdminUsersPage from './pages/AdminUsersPage';
import AuditLogsPage from './pages/AuditLogsPage';
import NotFoundPage from './pages/NotFoundPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  roles?: UserRole[];
  /** Accessible without login. Routes without this flag require authentication. */
  public?: boolean;
}

const allRoles: UserRole[] = ['admin', 'hr', 'manager', 'finance', 'employee'];
const peopleRoles: UserRole[] = ['admin', 'hr', 'manager'];
const hrRoles: UserRole[] = ['admin', 'hr'];
const teamRoles: UserRole[] = ['admin', 'hr', 'manager'];
const performanceRoles: UserRole[] = ['admin', 'hr', 'manager', 'employee'];
const exitRoles: UserRole[] = ['admin', 'hr', 'finance', 'employee'];
const auditRoles: UserRole[] = ['admin', 'hr'];

export const routes: RouteConfig[] = [
  { name: 'Login', path: '/login', element: <LoginPage />, public: true },
  { name: 'Page Not Found', path: '/404', element: <NotFoundPage />, public: true },
  { name: 'Dashboard', path: '/', element: <DashboardPage />, roles: allRoles },
  { name: 'Employees', path: '/employees', element: <EmployeesPage />, roles: peopleRoles },
  { name: 'Employee Detail', path: '/employees/:id', element: <EmployeeDetailPage />, roles: allRoles },
  { name: 'Recruitment', path: '/recruitment', element: <RecruitmentPage />, roles: hrRoles },
  { name: 'Onboarding', path: '/onboarding', element: <OnboardingPage />, roles: hrRoles },
  { name: 'Attendance', path: '/attendance', element: <AttendancePage />, roles: allRoles },
  { name: 'Leave', path: '/leave', element: <LeavePage />, roles: allRoles },
  { name: 'Performance', path: '/performance', element: <PerformancePage />, roles: performanceRoles },
  { name: 'Development', path: '/development', element: <DevelopmentPage />, roles: teamRoles },
  { name: 'Succession', path: '/succession', element: <SuccessionPage />, roles: hrRoles },
  { name: 'Payroll', path: '/payroll', element: <PayrollPage />, roles: allRoles },
  { name: 'Disciplinary', path: '/disciplinary', element: <DisciplinaryPage />, roles: hrRoles },
  { name: 'Employee Exit', path: '/exit', element: <ExitPage />, roles: exitRoles },
  { name: 'Documents', path: '/documents', element: <DocumentsPage />, roles: allRoles },
  { name: 'Notifications', path: '/notifications', element: <NotificationsPage />, roles: allRoles },
  { name: 'My Profile', path: '/profile', element: <ProfilePage />, roles: allRoles },
  { name: 'Users & Roles', path: '/admin/users', element: <AdminUsersPage />, roles: ['admin'] },
  { name: 'Audit Logs', path: '/admin/audit-logs', element: <AuditLogsPage />, roles: auditRoles },
];
