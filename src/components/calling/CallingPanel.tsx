import { useEffect } from "react";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CallSheet } from "./CallSheet";
import { CallOutcomeForm } from "./CallOutcomeForm";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCrmStore } from "@/store/useCrmStore";

export function CallingPanel() {
  const {
    active, panelOpen, closePanel, phase, queue, currentIndex,
    tickCallDuration, callDurationSeconds, stopSession,
  } = useCallSessionStore();

  // Timer tick
  useEffect(() => {
    if (phase !== "calling") return;
    const interval = setInterval(tickCallDuration, 1000);
    return () => clearInterval(interval);
  }, [phase, tickCallDuration]);

  const { companies } = useCrmStore();

  if (!active) return null;

  const currentLead = queue[currentIndex];

  return (
    <Sheet open={panelOpen} onOpenChange={(o) => !o && closePanel()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col" hideClose>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Calling Session</p>
            <p className="font-semibold">
              Lead {currentIndex + 1} of {queue.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {phase === "calling" && (
              <div className="flex items-center gap-1.5 text-red-500 text-sm font-mono">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                {String(Math.floor(callDurationSeconds / 60)).padStart(2, "0")}:
                {String(callDurationSeconds % 60).padStart(2, "0")}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm("End this calling session?")) stopSession();
              }}
            >
              Stop Session
            </Button>
            <Button size="icon" variant="ghost" onClick={closePanel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {phase === "done" ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
              <div className="text-4xl">🎉</div>
              <h3 className="text-xl font-semibold">Session Complete!</h3>
              <p className="text-muted-foreground">You've gone through all leads in the queue.</p>
              <Button onClick={stopSession}>End Session</Button>
            </div>
          ) : phase === "outcome" ? (
            <CallOutcomeForm lead={currentLead} />
          ) : (
            <CallSheet lead={currentLead} companies={companies} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
