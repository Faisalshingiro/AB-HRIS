import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { notificationsApi } from '@/services/api';
import type { Notification } from '@/types/types';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      setItems(await notificationsApi.list(profile.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const visible = items.filter((item) => (filter === 'unread' ? !item.is_read : true));

  const markAll = async () => {
    if (!profile?.id) return;
    try {
      await notificationsApi.markAllRead(profile.id);
      toast.success('All notifications marked as read');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Notification centre"
        description="Approval requests, payroll publications, document expiry and appraisal reminders."
        actions={
          <Button variant="outline" size="sm" onClick={markAll} disabled={!items.some((i) => !i.is_read)}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all read
          </Button>
        }
      />

      <Tabs value={filter} onValueChange={setFilter} className="mb-4">
        <TabsList>
          <TabsTrigger value="all">All ({items.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({items.filter((i) => !i.is_read).length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading notifications…</div>
          ) : visible.length === 0 ? (
            <EmptyState icon={Inbox} title="No notifications" description="You are all caught up." />
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((item) => (
                <li key={item.id} className={cn('px-5 py-4', !item.is_read && 'bg-muted/40')}>
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border',
                        item.is_read ? 'bg-card' : 'bg-accent/10',
                      )}
                    >
                      <Bell className={cn('h-3.5 w-3.5', item.is_read ? 'text-muted-foreground' : 'text-accent')} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{item.title}</p>
                        {!item.is_read ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                      </div>
                      <p className="mt-1 text-pretty text-sm text-muted-foreground">{item.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
                        {item.link ? (
                          <Link to={item.link} className="text-xs font-medium text-accent hover:underline">
                            Open
                          </Link>
                        ) : null}
                        {!item.is_read ? (
                          <button
                            type="button"
                            className="text-xs font-medium text-muted-foreground hover:text-foreground"
                            onClick={async () => {
                              await notificationsApi.markRead(item.id);
                              await load();
                            }}
                          >
                            Mark as read
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
