# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small private groups of friends (2-4 people) who already know each other, playing together casually over a shared link or room code — not strangers matched online, no public discovery. Sessions are short, social, informal.

## Product Purpose

Karré is a real-time multiplayer strategy game: a dots-and-boxes variant played on a diamond-shaped arena. Players take turns drawing one edge of the grid; completing the 4th edge of a square captures it (and can capture two squares at once when one line closes both), and a capture grants an extra turn. Most squares captured when the grid is full wins. Includes a solo mode against a local rule-based bot (no LLM).

## Positioning

Two things carry the identity equally: the diamond arena board itself (a rotated grid with each player's "home" corner marked, giving it an arena/territory feel a plain square dots-and-boxes board doesn't have), and real-time multiplayer that feels immediate and fluid (moves, captures, and turn changes sync live with no perceptible lag or refresh). Neither is secondary to the other.

## Operating Context

- Next.js (App Router) + Tailwind frontend, inline SVG board.
- Google sign-in via Auth.js.
- FastAPI + WebSocket backend is the multiplayer source of truth (server validates every move).
- Rooms for 2 or 4 players via invite code, plus a solo mode vs. a local bot.
- Played on both desktop and phones; the board already supports touch pan/zoom.

## Capabilities and Constraints

- Board is a square dots-and-boxes grid rendered rotated 45° for the diamond look; per-player corner markers show whose "side" is whose.
- Player color system currently: blue/red/green/yellow (extendable).
- Must work fully in both light and dark themes — not just a dark-mode default with light as an afterthought.

## Brand Commitments

- Name: Karré.
- No gradients, anywhere in the UI — explicit, firm constraint from the user.
- Casual/for-friends tone: this is a private game among people who know each other, not a public/enterprise product — the UI should feel like a game, not a dashboard or admin tool.

## Evidence on Hand

None yet — pre-launch, no real screenshots, player data, or brand assets exist. Nothing here should be fabricated as evidence of usage or scale.

## Product Principles

1. Feel like a game first, a web app second — the current UI reads as a flat dashboard, which the user explicitly rejected.
2. The diamond arena and per-player corners are the visual signature; the redesign should make that shape unmistakable, not incidental.
3. Real-time feedback (captures, turns, opponent moves) should feel alive and immediate, not like a form submission.
4. Casual/social register throughout — playful, not corporate; no gradients as the one hard visual rule.
5. Equal quality in light and dark themes.
