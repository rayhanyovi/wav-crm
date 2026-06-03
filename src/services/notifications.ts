import { supabase } from "@/lib/supabase";
import type { Notification } from "@/data/types";

const NOTIFICATION_SELECT =
  "id,recipient_id,type,title,message,entity_type,entity_id,is_read,read_at,created_at";

interface NotificationRow {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  message: string;
  entity_type: string;
  entity_id: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    recipient_id: row.recipient_id,
    type: row.type,
    title: row.title,
    message: row.message,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    is_read: row.is_read,
    read_at: row.read_at ?? undefined,
    created_at: row.created_at,
  };
}

export async function fetchNotifications(userId: string, limit = 20): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as NotificationRow[]).map(mapNotificationRow);
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .eq("is_read", false);

  if (error) throw new Error(error.message);
}
