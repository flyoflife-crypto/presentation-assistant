import { eventBus } from './EventBus';
import {
  CaptionAdapter,
  CaptionAdapterType,
  CaptionAdapterConfig,
} from './adapters/CaptionAdapter';
import { ManualPasteAdapter } from './adapters/ManualPasteAdapter';
import { FileTailAdapter } from './adapters/FileTailAdapter';
import { ClipboardAdapter } from './adapters/ClipboardAdapter';

/**
 * CaptionIngestService - Normalized ingestion interface
 * Manages multiple adapters (manual, file tail, clipboard)
 * Emits normalized caption events via EventBus
 */
export class CaptionIngestService {
  private adapters: Map<CaptionAdapterType, CaptionAdapter> = new Map();
  private activeAdapter: CaptionAdapter | null = null;

  constructor() {
    // Initialize with default manual adapter
    this.adapters.set('manual', new ManualPasteAdapter());
  }

  /**
   * Start the caption ingestion service
   * Starts the currently active adapter
   */
  async start(): Promise<void> {
    if (this.activeAdapter) {
      await this.activeAdapter.start();
    }
  }

  /**
   * Stop the caption ingestion service
   * Stops all running adapters
   */
  async stop(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    for (const adapter of this.adapters.values()) {
      if (adapter.isRunning()) {
        stopPromises.push(adapter.stop());
      }
    }

    await Promise.all(stopPromises);
    this.activeAdapter = null;
  }

  /**
   * Manually ingest a caption (for manual paste adapter)
   * @param source - The source type (typically 'manual')
   * @param text - The caption text to ingest
   */
  ingest(source: CaptionAdapterType, text: string): void {
    const adapter = this.adapters.get(source);

    if (!adapter) {
      throw new Error(`Adapter not found for source: ${source}`);
    }

    if (source === 'manual' && adapter instanceof ManualPasteAdapter) {
      adapter.ingest(text);
    } else {
      throw new Error(`Adapter ${source} does not support manual ingestion`);
    }
  }

  /**
   * Set or update an adapter with configuration
   * @param type - The adapter type to set
   * @param config - Configuration for the adapter
   */
  async setAdapter(
    type: CaptionAdapterType,
    config?: CaptionAdapterConfig
  ): Promise<void> {
    // Stop current active adapter if different
    if (this.activeAdapter && this.activeAdapter.getType() !== type) {
      await this.activeAdapter.stop();
      this.activeAdapter = null;
    }

    // Create or get adapter
    let adapter = this.adapters.get(type);

    if (!adapter) {
      adapter = this.createAdapter(type, config);
      this.adapters.set(type, adapter);
    } else {
      // Update existing adapter if needed
      if (config) {
        // Stop existing adapter before recreating
        if (adapter.isRunning()) {
          await adapter.stop();
        }
        adapter = this.createAdapter(type, config);
        this.adapters.set(type, adapter);
      }
    }

    // Set as active and start
    this.activeAdapter = adapter;
    await this.activeAdapter.start();

    // Emit event
    eventBus.emit('caption:adapter-changed', {
      type,
      config: config || {},
    });
  }

  /**
   * Get the currently active adapter type
   */
  getActiveAdapterType(): CaptionAdapterType | null {
    return this.activeAdapter ? this.activeAdapter.getType() : null;
  }

  /**
   * Get a specific adapter by type
   */
  getAdapter(type: CaptionAdapterType): CaptionAdapter | undefined {
    return this.adapters.get(type);
  }

  /**
   * Check if any adapter is currently running
   */
  isRunning(): boolean {
    return this.activeAdapter?.isRunning() || false;
  }

  /**
   * Create a new adapter instance based on type and config
   */
  private createAdapter(
    type: CaptionAdapterType,
    config?: CaptionAdapterConfig
  ): CaptionAdapter {
    switch (type) {
      case 'manual':
        return new ManualPasteAdapter();

      case 'file-tail':
        if (!config?.filePath) {
          throw new Error('filePath is required for file-tail adapter');
        }
        return new FileTailAdapter(
          config.filePath,
          config.fileFormat || 'txt'
        );

      case 'clipboard':
        return new ClipboardAdapter(config?.pollInterval || 1000);

      default:
        throw new Error(`Unknown adapter type: ${type}`);
    }
  }
}

// Singleton instance
export const captionIngestService = new CaptionIngestService();
export default captionIngestService;
