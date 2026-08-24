import type { StateStorage } from "zustand/middleware";

/**
 * Wrapper autour de localStorage qui avale les erreurs au lieu de planter
 * toute l'application. Certains navigateurs intégrés (WhatsApp, Instagram,
 * Facebook sur iOS) bloquent l'accès à localStorage — sans ce garde-fou, le
 * premier appel de Zustand (persist) faisait crasher l'app entière dès le
 * chargement, avant même le premier rendu.
 */
export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Stockage indisponible : la préférence ne sera pas mémorisée pour
      // cette session, mais l'app continue de fonctionner normalement.
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};
