import { initBrowserPane } from './js/browser-pane.js';
import { loadSettings, saveSettings } from './js/settings-store.js';
import { renderStrategyPane } from './js/ui-controls.js';
import { buildAutoRecognitionSuggestion, detectBrightCardShapes, summarizeCardShapeScan } from './js/card-shape-detector.js';
import { applyRecognitionSuggestion, autoApplyRecognitionSuggestion } from './js/recognition-suggestion.js';
import { formatUpdateStatusMessage } from './js/update-status.js';

const state = await loadSettings();

const app = document.getElementById('app');
app.innerHTML = `
  <div class="desktop-shell ${state.compactMode ? 'compact-mode' : ''} ${state.overlayMode ? 'overlay-mode' : ''}">
    <header class="app-header">
      <div>
        <div class="eyebrow">Blackjack overlay</div>
        <h1>Strategy Assistant</h1>
      </div>
      <div class="toolbar-actions">
        <button class="ui-btn secondary ${state.overlayMode ? 'active' : ''}" id="overlay-mode-btn">${state.overlayMode ? 'Full app' : 'Overlay mode'}</button>
        <button class="ui-btn secondary ${state.screenSetup?.active ? 'active' : ''}" id="screen-setup-btn">${state.screenSetup?.active ? 'Done setup' : 'Screen setup'}</button>
        <button class="ui-btn secondary" id="capture-once-btn">Capture once</button>
        <button class="ui-btn secondary" id="scan-cards-btn">Scan cards</button>
        <button class="ui-btn secondary ${state.autoScanMode ? 'active' : ''}" id="auto-scan-btn">${state.autoScanMode ? 'Auto scan on' : 'Auto scan'}</button>
        <button class="ui-btn secondary" id="toggle-pane-btn">${state.compactMode ? 'Show strategy' : 'Hide strategy'}</button>
        <button class="ui-btn secondary ${state.alwaysOnTop ? 'active' : ''}" id="always-on-top-btn">Always on top</button>
        <div class="update-menu">
          <select id="update-menu-select" aria-label="Program updates">
            <option value="">Updates</option>
            <option value="check">Check for updates</option>
            <option value="install">Install downloaded update</option>
            <option value="releases">Open release page</option>
          </select>
          <span class="update-status" id="update-status">Updates ready</span>
        </div>
      </div>
    </header>

    <main class="split-layout" id="split-layout" style="--left-ratio:${state.dividerRatio};">
      <section class="browser-pane">
        <div class="browser-toolbar">
          <button class="nav-btn" id="back-btn">←</button>
          <button class="nav-btn" id="forward-btn">→</button>
          <button class="nav-btn" id="reload-btn">↻</button>
          <button class="nav-btn" id="home-btn">⌂</button>
          <input id="stream-url" class="url-input" placeholder="Paste stream URL" />
        </div>
        <div class="webview-wrap" id="webview-wrap">
          <webview id="stream-webview" allowpopups webpreferences="contextIsolation=yes"></webview>
          <div class="screen-setup-layer ${state.screenSetup?.active ? 'active' : ''}" id="screen-setup-layer">
            <div class="screen-setup-help">
              <strong>Screen setup</strong>
              <span>Choose Player or Dealer, then drag a box over the cards.</span>
              <div class="region-targets">
                <button class="mini-btn ${state.screenSetup?.selectedTarget === 'player' ? 'active' : ''}" id="select-player-region">Player cards</button>
                <button class="mini-btn ${state.screenSetup?.selectedTarget === 'dealer' ? 'active' : ''}" id="select-dealer-region">Dealer card</button>
              </div>
            </div>
            <div class="region-box player-region" id="player-region-box"><span>Player</span></div>
            <div class="region-box dealer-region" id="dealer-region-box"><span>Dealer</span></div>
            <div class="region-box drawing-region hidden" id="drawing-region-box"></div>
          </div>
        </div>
        <div class="capture-preview-panel" id="capture-preview-panel">
          <div class="label-row"><label>Capture preview</label><span class="tiny-copy" id="capture-status">Select regions, then Capture once.</span></div>
          <div class="capture-preview-grid">
            <div><div class="tiny-copy">Player region</div><img id="player-capture-preview" alt="Player capture preview" /></div>
            <div><div class="tiny-copy">Dealer region</div><img id="dealer-capture-preview" alt="Dealer capture preview" /></div>
          </div>
          <div class="recognition-confirmation hidden" id="recognition-confirmation">
            <span id="recognition-summary">No detected hand yet.</span>
            <button class="mini-btn" id="use-recognition-btn">Use detected hand</button>
            <button class="mini-btn" id="dismiss-recognition-btn">Dismiss</button>
          </div>
        </div>
        <div class="browser-note">Viewer only. No page injection, no automation, no interaction with the game.</div>
      </section>

      <div class="splitter" id="splitter" aria-label="Resize panes"></div>

      <aside class="strategy-pane" id="strategy-root"></aside>
    </main>
  </div>
`;

const elements = {
  splitLayout: document.getElementById('split-layout'),
  splitter: document.getElementById('splitter'),
  strategyRoot: document.getElementById('strategy-root'),
  webviewWrap: document.getElementById('webview-wrap'),
  screenSetupBtn: document.getElementById('screen-setup-btn'),
  captureOnceBtn: document.getElementById('capture-once-btn'),
  scanCardsBtn: document.getElementById('scan-cards-btn'),
  autoScanBtn: document.getElementById('auto-scan-btn'),
  screenSetupLayer: document.getElementById('screen-setup-layer'),
  selectPlayerRegion: document.getElementById('select-player-region'),
  selectDealerRegion: document.getElementById('select-dealer-region'),
  playerRegionBox: document.getElementById('player-region-box'),
  dealerRegionBox: document.getElementById('dealer-region-box'),
  drawingRegionBox: document.getElementById('drawing-region-box'),
  captureStatus: document.getElementById('capture-status'),
  playerCapturePreview: document.getElementById('player-capture-preview'),
  dealerCapturePreview: document.getElementById('dealer-capture-preview'),
  recognitionConfirmation: document.getElementById('recognition-confirmation'),
  recognitionSummary: document.getElementById('recognition-summary'),
  useRecognitionBtn: document.getElementById('use-recognition-btn'),
  dismissRecognitionBtn: document.getElementById('dismiss-recognition-btn'),
  togglePaneBtn: document.getElementById('toggle-pane-btn'),
  overlayModeBtn: document.getElementById('overlay-mode-btn'),
  alwaysOnTopBtn: document.getElementById('always-on-top-btn'),
  updateMenuSelect: document.getElementById('update-menu-select'),
  updateStatus: document.getElementById('update-status'),
  webview: document.getElementById('stream-webview'),
  urlInput: document.getElementById('stream-url'),
  backBtn: document.getElementById('back-btn'),
  forwardBtn: document.getElementById('forward-btn'),
  reloadBtn: document.getElementById('reload-btn'),
  homeBtn: document.getElementById('home-btn')
};

let saveTimer;
let autoScanTimer = null;
let autoScanRunning = false;
function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSettings(state), 120);
}

function updateProgramStatus(status) {
  if (!status) return;
  elements.updateStatus.textContent = formatUpdateStatusMessage(status);
  elements.updateStatus.dataset.status = status.status || 'idle';
}

function renderRegionBox(box, region) {
  if (!region) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');
  box.style.left = `${region.x * 100}%`;
  box.style.top = `${region.y * 100}%`;
  box.style.width = `${region.w * 100}%`;
  box.style.height = `${region.h * 100}%`;
}

function renderScreenSetup() {
  const setup = state.screenSetup;
  elements.screenSetupLayer.classList.toggle('active', !!setup.active);
  elements.screenSetupBtn.textContent = setup.active ? 'Done setup' : 'Screen setup';
  elements.screenSetupBtn.classList.toggle('active', !!setup.active);
  elements.selectPlayerRegion.classList.toggle('active', setup.selectedTarget === 'player');
  elements.selectDealerRegion.classList.toggle('active', setup.selectedTarget === 'dealer');
  renderRegionBox(elements.playerRegionBox, setup.regions.player);
  renderRegionBox(elements.dealerRegionBox, setup.regions.dealer);
  elements.playerCapturePreview.src = state.capturePreview?.player || '';
  elements.dealerCapturePreview.src = state.capturePreview?.dealer || '';
  elements.recognitionConfirmation.classList.toggle('hidden', !state.recognitionSuggestion);
  elements.recognitionSummary.textContent = state.recognitionSuggestion?.summary || 'No detected hand yet.';
}

function regionToCaptureRect(region, imageSize, displaySize) {
  if (!region) return null;
  const scaleX = imageSize.width / displaySize.width;
  const scaleY = imageSize.height / displaySize.height;
  return {
    x: Math.round(region.x * displaySize.width * scaleX),
    y: Math.round(region.y * displaySize.height * scaleY),
    width: Math.max(1, Math.round(region.w * displaySize.width * scaleX)),
    height: Math.max(1, Math.round(region.h * displaySize.height * scaleY))
  };
}

async function captureSelectedRegions() {
  if (!elements.webview.capturePage) {
    elements.captureStatus.textContent = 'Capture is not available in this Electron view yet.';
    return;
  }
  const image = await elements.webview.capturePage();
  const imageSize = image.getSize();
  const displaySize = elements.webview.getBoundingClientRect();
  const playerRect = regionToCaptureRect(state.screenSetup.regions.player, imageSize, displaySize);
  const dealerRect = regionToCaptureRect(state.screenSetup.regions.dealer, imageSize, displaySize);
  if (!playerRect || !dealerRect) {
    elements.captureStatus.textContent = 'Draw both player and dealer regions first.';
    return;
  }
  state.capturePreview = {
    player: image.crop(playerRect).toDataURL(),
    dealer: image.crop(dealerRect).toDataURL()
  };
  state.recognitionSuggestion = null;
  elements.captureStatus.textContent = 'Captured selected regions. Rank confirmation flow is ready; image detector comes next.';
  renderScreenSetup();
  persistSoon();
}

async function imageDataFromDataUrl(dataUrl) {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

async function scanCapturedCards() {
  if (!state.capturePreview?.player || !state.capturePreview?.dealer) {
    elements.captureStatus.textContent = 'Capture player/dealer regions before scanning.';
    return;
  }
  const [playerImageData, dealerImageData] = await Promise.all([
    imageDataFromDataUrl(state.capturePreview.player),
    imageDataFromDataUrl(state.capturePreview.dealer)
  ]);
  const playerShapes = detectBrightCardShapes(playerImageData);
  const dealerShapes = detectBrightCardShapes(dealerImageData, { minAreaRatio: 0.015 });
  const suggestion = buildAutoRecognitionSuggestion({ playerImageData, dealerImageData, playerShapes, dealerShapes });
  state.cardShapeScan = { playerShapes, dealerShapes };
  state.recognitionSuggestion = suggestion;
  const autoApplied = autoApplyRecognitionSuggestion(state);
  elements.captureStatus.textContent = autoApplied
    ? state.autoRecognitionStatus
    : summarizeCardShapeScan({ playerShapes, dealerShapes, suggestion });
  render();
  persistSoon();
}

async function runAutoScanTick() {
  if (!state.autoScanMode || autoScanRunning) return;
  autoScanRunning = true;
  try {
    await captureSelectedRegions();
    await scanCapturedCards();
  } catch (error) {
    elements.captureStatus.textContent = `Auto scan failed: ${error.message}`;
  } finally {
    autoScanRunning = false;
  }
}

function syncAutoScanTimer() {
  if (autoScanTimer) {
    clearInterval(autoScanTimer);
    autoScanTimer = null;
  }
  if (state.autoScanMode) {
    autoScanTimer = setInterval(runAutoScanTick, 1200);
    runAutoScanTick();
  }
}

function render() {
  elements.splitLayout.style.setProperty('--left-ratio', state.compactMode ? 1 : state.dividerRatio);
  document.querySelector('.desktop-shell').classList.toggle('compact-mode', state.compactMode);
  document.querySelector('.desktop-shell').classList.toggle('overlay-mode', state.overlayMode);
  elements.togglePaneBtn.textContent = state.compactMode ? 'Show strategy' : 'Hide strategy';
  elements.overlayModeBtn.textContent = state.overlayMode ? 'Full app' : 'Overlay mode';
  elements.overlayModeBtn.classList.toggle('active', !!state.overlayMode);
  elements.alwaysOnTopBtn.classList.toggle('active', !!state.alwaysOnTop);
  elements.autoScanBtn.textContent = state.autoScanMode ? 'Auto scan on' : 'Auto scan';
  elements.autoScanBtn.classList.toggle('active', !!state.autoScanMode);
  renderScreenSetup();
  renderStrategyPane(elements.strategyRoot, state, () => {
    render();
    persistSoon();
  });
}

initBrowserPane({ state, elements, onStateChange: persistSoon });
render();

if (window.desktopAPI?.onUpdateStatus) {
  window.desktopAPI.onUpdateStatus(updateProgramStatus);
}
if (window.desktopAPI?.getUpdateStatus) {
  window.desktopAPI.getUpdateStatus().then(updateProgramStatus).catch(() => {
    updateProgramStatus({ status: 'unavailable', message: 'Update checker is unavailable in this build.' });
  });
}

let dragging = false;
elements.splitter.addEventListener('mousedown', () => {
  if (state.compactMode) return;
  dragging = true;
  document.body.classList.add('dragging-divider');
});
window.addEventListener('mouseup', () => {
  dragging = false;
  document.body.classList.remove('dragging-divider');
});
window.addEventListener('mousemove', (event) => {
  if (!dragging || state.compactMode) return;
  const rect = elements.splitLayout.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  state.dividerRatio = Math.max(0.28, Math.min(0.78, ratio));
  elements.splitLayout.style.setProperty('--left-ratio', state.dividerRatio);
  persistSoon();
});

elements.togglePaneBtn.addEventListener('click', () => {
  state.compactMode = !state.compactMode;
  render();
  persistSoon();
});

elements.overlayModeBtn.addEventListener('click', async () => {
  state.overlayMode = !state.overlayMode;
  if (state.overlayMode) {
    state.compactMode = false;
    state.alwaysOnTop = true;
    if (window.desktopAPI?.setAlwaysOnTop) {
      await window.desktopAPI.setAlwaysOnTop(true);
    }
  }
  render();
  persistSoon();
});

elements.screenSetupBtn.addEventListener('click', () => {
  state.screenSetup.active = !state.screenSetup.active;
  render();
  persistSoon();
});

elements.selectPlayerRegion.addEventListener('click', (event) => {
  event.stopPropagation();
  state.screenSetup.selectedTarget = 'player';
  renderScreenSetup();
  persistSoon();
});

elements.selectDealerRegion.addEventListener('click', (event) => {
  event.stopPropagation();
  state.screenSetup.selectedTarget = 'dealer';
  renderScreenSetup();
  persistSoon();
});

elements.captureOnceBtn.addEventListener('click', () => {
  captureSelectedRegions().catch((error) => {
    elements.captureStatus.textContent = `Capture failed: ${error.message}`;
  });
});

elements.scanCardsBtn.addEventListener('click', () => {
  scanCapturedCards().catch((error) => {
    elements.captureStatus.textContent = `Scan failed: ${error.message}`;
  });
});

elements.autoScanBtn.addEventListener('click', () => {
  state.autoScanMode = !state.autoScanMode;
  elements.captureStatus.textContent = state.autoScanMode
    ? 'Auto scan is running. It will keep capturing regions and fill confident hands.'
    : 'Auto scan stopped.';
  render();
  syncAutoScanTimer();
  persistSoon();
});

elements.useRecognitionBtn.addEventListener('click', () => {
  applyRecognitionSuggestion(state, state.recognitionSuggestion);
  state.recognitionSuggestion = null;
  render();
  persistSoon();
});

elements.dismissRecognitionBtn.addEventListener('click', () => {
  state.recognitionSuggestion = null;
  renderScreenSetup();
  persistSoon();
});

let drawingRegion = null;
elements.screenSetupLayer.addEventListener('pointerdown', (event) => {
  if (!state.screenSetup.active || event.target.closest('.screen-setup-help')) return;
  const rect = elements.screenSetupLayer.getBoundingClientRect();
  drawingRegion = {
    startX: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
    startY: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
    rect
  };
  elements.screenSetupLayer.setPointerCapture(event.pointerId);
  elements.drawingRegionBox.classList.remove('hidden');
});

elements.screenSetupLayer.addEventListener('pointermove', (event) => {
  if (!drawingRegion) return;
  const currentX = Math.max(0, Math.min(drawingRegion.rect.width, event.clientX - drawingRegion.rect.left));
  const currentY = Math.max(0, Math.min(drawingRegion.rect.height, event.clientY - drawingRegion.rect.top));
  const left = Math.min(drawingRegion.startX, currentX);
  const top = Math.min(drawingRegion.startY, currentY);
  const width = Math.abs(currentX - drawingRegion.startX);
  const height = Math.abs(currentY - drawingRegion.startY);
  elements.drawingRegionBox.style.left = `${left}px`;
  elements.drawingRegionBox.style.top = `${top}px`;
  elements.drawingRegionBox.style.width = `${width}px`;
  elements.drawingRegionBox.style.height = `${height}px`;
});

elements.screenSetupLayer.addEventListener('pointerup', (event) => {
  if (!drawingRegion) return;
  const currentX = Math.max(0, Math.min(drawingRegion.rect.width, event.clientX - drawingRegion.rect.left));
  const currentY = Math.max(0, Math.min(drawingRegion.rect.height, event.clientY - drawingRegion.rect.top));
  const left = Math.min(drawingRegion.startX, currentX);
  const top = Math.min(drawingRegion.startY, currentY);
  const width = Math.abs(currentX - drawingRegion.startX);
  const height = Math.abs(currentY - drawingRegion.startY);
  elements.drawingRegionBox.classList.add('hidden');
  if (width > 20 && height > 20) {
    state.screenSetup.regions[state.screenSetup.selectedTarget] = {
      x: left / drawingRegion.rect.width,
      y: top / drawingRegion.rect.height,
      w: width / drawingRegion.rect.width,
      h: height / drawingRegion.rect.height
    };
    elements.captureStatus.textContent = `${state.screenSetup.selectedTarget === 'player' ? 'Player' : 'Dealer'} region saved.`;
    renderScreenSetup();
    persistSoon();
  }
  drawingRegion = null;
});

elements.alwaysOnTopBtn.addEventListener('click', async () => {
  state.alwaysOnTop = !state.alwaysOnTop;
  if (window.desktopAPI?.setAlwaysOnTop) {
    await window.desktopAPI.setAlwaysOnTop(state.alwaysOnTop);
  }
  render();
  persistSoon();
});

elements.updateMenuSelect.addEventListener('change', async () => {
  const action = elements.updateMenuSelect.value;
  elements.updateMenuSelect.value = '';
  if (!action) return;
  try {
    if (action === 'check') {
      updateProgramStatus({ status: 'checking', message: 'Checking for updates…' });
      const status = await window.desktopAPI?.checkForUpdates?.();
      updateProgramStatus(status);
    }
    if (action === 'install') {
      const status = await window.desktopAPI?.installUpdate?.();
      updateProgramStatus(status);
    }
    if (action === 'releases') {
      await window.desktopAPI?.openReleases?.();
      updateProgramStatus({ status: 'releases', message: 'Opened the latest release page.' });
    }
  } catch (error) {
    updateProgramStatus({ status: 'error', message: `Update action failed: ${error.message}` });
  }
});

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === 'l') {
    event.preventDefault();
    elements.urlInput.focus();
    elements.urlInput.select();
  }
  if ((event.ctrlKey || event.metaKey) && key === 'r') {
    event.preventDefault();
    elements.webview.reload();
  }
  if ((event.ctrlKey || event.metaKey) && key === 'b') {
    event.preventDefault();
    state.compactMode = !state.compactMode;
    render();
    persistSoon();
  }
  if ((event.ctrlKey || event.metaKey) && key === 'n') {
    event.preventDefault();
    state.playerCards = [];
    state.dealerCard = '';
    render();
    persistSoon();
  }
});

syncAutoScanTimer();
persistSoon();
