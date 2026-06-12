import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useToastStore } from "@/store/useToastStore";
import { cn } from "@/lib/utils";

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  default: Info,
} as const;

const STYLES = {
  success: "border-green-500/30 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  default: "border-border bg-popover text-foreground",
} as const;

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm shadow-lg",
              "animate-in slide-in-from-bottom-2 fade-in-0 duration-200",
              STYLES[t.variant],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
