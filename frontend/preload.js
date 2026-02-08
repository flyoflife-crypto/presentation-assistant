/**
 * preload.js — Exposes a minimal API to the renderer process.
 *
 * Provides the WebSocket URL so the renderer can connect to the Python backend.
 */

const { contextBridge } = require('electron');
const path = require('path');
const fs = require('fs');

let wsHost = '127.0.0.1';
let wsPort = 8765;

try {
  const yaml = require('js-yaml');
  const raw = fs.readFileSync(
    path.resolve(__dirname, '..', 'config', 'config.yaml'),
    'utf8'
  );
  const cfg = yaml.load(raw);
  wsHost = cfg?.websocket?.host ?? wsHost;
  wsPort = cfg?.websocket?.port ?? wsPort;
} catch {
  // ignore — use defaults
}

contextBridge.exposeInMainWorld('backendConfig', {
  wsUrl: `ws://${wsHost}:${wsPort}`,
});
