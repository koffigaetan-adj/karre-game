"use client";

/**
 * Clic de bouton + musique d'ambiance, tous deux synthétisés via Web Audio
 * (pas de fichier distant à héberger). Les précédentes URLs
 * (actions.google.com/sounds/v1/...) renvoient un 404 — le catalogue de
 * démo de Google a été retiré — donc les sons ne jouaient jamais, en
 * silence puisque .play() rejette sans lever d'erreur visible.
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

function resumeIfNeeded(ctx: AudioContext, thenFn: () => void) {
  if (ctx.state === "suspended") {
    ctx.resume().then(thenFn).catch(() => {});
  } else {
    thenFn();
  }
}

/** Débloque le contexte audio partagé (musique + clic + capture) depuis un vrai geste utilisateur. */
export function primeAudio() {
  const ctx = ensureContext();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/** Petit arpège montant, joué quand un joueur capture une case. */
export function playCapture(enabled: boolean) {
  if (!enabled) return;
  const ctx = ensureContext();
  if (!ctx) return;
  resumeIfNeeded(ctx, () => {
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // Do5, Mi5, Sol5
    notes.forEach((freq, i) => {
      const start = now + i * 0.06;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.16, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  });
}

export function playClick(enabled: boolean) {
  if (!enabled) return;
  const ctx = ensureContext();
  if (!ctx) return;
  resumeIfNeeded(ctx, () => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(720, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  });
}

export function playChatNotification(enabled: boolean) {
  if (!enabled) return;
  const ctx = ensureContext();
  if (!ctx) return;
  resumeIfNeeded(ctx, () => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.1, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  });
}

// --- Musique d'ambiance : nappe douce à 3 voix + LFO lent, tout Web Audio ---

interface MusicGraph {
  master: GainNode;
  filter: BiquadFilterNode;
  lfo: OscillatorNode;
  voices: OscillatorNode[];
}

let musicGraph: MusicGraph | null = null;

// Accord calme (fondamentale + quinte + octave) — évoque une nappe de fond,
// pas une mélodie qui se répète de façon reconnaissable.
const CHORD_HZ = [110, 164.81, 220]; // A2, E3, A3

function buildMusicGraph(ctx: AudioContext): MusicGraph {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 650;
  filter.connect(master);

  const voices = CHORD_HZ.map((freq) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.05;
    osc.connect(voiceGain);
    voiceGain.connect(filter);
    osc.start();
    return osc;
  });

  // LFO lent qui fait "respirer" le filtre pour éviter une nappe figée.
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.08;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 220;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  return { master, filter, lfo, voices };
}

// Volume bas : une nappe de fond doit rester discrète, jamais couvrir les
// sons de jeu (clic, capture) ni gêner une conversation à côté.
const MUSIC_VOLUME = 0.16;

export function playMusic(enabled: boolean) {
  if (!enabled) return;
  const ctx = ensureContext();
  if (!ctx) return;
  resumeIfNeeded(ctx, () => {
    if (!musicGraph) musicGraph = buildMusicGraph(ctx);
    musicGraph.master.gain.cancelScheduledValues(ctx.currentTime);
    musicGraph.master.gain.linearRampToValueAtTime(MUSIC_VOLUME, ctx.currentTime + 1.8);
  });
}

export function stopMusic() {
  if (!musicGraph || !audioCtx) return;
  const ctx = audioCtx;
  const graph = musicGraph;
  graph.master.gain.cancelScheduledValues(ctx.currentTime);
  graph.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
  // Démonte le graphe une fois le fondu terminé, pour ne pas laisser tourner
  // des oscillateurs indéfiniment entre deux parties.
  setTimeout(() => {
    if (musicGraph !== graph) return;
    graph.voices.forEach((v) => {
      try {
        v.stop();
      } catch {
        /* déjà arrêté */
      }
    });
    try {
      graph.lfo.stop();
    } catch {
      /* déjà arrêté */
    }
    musicGraph = null;
  }, 450);
}

/** speed > 1 accélère légèrement le LFO et détend un peu les voix (fin de partie proche). */
export function setMusicSpeed(speed: number) {
  if (!musicGraph || !audioCtx) return;
  const ctx = audioCtx;
  musicGraph.lfo.frequency.linearRampToValueAtTime(0.08 * speed, ctx.currentTime + 0.5);
  musicGraph.voices.forEach((osc, i) => {
    osc.detune.linearRampToValueAtTime((speed - 1) * 15 * (i + 1), ctx.currentTime + 0.5);
  });
}
