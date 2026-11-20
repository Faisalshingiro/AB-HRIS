import { useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { employeesApi, profilesApi } from '@/services/api';
import { roleLabels } from '@/components/layouts/nav-config';
import type { EmployeeWithRelations } from '@/types/types';
import { RWF, formatDate, fullName } from '@/lib/format';
import { toast } from 'sonner';

export default function ProfilePage() {
  const { profile, role, employeeId, refreshProfile } = useAuth();
  const [employee, setEmployee] = useState<EmployeeWithRelations | null>(null);
  const [fullNameValue, setFullNameValue] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullNameValue(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile]);

  useEffect(() => {
    if (!employeeId) return;
    employeesApi
      .get(employeeId)
      .then(setEmployee)
      .catch(() => setEmployee(null));
  }, [employeeId]);

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      await profilesApi.updateSelf(profile.id, { full_name: fullNameValue.trim(), phone: phone.trim() || null });
      await refreshProfile();
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update your profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Your personal details, role assignment and employment record."
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account details</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Changes are recorded in the audit trail.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={fullNameValue} onChange={(e) => setFullNameValue(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+250..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={profile?.username ?? ''} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile?.email ?? ''} disabled />
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
                Role changes are restricted to system administrators.
              </div>
              <Button onClick={handleSave} disabled={saving} className="shrink-0">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Role</span>
              <StatusBadge status="active" label={role ? roleLabels[role] : 'Unassigned'} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Account status</span>
              <StatusBadge status={profile?.is_active ? 'active' : 'suspended'} label={profile?.is_active ? 'Active' : 'Disabled'} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Member since</span>
              <span className="text-sm font-medium">{formatDate(profile?.created_at)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {employee ? (
        <Card className="mt-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Employment record</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Maintained by the HR office.</p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-x-8 gap-y-4 md:grid-cols-2 md:grid-cols-3">
              {[
                ['Employee number', employee.employee_no],
                ['Name', fullName(employee)],
                ['Department', employee.department?.name ?? ''],
                ['Position', employee.position?.title ?? ''],
                ['Line manager', employee.manager ? fullName(employee.manager) : ''],
                ['Employment type', employee.employment_type.replace('_', ' ')],
                ['Hire date', formatDate(employee.hire_date)],
                ['Status', employee.status.replace('_', ' ')],
                ['Base salary', RWF(employee.base_salary)],
                ['Bank', employee.bank_name ?? ''],
                ['RSSB number', employee.rssb_number ?? ''],
                ['Emergency contact', employee.emergency_contact_name ?? ''],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="ed-label">{label}</p>
                  <p className="mt-1 break-words text-sm font-medium capitalize">{value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
