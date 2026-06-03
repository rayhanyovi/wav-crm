import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/notifications";
import type { Notification } from "@/data/types";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (userId: string, limit: number) => [...notificationKeys.all, userId, limit] as const,
};

export function useNotifications(userId: string | undefined, limit = 20) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: notificationKeys.list(userId ?? "", limit),
    queryFn: () => fetchNotifications(userId!, limit),
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId) return;

    // Append a unique suffix so Supabase never returns a cached already-subscribed
    // channel when this effect re-runs (e.g. two callers with same userId, StrictMode
    // double-invoke, or fast remount where removeChannel hasn't flushed yet).
    const channelName = `notifications:${userId}:${Math.random().toString(36).slice(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: notificationKeys.all });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  return query;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });

      const snapshots = queryClient.getQueriesData<Notification[]>({
        queryKey: notificationKeys.all,
      });

      snapshots.forEach(([key, data]) => {
        if (!data) return;
        queryClient.setQueryData<Notification[]>(
          key,
          data.map((notification) =>
            notification.id === id
              ? { ...notification, is_read: true, read_at: new Date().toISOString() }
              : notification,
          ),
        );
      });

      return { snapshots };
    },
    onError: (_error, _id, context) => {
      context?.snapshots?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => markAllNotificationsRead(userId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
