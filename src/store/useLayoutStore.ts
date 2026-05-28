import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppLayoutMode = "sidebar" | "navbar";

interface LayoutState {
  layoutMode: AppLayoutMode;
  setLayoutMode: (mode: AppLayoutMode) => void;
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      layoutMode: "navbar",
      setLayoutMode: (layoutMode) => set({ layoutMode }),
    }),
    { name: "crm-layout-v2" }
  )
);
