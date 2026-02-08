"""
audio_capture.py — Captures audio from a selected device using PyAudio.

Supports microphone and virtual audio devices (BlackHole, VB-Audio, PulseAudio).
Run with --list flag to enumerate available devices.
"""

import logging
import threading
from typing import Callable, Optional

import pyaudio

logger = logging.getLogger(__name__)


class AudioCapture:
    """Continuously reads audio from a PyAudio device and passes chunks to a callback."""

    def __init__(
        self,
        device_index: Optional[int] = None,
        sample_rate: int = 16000,
        channels: int = 1,
        chunk_size: int = 1024,
        audio_format: int = pyaudio.paInt16,
    ):
        self.device_index = device_index
        self.sample_rate = sample_rate
        self.channels = channels
        self.chunk_size = chunk_size
        self.audio_format = audio_format

        self._pa: Optional[pyaudio.PyAudio] = None
        self._stream: Optional[pyaudio.Stream] = None
        self._thread: Optional[threading.Thread] = None
        self._running = threading.Event()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def start(self, callback: Callable[[bytes], None]) -> None:
        """Start capturing audio.  *callback* receives raw PCM byte chunks."""
        if self._running.is_set():
            logger.warning("AudioCapture already running")
            return

        self._pa = pyaudio.PyAudio()
        try:
            self._stream = self._pa.open(
                format=self.audio_format,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                input_device_index=self.device_index,
                frames_per_buffer=self.chunk_size,
            )
        except Exception:
            logger.exception("Failed to open audio stream")
            self._cleanup()
            raise

        self._running.set()
        self._thread = threading.Thread(
            target=self._read_loop, args=(callback,), daemon=True
        )
        self._thread.start()
        logger.info(
            "AudioCapture started (device=%s, rate=%d)",
            self.device_index,
            self.sample_rate,
        )

    def stop(self) -> None:
        """Stop capturing audio and release resources."""
        self._running.clear()
        if self._thread is not None:
            self._thread.join(timeout=3)
            self._thread = None
        self._cleanup()
        logger.info("AudioCapture stopped")

    @property
    def is_running(self) -> bool:
        return self._running.is_set()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _read_loop(self, callback: Callable[[bytes], None]) -> None:
        while self._running.is_set():
            try:
                data = self._stream.read(self.chunk_size, exception_on_overflow=False)  # type: ignore[union-attr]
                callback(data)
            except IOError as exc:
                logger.warning("Audio read error (device may have been disconnected): %s", exc)
            except Exception:
                logger.exception("Unexpected error in audio read loop")
                break

    def _cleanup(self) -> None:
        if self._stream is not None:
            try:
                self._stream.stop_stream()
                self._stream.close()
            except Exception:
                pass
            self._stream = None
        if self._pa is not None:
            try:
                self._pa.terminate()
            except Exception:
                pass
            self._pa = None


# -----------------------------------------------------------------------
# CLI helper: list available audio devices
# -----------------------------------------------------------------------
def list_devices() -> None:
    pa = pyaudio.PyAudio()
    print("Available audio devices:")
    for i in range(pa.get_device_count()):
        info = pa.get_device_info_by_index(i)
        direction = []
        if info.get("maxInputChannels", 0) > 0:
            direction.append("IN")
        if info.get("maxOutputChannels", 0) > 0:
            direction.append("OUT")
        print(f"  [{i}] {info['name']}  ({'/'.join(direction)})")
    pa.terminate()


if __name__ == "__main__":
    import sys

    if "--list" in sys.argv:
        list_devices()
    else:
        print("Usage: python -m backend.audio_capture --list")
