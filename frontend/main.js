/**
 * main.js — Electron main process for the interview-assistant overlay.
 *
 * Creates a transparent, frameless, always-on-top window and registers a
 * global hotkey to toggle its visibility.  Connects to the Python backend
 * WebSocket server.
 */

const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');  // optional — falls back to defaults

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const CONFIG_PATH = path.resolve(__dirname, '..', 'config', 'config.yaml');

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return yaml.load(raw);
  } catch {
    return {};
  }
}

const config = loadConfig();
const WS_HOST = config?.websocket?.host ?? '127.0.0.1';
const WS_PORT = config?.websocket?.port ?? 8765;
const WIN_WIDTH = config?.window?.width ?? 420;
const WIN_HEIGHT = config?.window?.height ?? 320;
const WIN_OPACITY = config?.window?.opacity ?? 0.92;
const HOTKEY = config?.hotkey ?? 'CmdOrCtrl+Shift+H';

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    x: 20,
    y: 60,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    hasShadow: false,
    opacity: WIN_OPACITY,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  createWindow();

  // Register global hotkey to toggle overlay
  globalShortcut.register(HOTKEY, () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  console.log(`[Overlay] Hotkey registered: ${HOTKEY}`);
  console.log(`[Overlay] WebSocket target: ws://${WS_HOST}:${WS_PORT}`);
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  app.quit();
});
