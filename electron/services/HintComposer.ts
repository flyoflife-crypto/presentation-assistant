import { eventBus } from './EventBus';

export interface HintConfig {
  maxLength: number;
  maxLines: number;
  defaultTtlMs: number;
}

export interface ComposedHint {
  text: string;
  ttlMs: number;
  priority: 'low' | 'medium' | 'high';
}

export interface RawHint {
  content: string;
  priority?: 'low' | 'medium' | 'high';
  ttlMs?: number;
}

const DEFAULT_CONFIG: HintConfig = {
  maxLength: 240,
  maxLines: 2,
  defaultTtlMs: 5000,
};

/**
 * HintComposer - Validates and formats hints for display
 * Enforces strict formatting rules: max 240 chars, 1-2 lines, actionable
 */
class HintComposer {
  private config: HintConfig;

  constructor(config: Partial<HintConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Compose a hint from raw input
   * Validates and formats according to strict rules
   */
  compose(raw: RawHint): ComposedHint | null {
    try {
      const text = this.format(raw.content);
      
      if (!this.validate(text)) {
        console.warn('Hint validation failed:', text);
        return null;
      }

      const hint: ComposedHint = {
        text,
        ttlMs: raw.ttlMs ?? this.config.defaultTtlMs,
        priority: raw.priority ?? 'medium',
      };

      eventBus.emit('hint:generated', {
        text: hint.text,
        priority: hint.priority,
      });

      return hint;
    } catch (error) {
      console.error('Failed to compose hint:', error);
      eventBus.emit('app:error', {
        error: error as Error,
        context: 'HintComposer.compose',
      });
      return null;
    }
  }

  /**
   * Format hint text according to rules
   */
  private format(content: string): string {
    // Remove extra whitespace and newlines
    let text = content.trim().replace(/\s+/g, ' ');

    // Truncate to max length if needed
    if (text.length > this.config.maxLength) {
      text = text.substring(0, this.config.maxLength - 3) + '...';
    }

    // Split into sentences for line breaking
    const sentences = text.split(/(?<=[.!?])\s+/);
    
    // Try to fit into 2 lines naturally
    if (sentences.length > this.config.maxLines) {
      const firstLine = sentences.slice(0, this.config.maxLines).join(' ');
      if (firstLine.length <= this.config.maxLength) {
        text = firstLine;
      }
    }

    // Ensure actionable format (starts with verb or "Try", "Consider", etc.)
    text = this.ensureActionable(text);

    return text;
  }

  /**
   * Ensure hint is actionable
   */
  private ensureActionable(text: string): string {
    const actionableStarters = [
      'try', 'consider', 'use', 'avoid', 'speak', 'slow', 'pause',
      'emphasize', 'clarify', 'explain', 'show', 'demonstrate', 'highlight',
      'focus', 'maintain', 'improve', 'reduce', 'increase', 'add', 'remove',
    ];

    const firstWord = text.split(' ')[0].toLowerCase();
    
    // Check if already actionable
    if (actionableStarters.some(starter => firstWord.includes(starter))) {
      return text;
    }

    // Make it actionable by prefixing with "Try:"
    return `Try: ${text.charAt(0).toLowerCase() + text.slice(1)}`;
  }

  /**
   * Validate hint meets all requirements
   */
  private validate(text: string): boolean {
    // Check length
    if (text.length === 0 || text.length > this.config.maxLength) {
      return false;
    }

    // Check line count (approximate by sentence count)
    const lineBreaks = text.split(/[.!?]/).filter(s => s.trim().length > 0).length;
    if (lineBreaks > this.config.maxLines + 1) {
      return false;
    }

    // Check if actionable (starts with action word or "Try:")
    const startsWithAction = /^(try|consider|use|avoid|speak|slow|pause|emphasize|clarify|explain|show|demonstrate|highlight|focus|maintain|improve|reduce|increase|add|remove)/i.test(text);
    
    return startsWithAction;
  }

  /**
   * Compose multiple hints and prioritize
   */
  composeMultiple(rawHints: RawHint[]): ComposedHint[] {
    const composed: ComposedHint[] = [];

    for (const raw of rawHints) {
      const hint = this.compose(raw);
      if (hint) {
        composed.push(hint);
      }
    }

    // Sort by priority: high > medium > low
    return composed.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Extract hints from AI response
   * Looks for structured hints in the response
   */
  extractFromResponse(response: string): ComposedHint[] {
    const hints: RawHint[] = [];

    // Look for hints in various formats
    // Format 1: "HINT: text"
    const hintPattern1 = /HINT:\s*(.+?)(?=\n|$)/gi;
    let match;
    while ((match = hintPattern1.exec(response)) !== null) {
      hints.push({ content: match[1].trim() });
    }

    // Format 2: Bullet points
    const hintPattern2 = /^[•\-*]\s*(.+?)$/gm;
    while ((match = hintPattern2.exec(response)) !== null) {
      const content = match[1].trim();
      if (content.length >= 20 && content.length <= 240) {
        hints.push({ content });
      }
    }

    // Format 3: Numbered suggestions
    const hintPattern3 = /^\d+\.\s*(.+?)$/gm;
    while ((match = hintPattern3.exec(response)) !== null) {
      const content = match[1].trim();
      if (content.length >= 20 && content.length <= 240) {
        hints.push({ content });
      }
    }

    return this.composeMultiple(hints);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HintConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): HintConfig {
    return { ...this.config };
  }
}

// Export class for typing
export { HintComposer };

// Singleton instance
export const hintComposer = new HintComposer();
export default hintComposer;
