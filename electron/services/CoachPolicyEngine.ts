export interface TriggerContext {
  text: string;
  source: 'transcript' | 'caption';
  timestamp: number;
  previousText?: string;
  timeSinceLastText?: number;
}

export interface TriggerAnalysis {
  hasQuestion: boolean;
  hasPause: boolean;
  hasTopicDrift: boolean;
  hasFillerWords: boolean;
  questionConfidence: number;
  pauseDuration: number;
  fillerCount: number;
  priority: number;
}

export interface PolicyConfig {
  cooldownMs?: number;
  minPauseDuration?: number;
  fillerWordsThreshold?: number;
  questionConfidenceThreshold?: number;
  topicDriftThreshold?: number;
}

/**
 * CoachPolicyEngine - Decides WHEN to trigger hint requests
 * Analyzes transcript/caption text for questions, pauses, topic drift, and filler words
 */
export class CoachPolicyEngine {
  private config: Required<PolicyConfig>;
  private lastHintTime: number = 0;
  private triggerCount: number = 0;
  private recentKeywords: Set<string> = new Set();
  private fillerWordRegexes: Map<string, RegExp>;

  // Russian question words and patterns
  private readonly ruQuestionWords = [
    'что', 'как', 'почему', 'когда', 'где', 'куда', 'откуда',
    'кто', 'какой', 'какая', 'какое', 'какие', 'чей', 'чья',
    'чьё', 'чьи', 'сколько', 'зачем'
  ];

  // English question words
  private readonly enQuestionWords = [
    'what', 'how', 'why', 'when', 'where', 'who', 'which',
    'whose', 'whom', 'can', 'could', 'would', 'should',
    'will', 'is', 'are', 'do', 'does', 'did'
  ];

  // Filler words (RU/EN)
  private readonly fillerWords = [
    // Russian
    'эм', 'ээ', 'мм', 'ну', 'вот', 'короче', 'так', 'значит',
    'типа', 'как бы', 'в общем', 'в принципе',
    // English
    'um', 'uh', 'er', 'ah', 'like', 'you know', 'i mean',
    'basically', 'actually', 'literally', 'sort of', 'kind of'
  ];

  constructor(config: PolicyConfig = {}) {
    this.config = {
      cooldownMs: config.cooldownMs ?? 6000,
      minPauseDuration: config.minPauseDuration ?? 3000,
      fillerWordsThreshold: config.fillerWordsThreshold ?? 2,
      questionConfidenceThreshold: config.questionConfidenceThreshold ?? 0.6,
      topicDriftThreshold: config.topicDriftThreshold ?? 0.3,
    };

    // Pre-compile regex patterns for filler words
    this.fillerWordRegexes = new Map();
    for (const filler of this.fillerWords) {
      // Escape special regex characters
      const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      this.fillerWordRegexes.set(filler, new RegExp(`\\b${escaped}\\b`, 'gi'));
    }
  }

  /**
   * Analyze context and decide if a hint should be triggered
   */
  shouldTriggerHint(context: TriggerContext): { trigger: boolean; analysis: TriggerAnalysis; reason?: string } {
    // Check cooldown
    const now = Date.now();
    const timeSinceLastHint = now - this.lastHintTime;
    
    if (timeSinceLastHint < this.config.cooldownMs) {
      return {
        trigger: false,
        analysis: this.analyzeTriggers(context.text),
        reason: `Cooldown active (${Math.round((this.config.cooldownMs - timeSinceLastHint) / 1000)}s remaining)`,
      };
    }

    // Analyze triggers
    const analysis = this.analyzeTriggers(context.text);

    // Calculate pause duration if available
    if (context.timeSinceLastText) {
      analysis.pauseDuration = context.timeSinceLastText;
      analysis.hasPause = context.timeSinceLastText >= this.config.minPauseDuration;
    } else {
      analysis.pauseDuration = 0;
      analysis.hasPause = false;
    }

    // Detect topic drift if previous text available
    if (context.previousText) {
      const drift = this.detectTopicDrift(context.previousText, context.text);
      analysis.hasTopicDrift = drift > this.config.topicDriftThreshold;
    }

    // Calculate priority score
    analysis.priority = this.calculatePriority(analysis);

    // Decide if we should trigger
    const shouldTrigger = this.evaluateTriggers(analysis);

    if (shouldTrigger) {
      this.updateLastHintTime();
      const reasons = this.buildTriggerReason(analysis);
      console.log(`[CoachPolicyEngine] Hint triggered: ${reasons} (priority: ${analysis.priority})`);
      return { trigger: true, analysis, reason: reasons };
    }

    return { trigger: false, analysis };
  }

  /**
   * Analyze text for various trigger conditions
   */
  analyzeTriggers(text: string): TriggerAnalysis {
    const lowerText = text.toLowerCase();

    // Question detection
    const questionResult = this.detectQuestion(text);

    // Filler word detection
    const fillerCount = this.countFillerWords(lowerText);

    return {
      hasQuestion: questionResult.detected,
      hasPause: false, // Will be set by shouldTriggerHint
      hasTopicDrift: false, // Will be set by shouldTriggerHint
      hasFillerWords: fillerCount >= this.config.fillerWordsThreshold,
      questionConfidence: questionResult.confidence,
      pauseDuration: 0,
      fillerCount,
      priority: 0, // Will be calculated
    };
  }

  /**
   * Detect questions in text (RU/EN)
   */
  private detectQuestion(text: string): { detected: boolean; confidence: number } {
    const lowerText = text.toLowerCase();
    let confidence = 0;

    // Check for question mark
    if (text.includes('?')) {
      confidence += 0.5;
    }

    // Check for Russian question words at start
    const ruWords = this.ruQuestionWords.filter(word =>
      lowerText.startsWith(word + ' ')
    );
    if (ruWords.length > 0) {
      confidence += 0.4;
    }

    // Check for English question words at start
    const enWords = this.enQuestionWords.filter(word =>
      lowerText.startsWith(word + ' ')
    );
    if (enWords.length > 0) {
      confidence += 0.4;
    }

    // Check for question words anywhere in text
    const hasRuQuestion = this.ruQuestionWords.some(word =>
      lowerText.includes(' ' + word + ' ')
    );
    const hasEnQuestion = this.enQuestionWords.some(word =>
      lowerText.includes(' ' + word + ' ')
    );

    if (hasRuQuestion || hasEnQuestion) {
      confidence += 0.2;
    }

    return {
      detected: confidence >= this.config.questionConfidenceThreshold,
      confidence: Math.min(confidence, 1.0),
    };
  }

  /**
   * Count filler words in text using pre-compiled regexes
   */
  private countFillerWords(lowerText: string): number {
    let count = 0;

    for (const regex of this.fillerWordRegexes.values()) {
      // Reset regex state before each use
      regex.lastIndex = 0;
      const matches = lowerText.match(regex);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  /**
   * Detect topic drift using simple keyword comparison
   */
  private detectTopicDrift(previousText: string, currentText: string): number {
    const prevKeywords = this.extractKeywords(previousText);
    const currKeywords = this.extractKeywords(currentText);

    if (prevKeywords.length === 0 || currKeywords.length === 0) {
      return 0;
    }

    // Calculate overlap
    const overlap = currKeywords.filter(word => prevKeywords.includes(word)).length;
    const maxKeywords = Math.max(prevKeywords.length, currKeywords.length);

    // Drift score (1 - overlap ratio)
    const drift = 1 - (overlap / maxKeywords);

    // Update recent keywords
    this.recentKeywords = new Set([...prevKeywords, ...currKeywords]);

    return drift;
  }

  /**
   * Extract keywords from text (simple: words longer than 4 chars, excluding common words)
   */
  private extractKeywords(text: string): string[] {
    const commonWords = new Set([
      'that', 'this', 'with', 'from', 'have', 'been', 'will', 'your', 'more',
      'which', 'their', 'there', 'would', 'about', 'could', 'should',
      'что', 'это', 'как', 'для', 'все', 'был', 'или', 'они', 'вас',
      'был', 'так', 'его', 'но', 'да', 'ты', 'к', 'за', 'на', 'по'
    ]);

    const words = text.toLowerCase()
      .replace(/[^\w\s\u0400-\u04FF]/gi, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4 && !commonWords.has(word));

    return words;
  }

  /**
   * Calculate priority score based on trigger analysis
   */
  private calculatePriority(analysis: TriggerAnalysis): number {
    let priority = 0;

    // Question weight
    if (analysis.hasQuestion) {
      priority += analysis.questionConfidence * 40;
    }

    // Pause weight
    if (analysis.hasPause) {
      const pauseScore = Math.min(analysis.pauseDuration / 1000 / 10, 1); // Max 10s
      priority += pauseScore * 30;
    }

    // Topic drift weight
    if (analysis.hasTopicDrift) {
      priority += 20;
    }

    // Filler words weight
    if (analysis.hasFillerWords) {
      const fillerScore = Math.min(analysis.fillerCount / 5, 1); // Max 5 fillers
      priority += fillerScore * 25;
    }

    return Math.min(Math.round(priority), 100);
  }

  /**
   * Evaluate if triggers warrant a hint request
   */
  private evaluateTriggers(analysis: TriggerAnalysis): boolean {
    // High priority triggers (any one is sufficient)
    if (analysis.hasQuestion && analysis.questionConfidence > 0.8) {
      return true;
    }

    // Medium priority triggers (need at least two)
    const mediumTriggers = [
      analysis.hasQuestion,
      analysis.hasPause,
      analysis.hasFillerWords,
    ].filter(Boolean).length;

    if (mediumTriggers >= 2) {
      return true;
    }

    // Low priority triggers (need all three)
    if (analysis.hasPause && analysis.hasTopicDrift && analysis.hasFillerWords) {
      return true;
    }

    return false;
  }

  /**
   * Build human-readable trigger reason
   */
  private buildTriggerReason(analysis: TriggerAnalysis): string {
    const reasons: string[] = [];

    if (analysis.hasQuestion) {
      reasons.push(`question detected (${(analysis.questionConfidence * 100).toFixed(0)}%)`);
    }
    if (analysis.hasPause) {
      reasons.push(`pause (${(analysis.pauseDuration / 1000).toFixed(1)}s)`);
    }
    if (analysis.hasTopicDrift) {
      reasons.push('topic drift');
    }
    if (analysis.hasFillerWords) {
      reasons.push(`filler words (${analysis.fillerCount})`);
    }

    return reasons.join(', ');
  }

  /**
   * Update last hint time
   */
  updateLastHintTime(): void {
    this.lastHintTime = Date.now();
    this.triggerCount++;
  }

  /**
   * Get time since last hint
   */
  getTimeSinceLastHint(): number {
    return Date.now() - this.lastHintTime;
  }

  /**
   * Check if cooldown is active
   */
  isCooldownActive(): boolean {
    return this.getTimeSinceLastHint() < this.config.cooldownMs;
  }

  /**
   * Get statistics
   */
  getStats(): {
    triggerCount: number;
    lastHintTime: number;
    timeSinceLastHint: number;
    cooldownActive: boolean;
    recentKeywordsCount: number;
  } {
    return {
      triggerCount: this.triggerCount,
      lastHintTime: this.lastHintTime,
      timeSinceLastHint: this.getTimeSinceLastHint(),
      cooldownActive: this.isCooldownActive(),
      recentKeywordsCount: this.recentKeywords.size,
    };
  }

  /**
   * Reset engine state
   */
  reset(): void {
    this.lastHintTime = 0;
    this.triggerCount = 0;
    this.recentKeywords.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PolicyConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// Export singleton instance
export const coachPolicyEngine = new CoachPolicyEngine();
export default coachPolicyEngine;
