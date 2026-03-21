# Blackjack Desktop Companion

A local-only Electron desktop app for watching a blackjack stream in one pane and using a manual **basic strategy** helper in the other.

## Features

- **Two-pane desktop layout**
  - Left: embedded browser/webview for stream viewing
  - Right: blackjack basic strategy assistant
- **Resizable split view** with draggable divider
- **Always-on-top** toggle
- **Compact mode** to hide the strategy pane quickly
- **Saved preferences**
  - divider position
  - always-on-top state
  - compact mode state
  - last-used stream URL
- **Manual local strategy logic**
  - no backend
  - no automation
  - no page injection
- **Right pane assistant**
  - player hand card entry
  - dealer upcard entry
  - hard / soft / pair / blackjack / bust detection
  - rule toggles for H17/S17, DAS, surrender
  - explanation text and fallback advice
  - last 5 hands history
  - optional strategy chart tab/view
- **Keyboard shortcuts**
  - `Ctrl/Cmd + L` focus URL bar
  - `Ctrl/Cmd + R` reload stream pane
  - `Ctrl/Cmd + B` hide/show strategy pane
  - `Ctrl/Cmd + N` start new hand

## Safety / scope

This app is intentionally limited:

- The browser pane is **view-only**.
- It does **not** inject scripts into the stream page.
- It does **not** automate clicks or interact with the game.
- Strategy input is **manual only**.

Discord web may work as a stream source in some cases, but the browser pane is generic and should also work with other compatible stream pages.

## Project structure

- `electron/main.js` — Electron main process and window management
- `electron/preload.js` — safe bridge for settings and always-on-top
- `public/js/browser-pane.js` — embedded browser pane logic
- `public/js/strategy-engine.js` — local blackjack strategy engine
- `public/js/ui-controls.js` — right pane UI rendering and controls
- `public/js/settings-store.js` — persistence for renderer settings
- `public/index.html` / `public/styles.css` / `public/app.js` — desktop renderer shell

## Install

```bash
npm install
```

## Run

```bash
npm start
```

## Notes

- Everything is local-only.
- The recommendation engine is **basic strategy only** and does not do counting.
- If a site blocks embedding or has webview compatibility issues, try another compatible stream source.
