const { app, BrowserWindow, screen, systemPreferences } = require('electron');
const { insetWindowsBelow } = require('./window-inset');

const TICKER_HEIGHT = 30;
let tickerWindow = null;
let insetTimer = null;

function getTickerBounds() {
  const display = screen.getPrimaryDisplay();
  const { x, width, y: workAreaY } = display.workArea;
  const menuBarHeight = display.workArea.y - display.bounds.y;
  // workArea.y can be 0 when the menu bar auto-hides
  const y = menuBarHeight > 0 ? workAreaY : 25;
  return { x, y, width, height: TICKER_HEIGHT };
}

function getReservedTop() {
  return getTickerBounds().y + TICKER_HEIGHT;
}

function getExcludedProcessNames() {
  return ['Electron', app.getName(), 'sports_ticker'];
}

function requestAccessibilityIfNeeded() {
  if (process.platform !== 'darwin') return;
  systemPreferences.isTrustedAccessibilityClient(true);
}

function scheduleWindowInset() {
  if (process.platform !== 'darwin') return;

  clearTimeout(insetTimer);
  insetTimer = setTimeout(() => {
    if (!systemPreferences.isTrustedAccessibilityClient(false)) return;
    insetWindowsBelow(getReservedTop(), getExcludedProcessNames());
  }, 500);
}

function positionTicker(win) {
  win.setBounds(getTickerBounds());
  scheduleWindowInset();
}

function createWindow() {
  const { x, y, width, height } = getTickerBounds();

  tickerWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: { contextIsolation: true }
  });

  // 'status' keeps the ticker above apps but below the macOS menu bar
  tickerWindow.setAlwaysOnTop(true, process.platform === 'darwin' ? 'status' : 'screen-saver');
  tickerWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  tickerWindow.setFullScreenable(false);
  tickerWindow.loadFile('index.html');

  tickerWindow.once('ready-to-show', () => {
    positionTicker(tickerWindow);
  });

  tickerWindow.on('closed', () => {
    tickerWindow = null;
  });

  scheduleWindowInset();
}

function setupDisplayListeners() {
  screen.on('display-metrics-changed', () => {
    if (tickerWindow && !tickerWindow.isDestroyed()) {
      positionTicker(tickerWindow);
    }
  });
}

app.whenReady().then(() => {
  requestAccessibilityIfNeeded();
  createWindow();
  setupDisplayListeners();
});

app.on('activate', scheduleWindowInset);

app.on('window-all-closed', () => app.quit());
