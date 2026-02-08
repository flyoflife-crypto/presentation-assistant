# Caption Ingestion Services

The Caption Ingestion Services provide a normalized interface for ingesting captions from multiple sources.

## Architecture

- **CaptionIngestService**: Main service that manages multiple adapters
- **Adapters**: Pluggable adapters for different caption sources
  - ManualPasteAdapter: Direct text input
  - FileTailAdapter: Monitor file for new content
  - ClipboardAdapter: Poll system clipboard

## Usage Examples

### Manual Paste Adapter

```typescript
import { captionIngestService } from './services';

// Start with manual adapter (default)
await captionIngestService.start();

// Manually ingest a caption
captionIngestService.ingest('manual', 'Hello, this is a caption');
```

### File Tail Adapter

```typescript
import { captionIngestService } from './services';

// Configure file tail adapter
await captionIngestService.setAdapter('file-tail', {
  type: 'file-tail',
  filePath: '/path/to/captions.txt',
  fileFormat: 'txt', // or 'vtt' or 'srt'
});

// Adapter will automatically monitor the file and emit events
```

### Clipboard Adapter

```typescript
import { captionIngestService } from './services';

// Configure clipboard adapter with custom poll interval
await captionIngestService.setAdapter('clipboard', {
  type: 'clipboard',
  pollInterval: 1000, // milliseconds (default: 1000)
});

// Adapter will poll clipboard and emit events for new text
```

### Listening to Caption Events

```typescript
import { eventBus } from './services';

// Listen for ingested captions
eventBus.on('caption:ingested', (data) => {
  console.log(`Caption from ${data.source}: ${data.text}`);
  console.log(`Timestamp: ${data.timestamp}`);
});

// Listen for adapter changes
eventBus.on('caption:adapter-changed', (data) => {
  console.log(`Adapter changed to: ${data.type}`);
});

// Listen for clipboard monitoring status
eventBus.on('clipboard:monitoring', (data) => {
  console.log(`Clipboard monitoring: ${data.active ? 'ON' : 'OFF'}`);
});
```

### Switching Adapters

```typescript
import { captionIngestService } from './services';

// Start with manual adapter
await captionIngestService.start();

// Switch to file tail
await captionIngestService.setAdapter('file-tail', {
  type: 'file-tail',
  filePath: '/path/to/captions.vtt',
  fileFormat: 'vtt',
});

// Switch to clipboard
await captionIngestService.setAdapter('clipboard', {
  type: 'clipboard',
  pollInterval: 500,
});

// Back to manual
await captionIngestService.setAdapter('manual');
```

### Cleanup

```typescript
import { captionIngestService } from './services';

// Stop all adapters and cleanup
await captionIngestService.stop();
```

## File Formats

### Text (.txt)

Simple line-by-line text format. Each non-empty line is treated as a caption.

```
This is the first caption
This is the second caption
```

### WebVTT (.vtt)

WebVTT format with timestamps. The adapter extracts only the caption text.

```
WEBVTT

00:00:00.000 --> 00:00:05.000
This is the first caption

00:00:05.000 --> 00:00:10.000
This is the second caption
```

### SubRip (.srt)

SRT format with sequence numbers and timestamps. The adapter extracts only the caption text.

```
1
00:00:00,000 --> 00:00:05,000
This is the first caption

2
00:00:05,000 --> 00:00:10,000
This is the second caption
```

## Events

### caption:ingested

Emitted when a caption is ingested from any source.

```typescript
{
  text: string;       // Caption text
  source: string;     // Source adapter type
  timestamp: number;  // Unix timestamp (milliseconds)
}
```

### caption:adapter-changed

Emitted when the active adapter changes.

```typescript
{
  type: CaptionAdapterType;  // Adapter type
  config: any;               // Adapter configuration
}
```

### clipboard:monitoring

Emitted when clipboard monitoring starts or stops.

```typescript
{
  active: boolean;  // True if monitoring, false if stopped
}
```

## Error Handling

All adapters handle errors gracefully and emit errors via the EventBus:

```typescript
eventBus.on('app:error', (data) => {
  console.error(`Error in ${data.context}:`, data.error);
});
```

## Best Practices

1. **Always stop the service when done**: Call `captionIngestService.stop()` to cleanup resources
2. **Handle errors**: Listen to `app:error` events to handle adapter errors
3. **Clipboard monitoring indicator**: Show UI indicator when clipboard monitoring is active
4. **File validation**: Ensure file exists before configuring FileTailAdapter
5. **Poll interval**: Keep clipboard poll interval >= 100ms to avoid excessive CPU usage
