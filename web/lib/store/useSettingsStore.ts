import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  customInitials: string | null;
  setMusicEnabled: (enabled: boolean) => void;
  setSfxEnabled: (enabled: boolean) => void;
  setCustomInitials: (initials: string | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      musicEnabled: true,
      sfxEnabled: true,
      customInitials: null,
      setMusicEnabled: (enabled) => set({ musicEnabled: enabled }),
      setSfxEnabled: (enabled) => set({ sfxEnabled: enabled }),
      setCustomInitials: (initials) => set({ customInitials: initials }),
    }),
    {
      name: "karre-settings",
    }
  )
);
