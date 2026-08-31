'use client';

// Notifications — Phase 9. Minimal list view for the bell icon in
// `TopBar` (already fetches `/api/notifications` + `/api/notifications/count`
// via the starter's existing generic notification system — see
// .planning/banani/phase9.md). No Banani source; built fresh, matching the
// same "no fake UI" treatment as every other bare route in this project.
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useUser } from '@/contexts/AuthContext';
import { useApi, invalidateAllCache } from '@/lib/useApi';
import { api } from '@/lib/api';
import { Icon } from '@/components/jurali/Icon';
import { formatDateFr } from '@/lib/jurali-format';
import { PageTransition } from '@/components/jurali/PageTransition';
import { listItem } from '@/lib/motion';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: unknown;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const user = useUser();
  const { data, loading, refresh } = useApi<{ items: NotificationItem[] }>('/api/notifications', {
    skip: !user,
  });

  if (!user) return null;

  const items = data?.items ?? [];
  const unreadCount = items.filter((n) => !n.readAt).length;

  async function markAllRead() {
    await api('/api/notifications', { method: 'PATCH', body: { ids: 'all' } });
    invalidateAllCache();
    await refresh();
  }

  async function markRead(id: string) {
    await api('/api/notifications', { method: 'PATCH', body: { ids: [id] } });
    invalidateAllCache();
    await refresh();
  }

  return (
    <PageTransition>
      <div className="min-h-dvh bg-background font-body flex flex-col">
        <div className="bg-primary px-4 pt-10 pb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-10 h-10 flex items-center justify-center bg-primary-foreground/15 rounded-lg"
            >
              <Icon i="chevron-left" size={20} className="text-primary-foreground" />
            </Link>
            <div className="flex-1">
              <div className="font-headings font-bold text-lg text-primary-foreground">
                Notifications
              </div>
              <div className="text-xs text-secondary">
                {unreadCount > 0
                  ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                  : 'Tout est lu'}
              </div>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-headings font-bold text-primary-foreground/90 underline"
              >
                Tout marquer lu
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pt-5 pb-8 flex flex-col gap-2 max-w-lg w-full mx-auto">
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Chargement…</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Aucune notification pour l’instant.
            </div>
          ) : (
            <div className="bg-background border border-border rounded-xl overflow-hidden">
              {items.map((n, i) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  isFirst={i === 0}
                  index={i}
                  onRead={() => void markRead(n.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

function NotificationRow({
  notification,
  isFirst,
  index,
  onRead,
}: {
  notification: NotificationItem;
  isFirst: boolean;
  index: number;
  onRead: () => void;
}) {
  const clientId =
    notification.data && typeof notification.data === 'object' && 'clientId' in notification.data
      ? String((notification.data as { clientId: unknown }).clientId)
      : null;
  const unread = !notification.readAt;

  const body = (
    <motion.div
      variants={listItem}
      initial="hidden"
      animate="show"
      custom={index}
      className={`flex items-start gap-3 px-4 py-3.5 ${!isFirst ? 'border-t border-border' : ''}`}
    >
      {unread && <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0 mt-1.5" />}
      <div className={`flex-1 min-w-0 ${unread ? '' : 'pl-5'}`}>
        <div className="font-headings font-bold text-sm text-foreground">{notification.title}</div>
        <div className="text-sm text-muted-foreground mt-0.5">{notification.body}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {formatDateFr(notification.createdAt)}
        </div>
      </div>
    </motion.div>
  );

  if (clientId) {
    return (
      <Link href={`/clients/${clientId}`} onClick={onRead} className="block">
        {body}
      </Link>
    );
  }

  return unread ? (
    <button type="button" onClick={onRead} className="w-full text-left">
      {body}
    </button>
  ) : (
    body
  );
}
