"use client";

/**
 * Petits sons synthétisés (Web Audio), pas de fichier à héberger.
 * Le "thunk" descendant évoque un pion/jeton posé sur le plateau,
 * cohérent avec l'identité "Kraft & Counters" du plateau.
 *
 * Les navigateurs suspendent l'AudioContext tant qu'aucun geste utilisateur
 * n'a eu lieu, et resume() est asynchrone : si on planifie le son avant que
 * le contexte soit réellement "running", certains navigateurs le laissent
 * passer silencieusement. On attend donc resume() avant de jouer, et on
 * "amorce" le contexte dès le premier clic réel sur le plateau (bien avant
 * qu'une capture par l'IA — sans geste utilisateur — n'en ait besoin).
 */

let audioCtx: AudioContext | null = null;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioCtx) audioCtx = new AudioContextCtor();
    return audioCtx;
  } catch {
    return null;
  }
}

/** À appeler depuis un vrai gestionnaire de clic pour débloquer l'audio le plus tôt possible. */
export function primeAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

function scheduleThunk(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.18);
}

export function playCaptureSound() {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().then(() => scheduleThunk(ctx)).catch(() => {});
    return;
  }
  scheduleThunk(ctx);
}
