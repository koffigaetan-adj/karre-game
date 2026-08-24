export function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-ground">
      {/* Vague 1 */}
      <div className="absolute -left-[20%] -top-[20%] h-[70%] w-[70%] animate-wave-1 rounded-full bg-[var(--player-blue-soft)] opacity-60 mix-blend-multiply blur-[100px] dark:opacity-20" />
      {/* Vague 2 */}
      <div className="absolute -right-[20%] -bottom-[20%] h-[70%] w-[70%] animate-wave-2 rounded-full bg-[var(--player-yellow-soft)] opacity-60 mix-blend-multiply blur-[100px] dark:opacity-20" />
      {/* Vague 3 */}
      <div className="absolute left-[20%] top-[30%] h-[60%] w-[60%] animate-wave-3 rounded-full bg-[var(--player-pink-soft)] opacity-40 mix-blend-multiply blur-[120px] dark:opacity-15" />
      
      {/* Bruit (grain) pour lier le tout */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay dark:opacity-[0.06]" style={{ backgroundImage: "url('/noise.svg')", backgroundRepeat: "repeat" }} />
    </div>
  );
}
