import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Search, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { navGroups, roleLabels } from '@/components/layouts/nav-config';
import { notificationsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <Link to="/" className="flex items-center py-1">
      <img
        src="/images/abr_logo.png"
        alt="AB Rwanda"
        className="h-9 w-auto max-h-9 max-w-[180px] object-contain"
      />
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
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setMobileOpen(false);
    setSearchTerm('');
    setSearchOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!profile?.id) return;
    notificationsApi
      .list(profile.id)
      .then((items) => setUnread(items.filter((item) => !item.is_read).length))
      .catch(() => setUnread(0));
  }, [profile?.id, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return navGroups
      .flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })))
      .filter((item) => item.roles.includes(role ?? 'admin') && item.label.toLowerCase().includes(term))
      .slice(0, 6);
  }, [role, searchTerm]);

  const selectSearchResult = (path: string) => {
    setSearchOpen(false);
    setSearchTerm('');
    navigate(path);
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
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-16 items-center justify-between border-b border-border px-5">
            <BrandMark />
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
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

            <div className="relative hidden min-w-0 flex-1 md:block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && searchResults[0]) {
                    selectSearchResult(searchResults[0].path);
                  }
                  if (event.key === 'Escape') setSearchOpen(false);
                }}
                placeholder="Search sections"
                aria-label="Search sections"
                aria-expanded={searchOpen && searchResults.length > 0}
                className="h-9 max-w-md bg-muted/40 pl-9"
              />
              {searchOpen && searchResults.length > 0 ? (
                <div className="absolute left-0 top-full z-50 mt-2 w-full max-w-md rounded-md border border-border bg-popover p-1 shadow-md">
                  {searchResults.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectSearchResult(item.path)}
                      className="flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span>{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.group}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 md:hidden" />

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
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
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

      </div>
    </div>
  );
}
