import { eventBus } from './EventBus';
import { captionIngestService } from './CaptionIngestService';
import { roomMicAudioPipeline } from './RoomMicAudioPipeline';
import { realtimeTranscriptionService } from './RealtimeTranscriptionService';
import { responsesCoachService } from './ResponsesCoachService';
import { coachPolicyEngine } from './CoachPolicyEngine';
import { SessionState, LiveInputMode } from '../ipc/contracts';

export interface SessionConfig {
  mode: LiveInputMode;
  systemPrompt: string;
  micDeviceId?: string;
  captionSource?: 'manual' | 'file' | 'clipboard';
  captionFilePath?: string;
}

export interface StateTransition {
  from: SessionState;
  to: SessionState;
  timestamp: number;
  reason?: string;
}

export interface CancellationToken {
  cancelled: boolean;
  cancel: () => void;
  throwIfCancelled: () => void;
}

/**
 * SessionOrchestrator - Central state machine for session lifecycle
 * Manages transitions between states and coordinates all services
 */
export class SessionOrchestrator {
  private currentState: SessionState = SessionState.IDLE;
  private currentMode: LiveInputMode | null = null;
  private sessionStartTime: number = 0;
  private stateHistory: StateTransition[] = [];
  private cancellationToken: CancellationToken | null = null;
  private transitionInProgress: boolean = false;

  // Valid state transitions
  private readonly validTransitions: Record<SessionState, SessionState[]> = {
    [SessionState.IDLE]: [SessionState.STARTING],
    [SessionState.STARTING]: [SessionState.LIVE, SessionState.IDLE],
    [SessionState.LIVE]: [SessionState.PAUSED, SessionState.STOPPING],
    [SessionState.PAUSED]: [SessionState.LIVE, SessionState.STOPPING],
    [SessionState.STOPPING]: [SessionState.IDLE],
  };

  constructor() {
    this.setupEventHandlers();
  }

  /**
   * Start a new session
   */
  async startSession(config: SessionConfig): Promise<void> {
    // Validate state transition
    this.validateTransition(SessionState.STARTING);
    
    // Create cancellation token
    this.cancellationToken = this.createCancellationToken();

    try {
      // Transition to STARTING
      await this.transitionTo(SessionState.STARTING, 'User initiated session start');

      // Start services based on mode
      if (config.mode === LiveInputMode.ROOM_MIC) {
        await this.startRoomMicMode(config, this.cancellationToken);
      } else if (config.mode === LiveInputMode.CAPTIONS) {
        await this.startCaptionsMode(config, this.cancellationToken);
      } else {
        throw new Error(`Invalid session mode: ${config.mode}`);
      }

      // Check if cancelled during startup
      this.cancellationToken.throwIfCancelled();

      // Start coach service
      await responsesCoachService.startSession(config.systemPrompt);

      // Transition to LIVE
      this.currentMode = config.mode;
      this.sessionStartTime = Date.now();
      await this.transitionTo(SessionState.LIVE, 'All services started successfully');

      console.log(`[SessionOrchestrator] Session started in ${config.mode} mode`);
    } catch (error) {
      console.error('[SessionOrchestrator] Failed to start session:', error);
      
      // Cleanup on failure
      await this.emergencyCleanup();
      
      // Transition back to IDLE
      await this.transitionTo(SessionState.IDLE, `Startup failed: ${(error as Error).message}`);
      
      throw error;
    }
  }

  /**
   * Stop the current session
   */
  async stopSession(): Promise<void> {
    // Validate state transition
    const currentState = this.currentState;
    if (currentState === SessionState.IDLE || currentState === SessionState.STOPPING) {
      console.warn('[SessionOrchestrator] Session already stopped or stopping');
      return;
    }

    // Cancel any ongoing operations
    if (this.cancellationToken) {
      this.cancellationToken.cancel();
    }

    try {
      // Transition to STOPPING
      await this.transitionTo(SessionState.STOPPING, 'User initiated session stop');

      // Stop services based on mode
      if (this.currentMode === LiveInputMode.ROOM_MIC) {
        await this.stopRoomMicMode();
      } else if (this.currentMode === LiveInputMode.CAPTIONS) {
        await this.stopCaptionsMode();
      }

      // Stop coach service
      responsesCoachService.stopSession();

      // Reset engine
      coachPolicyEngine.reset();

      // Transition to IDLE
      this.currentMode = null;
      this.sessionStartTime = 0;
      this.cancellationToken = null;
      await this.transitionTo(SessionState.IDLE, 'All services stopped successfully');

      console.log('[SessionOrchestrator] Session stopped');
    } catch (error) {
      console.error('[SessionOrchestrator] Error stopping session:', error);
      
      // Force cleanup
      await this.emergencyCleanup();
      await this.transitionTo(SessionState.IDLE, 'Emergency cleanup after stop error');
      
      throw error;
    }
  }

  /**
   * Pause the current session
   */
  async pauseSession(): Promise<void> {
    // Validate state transition
    this.validateTransition(SessionState.PAUSED);

    try {
      await this.transitionTo(SessionState.PAUSED, 'User paused session');

      // Pause services based on mode
      if (this.currentMode === LiveInputMode.ROOM_MIC) {
        roomMicAudioPipeline.stop();
      } else if (this.currentMode === LiveInputMode.CAPTIONS) {
        await captionIngestService.stop();
      }

      console.log('[SessionOrchestrator] Session paused');
    } catch (error) {
      console.error('[SessionOrchestrator] Error pausing session:', error);
      throw error;
    }
  }

  /**
   * Resume a paused session
   */
  async resumeSession(): Promise<void> {
    // Validate state transition
    this.validateTransition(SessionState.LIVE);

    try {
      await this.transitionTo(SessionState.LIVE, 'User resumed session');

      // Resume services based on mode
      if (this.currentMode === LiveInputMode.ROOM_MIC) {
        await roomMicAudioPipeline.start();
      } else if (this.currentMode === LiveInputMode.CAPTIONS) {
        await captionIngestService.start();
      }

      console.log('[SessionOrchestrator] Session resumed');
    } catch (error) {
      console.error('[SessionOrchestrator] Error resuming session:', error);
      throw error;
    }
  }

  /**
   * Get current session state
   */
  getState(): SessionState {
    return this.currentState;
  }

  /**
   * Get current session mode
   */
  getMode(): LiveInputMode | null {
    return this.currentMode;
  }

  /**
   * Get session statistics
   */
  getStats(): {
    state: SessionState;
    mode: LiveInputMode | null;
    startedAt: number;
    duration: number;
    stateHistoryCount: number;
  } {
    return {
      state: this.currentState,
      mode: this.currentMode,
      startedAt: this.sessionStartTime,
      duration: this.sessionStartTime > 0 ? Date.now() - this.sessionStartTime : 0,
      stateHistoryCount: this.stateHistory.length,
    };
  }

  /**
   * Start Room Mic mode services
   */
  private async startRoomMicMode(_config: SessionConfig, token: CancellationToken): Promise<void> {
    token.throwIfCancelled();

    // Start transcription service
    await realtimeTranscriptionService.startSession();
    token.throwIfCancelled();

    // Start audio pipeline
    await roomMicAudioPipeline.start();
    token.throwIfCancelled();

    console.log('[SessionOrchestrator] Room Mic mode services started');
  }

  /**
   * Stop Room Mic mode services
   */
  private async stopRoomMicMode(): Promise<void> {
    // Stop audio pipeline first
    roomMicAudioPipeline.stop();

    // Stop transcription service
    realtimeTranscriptionService.stopSession();

    console.log('[SessionOrchestrator] Room Mic mode services stopped');
  }

  /**
   * Start Captions mode services
   */
  private async startCaptionsMode(config: SessionConfig, token: CancellationToken): Promise<void> {
    token.throwIfCancelled();

    // Configure caption source
    if (config.captionSource === 'file' && config.captionFilePath) {
      await captionIngestService.setAdapter('file-tail', { 
        type: 'file-tail',
        filePath: config.captionFilePath 
      });
    } else if (config.captionSource === 'clipboard') {
      await captionIngestService.setAdapter('clipboard', { 
        type: 'clipboard' 
      });
    } else {
      await captionIngestService.setAdapter('manual', { 
        type: 'manual' 
      });
    }

    token.throwIfCancelled();

    // Start adapter
    await captionIngestService.start();

    console.log(`[SessionOrchestrator] Captions mode services started (source: ${config.captionSource})`);
  }

  /**
   * Stop Captions mode services
   */
  private async stopCaptionsMode(): Promise<void> {
    await captionIngestService.stop();
    console.log('[SessionOrchestrator] Captions mode services stopped');
  }

  /**
   * Emergency cleanup (force stop all services)
   */
  private async emergencyCleanup(): Promise<void> {
    console.warn('[SessionOrchestrator] Performing emergency cleanup');

    try {
      roomMicAudioPipeline.stop();
    } catch (error) {
      console.error('[SessionOrchestrator] Error stopping audio pipeline:', error);
    }

    try {
      realtimeTranscriptionService.stopSession();
    } catch (error) {
      console.error('[SessionOrchestrator] Error stopping transcription:', error);
    }

    try {
      await captionIngestService.stop();
    } catch (error) {
      console.error('[SessionOrchestrator] Error stopping caption ingest:', error);
    }

    try {
      responsesCoachService.stopSession();
    } catch (error) {
      console.error('[SessionOrchestrator] Error stopping coach service:', error);
    }

    this.currentMode = null;
    this.sessionStartTime = 0;
    this.cancellationToken = null;
  }

  /**
   * Validate state transition
   */
  private validateTransition(targetState: SessionState): void {
    if (this.transitionInProgress) {
      throw new Error('State transition already in progress');
    }

    const validTargets = this.validTransitions[this.currentState];
    if (!validTargets.includes(targetState)) {
      throw new Error(
        `Invalid state transition: ${this.currentState} -> ${targetState}. Valid targets: ${validTargets.join(', ')}`
      );
    }
  }

  /**
   * Transition to a new state
   */
  private async transitionTo(targetState: SessionState, reason?: string): Promise<void> {
    if (this.currentState === targetState) {
      console.warn(`[SessionOrchestrator] Already in state ${targetState}`);
      return;
    }

    this.transitionInProgress = true;

    try {
      const transition: StateTransition = {
        from: this.currentState,
        to: targetState,
        timestamp: Date.now(),
        reason,
      };

      // Update state
      this.currentState = targetState;

      // Record transition
      this.stateHistory.push(transition);

      // Keep only last 50 transitions
      if (this.stateHistory.length > 50) {
        this.stateHistory = this.stateHistory.slice(-50);
      }

      // Emit state change event
      eventBus.emit('app:ready', undefined); // Using existing event; ideally would have session:state-changed

      console.log(`[SessionOrchestrator] State transition: ${transition.from} -> ${transition.to}${reason ? ` (${reason})` : ''}`);
    } finally {
      this.transitionInProgress = false;
    }
  }

  /**
   * Create a cancellation token
   */
  private createCancellationToken(): CancellationToken {
    const token: CancellationToken = {
      cancelled: false,
      cancel: () => {
        token.cancelled = true;
      },
      throwIfCancelled: () => {
        if (token.cancelled) {
          throw new Error('Operation cancelled');
        }
      },
    };
    return token;
  }

  /**
   * Setup event handlers for inter-service coordination
   */
  private setupEventHandlers(): void {
    // Handle transcription events
    eventBus.on('audio:transcription', (data) => {
      if (this.currentState !== SessionState.LIVE) {
        return;
      }

      // Check if hint should be triggered
      const context = {
        text: data.text,
        source: 'transcript' as const,
        timestamp: Date.now(),
      };

      const result = coachPolicyEngine.shouldTriggerHint(context);
      
      if (result.trigger) {
        // Request hint from coach service
        responsesCoachService.requestHint('policy_engine', {
          metrics: {
            priority: result.analysis.priority,
            triggers: result.reason,
          },
        }).catch(error => {
          console.error('[SessionOrchestrator] Failed to request hint:', error);
        });
      }
    });

    // Handle caption events
    eventBus.on('caption:ingested', (data) => {
      if (this.currentState !== SessionState.LIVE) {
        return;
      }

      // Check if hint should be triggered
      const context = {
        text: data.text,
        source: 'caption' as const,
        timestamp: data.timestamp,
      };

      const result = coachPolicyEngine.shouldTriggerHint(context);
      
      if (result.trigger) {
        // Request hint from coach service
        responsesCoachService.requestHint('policy_engine', {
          metrics: {
            priority: result.analysis.priority,
            triggers: result.reason,
          },
        }).catch(error => {
          console.error('[SessionOrchestrator] Failed to request hint:', error);
        });
      }
    });

    // Handle errors
    eventBus.on('app:error', (data) => {
      console.error('[SessionOrchestrator] Application error:', data.error);
      
      // If in LIVE state and critical error, attempt graceful stop
      if (this.currentState === SessionState.LIVE && data.context?.includes('Critical')) {
        console.warn('[SessionOrchestrator] Critical error detected, stopping session');
        this.stopSession().catch(error => {
          console.error('[SessionOrchestrator] Failed to stop session after error:', error);
        });
      }
    });
  }

  /**
   * Get state history
   */
  getStateHistory(): StateTransition[] {
    return [...this.stateHistory];
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.currentState === SessionState.LIVE || this.currentState === SessionState.PAUSED;
  }
}

// Export singleton instance
export const sessionOrchestrator = new SessionOrchestrator();
export default sessionOrchestrator;
