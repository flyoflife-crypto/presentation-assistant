import { z } from 'zod';
import WebSocket from 'ws';
import { secretStore } from './SecretStore';
import { eventBus } from './EventBus';

// Zod schemas for WebSocket message validation
const TranscriptDeltaSchema = z.object({
  type: z.literal('response.audio_transcript.delta'),
  item_id: z.string(),
  output_index: z.number(),
  content_index: z.number(),
  delta: z.string(),
});

const TranscriptDoneSchema = z.object({
  type: z.literal('response.audio_transcript.done'),
  item_id: z.string(),
  output_index: z.number(),
  content_index: z.number(),
  transcript: z.string(),
});

const ErrorSchema = z.object({
  type: z.literal('error'),
  error: z.object({
    type: z.string(),
    code: z.string().optional(),
    message: z.string(),
  }),
});

const SessionCreatedSchema = z.object({
  type: z.literal('session.created'),
  session: z.object({
    id: z.string(),
    model: z.string(),
  }),
});

// Custom error types
export class RealtimeTranscriptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'RealtimeTranscriptionError';
  }
}

export class WebSocketError extends RealtimeTranscriptionError {
  constructor(message: string = 'WebSocket error') {
    super(message, 'WEBSOCKET_ERROR', true);
    this.name = 'WebSocketError';
  }
}

export class AuthenticationError extends RealtimeTranscriptionError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', false);
    this.name = 'AuthenticationError';
  }
}

export interface TranscriptSegment {
  id: string;
  source: 'ROOM_MIC';
  text: string;
  receivedAt: number;
  itemId?: string;
  tsStart?: number;
  tsEnd?: number;
}

export interface RealtimeConfig {
  model?: string;
  voice?: string;
  maxRetries?: number;
  retryDelayMs?: number;
  maxConcurrentRequests?: number;
  reconnectDelayMs?: number;
}

interface BufferedAudio {
  buffer: Buffer;
  committed: boolean;
}

interface ItemTranscript {
  itemId: string;
  transcript: string;
  segments: string[];
  complete: boolean;
  receivedAt: number;
}

/**
 * RealtimeTranscriptionService - OpenAI Realtime API transcription over WebSocket
 * Manages WSS connection for transcription intent only
 */
export class RealtimeTranscriptionService {
  private ws: WebSocket | null = null;
  private sessionActive: boolean = false;
  private apiKey: string | null = null;
  private config: Required<RealtimeConfig>;
  private audioBuffer: BufferedAudio[] = [];
  private itemTranscripts: Map<string, ItemTranscript> = new Map();
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private segmentCounter: number = 0;
  private sessionId: string | null = null;

  constructor(config: RealtimeConfig = {}) {
    this.config = {
      model: config.model ?? 'gpt-4o-realtime-preview-2024-10-01',
      voice: config.voice ?? 'alloy',
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      maxConcurrentRequests: config.maxConcurrentRequests ?? 1,
      reconnectDelayMs: config.reconnectDelayMs ?? 2000,
    };
  }

  /**
   * Start transcription session
   * Establishes WSS connection with TLS
   */
  async startSession(): Promise<void> {
    if (this.sessionActive) {
      throw new RealtimeTranscriptionError(
        'Session already active',
        'SESSION_ACTIVE',
        false
      );
    }

    // Get API key from SecretStore
    this.apiKey = await secretStore.get('openaiApiKey');
    if (!this.apiKey) {
      throw new AuthenticationError('OpenAI API key not found');
    }

    await this.connect();
  }

  /**
   * Stop transcription session
   */
  stopSession(): void {
    if (!this.sessionActive) {
      return;
    }

    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.sessionActive = false;
    this.apiKey = null;
    this.audioBuffer = [];
    this.itemTranscripts.clear();
    this.reconnectAttempts = 0;
    this.sessionId = null;

    console.log('[RealtimeTranscriptionService] Session stopped');
  }

  /**
   * Connect to WebSocket
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${this.config.model}`;
      
      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      });

      const connectionTimeout = setTimeout(() => {
        if (this.ws) {
          this.ws.close();
        }
        reject(new WebSocketError('Connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(connectionTimeout);
        console.log('[RealtimeTranscriptionService] WebSocket connected');

        // Configure session for transcription only
        this.sendMessage({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: 'You are a transcription service. Transcribe all audio accurately.',
            voice: this.config.voice,
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            input_audio_transcription: {
              model: 'whisper-1',
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
        });

        this.sessionActive = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(connectionTimeout);
        console.log(`[RealtimeTranscriptionService] WebSocket closed: ${code} ${reason.toString()}`);
        
        if (this.sessionActive) {
          // Attempt reconnect
          this.handleDisconnect();
        }
      });

      this.ws.on('error', (error: Error) => {
        clearTimeout(connectionTimeout);
        console.error('[RealtimeTranscriptionService] WebSocket error:', error);
        
        eventBus.emit('ai:error', {
          endpoint: 'realtime',
          error: error.message,
        });

        reject(new WebSocketError(error.message));
      });
    });
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnect(): void {
    if (this.reconnectAttempts >= this.config.maxRetries) {
      console.error('[RealtimeTranscriptionService] Max reconnect attempts reached');
      this.stopSession();
      
      eventBus.emit('app:error', {
        error: new Error('Failed to maintain WebSocket connection'),
        context: 'RealtimeTranscriptionService.handleDisconnect',
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[RealtimeTranscriptionService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('[RealtimeTranscriptionService] Reconnect failed:', error);
        this.handleDisconnect();
      }
    }, delay);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Handle session created
      if (message.type === 'session.created') {
        const validated = SessionCreatedSchema.parse(message);
        this.sessionId = validated.session.id;
        console.log(`[RealtimeTranscriptionService] Session created: ${this.sessionId}`);
        return;
      }

      // Handle errors
      if (message.type === 'error') {
        const validated = ErrorSchema.parse(message);
        console.error('[RealtimeTranscriptionService] Error:', validated.error);
        
        eventBus.emit('ai:error', {
          endpoint: 'realtime',
          error: validated.error.message,
        });
        return;
      }

      // Handle transcript deltas (streaming)
      if (message.type === 'response.audio_transcript.delta') {
        const validated = TranscriptDeltaSchema.parse(message);
        this.handleTranscriptDelta(validated);
        return;
      }

      // Handle transcript completion
      if (message.type === 'response.audio_transcript.done') {
        const validated = TranscriptDoneSchema.parse(message);
        this.handleTranscriptDone(validated);
        return;
      }

      // Handle input audio transcription
      if (message.type === 'conversation.item.input_audio_transcription.completed') {
        const itemId = message.item_id;
        const transcript = message.transcript;
        
        if (transcript) {
          this.emitTranscriptSegment({
            text: transcript,
            itemId,
          });
        }
        return;
      }

    } catch (error) {
      console.error('[RealtimeTranscriptionService] Failed to parse message:', error);
    }
  }

  /**
   * Handle transcript delta (streaming)
   */
  private handleTranscriptDelta(delta: z.infer<typeof TranscriptDeltaSchema>): void {
    const { item_id, delta: text } = delta;

    // Get or create item transcript
    let item = this.itemTranscripts.get(item_id);
    if (!item) {
      item = {
        itemId: item_id,
        transcript: '',
        segments: [],
        complete: false,
        receivedAt: Date.now(),
      };
      this.itemTranscripts.set(item_id, item);
    }

    // Append delta
    item.segments.push(text);
    item.transcript += text;
  }

  /**
   * Handle transcript completion
   */
  private handleTranscriptDone(done: z.infer<typeof TranscriptDoneSchema>): void {
    const { item_id, transcript } = done;

    // Get or create item transcript
    let item = this.itemTranscripts.get(item_id);
    if (!item) {
      item = {
        itemId: item_id,
        transcript: '',
        segments: [],
        complete: false,
        receivedAt: Date.now(),
      };
      this.itemTranscripts.set(item_id, item);
    }

    // Mark as complete and use final transcript
    item.complete = true;
    item.transcript = transcript;

    // Emit complete transcript
    this.emitTranscriptSegment({
      text: transcript,
      itemId: item_id,
    });

    // Clean up old items (keep last 10)
    if (this.itemTranscripts.size > 10) {
      const sorted = Array.from(this.itemTranscripts.entries())
        .sort((a, b) => a[1].receivedAt - b[1].receivedAt);
      
      for (let i = 0; i < sorted.length - 10; i++) {
        this.itemTranscripts.delete(sorted[i][0]);
      }
    }
  }

  /**
   * Emit transcript segment event
   */
  private emitTranscriptSegment(data: { text: string; itemId?: string }): void {
    const segment: TranscriptSegment = {
      id: `transcript_${this.segmentCounter++}`,
      source: 'ROOM_MIC',
      text: data.text,
      receivedAt: Date.now(),
      itemId: data.itemId,
    };

    // Emit via EventBus
    eventBus.emit('audio:transcription', {
      text: segment.text,
      isFinal: true,
    });

    console.log(`[RealtimeTranscriptionService] Transcript: "${segment.text.substring(0, 50)}..."`);
  }

  /**
   * Append audio buffer (not yet committed)
   */
  appendAudio(buffer: Buffer): void {
    if (!this.sessionActive || !this.ws) {
      console.warn('[RealtimeTranscriptionService] Cannot append audio: no active session');
      return;
    }

    this.audioBuffer.push({
      buffer,
      committed: false,
    });
  }

  /**
   * Commit buffered audio to WebSocket
   * Uses append/commit pattern for audio streaming
   */
  commitAudio(): void {
    if (!this.sessionActive || !this.ws) {
      console.warn('[RealtimeTranscriptionService] Cannot commit audio: no active session');
      return;
    }

    // Send all uncommitted audio buffers
    const uncommitted = this.audioBuffer.filter(a => !a.committed);
    
    for (const audio of uncommitted) {
      // Send audio buffer
      this.sendMessage({
        type: 'input_audio_buffer.append',
        audio: audio.buffer.toString('base64'),
      });

      audio.committed = true;
    }

    // Commit the audio buffer
    this.sendMessage({
      type: 'input_audio_buffer.commit',
    });

    // Clear committed buffers (keep last 5 for reference)
    if (this.audioBuffer.length > 5) {
      this.audioBuffer = this.audioBuffer.slice(-5);
    }
  }

  /**
   * Clear audio buffer without committing
   */
  clearAudioBuffer(): void {
    this.audioBuffer = [];
  }

  /**
   * Send message to WebSocket
   */
  private sendMessage(message: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[RealtimeTranscriptionService] Cannot send message: WebSocket not open');
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('[RealtimeTranscriptionService] Failed to send message:', error);
    }
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.sessionActive && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get session statistics
   */
  getStats(): {
    active: boolean;
    sessionId: string | null;
    bufferedAudioCount: number;
    transcriptItemCount: number;
    reconnectAttempts: number;
  } {
    return {
      active: this.sessionActive,
      sessionId: this.sessionId,
      bufferedAudioCount: this.audioBuffer.length,
      transcriptItemCount: this.itemTranscripts.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RealtimeConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// Export singleton instance
export const realtimeTranscriptionService = new RealtimeTranscriptionService();
export default realtimeTranscriptionService;
