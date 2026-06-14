import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CommandPalette } from "@/components/search/CommandPalette";
import { CallingPanel } from "@/components/calling/CallingPanel";
import { StartCallingModal } from "@/components/calling/StartCallingModal";
import { FloatingCallBar } from "@/components/calling/FloatingCallBar";
import { Toaster } from "@/components/common/Toaster";
import { Tour } from "@/components/tour/Tour";
import { getTourSteps } from "@/components/tour/tourSteps";
import { useAuthStore } from "@/store/useAuthStore";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { useLayoutStore } from "@/store/useLayoutStore";
import { cn } from "@/lib/utils";

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [startCallingOpen, setStartCallingOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains("dark");
  });
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourSteps, setTourSteps] = useState(() => [] as ReturnType<typeof getTourSteps>);
  const { currentUser } = useAuthStore();
  const { active: sessionActive } = useCallSessionStore();
  const { layoutMode } = useLayoutStore();
  const location = useLocation();

  const handleStartTour = () => {
    const raw = getTourSteps(currentUser);
    const valid = raw.filter((s) => !!document.querySelector(s.selector));
    if (valid.length === 0) return;
    setTourSteps(valid);
    setTourStep(0);
    setTourActive(true);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div className="flex h-full">
      {layoutMode === "sidebar" && <Sidebar />}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          onSearchOpen={() => setSearchOpen(true)}
          onStartCalling={() => setStartCallingOpen(true)}
          onStartTour={handleStartTour}
          darkMode={darkMode}
          toggleDark={toggleDark}
        />
        <main className="flex-1 overflow-y-auto bg-card">
          <div
            className={cn(
              "min-h-full p-4 sm:p-6",
              layoutMode === "navbar" && "mx-auto w-full max-w-7xl",
            )}
          >
            <div key={location.key} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* Global overlays */}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <StartCallingModal
        open={startCallingOpen}
        onClose={() => setStartCallingOpen(false)}
      />
      {sessionActive && <FloatingCallBar />}
      <CallingPanel />
      <Toaster />
      {tourActive && (
        <Tour
          steps={tourSteps}
          currentStep={tourStep}
          onNext={() => setTourStep((s) => Math.min(s + 1, tourSteps.length - 1))}
          onPrev={() => setTourStep((s) => Math.max(s - 1, 0))}
          onClose={() => setTourActive(false)}
        />
      )}
    </div>
  );
}
