import { api, type Envelope, type Page } from "@/lib/api";
import type { Notification } from "@/data/types";

// ─── API response shape ───────────────────────────────────────────────────────

interface ApiNotification {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

function mapNotification(r: ApiNotification): Notification {
  return {
    id: r.id,
    recipient_id: r.recipientId,
    type: r.type,
    title: r.title,
    message: r.message,
    entity_type: r.entityType,
    entity_id: r.entityId,
    is_read: r.isRead,
    read_at: r.readAt ?? undefined,
    created_at: r.createdAt,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function fetchNotifications(_userId?: string, limit = 20): Promise<Notification[]> {
  const res = await api.get<Page<ApiNotification>>("/api/notifications", { pageSize: limit, page: 1 });
  return res.data.map(mapNotification);
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch<Envelope<ApiNotification>>(`/api/notifications/${id}/read`, {});
}

export async function markAllNotificationsRead(_userId?: string): Promise<void> {
  await api.patch("/api/notifications/read-all", {});
}
