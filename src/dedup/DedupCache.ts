/**
 * Deduplication cache with TTL support
 * Prevents duplicate events from being processed multiple times
 */

import { TwitterEvent } from '../models/types';

interface CacheEntry {
  key: string;
  timeoutId: NodeJS.Timeout;
}

export class DedupCache {
  private cache: Map<string, CacheEntry>;
  private defaultTTL: number;

  /**
   * Creates a new DedupCache instance
   * @param defaultTTL - Default time-to-live in milliseconds (default: 30000ms = 30s)
   */
  constructor(defaultTTL: number = 30000) {
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  /**
   * Checks if a key exists in the cache
   * @param key - The deduplication key to check
   * @returns true if the key exists, false otherwise
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Adds a key to the cache with TTL-based expiration
   * @param key - The deduplication key to add
   * @param ttl - Time-to-live in milliseconds (optional, uses default if not provided)
   */
  add(key: string, ttl?: number): void {
    const expirationTime = ttl ?? this.defaultTTL;
    
    // Clear existing timeout if key already exists
    if (this.cache.has(key)) {
      const existing = this.cache.get(key)!;
      clearTimeout(existing.timeoutId);
    }

    // Set up automatic expiration
    const timeoutId = setTimeout(() => {
      this.cache.delete(key);
    }, expirationTime);

    this.cache.set(key, { key, timeoutId });
  }

  /**
   * Clears all entries from the cache
   */
  clear(): void {
    // Clear all timeouts before clearing the cache
    for (const entry of this.cache.values()) {
      clearTimeout(entry.timeoutId);
    }
    this.cache.clear();
  }

  /**
   * Returns the current size of the cache
   * @returns The number of entries in the cache
   */
  size(): number {
    return this.cache.size;
  }
}

/**
 * Generates a deduplication key for a Twitter event
 * Key format: {eventType}:{primaryId}:{timestamp}
 * @param event - The Twitter event to generate a key for
 * @returns The deduplication key
 */
export function generateDedupKey(event: TwitterEvent): string {
  return `${event.type}:${event.primaryId}:${event.timestamp}`;
}
