import { create } from "zustand";
import type { Lead } from "@/data/types";
import { createCallSession } from "@/services/callSessions";
import { useAuthStore } from "@/store/useAuthStore";

interface CallSessionState {
  active: boolean;
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

  startSession: (queue: Lead[]) => void;
  stopSession: () => void;
  openPanel: () => void;
  closePanel: () => void;
  startCall: () => void;
  endCall: () => void;
  setLiveNotes: (notes: string) => void;
  tickCallDuration: () => void;
  submitOutcome: (pickup: boolean) => void;
  nextLead: () => void;
  updateCurrentLead: (patch: Partial<Lead>) => void;
  setPhase: (phase: "sheet" | "calling" | "outcome" | "done") => void;
}

export const useCallSessionStore = create<CallSessionState>((set, get) => ({
  active: false,
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

  startSession: (queue) =>
    set({
      active: true,
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
    {
      const state = get();
      const currentUser = useAuthStore.getState().currentUser;

      if (state.active && state.sessionStartedAt && currentUser) {
        void createCallSession({
          user_id: currentUser.id,
          started_at: state.sessionStartedAt,
          ended_at: new Date().toISOString(),
          total_duration_seconds: state.totalDurationSeconds,
          calls_made: state.callsMade,
          pickups: state.pickups,
          lead_ids: state.queue.map((lead) => lead.id),
        }).catch((error) => {
          console.error("Failed to save call session", error);
        });
      }

      set({
        active: false,
        queue: [],
        panelOpen: false,
        phase: "sheet",
      });
    },

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

  updateCurrentLead: (patch) =>
    set((s) => {
      const queue = [...s.queue];
      const lead = queue[s.currentIndex];
      if (!lead) return {};
      queue[s.currentIndex] = { ...lead, ...patch };
      return { queue };
    }),

  setPhase: (phase) => set({ phase }),
}));
