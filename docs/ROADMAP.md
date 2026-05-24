# Blackjack Overlay Roadmap

## Goal

Build a local desktop blackjack helper that starts with a reliable manual basic-strategy assistant and evolves toward a small always-on-top overlay that can read cards from the screen.

## Version 0.1 — Working manual helper

- Keep manual card entry as the dependable fallback.
- Show a clear next-move recommendation: Hit, Stand, Double, Split, Surrender.
- Support common rule toggles: H17/S17, double-after-split, surrender, deck count.
- Keep history and chart view for confidence/testing.
- Add an overlay-style mode that hides the browser pane and keeps the recommendation/card controls compact.

## Version 0.2 — Better table setup

- Add saved rule/table profiles for different blackjack websites.
- Add quicker keyboard input for cards.
- Make overlay mode draggable/resizable and easier to position over another browser window.
- Rename packaging/product metadata from the old Desktop Companion name to Blackjack Overlay.

## Version 0.3 — Screen-reading foundation

- Add a setup flow where the user marks screen regions for player cards and dealer up-card.
- Save region presets per website/table layout.
- Capture screenshots locally only; do not inject scripts into the game page.
- Keep manual correction available at all times.

## Version 0.4 — Card detection experiments

- Try template matching first for visible card ranks/suits.
- Try OCR for sites that show readable rank text.
- Add confidence scores and require manual confirmation when confidence is low.

## Scope boundaries

- Advice-only: the app should recommend a move, not click buttons or automate gameplay.
- Local-first: no backend is required for the core helper.
- Basic strategy only: no card counting or bankroll automation in the first working versions.
