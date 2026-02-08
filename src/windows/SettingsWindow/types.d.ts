import type {
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
} from '../../../electron/ipc/contracts';

declare global {
  interface Window {
    api: WindowAPI;
  }
}

export {};
