import * as fs from 'fs';
import { eventBus } from '../EventBus';
import { CaptionAdapter, CaptionAdapterType } from './CaptionAdapter';

/**
 * FileTailAdapter - Monitors a file for new appended content
 * Supports .txt, .vtt, and .srt files
 * Tracks file position to only read new content
 * Handles file rotation and truncation
 */
export class FileTailAdapter implements CaptionAdapter {
  private running: boolean = false;
  private filePath: string;
  private filePosition: number = 0;
  private watcherHandle: fs.FSWatcher | null = null;
  private lastFileSize: number = 0;
  private fileFormat: 'txt' | 'vtt' | 'srt';

  constructor(filePath: string, fileFormat: 'txt' | 'vtt' | 'srt' = 'txt') {
    this.filePath = filePath;
    this.fileFormat = fileFormat;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    // Validate file path
    if (!this.filePath || !fs.existsSync(this.filePath)) {
      throw new Error(`File not found: ${this.filePath}`);
    }

    this.running = true;

    // Get initial file size
    try {
      const stats = fs.statSync(this.filePath);
      this.filePosition = stats.size;
      this.lastFileSize = stats.size;
    } catch (error) {
      this.running = false;
      throw new Error(`Failed to read file stats: ${error}`);
    }

    // Watch file for changes
    try {
      this.watcherHandle = fs.watch(this.filePath, (eventType) => {
        if (eventType === 'change') {
          this.handleFileChange();
        }
      });
    } catch (error) {
      this.running = false;
      throw new Error(`Failed to watch file: ${error}`);
    }
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    // Close file watcher
    if (this.watcherHandle) {
      this.watcherHandle.close();
      this.watcherHandle = null;
    }

    // Reset file position
    this.filePosition = 0;
    this.lastFileSize = 0;
  }

  isRunning(): boolean {
    return this.running;
  }

  getType(): CaptionAdapterType {
    return 'file-tail';
  }

  private handleFileChange(): void {
    if (!this.running) {
      return;
    }

    try {
      const stats = fs.statSync(this.filePath);
      const currentSize = stats.size;

      // Handle file truncation or rotation
      if (currentSize < this.lastFileSize) {
        this.filePosition = 0;
      }

      this.lastFileSize = currentSize;

      // Read new content
      if (currentSize > this.filePosition) {
        const buffer = Buffer.alloc(currentSize - this.filePosition);
        const fd = fs.openSync(this.filePath, 'r');

        try {
          fs.readSync(fd, buffer, 0, buffer.length, this.filePosition);
          this.filePosition = currentSize;

          const newContent = buffer.toString('utf-8');
          this.processNewContent(newContent);
        } finally {
          fs.closeSync(fd);
        }
      }
    } catch (error) {
      eventBus.emit('app:error', {
        error: error instanceof Error ? error : new Error(String(error)),
        context: 'FileTailAdapter: handleFileChange',
      });
    }
  }

  private processNewContent(content: string): void {
    if (!content || content.trim().length === 0) {
      return;
    }

    // Process based on file format
    let captions: string[];

    switch (this.fileFormat) {
      case 'vtt':
        captions = this.parseVTT(content);
        break;
      case 'srt':
        captions = this.parseSRT(content);
        break;
      case 'txt':
      default:
        captions = this.parseText(content);
        break;
    }

    // Emit each caption
    captions.forEach((caption) => {
      if (caption.trim().length > 0) {
        eventBus.emit('caption:ingested', {
          text: caption.trim(),
          source: 'file-tail',
          timestamp: Date.now(),
        });
      }
    });
  }

  private parseText(content: string): string[] {
    // Split by newlines and filter empty lines
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private parseVTT(content: string): string[] {
    // WebVTT format: skip timestamps and metadata, extract text
    const lines = content.split(/\r?\n/);
    const captions: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip WEBVTT headers, timestamps, and empty lines
      if (
        !trimmed ||
        trimmed.startsWith('WEBVTT') ||
        trimmed.includes('-->') ||
        /^\d+$/.test(trimmed)
      ) {
        continue;
      }
      captions.push(trimmed);
    }

    return captions;
  }

  private parseSRT(content: string): string[] {
    // SRT format: skip sequence numbers and timestamps, extract text
    const lines = content.split(/\r?\n/);
    const captions: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip sequence numbers, timestamps, and empty lines
      if (
        !trimmed ||
        /^\d+$/.test(trimmed) ||
        trimmed.includes('-->') ||
        /^\d{2}:\d{2}:\d{2}/.test(trimmed)
      ) {
        continue;
      }
      captions.push(trimmed);
    }

    return captions;
  }
}
