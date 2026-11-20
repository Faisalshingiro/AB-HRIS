import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Lock, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

const DEMO_ACCOUNTS = [
  { label: 'Administrator', username: 'admin', password: 'Adm!n#ABR2026$xQ7vLp' },
  { label: 'HR Officer', username: 'hr', password: 'ABR-hr-2026!Kx9' },
  { label: 'Line Manager', username: 'manager', password: 'ABR-manager-2026!Kx9' },
  { label: 'Finance Officer', username: 'finance', password: 'ABR-finance-2026!Kx9' },
  { label: 'Employee', username: 'employee', password: 'ABR-employee-2026!Kx9' },
];

export default function LoginPage() {
  const { signInWithUsername, signUpWithUsername } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('signin');
  const [busy, setBusy] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', fullName: '' });

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.username.trim() || !form.password) {
      toast.error('Enter your username and password');
      return;
    }
    setBusy(true);
    const { error } = await signInWithUsername(form.username.trim(), form.password);
    setBusy(false);
    if (error) {
      toast.error(error.message || 'Sign in failed');
      return;
    }
    toast.success('Welcome back');
    navigate('/', { replace: true });
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!agreed) {
      toast.error('Please accept the User Agreement and Privacy Policy');
      return;
    }
    if (!/^[A-Za-z0-9_]{3,24}$/.test(form.username)) {
      toast.error('Username must be 3-24 characters using letters, digits or underscore');
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setBusy(true);
    const { error } = await signUpWithUsername(form.username.trim(), form.password, form.fullName.trim() || form.username);
    setBusy(false);
    if (error) {
      toast.error(error.message || 'Registration failed');
      return;
    }
    toast.success('Account created. You are signed in.');
    navigate('/', { replace: true });
  };

  const fillDemo = (username: string, password: string) => {
    setTab('signin');
    setForm({ username, password, fullName: '' });
  };

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <section className="relative flex flex-col justify-between overflow-hidden bg-foreground px-6 py-10 text-background md:w-[46%] md:px-12 md:py-14">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, currentColor 0, currentColor 1px, transparent 1px, transparent 56px)',
          }}
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-center">
            <img
              src="/images/abr_logo.png"
              alt="AB Rwanda logo"
              className="h-11 w-auto max-h-11 max-w-[220px] object-contain rounded-md bg-white p-2 shadow-sm"
            />
          </div>

          <h1 className="mt-12 max-w-md text-balance font-serif text-3xl font-bold leading-[1.1] tracking-tight md:mt-16 md:text-5xl">
            One record of every person, from first application to final settlement.
          </h1>
          <p className="mt-5 max-w-sm text-pretty text-sm leading-relaxed text-background/70">
            Recruitment, onboarding, attendance, performance, payroll and exit — governed by role-based access and a
            complete audit trail.
          </p>
        </div>

        <div className="relative mt-10 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-background/20 pt-6 md:mt-0">
          {[
            ['8', 'Integrated modules'],
            ['5', 'Access roles'],
            ['RRA', 'PAYE compliant'],
            ['RSSB', 'Pension & CBHI'],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="font-serif text-xl font-bold leading-none">{value}</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-background/55">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-5 py-10 md:px-10">
        <div className="w-full max-w-md">
          <p className="ed-label">Secure access</p>
          <h2 className="mt-2 text-balance text-2xl font-bold tracking-tight md:text-3xl">Sign in</h2>
          <p className="mt-2 text-pretty text-sm text-muted-foreground">
            Use your company credentials. Access is limited to the modules assigned to your role.
          </p>

          <Tabs value={tab} onValueChange={setTab} className="mt-7">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="username"
                      value={form.username}
                      onChange={(e) => update('username', e.target.value)}
                      placeholder="e.g. admin"
                      autoComplete="username"
                      className="pl-9"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      placeholder="Your password"
                      autoComplete="current-password"
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Sign in
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={form.fullName}
                    onChange={(e) => update('fullName', e.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newUsername">Username</Label>
                  <Input
                    id="newUsername"
                    value={form.username}
                    onChange={(e) => update('username', e.target.value)}
                    placeholder="letters, digits and underscore"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={form.password}
                    onChange={(e) => update('password', e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                </div>
                <label className="flex min-h-12 items-start gap-3 rounded-md border border-border bg-muted/40 p-3">
                  <Checkbox checked={agreed} onCheckedChange={(value) => setAgreed(value === true)} className="mt-0.5" />
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    I accept the User Agreement and Privacy Policy. Employee data is processed for employment purposes
                    only and retained in line with Rwandan data protection requirements.
                  </span>
                </label>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create account
                </Button>
                <p className="text-xs text-muted-foreground">
                  New accounts are created with employee access. An administrator assigns additional roles.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-8 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent" aria-hidden="true" />
              <p className="ed-label">Demonstration accounts</p>
            </div>
            <div className="mt-3 grid gap-1.5">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  onClick={() => fillDemo(account.username, account.password)}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                >
                  <span className="font-medium text-foreground">{account.label}</span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">{account.username}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
