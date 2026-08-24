---
name: Karré
description: A private multiplayer arena game, styled as a physical board game on a plain neutral light/dark surface
colors:
  ink: "#1A1C1F"
  ground: "#F2F3F5"
  surface: "#FFFFFF"
  line: "#C7CBD1"
  ink-dark: "#F1F2F4"
  ground-dark: "#16181B"
  surface-dark: "#202226"
  line-dark: "#3A3D43"
  ink-blue: "#1E5AA8"
  ink-red: "#C23B2E"
  ink-green: "#2F7D4F"
  ink-yellow: "#C68A1E"
typography:
  display:
    fontFamily: "Anton, Impact, sans-serif"
    fontSize: "clamp(2rem, 6vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "0.01em"
  body:
    fontFamily: "Karla, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "12px"
components:
  button-primary:
    backgroundColor: "{colors.ink-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "12px 20px"
---

# Design System: Karré

## Overview

**Creative North Star: "Kraft & Counters"**

Karré reads as a real board game unboxed on the table between friends — not a web dashboard with a game bolted on. Light and dark are both plain, familiar app themes (true neutral white/black-gray, the "basic" light/dark everyone already knows) — the game's character comes from the player colors, the ink borders, and the flat stacked-cardboard shadows, not from a tinted background. Nothing is generic SaaS chrome (no soft ambient glows, no glassy cards, no default framework blue), but nothing is costume-y either.

No gradients anywhere — flat ink and flat spot color only.

Light mode is a plain, bright neutral surface. Dark mode is a plain, near-black neutral surface. Both are first-class; neither is the "real" one — and neither is warmed or tinted toward a material (no kraft-paper cream, no walnut-wood brown).

**Key Characteristics:**
- Neutral ground and surface — off-white in light, near-black in dark — never warm-tinted.
- Thin-but-present ink borders (1.5px on controls/dividers, 2px on major cards) stand in for hairlines everywhere — present and deliberate, but light, not bulky.
- Flat "print ink" player colors (cobalt, brick red, pine green, ochre…) are the only saturated color in the UI — they read as accents against a neutral field, never web-saturated primary blue/red/green/yellow used loosely elsewhere.
- Depth = small tight offset shadow (stacked cardboard), lighter and closer than a generic card shadow, never wide ambient blur.
- Anton display type for scores, wordmark, and headers; Karla for everything else. No third face.

## Colors

Flat, printed character throughout — every color is a spot ink, never a gradient or tint-blend. The neutral scale carries no material tint; only player colors are saturated.

### Primary
- **Ink Blue** (`#1E5AA8` light / `#4A85D6` dark): Player 1's color and the default interactive accent (primary buttons, links, focus).

### Secondary
- **Brick Red** (`#C23B2E` light / `#E06B5C` dark): Player 2's color.
- **Pine Green** (`#2F7D4F` light / `#4FA873` dark): Player 3's color.
- **Ochre Yellow** (`#C68A1E` light / `#E8BC5C` dark): Player 4's color.

### Neutral
- **Ground** (`#F2F3F5` light / `#16181B` dark): Page background. Plain neutral gray-white / near-black — not tinted.
- **Surface** (`#FFFFFF` light / `#202226` dark): Cards, panels, the board's backing.
- **Ink** (`#1A1C1F` light / `#F1F2F4` dark): All text and line work. Near-black / near-white — never a warm or cool tint.
- **Line** (`#C7CBD1` light / `#3A3D43` dark): Secondary dividers and the undrawn-edge hint on the board.

### Named Rules
**The Spot-Ink Rule.** Every color is a flat fill or flat stroke. No gradient, no glow, no glassy translucency standing in for one. The neutral scale (ground/surface/ink/line) never carries a hue — only player colors are saturated.

## Typography

**Display Font:** Anton (with Impact, sans-serif fallback)
**Body Font:** Karla (with system-ui, sans-serif fallback)

**Character:** Anton is the box-lid title face — tall, condensed, ink-stamped confidence for the wordmark, scores, and player initials. Karla is the rulebook-instruction face underneath it: warm, humanist, easy at small sizes. Exactly two faces; no mono third face.

### Hierarchy
- **Display** (400, clamp(2rem, 6vw, 3.5rem), 0.95 line-height): Wordmark, score numerals, winner banner.
- **Headline** (400, 1.5rem, 1.1): Section titles ("Joueurs", room name).
- **Title** (700, 1rem, 1.3): Player names, button labels.
- **Body** (500, 1rem, 1.5): Turn status, helper copy.
- **Label** (700, 0.75rem, 1.2, uppercase, 0.04em tracking): Field labels, small status tags.

### Named Rules
**The Two-Face Rule.** Anton carries every number and title; Karla carries every sentence. Nothing else is introduced for "technical" flavor.

## Layout

Board-first composition: the arena is the largest element on screen at every breakpoint, with player info as a companion panel (sidebar on desktop ≥1024px, a bottom sheet-style strip on mobile) rather than a peer-sized card. Generous single-column stacking on mobile; the lobby is a single centered "box lid" panel, not a dashboard grid.

## Elevation & Depth

No blurred ambient shadows and no glass/blur panels. Depth is a small, tight "stacked cardboard" offset shadow: 2px x/y offset, 0 blur, ink color at ~14% opacity — reads as one card resting on another, not a glow, and stays light rather than bulky. Interactive elements (buttons, the active player row) lift on this shadow at rest and compress toward zero-offset on press, like a physical token being pushed down.

### Shadow Vocabulary
- **stack** (`box-shadow: 2px 2px 0 0 var(--shadow-ink)`): Resting depth on buttons, the active-turn player row, and popped-in captured tiles.
- **stack-sm** (`box-shadow: 1.5px 1.5px 0 0 var(--shadow-ink)`): Smaller controls (icon buttons, badges).
- **stack-pressed** (`box-shadow: 0.5px 0.5px 0 0 var(--shadow-ink)`, translate 1px,1px): Active/pressed button state.

### Named Rules
**The One Shadow Rule.** Exactly one shadow recipe exists in the whole system. It never widens, blurs further, or gains color.

## Shapes

12px radius on cards, panels, and buttons (8px on small chips/tags) — a soft-cut cardboard corner, not an app-rounded pill. Borders are the primary form language, not shadows, but they stay light: 1.5px solid ink on buttons, inputs, chips and dividers; 2px solid ink on major cards and modals (lobby card, waiting-room panel, board frame). Treat anything thicker than 2px as a rejected default — the "cardboard" character comes from the border being *present and consistent*, not from its weight.

## Components

### Buttons
- **Shape:** 12px radius, 1.5px ink border.
- **Primary:** flat ink-blue fill, white text, `stack` shadow at rest, `stack-pressed` on press/active.
- **Secondary/Ghost:** surface fill, ink border and text, same press behavior.

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** surface (white in light, near-black surface in dark).
- **Border:** 2px solid ink on major cards/modals, 1.5px on secondary containers; full ink border on the actively-focused card (e.g. current player row).
- **Shadow Strategy:** `stack` only where the card is interactive or currently active; static display cards stay flat (border does the work).

### Board (signature component)
Rendered as a flat surface-color backing, no texture filter. Grid points are small ink "rivet" dots. Undrawn edges are thin line-color dashes; drawn edges are thick flat player-color ink strokes with rounded caps. Captured boxes are flat player-color tiles with a thin (1.25px) ink border and Anton-set initials stamped in the tile — thin enough that the fill color, not the outline, reads first. Corner seat markers are small disc "tokens" with a 1.5px ink ring, resting just outside the board like a physical piece — not soft glowing badges.

## Do's and Don'ts

### Do:
- **Do** use flat player-ink colors everywhere a player is represented (edges, tiles, badges, corner tokens) — they are the only saturated color in the UI.
- **Do** keep borders light and consistent: 1.5px on controls/dividers, 2px on major cards; treat anything thicker as a rejected default.
- **Do** use Anton for anything numeric or titled, Karla for everything else.
- **Do** keep light and dark both plain and neutral — no warm or cool tint on ground/surface/ink/line.

### Don't:
- **Don't** use any gradient, anywhere, for any purpose (explicit user constraint).
- **Don't** use soft blurred ambient shadows, glass panels, or `backdrop-blur`.
- **Don't** tint the neutral scale toward a material (no kraft-paper cream, no walnut-wood brown) — plain neutral only.
- **Don't** hardcode a Tailwind default color (`bg-blue-600`, `text-gray-500`, …) where a design token exists — always go through `var(--player-*)`, `ink`, `line`, `ground`, `surface`.
- **Don't** add a third typeface or a monospace face for "technical" flavor.
- **Don't** use rounded-full pill shapes outside small chips/avatars.
