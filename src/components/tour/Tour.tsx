import { useEffect, useState, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TourStep } from "./tourSteps";

interface TargetRect { x: number; y: number; width: number; height: number }

interface TourProps {
  steps: TourStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

const PAD = 8;
const CARD_W = 320;

export function Tour({ steps, currentStep, onNext, onPrev, onClose }: TourProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const step = steps[currentStep];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(step.selector);
    if (!el) { setTargetRect(null); return; }
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      setTargetRect({ x: r.left, y: r.top, width: r.width, height: r.height });
    });
  }, [step]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!step) return null;

  const spotX = targetRect ? targetRect.x - PAD : -PAD;
  const spotY = targetRect ? targetRect.y - PAD : -PAD;
  const spotW = targetRect ? targetRect.width + PAD * 2 : 0;
  const spotH = targetRect ? targetRect.height + PAD * 2 : 0;

  const centerX = targetRect ? targetRect.x + targetRect.width / 2 : window.innerWidth / 2;
  const cardLeft = Math.max(12, Math.min(window.innerWidth - CARD_W - 12, centerX - CARD_W / 2));

  const belowY = spotY + spotH + 12;
  const preferBelow = !targetRect || belowY + 200 < window.innerHeight;
  const aboveY = spotY - 12;

  return (
    <>
      {/* SVG spotlight mask */}
      <svg
        aria-hidden
        style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 9990 }}
      >
        <defs>
          <mask id="tour-mask">
            <rect fill="white" width="100%" height="100%" />
            {targetRect && <rect fill="black" x={spotX} y={spotY} width={spotW} height={spotH} rx={6} />}
          </mask>
        </defs>
        <rect fill="rgba(0,0,0,0.52)" width="100%" height="100%" mask="url(#tour-mask)" />
        {targetRect && (
          <rect x={spotX} y={spotY} width={spotW} height={spotH} rx={6} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
        )}
      </svg>

      {/* Click-to-close backdrop */}
      <div style={{ position: "fixed", inset: 0, zIndex: 9989 }} onClick={onClose} />

      {/* Floating popover card */}
      <div
        style={{
          position: "fixed",
          zIndex: 9995,
          width: CARD_W,
          left: cardLeft,
          ...(preferBelow ? { top: belowY } : { bottom: window.innerHeight - aboveY }),
        }}
        className="rounded-xl border bg-popover text-popover-foreground shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm leading-snug">{step.title}</h3>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mt-0.5 -mr-1" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{step.content}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground tabular-nums">{currentStep + 1} / {steps.length}</span>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2.5 text-xs" onClick={onPrev}>
                <ChevronLeft className="h-3.5 w-3.5" />Back
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button size="sm" className="h-7 gap-1 px-2.5 text-xs" onClick={onNext}>
                Next<ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" className="h-7 px-3 text-xs" onClick={onClose}>Done</Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
