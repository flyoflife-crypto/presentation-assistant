import { eventBus } from './EventBus';
import { realtimeTranscriptionService } from './RealtimeTranscriptionService';

export interface AudioChunkData {
  buffer: ArrayBuffer;
  timestamp: number;
  sampleRate: number;
}

export interface VADData {
  isSpeech: boolean;
  confidence: number;
  timestamp: number;
}

export interface AudioPipelineConfig {
  bufferSizeMs?: number;
  maxBufferedChunks?: number;
  backpressureThreshold?: number;
  commitOnVADEnd?: boolean;
}

/**
 * RoomMicAudioPipeline - Manages audio flow from RoomMicCaptureWindow to RealtimeTranscriptionService
 * Handles buffering, backpressure, and VAD-based audio commitment
 */
export class RoomMicAudioPipeline {
  private active: boolean = false;
  private config: Required<AudioPipelineConfig>;
  private audioChunks: Buffer[] = [];
  private lastVADState: boolean = false;
  private droppedChunks: number = 0;
  private processedChunks: number = 0;
  private isBackpressure: boolean = false;

  constructor(config: AudioPipelineConfig = {}) {
    this.config = {
      bufferSizeMs: config.bufferSizeMs ?? 100,
      maxBufferedChunks: config.maxBufferedChunks ?? 50,
      backpressureThreshold: config.backpressureThreshold ?? 40,
      commitOnVADEnd: config.commitOnVADEnd ?? true,
    };
  }

  /**
   * Start the audio pipeline
   */
  async start(): Promise<void> {
    if (this.active) {
      throw new Error('Audio pipeline already active');
    }

    // Ensure transcription service is running
    if (!realtimeTranscriptionService.isSessionActive()) {
      await realtimeTranscriptionService.startSession();
    }

    this.active = true;
    this.audioChunks = [];
    this.lastVADState = false;
    this.droppedChunks = 0;
    this.processedChunks = 0;
    this.isBackpressure = false;

    eventBus.emit('audio:started', undefined);
    console.log('[RoomMicAudioPipeline] Pipeline started');
  }

  /**
   * Stop the audio pipeline
   */
  stop(): void {
    if (!this.active) {
      return;
    }

    // Commit any remaining audio
    if (this.audioChunks.length > 0) {
      this.commitBufferedAudio();
    }

    this.active = false;
    this.audioChunks = [];
    this.isBackpressure = false;

    eventBus.emit('audio:stopped', undefined);
    console.log(`[RoomMicAudioPipeline] Pipeline stopped (processed: ${this.processedChunks}, dropped: ${this.droppedChunks})`);
  }

  /**
   * Process incoming audio chunk from IPC
   */
  processAudioChunk(chunk: AudioChunkData): void {
    if (!this.active) {
      console.warn('[RoomMicAudioPipeline] Cannot process audio: pipeline not active');
      return;
    }

    // Check for backpressure
    if (this.audioChunks.length >= this.config.backpressureThreshold) {
      if (!this.isBackpressure) {
        this.isBackpressure = true;
        console.warn(`[RoomMicAudioPipeline] Backpressure detected (${this.audioChunks.length} chunks buffered)`);
      }

      // Drop chunks if buffer is full
      if (this.audioChunks.length >= this.config.maxBufferedChunks) {
        this.droppedChunks++;
        console.warn(`[RoomMicAudioPipeline] Dropping chunk (buffer full: ${this.audioChunks.length}/${this.config.maxBufferedChunks})`);
        return;
      }
    } else if (this.isBackpressure) {
      // Backpressure resolved
      this.isBackpressure = false;
      console.log(`[RoomMicAudioPipeline] Backpressure resolved (${this.audioChunks.length} chunks buffered)`);
    }

    // Convert ArrayBuffer to Buffer
    const buffer = Buffer.from(chunk.buffer);

    // Add to buffer
    this.audioChunks.push(buffer);
    this.processedChunks++;

    // Append to transcription service
    realtimeTranscriptionService.appendAudio(buffer);
  }

  /**
   * Process VAD (Voice Activity Detection) marker
   * Commits audio when speech ends
   */
  processVAD(vadData: VADData): void {
    if (!this.active) {
      console.warn('[RoomMicAudioPipeline] Cannot process VAD: pipeline not active');
      return;
    }

    const { isSpeech, confidence } = vadData;

    // Detect speech end (check previous state before updating)
    if (this.lastVADState && !isSpeech && this.config.commitOnVADEnd) {
      // Speech ended, commit buffered audio
      this.commitBufferedAudio();
      console.log(`[RoomMicAudioPipeline] Speech ended (confidence: ${confidence.toFixed(2)}), audio committed`);
    }

    // Log speech start
    if (isSpeech && !this.lastVADState) {
      console.log(`[RoomMicAudioPipeline] Speech detected (confidence: ${confidence.toFixed(2)})`);
    }

    // Update state after processing
    this.lastVADState = isSpeech;
  }

  /**
   * Commit buffered audio to transcription service
   */
  private commitBufferedAudio(): void {
    if (this.audioChunks.length === 0) {
      return;
    }

    // Commit audio in transcription service
    realtimeTranscriptionService.commitAudio();

    // Clear local buffer
    this.audioChunks = [];
  }

  /**
   * Force commit of buffered audio (can be called externally)
   */
  forceCommit(): void {
    if (!this.active) {
      console.warn('[RoomMicAudioPipeline] Cannot force commit: pipeline not active');
      return;
    }

    this.commitBufferedAudio();
  }

  /**
   * Get pipeline status
   */
  isActive(): boolean {
    return this.active;
  }

  /**
   * Get pipeline statistics
   */
  getStats(): {
    active: boolean;
    bufferedChunks: number;
    processedChunks: number;
    droppedChunks: number;
    isBackpressure: boolean;
    lastVADState: boolean;
  } {
    return {
      active: this.active,
      bufferedChunks: this.audioChunks.length,
      processedChunks: this.processedChunks,
      droppedChunks: this.droppedChunks,
      isBackpressure: this.isBackpressure,
      lastVADState: this.lastVADState,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AudioPipelineConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// Export singleton instance
export const roomMicAudioPipeline = new RoomMicAudioPipeline();
export default roomMicAudioPipeline;
