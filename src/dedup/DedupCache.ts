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
 * Generates a simple hash from a string
 * Uses a basic hash algorithm for content comparison
 * @param str - The string to hash
 * @returns A numeric hash value
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Generates a content hash for event data
 * This allows detecting when the same event has different content
 * @param data - The event data to hash
 * @returns A hash string representing the content
 */
function hashEventContent(data: any): string {
  try {
    // Stringify the data in a consistent way (sorted keys for consistency)
    // Use a replacer function to sort keys recursively
    const jsonStr = JSON.stringify(data, (_key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Sort object keys
        return Object.keys(value)
          .sort()
          .reduce((sorted: any, k) => {
            sorted[k] = value[k];
            return sorted;
          }, {});
      }
      return value;
    });
    return simpleHash(jsonStr).toString(36);
  } catch (error) {
    // If hashing fails, return a timestamp-based fallback
    return Date.now().toString(36);
  }
}

/**
 * Generates a deduplication key for a Twitter event
 * Key format: {eventType}:{primaryId}:{contentHash}
 * 
 * The content hash ensures that:
 * - Identical events (same content) are deduplicated
 * - Updated events (different content) are processed
 * - Works for all event types (created, updated, etc.)
 * 
 * @param event - The Twitter event to generate a key for
 * @returns The deduplication key
 */
export function generateDedupKey(event: TwitterEvent): string {
  const contentHash = hashEventContent(event.data);
  return `${event.type}:${event.primaryId}:${contentHash}`;
}
