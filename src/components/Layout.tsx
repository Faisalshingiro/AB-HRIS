import { useState, useEffect, ReactNode, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, UserPlus, Briefcase, Target, GraduationCap,
  DollarSign, ShieldCheck, LogOut, Bell, Search, Menu, X, ChevronDown,
  Building2, FileText, Settings, User as UserIcon
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types';
import { getRoleLabel, getRoleBadgeClass, fullName, isHrOrAdmin, canManagePayroll, canManageRecruitment } from '@/lib/utils';
import { Avatar } from './ui/Avatar';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: string[];
}

export function Layout({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const role = profile?.role ?? 'employee';

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) {
      setNotifications(data as Notification[]);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    fetchNotifications();
  };

  const navItems: NavItem[] = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { to: '/recruitment', label: 'Recruitment', icon: <Briefcase size={20} />, roles: ['system_admin', 'hr_admin', 'hr_officer', 'department_manager'] },
    { to: '/onboarding', label: 'Onboarding', icon: <UserPlus size={20} />, roles: ['system_admin', 'hr_admin', 'hr_officer'] },
    { to: '/employees', label: 'Employee Management', icon: <Users size={20} /> },
    { to: '/performance', label: 'Performance', icon: <Target size={20} /> },
    { to: '/development', label: 'Development', icon: <GraduationCap size={20} /> },
    { to: '/payroll', label: 'Payroll', icon: <DollarSign size={20} />, roles: ['system_admin', 'hr_admin', 'finance_officer', 'employee'] },
    { to: '/succession', label: 'Succession & Discipline', icon: <ShieldCheck size={20} />, roles: ['system_admin', 'hr_admin', 'hr_officer', 'department_manager'] },
    { to: '/exit', label: 'Employee Exit', icon: <LogOut size={20} />, roles: ['system_admin', 'hr_admin', 'hr_officer'] },
    { to: '/audit', label: 'Audit Logs', icon: <FileText size={20} />, roles: ['system_admin', 'hr_admin'] },
    { to: '/settings', label: 'Settings', icon: <Settings size={20} />, roles: ['system_admin', 'hr_admin'] },
  ];

  const filteredNavItems = navItems.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 shadow-sm">
            <Building2 className="text-white" size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-slate-900">AB Rwanda</h1>
            <p className="truncate text-xs text-slate-500">HRIS Platform</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin px-3 py-4">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            <p className="font-medium text-slate-700">Tender Ref. 010/2026</p>
            <p className="mt-0.5">AB Rwanda PLC HRIS</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search employees..."
                className="w-64 rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigate(`/employees?q=${encodeURIComponent(e.currentTarget.value)}`);
                  }
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl animate-fade-in">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="badge-info">{unreadCount} new</span>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto scrollbar-thin">
                      {notifications.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-400">No notifications</p>
                      ) : (
                        notifications.map((notif) => (
                          <button
                            key={notif.id}
                            onClick={() => {
                              if (!notif.is_read) markNotificationRead(notif.id);
                              if (notif.action_url) navigate(notif.action_url);
                              setNotifOpen(false);
                            }}
                            className={`flex w-full flex-col gap-1 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50 ${!notif.is_read ? 'bg-blue-50/50' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900">{notif.title}</p>
                              {!notif.is_read && <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-600" />}
                            </div>
                            {notif.message && <p className="text-xs text-slate-500 line-clamp-2">{notif.message}</p>}
                            <p className="text-xs text-slate-400">{new Date(notif.created_at).toLocaleString()}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
              >
                <Avatar
                  firstName={profile?.full_name?.split(' ')[0] ?? 'U'}
                  lastName={profile?.full_name?.split(' ')[1] ?? ''}
                  size="sm"
                />
                <div className="hidden text-left sm:block">
                  <p className="text-sm font-medium text-slate-900">{profile?.full_name ?? 'User'}</p>
                  <p className="text-xs text-slate-500">{getRoleLabel(role)}</p>
                </div>
                <ChevronDown size={16} className="text-slate-400" />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-xl animate-fade-in">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
                      <p className="truncate text-xs text-slate-500">{profile?.email}</p>
                      <span className={`mt-2 inline-block ${getRoleBadgeClass(role)}`}>{getRoleLabel(role)}</span>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { navigate('/profile'); setUserMenuOpen(false); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <UserIcon size={16} /> My Profile
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <LogOut size={16} /> Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
