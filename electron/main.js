const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  dividerRatio: 0.62,
  alwaysOnTop: false,
  compactMode: false,
  overlayMode: false,
  streamUrl: 'https://www.youtube.com/'
};

let mainWindow;
let settings = { ...DEFAULT_SETTINGS };

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(next) {
  settings = { ...settings, ...next };
  fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
  return settings;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: '#071019',
    autoHideMenuBar: true,
    alwaysOnTop: Boolean(settings.alwaysOnTop),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  loadSettings();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('settings:get', () => settings);
ipcMain.handle('settings:set', (_event, patch) => saveSettings(patch || {}));
ipcMain.handle('window:set-always-on-top', (_event, value) => {
  const next = Boolean(value);
  if (mainWindow) mainWindow.setAlwaysOnTop(next);
  saveSettings({ alwaysOnTop: next });
  return settings;
});
