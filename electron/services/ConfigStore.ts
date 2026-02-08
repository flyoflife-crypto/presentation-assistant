import ElectronStore = require('electron-store');
import { eventBus } from './EventBus';

export interface AppConfig {
  // API Configuration
  openRouterApiKey?: string;
  selectedModel?: string;
  maxTokens?: number;
  temperature?: number;

  // Audio Configuration
  audioInputDevice?: string;
  audioSampleRate?: number;
  autoTranscribe?: boolean;

  // Hint Configuration
  hintDisplayDuration?: number;
  hintPosition?: 'top' | 'bottom' | 'floating';
  hintOpacity?: number;
  enableAutoHints?: boolean;

  // Context Configuration
  maxContextSize?: number;
  compactionThreshold?: number;

  // UI Configuration
  theme?: 'light' | 'dark' | 'system';
  alwaysOnTop?: boolean;
  showNotifications?: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  selectedModel: 'meta-llama/llama-3.1-8b-instruct:free',
  maxTokens: 512,
  temperature: 0.7,
  audioSampleRate: 16000,
  autoTranscribe: true,
  hintDisplayDuration: 5000,
  hintPosition: 'top',
  hintOpacity: 0.9,
  enableAutoHints: true,
  maxContextSize: 8000,
  compactionThreshold: 0.8,
  theme: 'system',
  alwaysOnTop: true,
  showNotifications: true,
};

/**
 * ConfigStore - Manages non-secret application configuration
 * Uses electron-store for persistent storage
 */
class ConfigStore {
  private store: ElectronStore<AppConfig>;

  constructor() {
    this.store = new ElectronStore<AppConfig>({
      name: 'config',
      defaults: DEFAULT_CONFIG,
      encryptionKey: undefined, // No encryption for non-secret config
    });

    eventBus.emit('config:loaded', undefined);
  }

  /**
   * Get a configuration value
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] | undefined {
    return this.store.get(key);
  }

  /**
   * Set a configuration value
   */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.store.set(key, value);
    eventBus.emit('config:changed', { key, value });
  }

  /**
   * Get all configuration values
   */
  getAll(): AppConfig {
    return this.store.store;
  }

  /**
   * Set multiple configuration values
   */
  setAll(config: Partial<AppConfig>): void {
    Object.entries(config).forEach(([key, value]) => {
      this.set(key as keyof AppConfig, value);
    });
  }

  /**
   * Delete a configuration value (reset to default)
   */
  delete(key: keyof AppConfig): void {
    this.store.delete(key);
    eventBus.emit('config:changed', { key, value: undefined });
  }

  /**
   * Reset all configuration to defaults
   */
  reset(): void {
    this.store.clear();
    eventBus.emit('config:loaded', undefined);
  }

  /**
   * Check if a key exists
   */
  has(key: keyof AppConfig): boolean {
    return this.store.has(key);
  }

  /**
   * Get the store path
   */
  getPath(): string {
    return this.store.path;
  }
}

// Export class for typing
export { ConfigStore };

// Singleton instance
export const configStore = new ConfigStore();
export default configStore;
