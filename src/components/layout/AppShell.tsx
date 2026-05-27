import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { CommandPalette } from "@/components/search/CommandPalette";
import { CallingPanel } from "@/components/calling/CallingPanel";
import { StartCallingModal } from "@/components/calling/StartCallingModal";
import { FloatingCallBar } from "@/components/calling/FloatingCallBar";
import { useCallSessionStore } from "@/store/useCallSessionStore";
import { useLayoutStore } from "@/store/useLayoutStore";
import { cn } from "@/lib/utils";

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [startCallingOpen, setStartCallingOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains("dark");
  });
  const { active: sessionActive } = useCallSessionStore();
  const { layoutMode } = useLayoutStore();
  const location = useLocation();

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
    </div>
  );
}
