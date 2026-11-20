import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Briefcase,
  Clock,
  CalendarDays,
  Target,
  GraduationCap,
  TrendingUp,
  Banknote,
  AlertTriangle,
  LogOut,
  FolderOpen,
  Shield,
  FileText,
} from 'lucide-react';
import type { UserRole } from '@/types/types';

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  roles: UserRole[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const roleLabels: Record<UserRole, string> = {
  admin: 'Administrator',
  hr: 'HR Officer',
  manager: 'Line Manager',
  finance: 'Finance Officer',
  employee: 'Employee',
};

const allRoles: UserRole[] = ['admin', 'hr', 'manager', 'finance', 'employee'];
const staffAndAdmin: UserRole[] = ['admin', 'hr', 'manager'];
const hrAndAdmin: UserRole[] = ['admin', 'hr'];
const financeAndAdmin: UserRole[] = ['admin', 'finance', 'hr'];

export const navGroups: NavGroup[] = [
  {
    label: 'OVERVIEW',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: allRoles },
    ],
  },
  {
    label: 'PEOPLE',
    items: [
      { label: 'Employees', path: '/employees', icon: Users, roles: allRoles },
      { label: 'Onboarding', path: '/onboarding', icon: UserCheck, roles: allRoles },
      { label: 'Attendance', path: '/attendance', icon: Clock, roles: allRoles },
      { label: 'Leave', path: '/leave', icon: CalendarDays, roles: allRoles },
    ],
  },
  {
    label: 'TALENT',
    items: [
      { label: 'Recruitment', path: '/recruitment', icon: Briefcase, roles: allRoles },
      { label: 'Performance', path: '/performance', icon: Target, roles: allRoles },
      { label: 'Development', path: '/development', icon: GraduationCap, roles: allRoles },
      { label: 'Succession', path: '/succession', icon: TrendingUp, roles: staffAndAdmin },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { label: 'Payroll', path: '/payroll', icon: Banknote, roles: financeAndAdmin },
      { label: 'Disciplinary', path: '/disciplinary', icon: AlertTriangle, roles: hrAndAdmin },
      { label: 'Employee Exit', path: '/exit', icon: LogOut, roles: staffAndAdmin },
      { label: 'Documents', path: '/documents', icon: FolderOpen, roles: allRoles },
    ],
  },
  {
    label: 'ADMINISTRATION',
    items: [
      { label: 'Users & Roles', path: '/admin/users', icon: Shield, roles: ['admin'] },
      { label: 'Audit Logs', path: '/admin/audit-logs', icon: FileText, roles: ['admin'] },
    ],
  },
];
