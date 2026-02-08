"""
backend_orchestrator.py — Main coordinator for the interview-assistant backend.

Responsibilities:
  1. Load configuration from config/config.yaml
  2. Start audio capture, transcription, and LLM modules
  3. Run a WebSocket server that broadcasts recognised questions and hints
     to the Electron overlay front-end.
"""

import asyncio
import json
import logging
import os
import signal
import threading
import time
from pathlib import Path
from typing import Optional, Set

import websockets
import websockets.server
import yaml

from backend.audio_capture import AudioCapture
from backend.llm_agent import LLMAgent
from backend.transcriber import Transcriber

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------
# Configuration loader
# -----------------------------------------------------------------------
CONFIG_PATH = os.environ.get(
    "PA_CONFIG",
    str(Path(__file__).resolve().parent.parent / "config" / "config.yaml"),
)


def load_config(path: str = CONFIG_PATH) -> dict:
    with open(path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh)


# -----------------------------------------------------------------------
# Orchestrator
# -----------------------------------------------------------------------
class Orchestrator:
    """Ties audio capture, transcription and LLM together and exposes
    results over a WebSocket server."""

    def __init__(self, config: dict):
        self.config = config

        # Modules
        audio_cfg = config.get("audio", {})
        whisper_cfg = config.get("whisper", {})
        ollama_cfg = config.get("ollama", {})

        self.capture = AudioCapture(
            device_index=audio_cfg.get("device_index"),
            sample_rate=audio_cfg.get("sample_rate", 16000),
            channels=audio_cfg.get("channels", 1),
            chunk_size=audio_cfg.get("chunk_size", 1024),
        )

        self.transcriber = Transcriber(
            binary_path=whisper_cfg.get("binary_path", "whisper-cpp"),
            model_path=whisper_cfg.get("model_path", "models/ggml-base.en.bin"),
            language=whisper_cfg.get("language", "en"),
            sample_rate=audio_cfg.get("sample_rate", 16000),
            buffer_seconds=whisper_cfg.get("buffer_seconds", 20),
        )

        self.llm = LLMAgent(
            base_url=ollama_cfg.get("base_url", "http://localhost:11434"),
            model=ollama_cfg.get("model", "llama3.2:3b"),
            system_prompt=ollama_cfg.get("system_prompt", ""),
            max_tokens=ollama_cfg.get("max_tokens", 256),
            temperature=ollama_cfg.get("temperature", 0.3),
        )

        # WebSocket state
        ws_cfg = config.get("websocket", {})
        self.ws_host = ws_cfg.get("host", "127.0.0.1")
        self.ws_port = ws_cfg.get("port", 8765)
        self._clients: Set[websockets.server.ServerConnection] = set()

        # Control
        self._running = threading.Event()
        self._last_transcript = ""

    # ------------------------------------------------------------------
    # WebSocket helpers
    # ------------------------------------------------------------------
    async def _ws_handler(self, websocket: websockets.server.ServerConnection) -> None:
        self._clients.add(websocket)
        logger.info("Frontend connected (%d clients)", len(self._clients))
        try:
            async for _ in websocket:
                pass  # we only broadcast, no inbound messages expected
        finally:
            self._clients.discard(websocket)
            logger.info("Frontend disconnected (%d clients)", len(self._clients))

    async def _broadcast(self, message: dict) -> None:
        if not self._clients:
            return
        data = json.dumps(message)
        stale = []
        for ws in self._clients:
            try:
                await ws.send(data)
            except Exception:
                stale.append(ws)
        for ws in stale:
            self._clients.discard(ws)

    # ------------------------------------------------------------------
    # Pipeline loop (runs in a thread)
    # ------------------------------------------------------------------
    def _pipeline_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Periodically check for new transcription and request an LLM hint."""
        while self._running.is_set():
            time.sleep(1)
            transcript = self.transcriber.get_transcript()
            if transcript and transcript != self._last_transcript:
                self._last_transcript = transcript
                question = self.transcriber.get_last_segment()

                # Broadcast the recognised question immediately
                asyncio.run_coroutine_threadsafe(
                    self._broadcast({"type": "question", "text": question}),
                    loop,
                )

                # Ask LLM for a hint (blocking call)
                hint = self.llm.get_hint(transcript)
                if hint:
                    asyncio.run_coroutine_threadsafe(
                        self._broadcast({"type": "hint", "text": hint}),
                        loop,
                    )

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------
    async def run(self) -> None:
        """Start all subsystems and the WebSocket server."""
        self._running.set()

        # Start transcriber
        self.transcriber.start()

        # Start audio capture → feed into transcriber
        self.capture.start(callback=self.transcriber.feed)

        # Start pipeline thread
        loop = asyncio.get_running_loop()
        pipeline_thread = threading.Thread(
            target=self._pipeline_loop, args=(loop,), daemon=True
        )
        pipeline_thread.start()

        # Start WebSocket server
        logger.info("WebSocket server starting on ws://%s:%d", self.ws_host, self.ws_port)
        stop_event = asyncio.Event()

        def _handle_signal() -> None:
            stop_event.set()

        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, _handle_signal)
            except NotImplementedError:
                # Windows doesn't support add_signal_handler
                pass

        async with websockets.serve(  # type: ignore[attr-defined]
            self._ws_handler, self.ws_host, self.ws_port
        ):
            logger.info("Backend is ready.")
            await stop_event.wait()

        # Cleanup
        self._running.clear()
        self.capture.stop()
        self.transcriber.stop()
        pipeline_thread.join(timeout=5)
        logger.info("Backend shut down.")


# -----------------------------------------------------------------------
# CLI entry point
# -----------------------------------------------------------------------
def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )

    config = load_config()
    orchestrator = Orchestrator(config)

    try:
        asyncio.run(orchestrator.run())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")


if __name__ == "__main__":
    main()
