---
target: analyse frontend + parcours client de Karré
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-24T08-31-37Z
slug: web-app-game-roomid-page-tsx
---
Method: dual-agent (A: aaf677c5aa83d90c6 · B: aac1a2dd660aa69ee) — run sequentially rather than concurrently (parent invoked them one after another instead of in the same batch), but fully isolated: B never saw A's output.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | WebSocket disconnect mid-game leaves the board frozen with zero feedback |
| 2 | Match System / Real World | 3 | Permanently-disabled "Passer" button represents a move that doesn't exist in the game's rules |
| 3 | User Control and Freedom | 3 | Forfeit/rematch are solid; no recovery path once a connection silently drops |
| 4 | Consistency and Standards | 2 | Settings toggles use raw `neutral-300/700` gray, violating the "never gray" brand rule; "Kwadra" vs "Karré" naming drift |
| 5 | Error Prevention | 2 | Empty join-code silently no-ops with no message |
| 6 | Recognition Rather Than Recall | 3 | Room code, player list, minimap stay visible during play |
| 7 | Flexibility and Efficiency | 2 | No shortcuts, no remembered preferences, fixed bot pacing |
| 8 | Aesthetic and Minimalist Design | 2 | Coherent system undercut by a dead button, an 8-swatch grid for 2-4 players, and mobile clipping |
| 9 | Error Recovery | 1 | Native `window.alert()` at exactly the moments meant to reassure (start game, copy invite) |
| 10 | Help and Documentation | 2 | In-lobby rules modal is good; nothing equivalent once a game is in progress |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment**: The token system (kraft/walnut palette, ink borders, stacked-cardboard shadows, flat print-ink player colors) is genuinely bespoke — this is not generic Tailwind-default styling. But the single most identity-defining claim in your own product brief — a *diamond-shaped arena* — is not actually built. `KwadraBoard.tsx` renders a plain axis-aligned rectangular grid; there is no 45° rotation transform anywhere in the code, despite a comment in the file itself claiming "pivotée de 45° au rendu," and despite `MiniMap.tsx`'s comment claiming the opposite (that the diamond "comes from the playable cells themselves, not a rotation"). Neither is true — the board is a rectangle. Since the board is what a player looks at for 95% of a session, this is the biggest specificity gap: right now, strip the kraft coloring away and this could be any dots-and-boxes clone.

**Deterministic scan**: `detect.mjs` returned exit code 0, zero findings, against both `web/app` and `web/components`. This is a static source scanner — it caught real things like the token system being clean and gradient-free, but it does **not** catch layout/viewport bugs, missing typefaces, or contrast failures, all of which were found manually. Treat a clean detector run as "no obvious code smells," not "no UX problems."

**Visual overlays**: No script-injection browser tool was available in this pass, so no live `[Human]`-tab overlay was produced. Evidence instead comes from static headless screenshots (see below), which is a weaker signal than a live overlay but still caught two confirmed, reproducible bugs.

## Overall Impression

The *material system* (color, shadow, borders, no-gradient discipline) is the strongest part of this build and is genuinely well-executed — better than most first passes at a themed redesign. But three things undercut it badly enough that a first-time visitor on a phone literally cannot complete signup, and the product's own headline visual idea (the diamond arena) doesn't exist in the shipped code. The biggest opportunity: fix the mobile overflow (it's a one-file, probably one-line-class fix) and either build the rotation or stop promising it — those two alone would move this from "acceptable" to "good."

## What's Working

- **The capture moment** (`KwadraBoard.tsx`): thick ink-stroked tiles, flat player-color fills, ink "rivet" dots at every grid intersection, plus the pop/shake/confetti feedback loop on capture — this is the most game-specific, most alive part of the whole app.
- **The token system** (`globals.css`): kraft/walnut backgrounds, `shadow-stack`/`shadow-stack-sm`/`shadow-stack-pressed`, ink borders — consistently applied across buttons, cards, and modals. Confirmed zero gradients anywhere (`grep -rn "gradient"` returned nothing) — the one hard brand constraint is fully honored.
- **Dark mode** is a real reinterpretation (warm walnut/lamp-lit), not a naive gray inversion — each player color gets distinct light/dark values instead of reusing the same hex.

## Priority Issues

**[P0] Mobile viewport overflow — signup/join is broken on phones**
Why it matters: confirmed independently by both assessments, on both the lobby AND the waiting room, at 390×844. The sign-in button, size selector, "Jouer solo," "Créer (4 joueurs)," "Rejoindre," and (in the waiting room) 2 of the 4 color swatches plus "Lancer la partie" are all clipped past the right edge of the viewport with no wrapping and no visible card border. For a product whose primary audience is friends coordinating casually — very likely opening your invite link on a phone — this blocks the core task entirely on the platform that matters most.
Fix: `w-full max-w-md`/`max-w-sm` containers are overflowing despite their max-width caps — something inside (the `grid-cols-4` color grid, or a non-wrapping heading/button) is forcing intrinsic width past the container. Add `overflow-x-hidden` as an immediate safety net on `body`, then find and fix the actual non-shrinking child.
Suggested command: `$impeccable adapt`

**[P0] The board isn't actually a diamond**
Why it matters: your own product positioning says the diamond arena carries the brand identity equally with real-time multiplayer. The shipped board is a plain rectangle — comments in the code even contradict each other about whether a rotation exists. This is the biggest gap between what the product claims to be and what it visibly is.
Fix: either implement the rotation (or the Manhattan-distance diamond-shape approach already used elsewhere in this project's history) on `KwadraBoard.tsx`, or rewrite the comments/positioning copy to stop promising a shape that isn't there.
Suggested command: `$impeccable overdrive` (board is the signature component; this deserves a real push, not a patch)

**[P1] Native `window.alert()` breaks the crafted feel at reassurance-critical moments**
Why it matters: used for game-start validation and invite-copy confirmation — exactly the moments meant to feel like part of a designed game. A blocking OS dialog box reads as an unfinished dev leftover and breaks immersion right when it matters most.
Fix: replace with an inline toast/banner styled consistently with the existing modal system.
Suggested command: `$impeccable polish`

**[P1] Silent WebSocket disconnect mid-game**
Why it matters: `ws.onclose` only flips a `connected` boolean nothing reads; no banner, no reconnect. A normal WiFi blip leaves a player staring at a frozen board with zero explanation — corrosive to trust in a product whose whole pitch is "it just works for a casual game with friends."
Fix: surface a status banner in `GameView` when `connected` is false during active play; add basic reconnect-with-backoff.
Suggested command: `$impeccable harden`

**[P2] Feature drift from the design system on recently bolted-on UI**
Why it matters: settings toggles (`ProfileMenu.tsx`) use literal `bg-neutral-300 dark:bg-neutral-700` — a direct, checkable violation of the documented "never neutral gray" rule. This is exactly the kind of incremental drift that happens when features get added in separate sessions without checking DESIGN.md.
Fix: swap to the existing `--line`/`--ink` tokens.
Suggested command: `$impeccable audit` (to catch the rest of this drift systematically, not just this one instance)

## Persona Red Flags

**Casey (Mobile)**: The two most important CTAs for a first-time mobile visitor — "Se connecter" and "Rejoindre" — are the ones cut off-screen. Confirmed via pixel-crop analysis on real screenshots, not a guess.

**Sam (Accessibility)**: Several player-color/text pairs fail WCAG AA 4.5:1 for normal text: light-mode orange-on-white (4.23:1), and dark-mode orange (3.41), cyan (3.63), green (3.74), and pink (4.14) all fail against white text. These exact pairs are used for score badges, sidebar avatars, and captured-box initials — real gameplay-critical text, not decoration. Players are also distinguished by color alone with no shape/pattern redundancy.

**Riley (Stress Tester)**: A dropped connection mid-game produces total silence (no banner, no retry) combined with UI-thread-blocking `alert()` calls elsewhere — an already-stressed player gets no reassurance signal anywhere in the failure path.

## Minor Observations

- Only one typeface is actually loaded (`Poppins`, via `next/font/google` in `layout.tsx`) — `tailwind.config.ts` maps both `font-display` and `font-body` to the same `--font-poppins` variable. DESIGN.md's documented two-voice system (a condensed display face + a separate body face) does not exist in the running app; this was found independently by both assessments.
- WhatsApp share button hardcodes brand green `#25D366`, which visually clashes with the flatter, desaturated pine-green player color used right next to it.
- `PlayerSidebar.tsx` ships a permanently-disabled "Passer" (Skip) button with no tooltip — always visible, never usable, represents a move dots-and-boxes doesn't have.
- App metadata/titles say "Kwadra" everywhere, inconsistent with the "Karré" brand name.
- Confetti always originates from a fixed screen point rather than the captured box's actual position, so the celebration feels disconnected from the specific board event on wider desktop layouts.
- Dark mode could not be directly screenshotted in this pass (gated behind a logged-in session) — its visuals beyond the raw CSS token values are unverified.

## Questions to Consider

- If the diamond arena isn't actually rendered, what's left that a competitor's dots-and-boxes clone couldn't ship in a weekend?
- Every incremental feature (chat, history, emoji avatars, music) was added by a different session without checking DESIGN.md — what would catch a stray `neutral-300` gray or a native `alert()` before it ships, rather than in a retrospective review like this one?
- The color picker shows 8 swatches for a game that only ever seats 2-4 — was that sized for a future feature, or just never revisited after the palette grew?
