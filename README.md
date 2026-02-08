# Presentation Assistant Pro

A macOS Electron desktop application for real-time presentation coaching.

## Stack
- Electron + React + TypeScript
- OpenAI Realtime API (transcription)
- OpenAI Responses API (coaching)
- macOS (Apple Silicon first-class)

---

## Interview Assistant (LockedIn AI alternative)

An open-source, real-time interview helper that listens to audio, transcribes
speech with **whisper.cpp**, generates concise hints via a local **Ollama** LLM,
and displays them in an always-on-top transparent overlay built with **Electron**.

### Architecture

```
Microphone / Virtual Device
        │
  audio_capture.py   (PyAudio)
        │
  transcriber.py     (whisper.cpp)
        │
  llm_agent.py       (Ollama API)
        │
  backend_orchestrator.py  ──WebSocket──▶  Electron Overlay (frontend/)
```

### Prerequisites

| Component | Install |
|-----------|---------|
| Python 3.10+ | System package manager or pyenv |
| Node.js 18+ | https://nodejs.org |
| PortAudio | `brew install portaudio` (macOS) · `sudo apt install portaudio19-dev` (Linux) |
| whisper.cpp | Build from https://github.com/ggerganov/whisper.cpp and place binary in PATH or update `config/config.yaml` |
| Ollama | https://ollama.com — then `ollama pull llama3.2:3b` |

### Quick Start

```bash
# 1. Install Python dependencies
pip install -r backend/requirements.txt

# 2. Install frontend dependencies
cd frontend && npm install && cd ..

# 3. Pull an LLM model
ollama pull llama3.2:3b

# 4. Download a whisper.cpp GGML model
mkdir -p models
# e.g. wget https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin -O models/ggml-base.en.bin

# 5. Start the Python backend
python -m backend.backend_orchestrator

# 6. (In another terminal) Start the overlay
cd frontend && npm start
```

### Configuration

Edit `config/config.yaml` to change:

- Audio device (`audio.device_index`) — run `python -m backend.audio_capture --list`
- whisper.cpp binary / model paths
- Ollama model and system prompt
- WebSocket port
- Overlay window size and hotkey (`CmdOrCtrl+Shift+H` by default)

### Hotkeys

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Shift + H` | Toggle overlay visibility |