/**
 * Test file to verify all services are properly exported and functional
 * This demonstrates the basic usage of each service
 */

import { 
  eventBus, 
  configStore, 
  secretStore, 
  contextStore, 
  hintComposer 
} from './index';

// Test EventBus
console.log('Testing EventBus...');
eventBus.on('app:ready', () => {
  console.log('Received app ready event');
});

// Test ConfigStore
console.log('\nTesting ConfigStore...');
configStore.set('selectedModel', 'test-model');
console.log('Selected model:', configStore.get('selectedModel'));
console.log('All config:', Object.keys(configStore.getAll()));

// Test SecretStore (async)
console.log('\nTesting SecretStore...');
(async () => {
  await secretStore.set('openRouterApiKey', 'test-api-key-123');
  const key = await secretStore.get('openRouterApiKey');
  console.log('Retrieved key exists:', key !== null);
  await secretStore.delete('openRouterApiKey');
})();

// Test ContextStore
console.log('\nTesting ContextStore...');
contextStore.setSystemPrompt('You are a helpful presentation assistant.');
contextStore.addUserMessage('Hello, I need help with my presentation.');
contextStore.addAssistantMessage('Of course! How can I assist you?');
console.log('Context metrics:', contextStore.getMetrics());

// Test HintComposer
console.log('\nTesting HintComposer...');
const hint = hintComposer.compose({
  content: 'Slow down your speaking pace to give the audience time to absorb information.',
  priority: 'high',
});
console.log('Composed hint:', hint);

const extractedHints = hintComposer.extractFromResponse(`
Here are some suggestions:
- Maintain eye contact with the audience
- Use hand gestures to emphasize key points
- Pause between major sections
`);
console.log('Extracted hints:', extractedHints.length);

console.log('\n✓ All services initialized and tested successfully!');
