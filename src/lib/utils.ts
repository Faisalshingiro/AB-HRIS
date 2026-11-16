import { supabase } from '@/lib/supabase';

export function formatCurrency(amount: number | null | undefined, currency = 'RWF'): string {
  if (amount === null || amount === undefined) return '—';
  const formatter = new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency: currency === 'RWF' ? 'RWF' : currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function fullName(emp: { first_name: string; last_name: string; middle_name?: string | null }): string {
  return [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ');
}

export function getMonthName(month: number): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1] ?? '';
}

export function getStatusBadgeClass(status: string): string {
  const statusMap: Record<string, string> = {
    active: 'badge-success',
    open: 'badge-info',
    approved: 'badge-success',
    completed: 'badge-success',
    paid: 'badge-success',
    hired: 'badge-success',
    verified: 'badge-success',
    finalized: 'badge-success',
    acknowledged: 'badge-success',
    present: 'badge-success',
    remote: 'badge-info',
    pending: 'badge-warning',
    draft: 'badge-neutral',
    submitted: 'badge-info',
    reviewing: 'badge-warning',
    shortlisted: 'badge-info',
    interviewed: 'badge-info',
    offered: 'badge-info',
    late: 'badge-warning',
    half_day: 'badge-warning',
    on_leave: 'badge-warning',
    in_progress: 'badge-info',
    ongoing: 'badge-info',
    processing: 'badge-warning',
    enrolled: 'badge-info',
    planned: 'badge-neutral',
    probation: 'badge-warning',
    contract: 'badge-info',
    intern: 'badge-neutral',
    permanent: 'badge-success',
    rejected: 'badge-danger',
    cancelled: 'badge-danger',
    dismissed: 'badge-danger',
    failed: 'badge-danger',
    withdrawn: 'badge-danger',
    suspended: 'badge-warning',
    terminated: 'badge-danger',
    resigned: 'badge-danger',
    absent: 'badge-danger',
    no_show: 'badge-danger',
    expired: 'badge-warning',
    overdue: 'badge-danger',
    critical: 'badge-danger',
    high: 'badge-warning',
    medium: 'badge-warning',
    low: 'badge-success',
    gross: 'badge-danger',
    major: 'badge-warning',
    minor: 'badge-success',
    moderate: 'badge-warning',
    ready_now: 'badge-success',
    ready_1_2_years: 'badge-info',
    ready_3_5_years: 'badge-warning',
    development_needed: 'badge-warning',
  };
  return statusMap[status.toLowerCase()] ?? 'badge-neutral';
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    system_admin: 'System Administrator',
    hr_admin: 'HR Administrator',
    hr_officer: 'HR Officer',
    department_manager: 'Department Manager',
    finance_officer: 'Finance Officer',
    employee: 'Employee',
  };
  return labels[role] ?? role;
}

export function getRoleBadgeClass(role: string): string {
  const roleMap: Record<string, string> = {
    system_admin: 'badge-danger',
    hr_admin: 'badge-info',
    hr_officer: 'badge-info',
    department_manager: 'badge-warning',
    finance_officer: 'badge-success',
    employee: 'badge-neutral',
  };
  return roleMap[role] ?? 'badge-neutral';
}

export async function logAudit(
  action: string,
  entityType: string,
  entityId: string | null = null,
  entityName: string | null = null,
  oldValues: Record<string, unknown> | null = null,
  newValues: Record<string, unknown> | null = null
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('audit_logs').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      old_values: oldValues,
      new_values: newValues,
    });
  } catch (err) {
    console.error('Failed to log audit:', err);
  }
}

export async function sendNotification(
  userId: string,
  title: string,
  message: string,
  notificationType: string = 'info',
  entityType: string | null = null,
  entityId: string | null = null,
  actionUrl: string | null = null
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      notification_type: notificationType,
      entity_type: entityType,
      entity_id: entityId,
      action_url: actionUrl,
    });
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}

export function isHrOrAdmin(role: string): boolean {
  return ['hr_admin', 'hr_officer', 'system_admin'].includes(role);
}

export function canManageEmployees(role: string): boolean {
  return ['hr_admin', 'hr_officer', 'system_admin'].includes(role);
}

export function canManagePayroll(role: string): boolean {
  return ['hr_admin', 'finance_officer', 'system_admin'].includes(role);
}

export function canManageRecruitment(role: string): boolean {
  return ['hr_admin', 'hr_officer', 'system_admin', 'department_manager'].includes(role);
}

export function canViewAllEmployees(role: string): boolean {
  return role !== 'employee';
}
