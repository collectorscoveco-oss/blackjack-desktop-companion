import assert from 'node:assert/strict';
import { test } from 'node:test';

function createLocalStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    dump() {
      return Object.fromEntries(store.entries());
    }
  };
}

test('settings include default screen setup regions for future capture workflow', async () => {
  globalThis.window = { desktopAPI: {} };
  globalThis.localStorage = createLocalStorage();

  const { loadSettings } = await import(`../public/js/settings-store.js?default-${Date.now()}`);
  const state = await loadSettings();

  assert.equal(state.screenSetup.active, false);
  assert.equal(state.screenSetup.selectedTarget, 'player');
  assert.deepEqual(state.screenSetup.regions.player, null);
  assert.deepEqual(state.screenSetup.regions.dealer, null);
  assert.deepEqual(state.capturePreview.player, null);
  assert.deepEqual(state.capturePreview.dealer, null);
  assert.equal(state.autoScanMode, false);
});

test('settings persist screen setup regions locally and to Electron desktop settings', async () => {
  const desktopPatches = [];
  globalThis.window = {
    desktopAPI: {
      setSettings: async (patch) => {
        desktopPatches.push(patch);
        return patch;
      }
    }
  };
  globalThis.localStorage = createLocalStorage();

  const { saveSettings } = await import(`../public/js/settings-store.js?persist-${Date.now()}`);
  const state = {
    dividerRatio: 0.62,
    compactMode: false,
    overlayMode: false,
    streamUrl: 'https://example.com',
    browserHome: 'https://example.com',
    chartVisible: false,
    trainingMode: true,
    alwaysOnTop: false,
    autoScanMode: true,
    history: [],
    playerCards: [],
    dealerCard: '',
    rules: { decks: 6, hitSoft17: true, doubleAfterSplit: true, surrenderAllowed: true },
    screenSetup: {
      active: true,
      selectedTarget: 'dealer',
      regions: {
        player: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
        dealer: { x: 0.5, y: 0.6, w: 0.2, h: 0.1 }
      }
    },
    capturePreview: { player: null, dealer: null }
  };

  await saveSettings(state);

  const stored = JSON.parse(globalThis.localStorage.dump()['blackjack-desktop-renderer-v1']);
  assert.deepEqual(stored.screenSetup, state.screenSetup);
  assert.equal(stored.autoScanMode, true);
  assert.deepEqual(desktopPatches.at(-1).screenSetup, state.screenSetup);
  assert.equal(desktopPatches.at(-1).autoScanMode, true);
});
