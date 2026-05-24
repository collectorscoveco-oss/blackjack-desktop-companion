import { initBrowserPane } from './js/browser-pane.js';
import { loadSettings, saveSettings } from './js/settings-store.js';
import { renderStrategyPane } from './js/ui-controls.js';

const state = await loadSettings();

const app = document.getElementById('app');
app.innerHTML = `
  <div class="desktop-shell ${state.compactMode ? 'compact-mode' : ''} ${state.overlayMode ? 'overlay-mode' : ''}">
    <header class="app-header">
      <div>
        <div class="eyebrow">Desktop blackjack companion</div>
        <h1>Stream Viewer + Strategy Assistant</h1>
      </div>
      <div class="toolbar-actions">
        <button class="ui-btn secondary ${state.overlayMode ? 'active' : ''}" id="overlay-mode-btn">${state.overlayMode ? 'Full app' : 'Overlay mode'}</button>
        <button class="ui-btn secondary" id="toggle-pane-btn">${state.compactMode ? 'Show strategy' : 'Hide strategy'}</button>
        <button class="ui-btn secondary ${state.alwaysOnTop ? 'active' : ''}" id="always-on-top-btn">Always on top</button>
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
        <div class="webview-wrap">
          <webview id="stream-webview" allowpopups webpreferences="contextIsolation=yes"></webview>
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
  togglePaneBtn: document.getElementById('toggle-pane-btn'),
  overlayModeBtn: document.getElementById('overlay-mode-btn'),
  alwaysOnTopBtn: document.getElementById('always-on-top-btn'),
  webview: document.getElementById('stream-webview'),
  urlInput: document.getElementById('stream-url'),
  backBtn: document.getElementById('back-btn'),
  forwardBtn: document.getElementById('forward-btn'),
  reloadBtn: document.getElementById('reload-btn'),
  homeBtn: document.getElementById('home-btn')
};

let saveTimer;
function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveSettings(state), 120);
}

function render() {
  elements.splitLayout.style.setProperty('--left-ratio', state.compactMode ? 1 : state.dividerRatio);
  document.querySelector('.desktop-shell').classList.toggle('compact-mode', state.compactMode);
  document.querySelector('.desktop-shell').classList.toggle('overlay-mode', state.overlayMode);
  elements.togglePaneBtn.textContent = state.compactMode ? 'Show strategy' : 'Hide strategy';
  elements.overlayModeBtn.textContent = state.overlayMode ? 'Full app' : 'Overlay mode';
  elements.overlayModeBtn.classList.toggle('active', !!state.overlayMode);
  elements.alwaysOnTopBtn.classList.toggle('active', !!state.alwaysOnTop);
  renderStrategyPane(elements.strategyRoot, state, () => {
    render();
    persistSoon();
  });
}

initBrowserPane({ state, elements, onStateChange: persistSoon });
render();

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

elements.alwaysOnTopBtn.addEventListener('click', async () => {
  state.alwaysOnTop = !state.alwaysOnTop;
  if (window.desktopAPI?.setAlwaysOnTop) {
    await window.desktopAPI.setAlwaysOnTop(state.alwaysOnTop);
  }
  render();
  persistSoon();
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

persistSoon();
