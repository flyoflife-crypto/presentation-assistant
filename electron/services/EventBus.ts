import EventEmitter3 from 'eventemitter3';

export interface EventMap {
  // Configuration events
  'config:changed': { key: string; value: unknown };
  'config:loaded': void;

  // Secret events
  'secret:set': { key: string };
  'secret:deleted': { key: string };

  // Context events
  'context:updated': { size: number; messageCount: number };
  'context:compacted': { oldSize: number; newSize: number };
  'context:cleared': void;

  // Hint events
  'hint:generated': { text: string; priority: 'low' | 'medium' | 'high' };
  'hint:displayed': { text: string };
  'hint:expired': { text: string };

  // Audio events
  'audio:started': void;
  'audio:stopped': void;
  'audio:transcription': { text: string; isFinal: boolean };

  // AI events
  'ai:request': { endpoint: string };
  'ai:response': { endpoint: string; tokens?: number };
  'ai:error': { endpoint: string; error: string };

  // Application events
  'app:ready': void;
  'app:error': { error: Error; context?: string };
  'app:shutdown': void;
}

export type EventKey = keyof EventMap;
export type EventCallback<K extends EventKey> = (data: EventMap[K]) => void;

/**
 * EventBus - Central event system for inter-service communication
 * Uses EventEmitter3 for efficient pub/sub with typed events
 */
class EventBus {
  private emitter: EventEmitter3<EventMap>;

  constructor() {
    this.emitter = new EventEmitter3<EventMap>();
  }

  /**
   * Subscribe to an event
   */
  on<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    this.emitter.on(event, callback as any);
  }

  /**
   * Subscribe to an event (one-time only)
   */
  once<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    this.emitter.once(event, callback as any);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    this.emitter.off(event, callback as any);
  }

  /**
   * Emit an event
   */
  emit<K extends EventKey>(event: K, data: EventMap[K]): void {
    this.emitter.emit(event, data);
  }

  /**
   * Remove all listeners for a specific event or all events
   */
  removeAllListeners(event?: EventKey): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount(event: EventKey): number {
    return this.emitter.listenerCount(event);
  }
}

// Export class for typing
export { EventBus };

// Singleton instance
export const eventBus = new EventBus();
export default eventBus;
