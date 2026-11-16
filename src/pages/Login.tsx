import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Mail, Lock, User as UserIcon, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types';
import { getRoleLabel } from '@/lib/utils';

export function Login() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('hr_admin');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'signin') {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
        setLoading(false);
      } else {
        navigate('/');
      }
    } else {
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName, role);
      if (error) {
        setError(error);
        setLoading(false);
      } else {
        navigate('/');
      }
    }
  };

  const roles: UserRole[] = ['system_admin', 'hr_admin', 'hr_officer', 'department_manager', 'finance_officer', 'employee'];

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Left panel - branding */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 shadow-lg">
              <BriefcakeIcon />
            </div>
            <div>
              <h1 className="text-xl font-bold">AB Rwanda PLC</h1>
              <p className="text-sm text-blue-200">Human Resources Information System</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6 text-white">
          <h2 className="text-4xl font-bold leading-tight">
            Empowering People,<br />Transforming HR.
          </h2>
          <p className="max-w-md text-blue-100">
            A comprehensive HRIS managing the complete employee lifecycle — from recruitment to retirement —
            across eight integrated modules with role-based access, audit trails, and Rwandan compliance.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            {['Recruitment', 'Onboarding', 'Employee Mgmt', 'Performance', 'Development', 'Payroll', 'Succession', 'Exit Mgmt'].map((mod) => (
              <div key={mod} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-blue-50 backdrop-blur-sm">
                <div className="h-2 w-2 rounded-full bg-blue-400" />
                {mod}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-sm text-blue-200">
          Tender Ref. No. 010/2026 — Production HRIS
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
              <Briefcase className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">AB Rwanda PLC</h1>
              <p className="text-xs text-blue-200">HRIS</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {mode === 'signin' ? 'Enter your credentials to access the HRIS' : 'Register a new account to get started'}
            </p>

            {error && (
              <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="label">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="input pl-10"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input pl-10"
                    placeholder="you@abrwanda.rw"
                  />
                </div>
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="input pl-10 pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="label">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="input"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>{getRoleLabel(r)}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : mode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-500">
              {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Tender Ref. No. 010/2026 — AB Rwanda PLC HRIS
          </p>
        </div>
      </div>
    </div>
  );
}

function BriefcakeIcon() {
  return <Briefcase className="text-white" size={24} />;
}
