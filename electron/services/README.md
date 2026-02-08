# Core Services

This directory contains the core services for the Presentation Assistant Pro application. Each service is modular, well-typed, and communicates through the EventBus.

## Services Overview

### 1. EventBus.ts
Central event system for inter-service communication using EventEmitter3.

**Features:**
- Typed events with full TypeScript support
- Pub/sub pattern for loose coupling
- Event listener management (on, once, off)
- Singleton instance for global access

**Usage:**
```typescript
import { eventBus } from './services';

// Subscribe to events
eventBus.on('config:changed', (data) => {
  console.log(`Config changed: ${data.key} = ${data.value}`);
});

// Emit events
eventBus.emit('app:ready', undefined);
```

**Event Types:**
- Configuration: `config:changed`, `config:loaded`
- Secrets: `secret:set`, `secret:deleted`
- Context: `context:updated`, `context:compacted`, `context:cleared`
- Hints: `hint:generated`, `hint:displayed`, `hint:expired`
- Audio: `audio:started`, `audio:stopped`, `audio:transcription`
- AI: `ai:request`, `ai:response`, `ai:error`
- Application: `app:ready`, `app:error`, `app:shutdown`

---

### 2. ConfigStore.ts
Manages non-secret application configuration using electron-store.

**Features:**
- Persistent storage of settings
- Type-safe configuration interface
- Default values
- Emits events on changes

**Usage:**
```typescript
import { configStore } from './services';

// Get configuration
const model = configStore.get('selectedModel');

// Set configuration
configStore.set('temperature', 0.8);

// Get all configuration
const allConfig = configStore.getAll();

// Reset to defaults
configStore.reset();
```

**Configuration Keys:**
- API: `openRouterApiKey`, `selectedModel`, `maxTokens`, `temperature`
- Audio: `audioInputDevice`, `audioSampleRate`, `autoTranscribe`
- Hints: `hintDisplayDuration`, `hintPosition`, `hintOpacity`, `enableAutoHints`
- Context: `maxContextSize`, `compactionThreshold`
- UI: `theme`, `alwaysOnTop`, `showNotifications`

---

### 3. SecretStore.ts
Manages sensitive data using native macOS Keychain via keytar.

**Features:**
- Secure storage in macOS Keychain
- In-memory caching for performance
- Service name: `presentation-assistant-pro`
- Async operations

**Usage:**
```typescript
import { secretStore } from './services';

// Set a secret
await secretStore.set('openRouterApiKey', 'sk-...');

// Get a secret
const apiKey = await secretStore.get('openRouterApiKey');

// Check if secret exists
const hasKey = await secretStore.has('openRouterApiKey');

// Delete a secret
await secretStore.delete('openRouterApiKey');

// Clear all secrets
await secretStore.clearAll();
```

**Supported Keys:**
- `openRouterApiKey`
- `anthropicApiKey`
- `openaiApiKey`

---

### 4. ContextStore.ts
Manages conversation context for AI interactions with compaction support.

**Features:**
- Tracks system prompt (sent once)
- Rolling transcript of conversation
- Hint messages
- Automatic context compaction when near limits
- Token estimation (≈4 chars per token)

**Usage:**
```typescript
import { contextStore } from './services';

// Set system prompt
contextStore.setSystemPrompt('You are a helpful presentation assistant.');

// Add messages
contextStore.addUserMessage('I need help with my presentation.');
contextStore.addAssistantMessage('Of course! How can I assist you?');

// Add hints
contextStore.addHint('Try: Slow down your pace');

// Get all messages for API
const messages = contextStore.getMessages();

// Get metrics
const metrics = contextStore.getMetrics();
// { totalMessages, estimatedTokens, systemPromptTokens, transcriptTokens, hintsTokens }

// Clear old hints (older than 60s)
contextStore.clearOldHints(60000);

// Manual compaction
await contextStore.compact();

// Clear all context
contextStore.clear();
```

**Compaction:**
When context size exceeds `maxContextSize * compactionThreshold`, the store automatically compacts by summarizing older messages. This prevents token limit issues while maintaining conversation continuity.

---

### 5. HintComposer.ts
Validates and formats hints for display with strict rules.

**Features:**
- Maximum 240 characters
- 1-2 lines
- Actionable format (starts with action verb)
- Priority levels: low, medium, high
- TTL (time-to-live) support
- Extraction from AI responses

**Usage:**
```typescript
import { hintComposer } from './services';

// Compose a single hint
const hint = hintComposer.compose({
  content: 'Slow down your speaking pace',
  priority: 'high',
  ttlMs: 5000
});
// Returns: { text: 'Try: Slow down your speaking pace', ttlMs: 5000, priority: 'high' }

// Compose multiple hints (auto-prioritized)
const hints = hintComposer.composeMultiple([
  { content: 'Maintain eye contact', priority: 'medium' },
  { content: 'Use hand gestures', priority: 'low' }
]);

// Extract hints from AI response
const extracted = hintComposer.extractFromResponse(`
Here are some suggestions:
- Maintain eye contact with the audience
- Use hand gestures to emphasize key points
- Pause between major sections
`);

// Update configuration
hintComposer.updateConfig({
  maxLength: 200,
  defaultTtlMs: 3000
});
```

**Hint Format Rules:**
1. Maximum 240 characters
2. 1-2 lines (natural sentence breaks)
3. Must be actionable (starts with action verb or "Try:")
4. Truncated with "..." if too long
5. Auto-prefixed with "Try:" if not already actionable

**Extraction Patterns:**
- `HINT: text` format
- Bullet points (`-`, `•`, `*`)
- Numbered lists (`1.`, `2.`, etc.)

---

## Architecture

All services follow these principles:

1. **Modularity**: Each service has a single responsibility
2. **Type Safety**: Full TypeScript typing with interfaces
3. **Event-Driven**: Services communicate via EventBus
4. **Singleton Pattern**: Single instance per service
5. **Error Handling**: Errors emit `app:error` events
6. **Testing**: Each service can be tested independently

## Usage in Main Process

```typescript
import { 
  eventBus,
  configStore,
  secretStore,
  contextStore,
  hintComposer
} from './services';

// Initialize services
eventBus.emit('app:ready', undefined);

// Load API key
const apiKey = await secretStore.get('openRouterApiKey');

// Setup context
const maxContextSize = configStore.get('maxContextSize') || 8000;
contextStore.updateConfig(maxContextSize);
contextStore.setSystemPrompt('You are a presentation assistant...');

// Listen for context updates
eventBus.on('context:compacted', ({ oldSize, newSize }) => {
  console.log(`Context compacted: ${oldSize} -> ${newSize} tokens`);
});

// Compose hints from AI response
const hints = hintComposer.extractFromResponse(aiResponse);
for (const hint of hints) {
  contextStore.addHint(hint.text);
  eventBus.emit('hint:generated', { text: hint.text, priority: hint.priority });
}
```

## Error Handling

All services emit errors through the EventBus:

```typescript
eventBus.on('app:error', ({ error, context }) => {
  console.error(`Error in ${context}:`, error);
  // Handle error appropriately
});
```

## Testing

Run type checks:
```bash
npm run type-check
```

Test services:
```bash
npx ts-node electron/services/test.ts
```

## Dependencies

- `eventemitter3`: ^5.0.1 - Event bus implementation
- `electron-store`: ^8.1.0 - Configuration storage
- `keytar`: ^7.9.0 - Secure secret storage
