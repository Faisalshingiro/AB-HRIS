import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { navGroups, roleLabels } from '@/components/layouts/nav-config';
import { notificationsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img
        src="/images/abr_logo.png"
        alt="AB Rwanda"
        className="h-8 w-auto max-h-8 max-w-[120px] object-contain rounded-sm"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      {/* <span className="min-w-0">
        <span className="block truncate text-sm font-bold leading-tight tracking-tight">AB Rwanda</span>
        <span className="ed-label block text-[10px] leading-tight">HRIS</span>
      </span> */}
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useAuth();
  const effectiveRole = role ?? 'admin';
  const location = useLocation();
  const groups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => item.roles.includes(effectiveRole)),
        }))
        .filter((group) => group.items.length > 0),
    [effectiveRole],
  );

  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="ed-label px-3 pb-2">{group.label}</p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
                  data-active={isActive}
                  className="ed-nav-item"
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppLayout() {
  const { profile, role, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const mainRef = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!profile?.id) return;
    notificationsApi
      .list(profile.id)
      .then((items) => setUnread(items.filter((item) => !item.is_read).length))
      .catch(() => setUnread(0));
  }, [profile?.id, location.pathname]);

  const handleSignOut = () => {
    void signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <div className="flex h-16 items-center border-b border-border px-5">
          <BrandMark />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavList />
        </div>
        <div className="border-t border-border px-5 py-3">
          <p className="ed-label">AB Rwanda PLC</p>
          <p className="mt-1 text-xs text-muted-foreground">Kigali · Rwanda</p>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col overflow-hidden bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
            <BrandMark />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            <NavList onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <header className="z-30 shrink-0 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 md:px-8">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate text-xs text-muted-foreground">
                AB Rwanda Human Resources Information System
              </span>
            </div>
            <div className="min-w-0 flex-1 md:hidden">
              <span className="block truncate text-sm font-semibold">AB Rwanda HRIS</span>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" asChild aria-label="Notifications">
                <Link to="/notifications" className="relative">
                  <Bell className="h-4 w-4" />
                  {unread > 0 ? (
                    <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  ) : null}
                </Link>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 gap-2 px-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-foreground text-[11px] font-semibold text-background">
                        {initials(profile?.full_name?.split(' ')[0], profile?.full_name?.split(' ')[1])}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden max-w-32 truncate text-sm font-medium md:inline">
                      {profile?.full_name ?? profile?.username ?? 'Account'}
                    </span>
                    <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:inline" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <p className="truncate text-sm font-semibold">{profile?.full_name ?? 'Account'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {role ? roleLabels[role] : 'No role assigned'}
                    </p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">My profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/notifications">Notifications</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-white">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="ed-rule" />
        </header>

        <main
          ref={mainRef}
          className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 md:px-8 md:py-8')}
        >
          <Outlet />
        </main>

        <footer className="shrink-0 border-t border-border px-4 py-4 md:px-8">
          <p className="text-xs text-muted-foreground">
            AB Rwanda PLC · Human Resources Information System · Data handled in line with Rwandan data protection
            requirements
          </p>
        </footer>
      </div>
    </div>
  );
}
