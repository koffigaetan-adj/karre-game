export function AnimatedBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-ground">
      {/*
        Les tokens --player-*-soft sont déjà semi-transparents (~16-25% alpha).
        Combinés à mix-blend-multiply sur un fond quasi blanc (--ground clair),
        multiplier une couleur par du blanc la laisse presque inchangée mais à
        très faible opacité effective : le résultat était quasiment invisible
        en clair, alors que le même réglage ressort bien plus sur fond sombre
        (tout écart de luminosité se voit davantage sur un fond sombre).
        On utilise donc les couleurs pleines (fill, opaques) et on pilote la
        seule opacité du calque pour un rendu comparable dans les deux thèmes.
      */}
      {/* Vague 1 */}
      <div className="absolute -left-[20%] -top-[20%] h-[70%] w-[70%] animate-wave-1 rounded-full bg-[var(--player-blue-fill)] opacity-60 blur-[100px] dark:opacity-20" />
      {/* Vague 2 */}
      <div className="absolute -right-[20%] -bottom-[20%] h-[70%] w-[70%] animate-wave-2 rounded-full bg-[var(--player-yellow-fill)] opacity-60 blur-[100px] dark:opacity-20" />
      {/* Vague 3 */}
      <div className="absolute left-[20%] top-[30%] h-[60%] w-[60%] animate-wave-3 rounded-full bg-[var(--player-pink-fill)] opacity-40 blur-[120px] dark:opacity-15" />
      
      {/* Bruit (grain) pour lier le tout */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay dark:opacity-[0.05]" style={{ backgroundImage: "url('/noise.svg')", backgroundRepeat: "repeat" }} />
    </div>
  );
}
