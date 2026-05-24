const STORAGE_KEY = 'blackjack-desktop-renderer-v1';

const defaults = {
  dividerRatio: 0.62,
  compactMode: false,
  overlayMode: false,
  streamUrl: 'https://www.youtube.com/',
  browserHome: 'https://www.youtube.com/',
  chartVisible: false,
  trainingMode: true,
  alwaysOnTop: false,
  history: [],
  playerCards: [],
  dealerCard: '',
  screenSetup: {
    active: false,
    selectedTarget: 'player',
    regions: {
      player: null,
      dealer: null
    }
  },
  capturePreview: {
    player: null,
    dealer: null
  },
  rules: {
    decks: 6,
    hitSoft17: true,
    doubleAfterSplit: true,
    surrenderAllowed: true
  }
};

export async function loadSettings() {
  let desktop = {};
  if (window.desktopAPI?.getSettings) {
    desktop = await window.desktopAPI.getSettings();
  }

  let local = {};
  try {
    local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    local = {};
  }

  return {
    ...defaults,
    ...desktop,
    ...local,
    screenSetup: {
      ...defaults.screenSetup,
      ...(desktop.screenSetup || {}),
      ...(local.screenSetup || {}),
      regions: {
        ...defaults.screenSetup.regions,
        ...((desktop.screenSetup && desktop.screenSetup.regions) || {}),
        ...((local.screenSetup && local.screenSetup.regions) || {})
      }
    },
    capturePreview: {
      ...defaults.capturePreview,
      ...(local.capturePreview || {})
    },
    rules: {
      ...defaults.rules,
      ...(desktop.rules || {}),
      ...(local.rules || {})
    }
  };
}

export async function saveSettings(state) {
  const localPayload = {
    dividerRatio: state.dividerRatio,
    compactMode: state.compactMode,
    overlayMode: state.overlayMode,
    streamUrl: state.streamUrl,
    browserHome: state.browserHome,
    chartVisible: state.chartVisible,
    trainingMode: state.trainingMode,
    alwaysOnTop: state.alwaysOnTop,
    history: state.history,
    playerCards: state.playerCards,
    dealerCard: state.dealerCard,
    screenSetup: state.screenSetup,
    capturePreview: state.capturePreview,
    rules: state.rules
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(localPayload));

  if (window.desktopAPI?.setSettings) {
    await window.desktopAPI.setSettings({
      dividerRatio: state.dividerRatio,
      compactMode: state.compactMode,
      overlayMode: state.overlayMode,
      streamUrl: state.streamUrl,
      alwaysOnTop: state.alwaysOnTop,
      screenSetup: state.screenSetup
    });
  }
}
