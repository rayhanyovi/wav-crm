import { create } from "zustand";
import type { Campaign, Lead } from "@/data/types";

interface CallSessionState {
  active: boolean;
  campaign: Campaign | null;
  queue: Lead[];
  currentIndex: number;
  sessionStartedAt: string | null;
  totalDurationSeconds: number;
  callsMade: number;
  pickups: number;
  callStartedAt: string | null;
  callDurationSeconds: number;
  liveNotes: string;
  panelOpen: boolean;
  phase: "sheet" | "calling" | "outcome" | "done";

  startSession: (campaign: Campaign, queue: Lead[]) => void;
  stopSession: () => void;
  openPanel: () => void;
  closePanel: () => void;
  startCall: () => void;
  endCall: () => void;
  setLiveNotes: (notes: string) => void;
  tickCallDuration: () => void;
  submitOutcome: (pickup: boolean) => void;
  nextLead: () => void;
  setPhase: (phase: "sheet" | "calling" | "outcome" | "done") => void;
}

export const useCallSessionStore = create<CallSessionState>((set, get) => ({
  active: false,
  campaign: null,
  queue: [],
  currentIndex: 0,
  sessionStartedAt: null,
  totalDurationSeconds: 0,
  callsMade: 0,
  pickups: 0,
  callStartedAt: null,
  callDurationSeconds: 0,
  liveNotes: "",
  panelOpen: false,
  phase: "sheet",

  startSession: (campaign, queue) =>
    set({
      active: true,
      campaign,
      queue,
      currentIndex: 0,
      sessionStartedAt: new Date().toISOString(),
      totalDurationSeconds: 0,
      callsMade: 0,
      pickups: 0,
      callStartedAt: null,
      callDurationSeconds: 0,
      liveNotes: "",
      panelOpen: true,
      phase: "sheet",
    }),

  stopSession: () =>
    set({
      active: false,
      campaign: null,
      queue: [],
      panelOpen: false,
      phase: "sheet",
    }),

  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),

  startCall: () =>
    set({
      callStartedAt: new Date().toISOString(),
      callDurationSeconds: 0,
      phase: "calling",
    }),

  endCall: () =>
    set((s) => ({
      phase: "outcome",
      callsMade: s.callsMade + 1,
      totalDurationSeconds: s.totalDurationSeconds + s.callDurationSeconds,
    })),

  setLiveNotes: (notes) => set({ liveNotes: notes }),

  tickCallDuration: () =>
    set((s) => ({ callDurationSeconds: s.callDurationSeconds + 1 })),

  submitOutcome: (pickup) =>
    set((s) => ({
      pickups: pickup ? s.pickups + 1 : s.pickups,
      liveNotes: "",
      callDurationSeconds: 0,
      callStartedAt: null,
    })),

  nextLead: () =>
    set((s) => {
      const next = s.currentIndex + 1;
      if (next >= s.queue.length) {
        return { phase: "done", currentIndex: next };
      }
      return { currentIndex: next, phase: "sheet" };
    }),

  setPhase: (phase) => set({ phase }),
}));
