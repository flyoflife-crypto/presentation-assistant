import * as keytar from 'keytar';
import { eventBus } from './EventBus';

const SERVICE_NAME = 'presentation-assistant-pro';

export type SecretKey = 'openRouterApiKey' | 'anthropicApiKey' | 'openaiApiKey';

/**
 * SecretStore - Manages sensitive data using native keychain
 * Uses keytar for macOS Keychain integration
 */
class SecretStore {
  private cache: Map<SecretKey, string>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Get a secret value
   * Returns cached value if available, otherwise fetches from keychain
   */
  async get(key: SecretKey): Promise<string | null> {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key) || null;
    }

    // Fetch from keychain
    try {
      const value = await keytar.getPassword(SERVICE_NAME, key);
      if (value) {
        this.cache.set(key, value);
      }
      return value;
    } catch (error) {
      console.error(`Failed to get secret ${key}:`, error);
      eventBus.emit('app:error', {
        error: error as Error,
        context: `SecretStore.get(${key})`,
      });
      return null;
    }
  }

  /**
   * Set a secret value
   */
  async set(key: SecretKey, value: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, key, value);
      this.cache.set(key, value);
      eventBus.emit('secret:set', { key });
    } catch (error) {
      console.error(`Failed to set secret ${key}:`, error);
      eventBus.emit('app:error', {
        error: error as Error,
        context: `SecretStore.set(${key})`,
      });
      throw error;
    }
  }

  /**
   * Delete a secret value
   */
  async delete(key: SecretKey): Promise<boolean> {
    try {
      const deleted = await keytar.deletePassword(SERVICE_NAME, key);
      this.cache.delete(key);
      if (deleted) {
        eventBus.emit('secret:deleted', { key });
      }
      return deleted;
    } catch (error) {
      console.error(`Failed to delete secret ${key}:`, error);
      eventBus.emit('app:error', {
        error: error as Error,
        context: `SecretStore.delete(${key})`,
      });
      return false;
    }
  }

  /**
   * Check if a secret exists
   */
  async has(key: SecretKey): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Clear all secrets for this service
   */
  async clearAll(): Promise<void> {
    const keys: SecretKey[] = ['openRouterApiKey', 'anthropicApiKey', 'openaiApiKey'];
    
    for (const key of keys) {
      await this.delete(key);
    }
    
    this.cache.clear();
  }

  /**
   * Get all secret keys (returns keys only, not values)
   */
  async getAllKeys(): Promise<SecretKey[]> {
    const keys: SecretKey[] = ['openRouterApiKey', 'anthropicApiKey', 'openaiApiKey'];
    const existingKeys: SecretKey[] = [];

    for (const key of keys) {
      if (await this.has(key)) {
        existingKeys.push(key);
      }
    }

    return existingKeys;
  }

  /**
   * Clear the in-memory cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export class for typing
export { SecretStore };

// Singleton instance
export const secretStore = new SecretStore();
export default secretStore;
