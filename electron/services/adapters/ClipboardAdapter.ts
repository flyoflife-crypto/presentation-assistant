import { clipboard } from 'electron';
import { eventBus } from '../EventBus';
import { CaptionAdapter, CaptionAdapterType } from './CaptionAdapter';

/**
 * ClipboardAdapter - Polls system clipboard when explicitly enabled
 * Shows persistent indicator when ON
 * Detects new text and emits as captions
 * Configurable poll interval (default 1000ms)
 */
export class ClipboardAdapter implements CaptionAdapter {
  private running: boolean = false;
  private pollInterval: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  private lastClipboardText: string = '';

  constructor(pollInterval: number = 1000) {
    this.pollInterval = pollInterval;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    // Initialize with current clipboard content to avoid immediate duplicate
    try {
      this.lastClipboardText = clipboard.readText();
    } catch (error) {
      eventBus.emit('app:error', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: 'ClipboardAdapter: start - reading initial clipboard',
      });
    }

    // Start polling
    this.intervalHandle = setInterval(() => {
      this.checkClipboard();
    }, this.pollInterval);

    // Emit indicator event
    eventBus.emit('clipboard:monitoring', { active: true });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Stop polling
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    // Reset state
    this.lastClipboardText = '';

    // Emit indicator event
    eventBus.emit('clipboard:monitoring', { active: false });
  }

  isRunning(): boolean {
    return this.running;
  }

  getType(): CaptionAdapterType {
    return 'clipboard';
  }

  /**
   * Set the poll interval (in milliseconds)
   */
  setPollInterval(interval: number): void {
    if (interval < 100) {
      throw new Error('Poll interval must be at least 100ms');
    }

    this.pollInterval = interval;

    // Restart polling if running
    if (this.running) {
      if (this.intervalHandle) {
        clearInterval(this.intervalHandle);
      }

      this.intervalHandle = setInterval(() => {
        this.checkClipboard();
      }, this.pollInterval);
    }
  }

  private checkClipboard(): void {
    if (!this.running) {
      return;
    }

    try {
      const currentText = clipboard.readText();

      // Check if clipboard has changed
      if (currentText && currentText !== this.lastClipboardText) {
        this.lastClipboardText = currentText;

        // Only process non-empty text
        if (currentText.trim().length > 0) {
          eventBus.emit('caption:ingested', {
            text: currentText.trim(),
            source: 'clipboard',
            timestamp: Date.now(),
          });
        }
      }
    } catch (error) {
      eventBus.emit('app:error', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: 'ClipboardAdapter: checkClipboard',
      });
    }
  }
}
