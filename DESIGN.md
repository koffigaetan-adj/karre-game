---
name: Karré
description: A private multiplayer arena game, dressed as a real cardboard board game on a lamp-lit table
colors:
  ink: "#2B2320"
  kraft-ground: "#EDE4D3"
  kraft-surface: "#F7F1E4"
  kraft-line: "#8A7860"
  ink-dark: "#F0E6D2"
  walnut-ground: "#231A14"
  walnut-surface: "#2E2119"
  walnut-line: "#4A392C"
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

Karré is redesigned as a real cardboard board game unboxed on a lamp-lit table between friends — not a web dashboard with a game bolted on. The current UI (dark neutral-900 cards, blue-600 buttons, rounded-2xl everything) is the rejected form: generic SaaS chrome. It is replaced wholesale, not polished.

Every surface reads as printed cardstock: warm kraft tone, thick ink-black rules instead of hairline borders, flat "print ink" player colors instead of saturated web accents, and depth conveyed as physical stacked-cardboard thickness rather than soft ambient glow. No gradients anywhere — kraft, ink, and flat spot color only, which is also how real board-game print production actually works, so the constraint is native to the world, not a limitation fought against.

Light mode is the game unboxed in daylight (warm cream kraft). Dark mode is the same table after dark, lamp-lit (deep walnut wood-grain, warm parchment ink) — never a cold slate dashboard dark mode. Both are first-class; neither is the "real" one.

**Key Characteristics:**
- Warm kraft/walnut ground, never neutral gray or near-black slate.
- Thick 2px ink borders stand in for hairlines everywhere.
- Flat print-ink player colors (cobalt, brick red, pine green, ochre), never web-saturated primary blue/red/green/yellow.
- Depth = small tight offset shadow (stacked cardboard), never wide ambient blur.
- Anton display type for scores, wordmark, and headers; Karla for everything else. No third face.

## Colors

Flat, printed-cardstock character throughout — every color is a spot ink, never a gradient or tint-blend.

### Primary
- **Ink Blue** (`#1E5AA8` light / `#4A85D6` dark): Player 1's color and the default interactive accent (primary buttons, links, focus).

### Secondary
- **Brick Red** (`#C23B2E` light / `#E06B5C` dark): Player 2's color.
- **Pine Green** (`#2F7D4F` light / `#4FA873` dark): Player 3's color.
- **Ochre Yellow** (`#C68A1E` light / `#E8BC5C` dark): Player 4's color.

### Neutral
- **Kraft Ground** (`#EDE4D3` light / `#231A14` dark — "Walnut Ground"): Page background.
- **Kraft Surface** (`#F7F1E4` light / `#2E2119` dark — "Walnut Surface"): Cards, panels, the board's backing.
- **Ink** (`#2B2320` light / `#F0E6D2` dark): All text and line work. Warm near-black / warm parchment — never pure black/white, never cool gray.
- **Kraft Line** (`#8A7860` light / `#4A392C` dark — "Walnut Line"): Secondary dividers and the undrawn-edge hint on the board.

### Named Rules
**The Spot-Ink Rule.** Every color is a flat fill or flat stroke. No gradient, no glow, no glassy translucency standing in for one.

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

No blurred ambient shadows and no glass/blur panels. Depth is a small, tight "stacked cardboard" offset shadow: 3px x/y offset, 3px blur, ink color at 20% opacity — reads as one card resting on another, not a glow. Interactive elements (buttons, the active player row) lift on this shadow at rest and compress toward zero-offset on press, like a physical token being pushed down.

### Shadow Vocabulary
- **stack** (`box-shadow: 3px 3px 0 0 rgba(43,35,32,0.2)`): Resting depth on buttons, the active-turn player row, and popped-in captured tiles.
- **stack-pressed** (`box-shadow: 1px 1px 0 0 rgba(43,35,32,0.2)`, translate 2px,2px): Active/pressed button state.

### Named Rules
**The One Shadow Rule.** Exactly one shadow recipe exists in the whole system. It never widens, blurs further, or gains color.

## Shapes

12px radius on cards, panels, and buttons (8px on small chips/tags) — a soft-cut cardboard corner, not an app-rounded pill. Every surface carries a 2px solid ink border; borders are the primary form language, not shadows.

## Components

### Buttons
- **Shape:** 12px radius, 2px ink border.
- **Primary:** flat ink-blue fill, white text, `stack` shadow at rest, `stack-pressed` on press/active.
- **Secondary/Ghost:** kraft-surface fill, ink border and text, same press behavior.

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** kraft-surface (walnut-surface in dark).
- **Border:** 2px solid ink at low opacity (kraft-line color), full ink border on the actively-focused card (e.g. current player row).
- **Shadow Strategy:** `stack` only where the card is interactive or currently active; static display cards stay flat (border does the work).

### Board (signature component)
Rendered as a kraft-cardstock surface (flat kraft-surface fill, no texture filter). Grid points are small ink "rivet" dots. Undrawn edges are thin kraft-line dashes; drawn edges are thick flat player-color ink strokes with rounded caps. Captured boxes are flat player-color tiles with a thin ink border and Anton-set initials stamped in the tile. Corner seat markers are small disc "tokens" with a thick ink ring, resting just outside the board like a physical piece — not soft glowing badges.

## Do's and Don'ts

### Do:
- **Do** use flat player-ink colors everywhere a player is represented (edges, tiles, badges, corner tokens).
- **Do** keep every border 2px solid ink; treat 1px hairlines as a rejected default.
- **Do** use Anton for anything numeric or titled, Karla for everything else.
- **Do** keep dark mode warm (walnut/parchment), never a cool slate near-black.

### Don't:
- **Don't** use any gradient, anywhere, for any purpose (explicit user constraint).
- **Don't** use soft blurred ambient shadows, glass panels, or `backdrop-blur`.
- **Don't** use the generic neutral-900/blue-600 SaaS palette this replaces.
- **Don't** add a third typeface or a monospace face for "technical" flavor.
- **Don't** use rounded-full pill shapes outside small chips/avatars.
