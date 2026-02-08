# Quick Start Guide

## Prerequisites

- macOS 10.15 or later
- Node.js 18+ and npm
- OpenAI API key
- Xcode Command Line Tools (for native modules)

## Installation

```bash
# Clone repository
git clone https://github.com/flyoflife-crypto/presentation-assistant.git
cd presentation-assistant

# Install dependencies
npm install

# Note: keytar requires native compilation
# If installation fails, ensure Xcode CLI tools are installed:
xcode-select --install
```

## Development

```bash
# Start development mode (hot reload enabled)
npm run dev

# This will:
# 1. Start webpack dev server for React (port 3000)
# 2. Build electron main process
# 3. Launch Electron app
```

## First Run Setup

1. **Launch the app** - Settings window opens automatically
2. **Add API Key** - Go to "OpenAI Setup" tab
   - Paste your OpenAI API key
   - Click "Test Connection" to verify
   - Key is saved securely in macOS Keychain
3. **Configure System Prompt** - Go to "Assistant Script" tab
   - Review or customize the coaching prompt
   - This defines how the AI coach behaves
4. **Choose Input Mode** - Go to "Live Input" tab
   - Select "Captions" for safe default mode
   - Or "Room Mic" for real-time audio capture
5. **Save Settings** - Click "Save" button

## Running Your First Session

### Caption Mode (Recommended for First Try)

1. Click "Start Live" in Settings
2. Click "Open Caption Feed" to open caption window
3. Type or paste text in the caption input box
4. Click "Submit" to send captions
5. Watch for coaching hints in the Teleprompter overlay

### Room Mic Mode

1. Select "Room Mic" in Settings → Live Input
2. Choose your microphone device
3. Click "Start Live"
4. Grant microphone permissions when prompted
5. Speak naturally - your speech is transcribed
6. Coaching hints appear automatically

## Using Prep Chat

1. Click "Open Prep Chat" button in Settings
2. Chat with the AI to prepare for your presentation
3. Ask questions like:
   - "Help me prepare for a 10-minute talk on React hooks"
   - "What are key points I should cover?"
   - "How should I handle Q&A?"

## Teleprompter Settings

1. Go to Settings → Teleprompter tab
2. Adjust:
   - Font size (14-24px)
   - Opacity (20-100%)
   - Position (top-left, top-center, etc.)
   - Share-Safe watermark (ON recommended)
3. Hints will appear in the configured position

## Privacy Settings

1. Go to Settings → Privacy tab
2. Configure:
   - Save transcripts: ON/OFF
   - Save recordings: ON/OFF
   - Auto-delete after N days
   - Status indicators visibility

## Stopping a Session

1. Click "Stop" in Settings window
2. Or use tray menu → Stop Session
3. All services are gracefully stopped

## Troubleshooting

### Can't Install Dependencies
```bash
# Ensure Xcode CLI tools installed
xcode-select --install

# Clean and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Microphone Not Working
- Grant permissions: System Settings → Privacy & Security → Microphone
- Check device selection in Settings → Live Input
- Restart app after granting permissions

### API Connection Fails
- Verify API key is correct
- Check internet connection
- Ensure firewall allows HTTPS/WSS
- Try test connection button

### Teleprompter Not Visible
- Check tray menu shows "Teleprompter: ON"
- Adjust opacity if too transparent
- Try different position setting
- Ensure window isn't minimized

## Building for Production

```bash
# Build production version
npm run build

# Package macOS app (arm64)
npm run package

# Package universal binary (Intel + Apple Silicon)
npm run package:universal

# Output in: ./release/
```

## Development Tips

### Hot Reload
- React changes reload automatically
- Electron main process changes require restart
- Use `Cmd+R` to reload renderer windows

### Debugging
- Main process: Check terminal output
- Renderer: Use Chrome DevTools (View → Toggle Developer Tools)
- Enable verbose logging in ConfigStore

### File Structure
```
electron/          # Main process code
src/windows/       # React renderer windows
src/shared/        # Shared UI components
dist/              # Build output (gitignored)
release/           # Packaged apps (gitignored)
```

## Useful Commands

```bash
npm run dev          # Development mode
npm run build        # Production build
npm run package      # Package macOS app
npm run lint         # Run linter
npm run type-check   # TypeScript validation
```

## Getting Help

- Check IMPLEMENTATION.md for architecture details
- Review README.md for full documentation
- Open issue on GitHub for bugs/features
- Check console logs for error messages

## What's Next?

1. **Customize System Prompt** - Tailor AI coaching to your needs
2. **Try Different Input Modes** - Test both captions and mic
3. **Experiment with Prep Chat** - Practice before presentations
4. **Configure Teleprompter** - Find your ideal settings
5. **Enable Gaze Training** - Improve eye contact (beta)

Happy presenting! 🎤