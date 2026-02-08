import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  IPCChannel,
  WindowAPI,
  SessionStartPayload,
  SessionStatePayload,
  CaptionIngestPayload,
  CaptionStatusPayload,
  AudioChunkPayload,
  AudioVADPayload,
  TranscriptSegmentPayload,
  CoachHintPayload,
  TeleprompterShowHintPayload,
  GazeMetricPayload,
  GazeAlertPayload,
  OpenAITestConnectionPayload,
  OpenAITestConnectionResponse,
  OpenAISaveKeyPayload,
  OpenAIGetKeyResponse,
  ConfigGetPayload,
  ConfigSetPayload,
  ConfigGetResponse,
} from './ipc/contracts';

// Helper to create event listener cleanup function
function createEventListener<T>(
  channel: string,
  callback: (payload: T) => void
): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

// Expose protected methods to renderer
const api: WindowAPI = {
  // Session
  startSession: (payload: SessionStartPayload) =>
    ipcRenderer.invoke(IPCChannel.SESSION_START, payload),
  stopSession: () => ipcRenderer.invoke(IPCChannel.SESSION_STOP),
  pauseSession: () => ipcRenderer.invoke(IPCChannel.SESSION_PAUSE),
  resumeSession: () => ipcRenderer.invoke(IPCChannel.SESSION_RESUME),
  onSessionState: (callback: (payload: SessionStatePayload) => void) =>
    createEventListener(IPCChannel.SESSION_STATE, callback),

  // Captions
  ingestCaption: (payload: CaptionIngestPayload) =>
    ipcRenderer.invoke(IPCChannel.CAPTIONS_INGEST, payload),
  onCaptionStatus: (callback: (payload: CaptionStatusPayload) => void) =>
    createEventListener(IPCChannel.CAPTIONS_STATUS, callback),

  // Audio
  sendAudioChunk: (payload: AudioChunkPayload) =>
    ipcRenderer.invoke(IPCChannel.AUDIO_CHUNK, payload),
  sendAudioVAD: (payload: AudioVADPayload) =>
    ipcRenderer.invoke(IPCChannel.AUDIO_VAD, payload),

  // Transcription
  onTranscriptSegment: (callback: (payload: TranscriptSegmentPayload) => void) =>
    createEventListener(IPCChannel.TRANSCRIPT_SEGMENT, callback),

  // Coach
  onCoachHint: (callback: (payload: CoachHintPayload) => void) =>
    createEventListener(IPCChannel.COACH_HINT, callback),

  // Teleprompter
  showTeleprompterHint: (payload: TeleprompterShowHintPayload) =>
    ipcRenderer.invoke(IPCChannel.TELEPROMPTER_SHOW_HINT, payload),
  hideTeleprompter: () => ipcRenderer.invoke(IPCChannel.TELEPROMPTER_HIDE),

  // Gaze
  sendGazeMetric: (payload: GazeMetricPayload) =>
    ipcRenderer.invoke(IPCChannel.GAZE_METRIC, payload),
  onGazeAlert: (callback: (payload: GazeAlertPayload) => void) =>
    createEventListener(IPCChannel.GAZE_ALERT, callback),

  // OpenAI
  testOpenAIConnection: (payload: OpenAITestConnectionPayload): Promise<OpenAITestConnectionResponse> =>
    ipcRenderer.invoke(IPCChannel.OPENAI_TEST_CONNECTION, payload),
  saveOpenAIKey: (payload: OpenAISaveKeyPayload) =>
    ipcRenderer.invoke(IPCChannel.OPENAI_SAVE_KEY, payload),
  getOpenAIKey: (): Promise<OpenAIGetKeyResponse> =>
    ipcRenderer.invoke(IPCChannel.OPENAI_GET_KEY),

  // Config
  getConfig: (payload: ConfigGetPayload): Promise<ConfigGetResponse> =>
    ipcRenderer.invoke(IPCChannel.CONFIG_GET, payload),
  setConfig: (payload: ConfigSetPayload) =>
    ipcRenderer.invoke(IPCChannel.CONFIG_SET, payload),
  getAllConfig: () =>
    ipcRenderer.invoke(IPCChannel.CONFIG_GET_ALL),

  // Windows
  openSettings: () => ipcRenderer.invoke(IPCChannel.WINDOW_OPEN_SETTINGS),
  openCaptionFeed: () => ipcRenderer.invoke(IPCChannel.WINDOW_OPEN_CAPTION_FEED),
  openPrepChat: () => ipcRenderer.invoke(IPCChannel.WINDOW_OPEN_PREP_CHAT),
  openPostAnalysis: () => ipcRenderer.invoke(IPCChannel.WINDOW_OPEN_POST_ANALYSIS),
  closeWindow: () => ipcRenderer.invoke(IPCChannel.WINDOW_CLOSE),
};

contextBridge.exposeInMainWorld('api', api);
