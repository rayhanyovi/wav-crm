import { Phone, PhoneOff, ChevronUp } from "lucide-react";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { useAuthStore } from "@/store/useAuthStore";
import { isColdCaller } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";

export function FloatingCallBar() {
  const {
    queue, currentIndex, callsMade, pickups,
    totalDurationSeconds, openPanel, stopSession,
  } = useCallSessionStore();
  const { currentUser } = useAuthStore();
  const sessionLabel = isColdCaller(currentUser) ? "Call Queue" : "Follow-up Queue";

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-primary text-primary-foreground rounded-full px-5 py-2.5 shadow-lg shadow-primary/20 text-sm">
        <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
        <span className="font-medium truncate max-w-40">{sessionLabel}</span>
        <span className="text-primary-foreground/70">·</span>
        <span className="font-mono text-xs">{formatDuration(totalDurationSeconds)}</span>
        <span className="text-primary-foreground/70">·</span>
        <span className="text-xs">{callsMade} calls</span>
        <span className="text-xs">({pickups} pickups)</span>
        <span className="text-xs text-primary-foreground/70">
          {currentIndex + 1}/{queue.length}
        </span>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 gap-1 text-xs rounded-full"
          onClick={openPanel}
        >
          <Phone className="h-3 w-3" />
          Open
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 gap-1 text-xs rounded-full"
          onClick={() => { if (confirm("End calling session?")) stopSession(); }}
        >
          <PhoneOff className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
