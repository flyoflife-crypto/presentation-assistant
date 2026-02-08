# SettingsWindow

The SettingsWindow provides a comprehensive configuration interface for the Presentation Assistant Pro application. It features a tabbed interface with six sections covering all application settings.

## Architecture

### File Structure

```
SettingsWindow/
├── index.html              # HTML template
├── index.tsx               # React mount point
├── SettingsWindow.tsx      # Main component
├── styles.css              # Window-specific styles
├── types.d.ts             # TypeScript type declarations
└── tabs/
    ├── OpenAISetupTab.tsx       # OpenAI API configuration
    ├── AssistantScriptTab.tsx   # System prompt editor
    ├── LiveInputTab.tsx         # Input source configuration
    ├── TeleprompterTab.tsx      # Display settings
    ├── GazeTrainerTab.tsx       # Gaze tracking settings
    └── PrivacyTab.tsx           # Privacy and data settings
```

## Components

### SettingsWindow.tsx

Main component that orchestrates the entire settings interface.

**Features:**
- Tab navigation (6 tabs)
- Configuration state management
- IPC communication via `window.api`
- Loading and saving states
- Success/error notifications
- Action buttons for session control

**State Management:**
- `activeTab`: Currently selected tab
- `config`: All application configuration
- `isLoading`: Loading state indicator
- `isSaving`: Save operation in progress
- `saveStatus`: Success/error messages

**Methods:**
- `loadConfig()`: Loads all configuration from Electron main process
- `handleConfigChange()`: Updates configuration state
- `handleSave()`: Persists configuration via IPC
- `handleStartLive()`: Starts a live coaching session
- `handleStop()`: Stops active session
- `handleOpenPrepChat()`: Opens prep chat window
- `handleOpenPostAnalysis()`: Opens post-analysis window

### Tab Components

Each tab component receives:
- `config`: Current configuration object
- `onConfigChange(key, value)`: Callback to update configuration

#### OpenAISetupTab

**Purpose:** Configure OpenAI API access and model selections

**Settings:**
- API Key (securely stored via keychain)
- Test connection functionality
- Model selection for Coach, Prep, and Analysis
- Latency target configuration

**Key Features:**
- Password-masked API key input
- Real-time connection testing with latency display
- Automatic key storage on successful test
- Model-specific configuration

#### AssistantScriptTab

**Purpose:** Edit the AI assistant's system prompt

**Settings:**
- System prompt (up to 4000 characters)
- Character counter
- Reset to default functionality

**Key Features:**
- Large textarea with character limit
- Live character count display
- Default prompt with best practices
- Customization tips and guidelines

#### LiveInputTab

**Purpose:** Configure input sources for presentations

**Settings:**
- Input mode selection (Captions vs Room Microphone)
- Caption source (Manual, File, Clipboard)
- Caption file path (for file monitoring)
- Microphone device selection

**Key Features:**
- Radio buttons for mutually exclusive modes
- Dynamic microphone device enumeration
- Permission handling for audio access
- Context-sensitive help text

#### TeleprompterTab

**Purpose:** Configure teleprompter display settings

**Settings:**
- Font size (14px - 24px)
- Opacity (20% - 100%)
- Screen position (6 options)
- Watermark display toggle

**Key Features:**
- Live preview of settings
- Responsive sliders
- Position presets
- Share-safe watermark option

#### GazeTrainerTab

**Purpose:** Configure gaze tracking and alerts

**Settings:**
- Enable/disable gaze tracking
- Calibration controls
- Look-away threshold (1-10 seconds)
- Attention threshold (30-90%)

**Key Features:**
- Calibration workflow (placeholder)
- Adjustable alert thresholds
- Privacy notice
- Conditional UI based on enable state

#### PrivacyTab

**Purpose:** Manage data retention and privacy settings

**Settings:**
- Save transcripts toggle
- Save recordings toggle
- Auto-delete after N days
- Status indicator preferences
- Recording indicator toggle

**Key Features:**
- Data retention controls
- Auto-deletion configuration
- Security information display
- Compliance best practices
- Local storage path display

## Usage

### Configuration Keys

The window uses the following configuration keys:

```typescript
{
  // OpenAI
  openaiApiKey: string,
  coachModel: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo',
  prepModel: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo',
  analysisModel: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo',
  latencyTarget: '500' | '1000' | '2000' | '3000',
  
  // Assistant
  systemPrompt: string,
  
  // Live Input
  liveInputMode: 'CAPTIONS' | 'ROOM_MIC',
  captionSource: 'manual' | 'file' | 'clipboard',
  captionFilePath: string,
  micDeviceId: string,
  
  // Teleprompter
  teleprompterFontSize: '14' | '16' | '18' | '20' | '24',
  teleprompterOpacity: number, // 20-100
  teleprompterPosition: 'top-left' | 'top-center' | 'top-right' | 
                        'bottom-left' | 'bottom-center' | 'bottom-right',
  teleprompterWatermark: boolean,
  
  // Gaze Trainer
  gazeTrainerEnabled: boolean,
  gazeLookAwayThreshold: number, // milliseconds
  gazeAttentionThreshold: number, // percentage
  
  // Privacy
  saveTranscripts: boolean,
  saveRecordings: boolean,
  autoDeleteAfterDays: number,
  showStatusIndicators: boolean,
  showRecordingIndicator: boolean,
}
```

### IPC Communication

The window communicates with the Electron main process via `window.api`:

```typescript
// Load all configuration
const config = await window.api.getAllConfig();

// Get specific configuration
const value = await window.api.getConfig({ key: 'systemPrompt' });

// Save configuration
await window.api.setConfig({ key: 'systemPrompt', value: 'new prompt' });

// Test OpenAI connection
const result = await window.api.testOpenAIConnection({ apiKey: 'sk-...' });

// Session control
await window.api.startSession({ mode: 'CAPTIONS', systemPrompt: '...' });
await window.api.stopSession();

// Open other windows
await window.api.openPrepChat();
await window.api.openPostAnalysis();
```

## Styling

The window uses a responsive layout optimized for 800x600 pixels with:

- Consistent spacing and typography
- CSS custom properties for theming
- Flexbox layout for responsiveness
- Smooth transitions and animations
- Accessible focus states

## Accessibility

- Semantic HTML structure
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus visible indicators
- High contrast ratios
- Screen reader compatible

## Future Enhancements

- [ ] Implement actual gaze calibration workflow
- [ ] Add import/export settings functionality
- [ ] Implement preset configurations
- [ ] Add settings search/filter
- [ ] Keyboard shortcuts for tab navigation
- [ ] Validation feedback for all inputs
- [ ] Settings migration on version updates
