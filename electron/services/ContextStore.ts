import { eventBus } from './EventBus';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ContextMetrics {
  totalMessages: number;
  estimatedTokens: number;
  systemPromptTokens: number;
  transcriptTokens: number;
  hintsTokens: number;
}

/**
 * ContextStore - Manages conversation context for AI interactions
 * Tracks system prompt, rolling transcript, and hints with compaction support
 */
class ContextStore {
  private systemPrompt: Message | null;
  private transcript: Message[];
  private hints: Message[];
  private maxContextSize: number;
  private compactionThreshold: number;
  private isCompacting: boolean;

  constructor(maxContextSize: number = 8000, compactionThreshold: number = 0.8) {
    this.systemPrompt = null;
    this.transcript = [];
    this.hints = [];
    this.maxContextSize = maxContextSize;
    this.compactionThreshold = compactionThreshold;
    this.isCompacting = false;
  }

  /**
   * Set the system prompt (sent once at the start)
   */
  setSystemPrompt(content: string): void {
    this.systemPrompt = {
      role: 'system',
      content,
      timestamp: Date.now(),
    };
    this.emitContextUpdate();
  }

  /**
   * Get the system prompt
   */
  getSystemPrompt(): Message | null {
    return this.systemPrompt;
  }

  /**
   * Add a user message to the transcript
   */
  addUserMessage(content: string): void {
    this.transcript.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    });
    this.checkAndCompact();
    this.emitContextUpdate();
  }

  /**
   * Add an assistant message to the transcript
   */
  addAssistantMessage(content: string): void {
    this.transcript.push({
      role: 'assistant',
      content,
      timestamp: Date.now(),
    });
    this.checkAndCompact();
    this.emitContextUpdate();
  }

  /**
   * Add a hint message
   */
  addHint(content: string): void {
    this.hints.push({
      role: 'assistant',
      content,
      timestamp: Date.now(),
    });
    this.emitContextUpdate();
  }

  /**
   * Get all messages for API request
   */
  getMessages(): Message[] {
    const messages: Message[] = [];

    if (this.systemPrompt) {
      messages.push(this.systemPrompt);
    }

    messages.push(...this.transcript);
    messages.push(...this.hints);

    return messages;
  }

  /**
   * Estimate token count (rough approximation: ~4 chars per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get current context size in estimated tokens
   */
  getContextSize(): number {
    let size = 0;

    if (this.systemPrompt) {
      size += this.estimateTokens(this.systemPrompt.content);
    }

    for (const message of this.transcript) {
      size += this.estimateTokens(message.content);
    }

    for (const hint of this.hints) {
      size += this.estimateTokens(hint.content);
    }

    return size;
  }

  /**
   * Get context metrics
   */
  getMetrics(): ContextMetrics {
    const systemPromptTokens = this.systemPrompt
      ? this.estimateTokens(this.systemPrompt.content)
      : 0;

    let transcriptTokens = 0;
    for (const message of this.transcript) {
      transcriptTokens += this.estimateTokens(message.content);
    }

    let hintsTokens = 0;
    for (const hint of this.hints) {
      hintsTokens += this.estimateTokens(hint.content);
    }

    return {
      totalMessages: this.transcript.length + this.hints.length,
      estimatedTokens: systemPromptTokens + transcriptTokens + hintsTokens,
      systemPromptTokens,
      transcriptTokens,
      hintsTokens,
    };
  }

  /**
   * Check if context needs compaction and trigger if necessary
   */
  private async checkAndCompact(): Promise<void> {
    const currentSize = this.getContextSize();
    const threshold = this.maxContextSize * this.compactionThreshold;

    if (currentSize > threshold && !this.isCompacting) {
      await this.compact();
    }
  }

  /**
   * Compact the context by summarizing older messages
   * Uses /responses/compact endpoint to create a summary
   */
  async compact(): Promise<void> {
    if (this.isCompacting || this.transcript.length < 4) {
      return;
    }

    this.isCompacting = true;
    const oldSize = this.getContextSize();

    try {
      // Take the first half of the transcript for compaction
      const midpoint = Math.floor(this.transcript.length / 2);
      const toCompact = this.transcript.slice(0, midpoint);
      const toKeep = this.transcript.slice(midpoint);

      // Create a summary of the compacted messages
      const summary = this.createSummary(toCompact);

      // Replace with a single summary message
      this.transcript = [
        {
          role: 'system',
          content: `[Previous conversation summary: ${summary}]`,
          timestamp: Date.now(),
        },
        ...toKeep,
      ];

      const newSize = this.getContextSize();
      eventBus.emit('context:compacted', { oldSize, newSize });
      this.emitContextUpdate();
    } catch (error) {
      console.error('Failed to compact context:', error);
      eventBus.emit('app:error', {
        error: error as Error,
        context: 'ContextStore.compact',
      });
    } finally {
      this.isCompacting = false;
    }
  }

  /**
   * Create a simple summary of messages
   */
  private createSummary(messages: Message[]): string {
    const points: string[] = [];

    for (const message of messages) {
      if (message.role === 'user') {
        // Extract key points from user messages
        const sentences = message.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 0) {
          points.push(`User mentioned: ${sentences[0].trim()}`);
        }
      }
    }

    return points.slice(0, 3).join('; ') || 'Earlier conversation context';
  }

  /**
   * Clear old hints (keep only recent ones)
   */
  clearOldHints(maxAge: number = 60000): void {
    const now = Date.now();
    this.hints = this.hints.filter(hint => now - hint.timestamp < maxAge);
    this.emitContextUpdate();
  }

  /**
   * Clear all context
   */
  clear(): void {
    this.systemPrompt = null;
    this.transcript = [];
    this.hints = [];
    eventBus.emit('context:cleared', undefined);
  }

  /**
   * Update configuration
   */
  updateConfig(maxContextSize?: number, compactionThreshold?: number): void {
    if (maxContextSize !== undefined) {
      this.maxContextSize = maxContextSize;
    }
    if (compactionThreshold !== undefined) {
      this.compactionThreshold = compactionThreshold;
    }
  }

  /**
   * Emit context update event
   */
  private emitContextUpdate(): void {
    eventBus.emit('context:updated', {
      size: this.getContextSize(),
      messageCount: this.transcript.length + this.hints.length,
    });
  }
}

// Export class for typing
export { ContextStore };

// Singleton instance
export const contextStore = new ContextStore();
export default contextStore;
