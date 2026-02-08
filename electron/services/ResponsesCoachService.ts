import { z } from 'zod';
import pLimit from 'p-limit';
import * as https from 'https';
import { contextStore } from './ContextStore';
import { secretStore } from './SecretStore';
import { eventBus } from './EventBus';

// Zod schemas for response validation
const ChatCompletionSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion'),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: z.object({
        role: z.literal('assistant'),
        content: z.string(),
      }),
      finish_reason: z.string().optional(),
    })
  ),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }).optional(),
});

// Custom error types
export class ResponsesCoachError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'ResponsesCoachError';
  }
}

export class RateLimitError extends ResponsesCoachError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT', 429, true);
    this.name = 'RateLimitError';
  }
}

export class AuthenticationError extends ResponsesCoachError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTH_ERROR', 401, false);
    this.name = 'AuthenticationError';
  }
}

export class NetworkError extends ResponsesCoachError {
  constructor(message: string = 'Network error') {
    super(message, 'NETWORK_ERROR', undefined, true);
    this.name = 'NetworkError';
  }
}

export interface SessionConfig {
  model?: string;
  temperature?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  maxConcurrentRequests?: number;
  timeoutMs?: number;
}

interface IngestSource {
  type: 'transcript' | 'slides' | 'notes';
  id: string;
}

/**
 * ResponsesCoachService - OpenAI Responses API integration
 * Manages conversation state, retries, rate limiting, and cancellation
 */
export class ResponsesCoachService {
  private sessionActive: boolean = false;
  private apiKey: string | null = null;
  private config: Required<SessionConfig>;
  private rateLimiter: ReturnType<typeof pLimit>;
  private abortController: AbortController | null = null;
  private requestCount: number = 0;

  constructor(config: SessionConfig = {}) {
    this.config = {
      model: config.model ?? 'gpt-4o',
      temperature: config.temperature ?? 0.7,
      maxRetries: config.maxRetries ?? 3,
      retryDelayMs: config.retryDelayMs ?? 1000,
      maxConcurrentRequests: config.maxConcurrentRequests ?? 2,
      timeoutMs: config.timeoutMs ?? 30000,
    };

    this.rateLimiter = pLimit(this.config.maxConcurrentRequests);
  }

  /**
   * Start a new session with system prompt
   * System prompt is sent ONCE at session start
   */
  async startSession(systemPrompt: string): Promise<void> {
    if (this.sessionActive) {
      throw new ResponsesCoachError(
        'Session already active',
        'SESSION_ACTIVE',
        undefined,
        false
      );
    }

    // Get API key from SecretStore
    this.apiKey = await secretStore.get('openaiApiKey');
    if (!this.apiKey) {
      throw new AuthenticationError('OpenAI API key not found');
    }

    // Set system prompt in ContextStore
    contextStore.setSystemPrompt(systemPrompt);

    this.sessionActive = true;
    this.abortController = new AbortController();
    this.requestCount = 0;

    eventBus.emit('ai:request', { endpoint: 'responses/session_start' });
    console.log('[ResponsesCoachService] Session started');
  }

  /**
   * Stop the current session
   */
  stopSession(): void {
    if (!this.sessionActive) {
      return;
    }

    // Cancel any pending requests
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.sessionActive = false;
    this.apiKey = null;
    contextStore.clear();

    console.log(`[ResponsesCoachService] Session stopped (${this.requestCount} requests)`);
  }

  /**
   * Ingest text from various sources into the conversation context
   */
  async ingestText(source: IngestSource, text: string): Promise<void> {
    if (!this.sessionActive) {
      throw new ResponsesCoachError(
        'No active session',
        'NO_SESSION',
        undefined,
        false
      );
    }

    // Add to context store as user message
    const formattedText = `[${source.type}:${source.id}] ${text}`;
    contextStore.addUserMessage(formattedText);

    console.log(`[ResponsesCoachService] Ingested ${text.length} chars from ${source.type}`);
  }

  /**
   * Request a hint from the AI coach
   * Uses full conversation context from ContextStore
   */
  async requestHint(
    trigger: string,
    snapshot: { metrics?: Record<string, unknown> } = {}
  ): Promise<string> {
    if (!this.sessionActive) {
      throw new ResponsesCoachError(
        'No active session',
        'NO_SESSION',
        undefined,
        false
      );
    }

    if (!this.apiKey) {
      throw new AuthenticationError('API key not available');
    }

    // Add trigger to context
    const triggerMessage = `[HINT_REQUEST:${trigger}] ${JSON.stringify(snapshot)}`;
    contextStore.addUserMessage(triggerMessage);

    // Execute request with rate limiting
    return this.rateLimiter(async () => {
      return this.executeRequestWithRetry();
    });
  }

  /**
   * Execute API request with exponential backoff retry logic
   */
  private async executeRequestWithRetry(): Promise<string> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Check for cancellation
        if (this.abortController?.signal.aborted) {
          throw new ResponsesCoachError(
            'Request cancelled',
            'CANCELLED',
            undefined,
            false
          );
        }

        const response = await this.executeRequest();
        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry non-retryable errors
        if (error instanceof ResponsesCoachError && !error.retryable) {
          throw error;
        }

        // Check if we should retry
        if (attempt < this.config.maxRetries - 1) {
          // Calculate exponential backoff delay
          const delay = this.config.retryDelayMs * Math.pow(2, attempt);
          console.log(`[ResponsesCoachService] Retry ${attempt + 1}/${this.config.maxRetries} after ${delay}ms`);
          
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    throw new ResponsesCoachError(
      `Failed after ${this.config.maxRetries} retries: ${lastError?.message}`,
      'MAX_RETRIES',
      undefined,
      false
    );
  }

  /**
   * Execute a single API request
   */
  private async executeRequest(): Promise<string> {
    return new Promise((resolve, reject) => {
      const messages = contextStore.getMessages();
      const payload = JSON.stringify({
        model: this.config.model,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: this.config.temperature,
      });

      const options = {
        hostname: 'api.openai.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'Authorization': `Bearer ${this.apiKey}`,
        },
      };

      const startTime = Date.now();
      this.requestCount++;

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          const duration = Date.now() - startTime;

          // Handle non-200 responses
          if (res.statusCode !== 200) {
            const errorData = this.parseErrorResponse(data);
            
            if (res.statusCode === 401 || res.statusCode === 403) {
              reject(new AuthenticationError(errorData.message));
            } else if (res.statusCode === 429) {
              reject(new RateLimitError(errorData.message));
            } else if (res.statusCode && res.statusCode >= 500) {
              reject(new ResponsesCoachError(
                errorData.message,
                'SERVER_ERROR',
                res.statusCode,
                true
              ));
            } else {
              reject(new ResponsesCoachError(
                errorData.message,
                'API_ERROR',
                res.statusCode,
                false
              ));
            }
            return;
          }

          try {
            // Parse and validate response
            const parsed = JSON.parse(data);
            const validated = ChatCompletionSchema.parse(parsed);

            // Extract assistant message
            const assistantMessage = validated.choices[0]?.message?.content || '';

            if (!assistantMessage) {
              reject(new ResponsesCoachError(
                'Empty response from API',
                'EMPTY_RESPONSE',
                undefined,
                false
              ));
              return;
            }

            // Add to context store
            contextStore.addAssistantMessage(assistantMessage);

            // Emit success event
            eventBus.emit('ai:response', {
              endpoint: 'responses',
              tokens: validated.usage?.total_tokens,
            });

            console.log(`[ResponsesCoachService] Request completed in ${duration}ms`);
            resolve(assistantMessage);
          } catch (error) {
            reject(new ResponsesCoachError(
              `Failed to parse response: ${(error as Error).message}`,
              'PARSE_ERROR',
              undefined,
              false
            ));
          }
        });
      });

      // Set timeout
      req.setTimeout(this.config.timeoutMs, () => {
        req.destroy();
        reject(new NetworkError('Request timeout'));
      });

      // Handle request errors
      req.on('error', (error) => {
        reject(new NetworkError(`Request failed: ${error.message}`));
      });

      // Handle cancellation
      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', () => {
          req.destroy();
        });
      }

      // Send request
      req.write(payload);
      req.end();
    });
  }

  /**
   * Parse error response from API
   */
  private parseErrorResponse(data: string): { message: string; type: string } {
    try {
      const parsed = JSON.parse(data);
      return {
        message: parsed.error?.message || 'Unknown error',
        type: parsed.error?.type || 'unknown',
      };
    } catch {
      return {
        message: data || 'Unknown error',
        type: 'unknown',
      };
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if session is active
   */
  isSessionActive(): boolean {
    return this.sessionActive;
  }

  /**
   * Get current session statistics
   */
  getStats(): {
    active: boolean;
    requestCount: number;
    contextSize: number;
  } {
    return {
      active: this.sessionActive,
      requestCount: this.requestCount,
      contextSize: contextStore.getContextSize(),
    };
  }

  /**
   * Update session configuration
   */
  updateConfig(config: Partial<SessionConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      maxConcurrentRequests: config.maxConcurrentRequests ?? this.config.maxConcurrentRequests,
    };

    // Update rate limiter if concurrency changed
    if (config.maxConcurrentRequests) {
      this.rateLimiter = pLimit(config.maxConcurrentRequests);
    }
  }
}

// Export singleton instance
export const responsesCoachService = new ResponsesCoachService();
export default responsesCoachService;
