"use client";

// URLs de sons libres de droits (placeholders)
const CLICK_SOUND_URL = "https://actions.google.com/sounds/v1/ui/button_click.ogg";
const MUSIC_URL = "https://actions.google.com/sounds/v1/water/water_flowing.ogg"; // Placeholder apaisant

let clickAudio: HTMLAudioElement | null = null;
let musicAudio: HTMLAudioElement | null = null;

if (typeof window !== "undefined") {
  clickAudio = new Audio(CLICK_SOUND_URL);
  clickAudio.volume = 0.5;
  
  musicAudio = new Audio(MUSIC_URL);
  musicAudio.volume = 0.2;
  musicAudio.loop = true;
}

export function playClick(enabled: boolean) {
  if (!enabled || !clickAudio) return;
  // Clone pour permettre des clics rapides
  const clone = clickAudio.cloneNode() as HTMLAudioElement;
  clone.volume = 0.5;
  clone.play().catch(() => {});
}

export function playMusic(enabled: boolean) {
  if (!musicAudio) return;
  if (enabled) {
    if (musicAudio.paused) {
      musicAudio.play().catch(() => {});
    }
  } else {
    musicAudio.pause();
  }
}

export function stopMusic() {
  if (!musicAudio) return;
  musicAudio.pause();
  musicAudio.currentTime = 0;
}
