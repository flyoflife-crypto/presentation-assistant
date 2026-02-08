"""
transcriber.py — Integrates with whisper.cpp for speech-to-text.

Maintains a ring buffer of the last N seconds of recognised dialog and
exposes the current transcript as a string.
"""

import collections
import io
import logging
import subprocess
import tempfile
import threading
import time
import wave
from typing import Optional

logger = logging.getLogger(__name__)


class Transcriber:
    """Accumulates raw PCM audio, periodically invokes whisper.cpp, and keeps
    a rolling transcript of the last *buffer_seconds* of speech."""

    def __init__(
        self,
        binary_path: str = "whisper-cpp",
        model_path: str = "models/ggml-base.en.bin",
        language: str = "en",
        sample_rate: int = 16000,
        channels: int = 1,
        sample_width: int = 2,  # 16-bit
        buffer_seconds: int = 20,
        transcribe_interval: float = 3.0,
    ):
        self.binary_path = binary_path
        self.model_path = model_path
        self.language = language
        self.sample_rate = sample_rate
        self.channels = channels
        self.sample_width = sample_width
        self.buffer_seconds = buffer_seconds
        self.transcribe_interval = transcribe_interval

        # Audio accumulator (protected by lock)
        self._lock = threading.Lock()
        self._audio_buf = bytearray()

        # Ring buffer of transcribed text segments
        self._segments: collections.deque[str] = collections.deque(maxlen=50)

        self._running = threading.Event()
        self._thread: Optional[threading.Thread] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def feed(self, pcm_data: bytes) -> None:
        """Feed raw PCM audio bytes into the accumulator."""
        with self._lock:
            self._audio_buf.extend(pcm_data)

    def start(self) -> None:
        """Start the background transcription loop."""
        if self._running.is_set():
            return
        self._running.set()
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        logger.info("Transcriber started")

    def stop(self) -> None:
        """Stop the transcription loop."""
        self._running.clear()
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None
        logger.info("Transcriber stopped")

    def get_transcript(self) -> str:
        """Return the concatenated rolling transcript."""
        return " ".join(self._segments)

    def get_last_segment(self) -> str:
        """Return the most recent transcription segment."""
        return self._segments[-1] if self._segments else ""

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------
    def _loop(self) -> None:
        while self._running.is_set():
            time.sleep(self.transcribe_interval)
            self._process_buffer()

    def _process_buffer(self) -> None:
        """Take accumulated audio, write a temporary WAV, and run whisper.cpp."""
        with self._lock:
            if len(self._audio_buf) == 0:
                return
            raw = bytes(self._audio_buf)
            self._audio_buf.clear()

        # Limit to last buffer_seconds of audio
        max_bytes = self.sample_rate * self.sample_width * self.channels * self.buffer_seconds
        if len(raw) > max_bytes:
            raw = raw[-max_bytes:]

        text = self._run_whisper(raw)
        if text:
            self._segments.append(text)
            logger.debug("Transcribed: %s", text)

    def _run_whisper(self, pcm_data: bytes) -> str:
        """Write PCM to a temp WAV file and invoke whisper.cpp binary."""
        try:
            wav_bytes = self._pcm_to_wav(pcm_data)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
                tmp.write(wav_bytes)
                tmp.flush()
                result = subprocess.run(
                    [
                        self.binary_path,
                        "-m", self.model_path,
                        "-f", tmp.name,
                        "-l", self.language,
                        "--no-timestamps",
                        "-nt",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=15,
                )
            if result.returncode != 0:
                logger.warning("whisper.cpp returned %d: %s", result.returncode, result.stderr.strip())
                return ""
            return result.stdout.strip()
        except FileNotFoundError:
            logger.error(
                "whisper.cpp binary not found at '%s'. "
                "Make sure it is compiled and the path in config.yaml is correct.",
                self.binary_path,
            )
            return ""
        except subprocess.TimeoutExpired:
            logger.warning("whisper.cpp timed out")
            return ""
        except Exception:
            logger.exception("Error running whisper.cpp")
            return ""

    def _pcm_to_wav(self, pcm_data: bytes) -> bytes:
        """Wrap raw PCM data into a valid WAV container."""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(self.channels)
            wf.setsampwidth(self.sample_width)
            wf.setframerate(self.sample_rate)
            wf.writeframes(pcm_data)
        return buf.getvalue()
