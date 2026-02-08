import { eventBus } from '../EventBus';
import { CaptionAdapter, CaptionAdapterType } from './CaptionAdapter';

/**
 * ManualPasteAdapter - Simple pass-through adapter for manually pasted captions
 * No polling or monitoring needed - captions are explicitly pushed via ingest()
 */
export class ManualPasteAdapter implements CaptionAdapter {
  private running: boolean = false;

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  getType(): CaptionAdapterType {
    return 'manual';
  }

  /**
   * Directly ingest text as a caption
   * Called externally when user pastes text
   */
  ingest(text: string): void {
    if (!this.running) {
      return;
    }

    if (!text || text.trim().length === 0) {
      return;
    }

    eventBus.emit('caption:ingested', {
      text: text.trim(),
      source: 'manual',
      timestamp: Date.now(),
    });
  }
}
