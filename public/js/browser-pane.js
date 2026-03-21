export function initBrowserPane({ state, elements, onStateChange }) {
  const { webview, urlInput, backBtn, forwardBtn, reloadBtn, homeBtn } = elements;

  function navigate(url) {
    const next = normalizeUrl(url);
    state.streamUrl = next;
    urlInput.value = next;
    webview.src = next;
    onStateChange();
  }

  function normalizeUrl(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) return state.browserHome;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  function syncNavButtons() {
    backBtn.disabled = !webview.canGoBack();
    forwardBtn.disabled = !webview.canGoForward();
  }

  urlInput.value = state.streamUrl;
  webview.src = state.streamUrl;

  urlInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') navigate(urlInput.value);
  });

  backBtn.addEventListener('click', () => webview.canGoBack() && webview.goBack());
  forwardBtn.addEventListener('click', () => webview.canGoForward() && webview.goForward());
  reloadBtn.addEventListener('click', () => webview.reload());
  homeBtn.addEventListener('click', () => navigate(state.browserHome));

  webview.addEventListener('did-navigate', (event) => {
    state.streamUrl = event.url;
    urlInput.value = event.url;
    syncNavButtons();
    onStateChange();
  });

  webview.addEventListener('did-navigate-in-page', (event) => {
    state.streamUrl = event.url;
    urlInput.value = event.url;
    syncNavButtons();
    onStateChange();
  });

  webview.addEventListener('dom-ready', () => syncNavButtons());
  webview.addEventListener('page-title-updated', () => syncNavButtons());
  webview.addEventListener('did-fail-load', () => syncNavButtons());

  return { navigate, syncNavButtons };
}
