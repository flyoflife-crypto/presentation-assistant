import { app, ipcMain, BrowserWindow } from 'electron';
import { appLifecycle, WindowType } from './services/AppLifecycle';
import { eventBus } from './services/EventBus';
import { sessionOrchestrator } from './services/SessionOrchestrator';
import { configStore } from './services/ConfigStore';
import { secretStore } from './services/SecretStore';
import { Events } from './services/EventBus';
import {
  IPCChannel,
  SessionStartPayload,
  CaptionIngestPayload,
  AudioChunkPayload,
  AudioVADPayload,
  TeleprompterShowHintPayload,
  GazeMetricPayload,
  OpenAITestConnectionPayload,
  OpenAITestConnectionResponse,
  OpenAISaveKeyPayload,
  OpenAIGetKeyResponse,
  ConfigGetPayload,
  ConfigSetPayload,
  ConfigGetResponse,
  SessionStatePayload,
  CaptionStatusPayload,
  TranscriptSegmentPayload,
  CoachHintPayload,
  GazeAlertPayload,
} from './ipc/contracts';

/**
 * Main process entry point
 * Initializes the application and sets up IPC handlers
 */

// Setup error handlers
process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Main] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle app ready event
app.whenReady().then(async () => {
  console.log('[Main] App ready, initializing...');
  
  // Initialize AppLifecycle
  await appLifecycle.initialize();
  
  // Setup IPC handlers
  setupIPCHandlers();
  
  // Setup event bus listeners
  setupEventBusListeners();
  
  // Create initial settings window
  appLifecycle.showWindow(WindowType.SETTINGS);
  
  console.log('[Main] Initialization complete');
});

/**
 * Setup IPC handlers for all application features
 */
function setupIPCHandlers(): void {
  // Session Management
  ipcMain.handle(IPCChannel.SESSION_START, async (_event, payload: SessionStartPayload) => {
    try {
      await sessionOrchestrator.startSession(payload);
    } catch (error) {
      console.error('[Main] Failed to start session:', error);
      throw error;
    }
  });

  ipcMain.handle(IPCChannel.SESSION_STOP, async () => {
    try {
      await sessionOrchestrator.stopSession();
    } catch (error) {
      console.error('[Main] Failed to stop session:', error);
      throw error;
    }
  });

  ipcMain.handle(IPCChannel.SESSION_PAUSE, async () => {
    try {
      await sessionOrchestrator.pauseSession();
    } catch (error) {
      console.error('[Main] Failed to pause session:', error);
      throw error;
    }
  });

  ipcMain.handle(IPCChannel.SESSION_RESUME, async () => {
    try {
      await sessionOrchestrator.resumeSession();
    } catch (error) {
      console.error('[Main] Failed to resume session:', error);
      throw error;
    }
  });

  // Caption Ingestion
  ipcMain.handle(IPCChannel.CAPTIONS_INGEST, async (_event, payload: CaptionIngestPayload) => {
    try {
      eventBus.emitTyped(Events.CAPTION_INGESTED, payload);
    } catch (error) {
      console.error('[Main] Failed to ingest caption:', error);
      throw error;
    }
  });

  // Audio Handling
  ipcMain.handle(IPCChannel.AUDIO_CHUNK, async (_event, payload: AudioChunkPayload) => {
    try {
      eventBus.emitTyped(Events.AUDIO_CHUNK_RECEIVED, payload);
    } catch (error) {
      console.error('[Main] Failed to process audio chunk:', error);
      throw error;
    }
  });

  ipcMain.handle(IPCChannel.AUDIO_VAD, async (_event, payload: AudioVADPayload) => {
    try {
      eventBus.emitTyped(Events.AUDIO_VAD_DETECTED, payload);
    } catch (error) {
      console.error('[Main] Failed to process VAD:', error);
      throw error;
    }
  });

  // Teleprompter
  ipcMain.handle(IPCChannel.TELEPROMPTER_SHOW_HINT, async (_event, payload: TeleprompterShowHintPayload) => {
    try {
      eventBus.emitTyped(Events.TELEPROMPTER_SHOW, payload);
      broadcastToWindow(WindowType.TELEPROMPTER, IPCChannel.TELEPROMPTER_SHOW_HINT, payload);
    } catch (error) {
      console.error('[Main] Failed to show teleprompter hint:', error);
      throw error;
    }
  });

  ipcMain.handle(IPCChannel.TELEPROMPTER_HIDE, async () => {
    try {
      eventBus.emitTyped(Events.TELEPROMPTER_HIDE, {});
      broadcastToWindow(WindowType.TELEPROMPTER, IPCChannel.TELEPROMPTER_HIDE, {});
    } catch (error) {
      console.error('[Main] Failed to hide teleprompter:', error);
      throw error;
    }
  });

  // Gaze Tracking
  ipcMain.handle(IPCChannel.GAZE_METRIC, async (_event, payload: GazeMetricPayload) => {
    try {
      eventBus.emitTyped(Events.GAZE_METRIC_RECEIVED, payload);
    } catch (error) {
      console.error('[Main] Failed to process gaze metric:', error);
      throw error;
    }
  });

  // OpenAI
  ipcMain.handle(IPCChannel.OPENAI_TEST_CONNECTION, async (_event, payload: OpenAITestConnectionPayload): Promise<OpenAITestConnectionResponse> => {
    try {
      const startTime = Date.now();
      
      // Make a simple test request to OpenAI API
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${payload.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        return { success: true, latency };
      } else {
        const errorData = await response.json();
        return { 
          success: false, 
          error: errorData.error?.message || 'API request failed',
          latency,
        };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  ipcMain.handle(IPCChannel.OPENAI_SAVE_KEY, async (_event, payload: OpenAISaveKeyPayload) => {
    try {
      await secretStore.setApiKey(payload.apiKey);
    } catch (error) {
      console.error('[Main] Failed to save API key:', error);
      throw error;
    }
  });

  ipcMain.handle(IPCChannel.OPENAI_GET_KEY, async (): Promise<OpenAIGetKeyResponse> => {
    try {
      const apiKey = await secretStore.getApiKey();
      return { apiKey };
    } catch (error) {
      console.error('[Main] Failed to get API key:', error);
      return { apiKey: null };
    }
  });

  // Config Management
  ipcMain.handle(IPCChannel.CONFIG_GET, async (_event, payload: ConfigGetPayload): Promise<ConfigGetResponse> => {
    try {
      const value = configStore.get(payload.key);
      return { value };
    } catch (error) {
      console.error('[Main] Failed to get config:', error);
      throw error;
    }
  });

  ipcMain.handle(IPCChannel.CONFIG_SET, async (_event, payload: ConfigSetPayload) => {
    try {
      configStore.set(payload.key, payload.value);
    } catch (error) {
      console.error('[Main] Failed to set config:', error);
      throw error;
    }
  });

  ipcMain.handle(IPCChannel.CONFIG_GET_ALL, async () => {
    try {
      return configStore.getAll();
    } catch (error) {
      console.error('[Main] Failed to get all config:', error);
      throw error;
    }
  });

  // Window Management
  ipcMain.handle(IPCChannel.WINDOW_OPEN_SETTINGS, () => {
    appLifecycle.showWindow(WindowType.SETTINGS);
  });

  ipcMain.handle(IPCChannel.WINDOW_OPEN_CAPTION_FEED, () => {
    appLifecycle.showWindow(WindowType.CAPTION_FEED);
  });

  ipcMain.handle(IPCChannel.WINDOW_OPEN_PREP_CHAT, () => {
    appLifecycle.showWindow(WindowType.PREP_CHAT);
  });

  ipcMain.handle(IPCChannel.WINDOW_OPEN_POST_ANALYSIS, () => {
    // Post analysis window not yet implemented
    console.log('[Main] Post Analysis window requested (not yet implemented)');
  });

  ipcMain.handle(IPCChannel.WINDOW_CLOSE, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.close();
    }
  });

  console.log('[Main] IPC handlers registered');
}

/**
 * Setup event bus listeners to broadcast events to renderer processes
 */
function setupEventBusListeners(): void {
  // Broadcast session state changes to all windows
  eventBus.onTyped<SessionStatePayload>(Events.SESSION_STATE_CHANGED, (payload) => {
    broadcastToAllWindows(IPCChannel.SESSION_STATE, payload);
  });

  // Broadcast caption status changes
  eventBus.onTyped<CaptionStatusPayload>(Events.CAPTION_STATUS_CHANGED, (payload) => {
    broadcastToAllWindows(IPCChannel.CAPTIONS_STATUS, payload);
  });

  // Broadcast transcript segments
  eventBus.onTyped<TranscriptSegmentPayload>(Events.TRANSCRIPT_SEGMENT_RECEIVED, (payload) => {
    broadcastToAllWindows(IPCChannel.TRANSCRIPT_SEGMENT, payload);
  });

  // Broadcast coach hints
  eventBus.onTyped<CoachHintPayload>(Events.COACH_HINT_GENERATED, (payload) => {
    broadcastToAllWindows(IPCChannel.COACH_HINT, payload);
    // Also show in teleprompter
    broadcastToWindow(WindowType.TELEPROMPTER, IPCChannel.TELEPROMPTER_SHOW_HINT, {
      text: payload.text,
      ttlMs: payload.ttlMs,
      priority: payload.priority,
    });
  });

  // Broadcast gaze alerts
  eventBus.onTyped<GazeAlertPayload>(Events.GAZE_ALERT_TRIGGERED, (payload) => {
    broadcastToAllWindows(IPCChannel.GAZE_ALERT, payload);
  });

  console.log('[Main] Event bus listeners registered');
}

/**
 * Helper function to broadcast to all open windows
 */
function broadcastToAllWindows(channel: string, data: any): void {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, data);
    }
  });
}

/**
 * Helper function to broadcast to a specific window type
 */
function broadcastToWindow(windowType: WindowType, channel: string, data: any): void {
  const window = appLifecycle.getWindow(windowType);
  if (window && !window.isDestroyed()) {
    window.webContents.send(channel, data);
  }
}
