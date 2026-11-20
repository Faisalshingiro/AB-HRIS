import type { ReactNode } from 'react';
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

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: 'Login', path: '/login', element: <LoginPage />, public: true },
  { name: 'Dashboard', path: '/', element: <DashboardPage /> },
  { name: 'Employees', path: '/employees', element: <EmployeesPage /> },
  { name: 'Employee Detail', path: '/employees/:id', element: <EmployeeDetailPage /> },
  { name: 'Recruitment', path: '/recruitment', element: <RecruitmentPage /> },
  { name: 'Onboarding', path: '/onboarding', element: <OnboardingPage /> },
  { name: 'Attendance', path: '/attendance', element: <AttendancePage /> },
  { name: 'Leave', path: '/leave', element: <LeavePage /> },
  { name: 'Performance', path: '/performance', element: <PerformancePage /> },
  { name: 'Development', path: '/development', element: <DevelopmentPage /> },
  { name: 'Succession', path: '/succession', element: <SuccessionPage /> },
  { name: 'Payroll', path: '/payroll', element: <PayrollPage /> },
  { name: 'Disciplinary', path: '/disciplinary', element: <DisciplinaryPage /> },
  { name: 'Employee Exit', path: '/exit', element: <ExitPage /> },
  { name: 'Documents', path: '/documents', element: <DocumentsPage /> },
  { name: 'Notifications', path: '/notifications', element: <NotificationsPage /> },
  { name: 'My Profile', path: '/profile', element: <ProfilePage /> },
  { name: 'Users & Roles', path: '/admin/users', element: <AdminUsersPage /> },
  { name: 'Audit Logs', path: '/admin/audit-logs', element: <AuditLogsPage /> },
];
