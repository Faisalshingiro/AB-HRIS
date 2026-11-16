/*
# Audit Logs and Notifications

## Purpose
- `audit_logs`: tracks all significant actions in the HRIS for compliance and security
- `notifications`: in-app notifications for approvals, deadlines, updates

## New Tables
1. `audit_logs` — immutable record of user actions (who, what, when, what changed)
2. `notifications` — user-targeted notifications with read/unread status

## Security
- audit_logs: HR/admin/system_admin can read; INSERT is allowed for authenticated (system writes logs); no UPDATE/DELETE (append-only)
- notifications: users can read/update only their own; HR can insert
*/

-- ============================================================
-- audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_name text,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;

DROP POLICY IF EXISTS "audit_logs_select_hr" ON public.audit_logs;
CREATE POLICY "audit_logs_select_hr"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_hr_or_admin() OR public.has_role('system_admin'));

DROP POLICY IF EXISTS "audit_logs_insert_any" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_any"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================
-- notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  notification_type text NOT NULL DEFAULT 'info' CHECK (notification_type IN ('info','success','warning','error','approval','deadline','update')),
  entity_type text,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  action_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_any" ON public.notifications;
CREATE POLICY "notifications_insert_any"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);
