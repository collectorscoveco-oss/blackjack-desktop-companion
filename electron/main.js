const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');

const DEFAULT_SETTINGS = {
  dividerRatio: 0.62,
  alwaysOnTop: false,
  compactMode: false,
  overlayMode: false,
  screenSetup: {
    active: false,
    selectedTarget: 'player',
    regions: {
      player: null,
      dealer: null
    }
  },
  streamUrl: 'https://www.youtube.com/'
};

let mainWindow;
let latestUpdateStatus = {
  status: 'idle',
  message: 'Updates are ready. Choose Check for updates when you want to look for a new release.'
};
let settings = { ...DEFAULT_SETTINGS };

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function sendUpdateStatus(payload) {
  latestUpdateStatus = { ...latestUpdateStatus, ...payload };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:status', latestUpdateStatus);
  }
}

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
  mainWindow.webContents.once('did-finish-load', () => sendUpdateStatus(latestUpdateStatus));
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

autoUpdater.on('checking-for-update', () => sendUpdateStatus({
  status: 'checking',
  message: 'Checking GitHub Releases for updates…'
}));
autoUpdater.on('update-available', (info) => sendUpdateStatus({
  status: 'available',
  version: info.version,
  message: `Update ${info.version} found. Downloading now…`
}));
autoUpdater.on('update-not-available', (info) => sendUpdateStatus({
  status: 'current',
  version: info.version,
  message: 'You are on the latest available release.'
}));
autoUpdater.on('download-progress', (progress) => sendUpdateStatus({
  status: 'downloading',
  progress: Math.round(progress.percent || 0),
  message: `Downloading update… ${Math.round(progress.percent || 0)}%`
}));
autoUpdater.on('update-downloaded', (info) => sendUpdateStatus({
  status: 'downloaded',
  version: info.version,
  message: `Update ${info.version} downloaded. Choose Install downloaded update to restart and finish.`
}));
autoUpdater.on('error', (error) => sendUpdateStatus({
  status: 'error',
  message: `Update check failed: ${error.message}`
}));

ipcMain.handle('settings:get', () => settings);
ipcMain.handle('settings:set', (_event, patch) => saveSettings(patch || {}));
ipcMain.handle('window:set-always-on-top', (_event, value) => {
  const next = Boolean(value);
  if (mainWindow) mainWindow.setAlwaysOnTop(next);
  saveSettings({ alwaysOnTop: next });
  return settings;
});
ipcMain.handle('updates:get-status', () => latestUpdateStatus);
ipcMain.handle('updates:check', async () => {
  if (!app.isPackaged) {
    sendUpdateStatus({
      status: 'dev-mode',
      message: 'Updates work after installing a packaged GitHub Release build.'
    });
    return latestUpdateStatus;
  }
  await autoUpdater.checkForUpdates();
  return latestUpdateStatus;
});
ipcMain.handle('updates:install', () => {
  if (latestUpdateStatus.status !== 'downloaded') {
    sendUpdateStatus({
      status: latestUpdateStatus.status,
      message: 'No downloaded update is ready to install yet.'
    });
    return latestUpdateStatus;
  }
  autoUpdater.quitAndInstall(false, true);
  return latestUpdateStatus;
});
ipcMain.handle('updates:open-releases', () => shell.openExternal('https://github.com/collectorscoveco-oss/blackjack-desktop-companion/releases/latest'));
