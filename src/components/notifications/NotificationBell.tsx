import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuthStore } from "@/store/useAuthStore";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/hooks/useNotifications";
import { formatRelative } from "@/lib/format";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const entityRoutes: Record<string, (id: string) => string> = {
  deal: (id) => `/deals/${id}`,
  lead: (id) => `/leads/${id}`,
  contact: (id) => `/contacts/${id}`,
  activity: (id) => `/activities/${id}`,
  product: (id) => `/products/${id}`,
  bundle: (id) => `/bundles/${id}`,
};

export function NotificationBell() {
  const { currentUser } = useAuthStore();
  const { data: notifications = [], isLoading } = useNotifications(currentUser?.id);
  const markNotificationReadMutation = useMarkNotificationRead();
  const markAllNotificationsReadMutation = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  const myNotifs = notifications
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20);

  const unreadCount = myNotifs.filter((n) => !n.is_read).length;

  const handleClick = (id: string, entityType: string, entityId: string) => {
    markNotificationReadMutation.mutate(id);
    const routeFn = entityRoutes[entityType];
    if (routeFn) navigate(routeFn(entityId));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={() => currentUser && markAllNotificationsReadMutation.mutate(currentUser.id)}
              className="text-xs text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 px-4 py-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="space-y-2 rounded-md border p-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-full animate-pulse rounded bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : myNotifs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            myNotifs.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n.id, n.entity_type, n.entity_id)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-muted transition-colors border-b last:border-b-0",
                  !n.is_read && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && (
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                  {n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatRelative(n.created_at)}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
