# Presentation Assistant Pro

A macOS Electron desktop application for real-time presentation coaching using AI-powered transcription and coaching hints.

## Overview

Presentation Assistant Pro provides real-time coaching during presentations via a teleprompter overlay. It uses OpenAI's Realtime API for transcription and the Responses API for intelligent coaching feedback.

## Features

### 🎤 **Multiple Input Modes**
- **Caption-Driven Mode** (Safe Default)
  - Manual paste captions
  - File tailing (`.txt`, `.vtt`, `.srt`)
  - Clipboard capture (with explicit toggle)
  
- **Room Mic Mode** (In-person/Speakers)
  - Real-time audio capture via microphone
  - Voice Activity Detection (VAD)
  - Streaming transcription using OpenAI Realtime API

### 🤖 **AI Coaching**
- Real-time coaching hints during presentations
- Question detection (English & Russian)
- Pause detection for strategic interventions
- Topic drift awareness
- Filler word detection
- Cooldown management (6s minimum between hints)

### 💬 **Preparation & Analysis**
- **Prep Mode**: Chat with AI to prepare for your presentation
- **Post-Analysis**: Import transcripts for post-presentation feedback
- System prompt customization for personalized coaching

### 🎯 **Gaze Training** (Beta)
- Eye contact tracking using WebGazer.js
- Calibration system
- Real-time gaze metrics
- Look-away alerts

### 🔒 **Privacy & Security**
- API keys stored securely in macOS Keychain (via keytar)
- Configurable session saving
- Share-Safe mode with visible watermark
- Persistent indicators for mic/camera/clipboard usage

## Stack

- **Frontend**: React + TypeScript
- **Backend**: Electron (Main Process)
- **APIs**: 
  - OpenAI Realtime API (WebSocket transcription)
  - OpenAI Responses API (HTTPS coaching)
- **Platform**: macOS (Apple Silicon first-class support)

## Architecture

### Main Process Services

- **EventBus**: Event-driven communication between services
- **AppLifecycle**: Window management, tray, global shortcuts
- **SessionOrchestrator**: State machine for session lifecycle
- **ConfigStore**: Non-secret settings storage
- **SecretStore**: Secure API key storage (macOS Keychain)
- **ContextStore**: Long-context management with automatic compaction
- **ResponsesCoachService**: OpenAI Responses API integration
- **RealtimeTranscriptionService**: OpenAI Realtime API (WebSocket)
- **CaptionIngestService**: Normalized caption ingestion
- **RoomMicAudioPipeline**: Audio buffering and processing
- **CoachPolicyEngine**: Hint triggering logic
- **HintComposer**: Hint formatting and validation

### Renderer Windows

1. **SettingsWindow**: Configuration (6 tabs)
   - OpenAI Setup
   - Assistant Script (System Prompt)
   - Live Input (Captions vs Room Mic)
   - Teleprompter (Font, opacity, position)
   - Gaze Trainer
   - Privacy Settings

2. **CaptionFeedWindow**: Live caption display and manual input
3. **PrepChatWindow**: Pre-presentation AI chat
4. **TeleprompterWindow**: Transparent overlay for hints
5. **GazeTrainerWindow**: Eye tracking and calibration
6. **RoomMicCaptureWindow**: Audio capture interface

### IPC Communication

All IPC communication is strongly typed via `electron/ipc/contracts.ts`:
- Session management
- Caption ingestion
- Audio streaming
- Transcript events
- Coach hints
- Configuration
- Window control

## Installation

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Build for production
npm run build

# Package macOS app
npm run package

# Package universal binary (Intel + Apple Silicon)
npm run package:universal
```

## Development

### Project Structure

```
presentation-assistant/
├── electron/
│   ├── main.ts                 # Main process entry point
│   ├── preload.ts              # Context bridge for IPC
│   ├── ipc/
│   │   └── contracts.ts        # Typed IPC definitions
│   └── services/               # Main process services
│       ├── EventBus.ts
│       ├── AppLifecycle.ts
│       ├── SessionOrchestrator.ts
│       ├── ConfigStore.ts
│       ├── SecretStore.ts
│       ├── ContextStore.ts
│       ├── ResponsesCoachService.ts
│       ├── RealtimeTranscriptionService.ts
│       ├── CaptionIngestService.ts
│       ├── RoomMicAudioPipeline.ts
│       ├── CoachPolicyEngine.ts
│       ├── HintComposer.ts
│       └── adapters/
│           ├── ManualPasteAdapter.ts
│           ├── FileTailAdapter.ts
│           └── ClipboardAdapter.ts
├── src/
│   ├── windows/                # React renderer windows
│   │   ├── SettingsWindow/
│   │   ├── CaptionFeedWindow/
│   │   ├── PrepChatWindow/
│   │   ├── TeleprompterWindow/
│   │   ├── GazeTrainerWindow/
│   │   └── RoomMicCaptureWindow/
│   └── shared/
│       ├── ui/                 # Reusable UI components
│       ├── types/              # Shared TypeScript types
│       └── styles/             # Common CSS
├── assets/
│   └── icon.png                # App icon
├── build/
│   └── entitlements.mac.plist  # macOS entitlements
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
├── webpack.renderer.config.ts
├── webpack.electron.config.ts
└── electron-builder.yml
```

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run package` - Package macOS app (arm64)
- `npm run package:universal` - Package universal binary
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Configuration

1. **OpenAI API Key**: Set via Settings window (stored in macOS Keychain)
2. **System Prompt**: Customize in Settings → Assistant Script tab
3. **Input Mode**: Choose Captions or Room Mic in Settings → Live Input tab
4. **Teleprompter**: Configure appearance in Settings → Teleprompter tab
5. **Privacy**: Configure saving and indicators in Settings → Privacy tab

## Usage

### Starting a Live Session

1. Open Presentation Assistant Pro
2. Go to Settings and configure:
   - Add your OpenAI API key
   - Customize the system prompt (optional)
   - Choose input mode (Captions or Room Mic)
   - Configure teleprompter settings
3. Click "Start Live" to begin a session
4. Present while receiving real-time coaching hints in the teleprompter overlay

### Caption Mode

**Manual Paste:**
1. Open Caption Feed window
2. Paste captions as you speak
3. Hints appear automatically based on content

**File Tailing:**
1. Configure file path in Settings → Live Input
2. Select "File" as caption source
3. External app writes to the file
4. Captions are automatically ingested

**Clipboard:**
1. Enable clipboard capture in Settings → Live Input
2. Indicator shows "Clipboard capture ON"
3. New clipboard text is automatically ingested

### Room Mic Mode

1. Select "Room Mic" in Settings → Live Input
2. Choose microphone device
3. Click "Start Live"
4. Speak naturally - audio is transcribed in real-time
5. Coaching hints appear based on transcription

### Preparation Chat

1. Click "Open Prep Chat" in Settings
2. Chat with AI to prepare for your presentation
3. Ask questions, get feedback, practice responses

## Security

- ✅ API keys stored in macOS Keychain (not plain text)
- ✅ All API calls use HTTPS/WSS with TLS
- ✅ Context isolation enabled on all windows
- ✅ Node integration disabled in renderer
- ✅ No remote module access
- ✅ External links open in system browser
- ✅ Configurable session saving (opt-in)

## Privacy

- Session transcripts are NOT saved by default
- Enable saving in Settings → Privacy tab
- Mic/Camera/Clipboard indicators always visible when active
- Share-Safe mode adds visible watermark to teleprompter
- Audio recordings can be auto-deleted after N days

## Requirements

- macOS 10.15 or later
- Apple Silicon (M1/M2/M3) or Intel Mac
- OpenAI API key
- Microphone (for Room Mic mode)
- Camera (optional, for Gaze Training)

## Troubleshooting

### API Connection Issues
- Verify API key in Settings → OpenAI Setup
- Test connection using "Test Connection" button
- Check internet connectivity
- Verify firewall settings allow HTTPS/WSS

### Microphone Not Working
- Grant microphone permissions in macOS System Settings
- Select correct device in Settings → Live Input
- Check audio level meter in Room Mic Capture window

### Teleprompter Not Showing
- Check Teleprompter is ON in tray menu
- Verify window is not minimized
- Adjust position in Settings → Teleprompter

### Gaze Training Issues
- Grant camera permissions in macOS System Settings
- Perform full calibration before use
- Ensure good lighting conditions
- Keep face centered in camera view

## License

MIT

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

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