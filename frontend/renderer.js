/**
 * renderer.js — Connects to the Python backend WebSocket and updates the DOM
 *               with recognised questions and LLM-generated hints.
 */

(function () {
  'use strict';

  const questionEl = document.getElementById('question');
  const hintEl = document.getElementById('hint');
  const statusEl = document.getElementById('status');

  const WS_URL = window.backendConfig?.wsUrl ?? 'ws://127.0.0.1:8765';
  const RECONNECT_DELAY_MS = 3000;

  let ws = null;

  // -------------------------------------------------------------------
  // WebSocket connection with automatic reconnect
  // -------------------------------------------------------------------
  function connect() {
    ws = new WebSocket(WS_URL);

    ws.addEventListener('open', () => {
      console.log('[Renderer] Connected to backend');
      statusEl.textContent = '● Connected';
      statusEl.className = 'status connected';
    });

    ws.addEventListener('message', (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'question' && msg.text) {
          questionEl.textContent = msg.text;
        } else if (msg.type === 'hint' && msg.text) {
          hintEl.textContent = msg.text;
        }
      } catch (err) {
        console.warn('[Renderer] Bad message:', err);
      }
    });

    ws.addEventListener('close', () => {
      console.log('[Renderer] Disconnected — reconnecting…');
      statusEl.textContent = '○ Disconnected';
      statusEl.className = 'status disconnected';
      setTimeout(connect, RECONNECT_DELAY_MS);
    });

    ws.addEventListener('error', (err) => {
      console.error('[Renderer] WebSocket error:', err);
      ws.close();
    });
  }

  connect();
})();
