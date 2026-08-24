import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeStorage } from "./safeStorage";

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
      name: "Kwadra-settings",
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
