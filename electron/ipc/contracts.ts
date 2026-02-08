// IPC Channel Enums
export enum IPCChannel {
  // Session Management
  SESSION_START = 'session:start',
  SESSION_STOP = 'session:stop',
  SESSION_PAUSE = 'session:pause',
  SESSION_RESUME = 'session:resume',
  SESSION_STATE = 'session:state',

  // Captions
  CAPTIONS_INGEST = 'captions:ingest',
  CAPTIONS_STATUS = 'captions:status',

  // Audio
  AUDIO_CHUNK = 'audio:chunk',
  AUDIO_VAD = 'audio:vad',

  // Transcription
  TRANSCRIPT_SEGMENT = 'transcript:segment',

  // Coach
  COACH_HINT = 'coach:hint',

  // Teleprompter
  TELEPROMPTER_SHOW_HINT = 'teleprompter:showHint',
  TELEPROMPTER_HIDE = 'teleprompter:hide',

  // Gaze
  GAZE_METRIC = 'gaze:metric',
  GAZE_ALERT = 'gaze:alert',

  // OpenAI
  OPENAI_TEST_CONNECTION = 'openai:testConnection',
  OPENAI_SAVE_KEY = 'openai:saveKey',
  OPENAI_GET_KEY = 'openai:getKey',

  // Config
  CONFIG_GET = 'config:get',
  CONFIG_SET = 'config:set',
  CONFIG_GET_ALL = 'config:getAll',

  // Windows
  WINDOW_OPEN_SETTINGS = 'window:openSettings',
  WINDOW_OPEN_CAPTION_FEED = 'window:openCaptionFeed',
  WINDOW_OPEN_PREP_CHAT = 'window:openPrepChat',
  WINDOW_OPEN_POST_ANALYSIS = 'window:openPostAnalysis',
  WINDOW_CLOSE = 'window:close',
}

// Session Types
export enum SessionState {
  IDLE = 'Idle',
  STARTING = 'Starting',
  LIVE = 'Live',
  PAUSED = 'Paused',
  STOPPING = 'Stopping',
}

export enum LiveInputMode {
  CAPTIONS = 'CAPTIONS',
  ROOM_MIC = 'ROOM_MIC',
}

export interface SessionStartPayload {
  mode: LiveInputMode;
  systemPrompt: string;
  micDeviceId?: string;
  captionSource?: 'manual' | 'file' | 'clipboard';
  captionFilePath?: string;
}

export interface SessionStatePayload {
  state: SessionState;
  mode?: LiveInputMode;
  startedAt?: number;
}

// Caption Types
export interface CaptionIngestPayload {
  source: 'manual' | 'file' | 'clipboard';
  text: string;
  timestamp: number;
}

export interface CaptionStatusPayload {
  active: boolean;
  source?: string;
  lastIngestAt?: number;
}

// Audio Types
export interface AudioChunkPayload {
  buffer: ArrayBuffer;
  timestamp: number;
  sampleRate: number;
}

export interface AudioVADPayload {
  isSpeech: boolean;
  confidence: number;
  timestamp: number;
}

// Transcript Types
export interface TranscriptSegmentPayload {
  id: string;
  source: 'ROOM_MIC' | 'CAPTIONS';
  text: string;
  receivedAt: number;
  itemId?: string;
  tsStart?: number;
  tsEnd?: number;
}

// Coach Types
export interface CoachHintPayload {
  text: string;
  ttlMs: number;
  priority: number;
  timestamp: number;
}

// Teleprompter Types
export interface TeleprompterShowHintPayload {
  text: string;
  ttlMs: number;
  priority: number;
}

// Gaze Types
export interface GazeMetricPayload {
  x: number;
  y: number;
  confidence: number;
  timestamp: number;
}

export interface GazeAlertPayload {
  type: 'look-away' | 'poor-attention';
  severity: 'low' | 'medium' | 'high';
  message: string;
  timestamp: number;
}

// OpenAI Types
export interface OpenAITestConnectionPayload {
  apiKey: string;
}

export interface OpenAITestConnectionResponse {
  success: boolean;
  error?: string;
  latency?: number;
}

export interface OpenAISaveKeyPayload {
  apiKey: string;
}

export interface OpenAIGetKeyResponse {
  apiKey: string | null;
}

// Config Types
export interface ConfigGetPayload {
  key: string;
}

export interface ConfigSetPayload {
  key: string;
  value: any;
}

export interface ConfigGetResponse {
  value: any;
}

// Window API Type Definition
export interface WindowAPI {
  // Session
  startSession: (payload: SessionStartPayload) => Promise<void>;
  stopSession: () => Promise<void>;
  pauseSession: () => Promise<void>;
  resumeSession: () => Promise<void>;
  onSessionState: (callback: (payload: SessionStatePayload) => void) => () => void;

  // Captions
  ingestCaption: (payload: CaptionIngestPayload) => Promise<void>;
  onCaptionStatus: (callback: (payload: CaptionStatusPayload) => void) => () => void;

  // Audio
  sendAudioChunk: (payload: AudioChunkPayload) => Promise<void>;
  sendAudioVAD: (payload: AudioVADPayload) => Promise<void>;

  // Transcription
  onTranscriptSegment: (callback: (payload: TranscriptSegmentPayload) => void) => () => void;

  // Coach
  onCoachHint: (callback: (payload: CoachHintPayload) => void) => () => void;

  // Teleprompter
  showTeleprompterHint: (payload: TeleprompterShowHintPayload) => Promise<void>;
  hideTeleprompter: () => Promise<void>;

  // Gaze
  sendGazeMetric: (payload: GazeMetricPayload) => Promise<void>;
  onGazeAlert: (callback: (payload: GazeAlertPayload) => void) => () => void;

  // OpenAI
  testOpenAIConnection: (payload: OpenAITestConnectionPayload) => Promise<OpenAITestConnectionResponse>;
  saveOpenAIKey: (payload: OpenAISaveKeyPayload) => Promise<void>;
  getOpenAIKey: () => Promise<OpenAIGetKeyResponse>;

  // Config
  getConfig: (payload: ConfigGetPayload) => Promise<ConfigGetResponse>;
  setConfig: (payload: ConfigSetPayload) => Promise<void>;
  getAllConfig: () => Promise<Record<string, any>>;

  // Windows
  openSettings: () => Promise<void>;
  openCaptionFeed: () => Promise<void>;
  openPrepChat: () => Promise<void>;
  openPostAnalysis: () => Promise<void>;
  closeWindow: () => Promise<void>;
}

// Global type declaration for window.api
declare global {
  interface Window {
    api: WindowAPI;
  }
}
