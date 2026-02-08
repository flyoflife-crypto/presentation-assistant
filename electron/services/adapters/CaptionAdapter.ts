/**
 * Common interface for all caption ingestion adapters
 */
export interface CaptionAdapter {
  /**
   * Start the adapter (begin monitoring/polling)
   */
  start(): Promise<void>;

  /**
   * Stop the adapter and cleanup resources
   */
  stop(): Promise<void>;

  /**
   * Check if the adapter is currently running
   */
  isRunning(): boolean;

  /**
   * Get the adapter type
   */
  getType(): CaptionAdapterType;
}

export type CaptionAdapterType = 'manual' | 'file-tail' | 'clipboard';

export interface CaptionAdapterConfig {
  type: CaptionAdapterType;
  // Type-specific configuration
  filePath?: string;
  pollInterval?: number;
  fileFormat?: 'txt' | 'vtt' | 'srt';
}
