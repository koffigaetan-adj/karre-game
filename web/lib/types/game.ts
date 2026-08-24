/**
 * Schéma de données du state de la partie "Karré".
 *
 * La grille logique reste un plateau rectangulaire classique (dots-and-boxes) :
 * `rows` x `cols` cases, (rows+1) x cols bordures horizontales, rows x (cols+1)
 * bordures verticales. L'aspect "losange/arène" est purement visuel : le
 * <KwadraBoard> fait pivoter le rendu SVG de 45°. Garder la logique sur une
 * grille carrée simplifie énormément la détection de capture et le
 * multijoueur (pas de coordonnées spéciales à synchroniser).
 */

export type EdgeType = "h" | "v";

export type PlayerColor = "blue" | "red" | "green" | "yellow" | "purple" | "orange" | "cyan" | "pink";

export type GameStatus = "waiting" | "playing" | "finished";

export type GameMode = "solo" | "multiplayer";

export type BoardSize = "small" | "medium" | "large" | "giant";

export interface Player {
  id: string;
  displayName: string;
  /** Initiales calculées depuis le nom Google (ex: "Ada Perez" -> "AP") */
  initials: string;
  color: PlayerColor | null;
  avatarUrl?: string | null;
  score: number;
  isAI?: boolean;
  aiDifficulty?: "easy" | "medium";
  connected: boolean;
}

export interface Move {
  type: EdgeType;
  row: number;
  col: number;
  playerId: string;
}

export interface ChatMessage {
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
}

export interface GameState {
  roomId: string;
  mode: GameMode;
  size: BoardSize;
  maxPlayers: number;
  /** Nombre de cases en hauteur / largeur (grille logique, avant rotation visuelle) */
  rows: number;
  cols: number;
  players: Player[];
  currentPlayerIndex: number;
  /** (rows+1) x cols — valeur = id du joueur propriétaire du trait, ou null */
  horizontalEdges: (string | null)[][];
  /** rows x (cols+1) */
  verticalEdges: (string | null)[][];
  /** rows x cols — id du joueur propriétaire de la case, ou null */
  boxes: (string | null)[][];
  status: GameStatus;
  winnerId: string | null;
  /** Distingue une victoire "normale" (plateau rempli) d'une partie stoppée
   * par un abandon — l'historique ne doit pas afficher un abandon comme une
   * vraie victoire/défaite. */
  endReason?: "completed" | "forfeit" | null;
  forfeitedBy?: string | null;
  lastMove: Move | null;
  createdAt: string;
  /** Horodatage du passage à "playing" ; sert de base au chrono de partie. */
  startedAt: string | null;
  messages: ChatMessage[];
}

export interface ColorTheme {
  fill: string;
  ring: string;
  text: string;
  soft: string;
}

export const PLAYER_COLORS: Record<PlayerColor, { light: ColorTheme; dark: ColorTheme }> = {
  blue: {
    light: { fill: "var(--player-blue-fill)", ring: "var(--player-blue-ring)", text: "var(--player-blue-text)", soft: "var(--player-blue-soft)" },
    dark: { fill: "var(--player-blue-fill)", ring: "var(--player-blue-ring)", text: "var(--player-blue-text)", soft: "var(--player-blue-soft)" },
  },
  red: {
    light: { fill: "var(--player-red-fill)", ring: "var(--player-red-ring)", text: "var(--player-red-text)", soft: "var(--player-red-soft)" },
    dark: { fill: "var(--player-red-fill)", ring: "var(--player-red-ring)", text: "var(--player-red-text)", soft: "var(--player-red-soft)" },
  },
  green: {
    light: { fill: "var(--player-green-fill)", ring: "var(--player-green-ring)", text: "var(--player-green-text)", soft: "var(--player-green-soft)" },
    dark: { fill: "var(--player-green-fill)", ring: "var(--player-green-ring)", text: "var(--player-green-text)", soft: "var(--player-green-soft)" },
  },
  yellow: {
    light: { fill: "var(--player-yellow-fill)", ring: "var(--player-yellow-ring)", text: "var(--player-yellow-text)", soft: "var(--player-yellow-soft)" },
    dark: { fill: "var(--player-yellow-fill)", ring: "var(--player-yellow-ring)", text: "var(--player-yellow-text)", soft: "var(--player-yellow-soft)" },
  },
  purple: {
    light: { fill: "var(--player-purple-fill)", ring: "var(--player-purple-ring)", text: "var(--player-purple-text)", soft: "var(--player-purple-soft)" },
    dark: { fill: "var(--player-purple-fill)", ring: "var(--player-purple-ring)", text: "var(--player-purple-text)", soft: "var(--player-purple-soft)" },
  },
  orange: {
    light: { fill: "var(--player-orange-fill)", ring: "var(--player-orange-ring)", text: "var(--player-orange-text)", soft: "var(--player-orange-soft)" },
    dark: { fill: "var(--player-orange-fill)", ring: "var(--player-orange-ring)", text: "var(--player-orange-text)", soft: "var(--player-orange-soft)" },
  },
  cyan: {
    light: { fill: "var(--player-cyan-fill)", ring: "var(--player-cyan-ring)", text: "var(--player-cyan-text)", soft: "var(--player-cyan-soft)" },
    dark: { fill: "var(--player-cyan-fill)", ring: "var(--player-cyan-ring)", text: "var(--player-cyan-text)", soft: "var(--player-cyan-soft)" },
  },
  pink: {
    light: { fill: "var(--player-pink-fill)", ring: "var(--player-pink-ring)", text: "var(--player-pink-text)", soft: "var(--player-pink-soft)" },
    dark: { fill: "var(--player-pink-fill)", ring: "var(--player-pink-ring)", text: "var(--player-pink-text)", soft: "var(--player-pink-soft)" },
  },
};

export const PLAYER_COLOR_ORDER: PlayerColor[] = ["blue", "red", "green", "yellow", "purple", "orange", "cyan", "pink"];

/**
 * Valeur spéciale pour les bordures du pourtour de l'arène : pré-tracées dès
 * la création de la partie, non attribuables à un joueur, non cliquables.
 */
export const WALL_EDGE = "WALL";

/** Calcule des initiales (2 lettres) à partir d'un nom complet Google. */
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
