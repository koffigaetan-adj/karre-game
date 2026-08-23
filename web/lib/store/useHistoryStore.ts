import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MatchRecord {
  id: string; // roomId
  date: string; // ISO string
  mode: "solo" | "multiplayer";
  players: {
    id: string;
    displayName: string;
    score: number;
    initials: string;
    isWinner: boolean;
  }[];
  isDraw: boolean;
}

interface HistoryState {
  matches: MatchRecord[];
  addMatch: (match: MatchRecord) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      matches: [],
      addMatch: (match) =>
        set((state) => {
          // Éviter d'ajouter la même partie deux fois (si rechargement rapide de page)
          if (state.matches.some((m) => m.id === match.id)) return state;
          // Garder les 50 dernières parties
          return { matches: [match, ...state.matches].slice(0, 50) };
        }),
      clearHistory: () => set({ matches: [] }),
    }),
    {
      name: "karre-history",
    }
  )
);
