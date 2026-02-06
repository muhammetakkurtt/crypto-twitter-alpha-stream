/**
 * Unit tests for DedupCache
 */

import { DedupCache, generateDedupKey } from '../../src/dedup/DedupCache';
import { TwitterEvent } from '../../src/models/types';

describe('DedupCache - Unit Tests', () => {
  let cache: DedupCache;

  beforeEach(() => {
    cache = new DedupCache(1000); // 1 second default TTL
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate keys', () => {
      const key = 'test:key:123';

      // Add key
      cache.add(key);

      // Should detect duplicate
      expect(cache.has(key)).toBe(true);
    });

    it('should not detect non-existent keys', () => {
      const key = 'test:key:123';

      // Should not exist
      expect(cache.has(key)).toBe(false);
    });

    it('should handle multiple different keys', () => {
      const key1 = 'test:key1:123';
      const key2 = 'test:key2:456';
      const key3 = 'test:key3:789';

      cache.add(key1);
      cache.add(key2);
      cache.add(key3);

      expect(cache.has(key1)).toBe(true);
      expect(cache.has(key2)).toBe(true);
      expect(cache.has(key3)).toBe(true);
      expect(cache.size()).toBe(3);
    });

    it('should allow re-adding the same key', () => {
      const key = 'test:key:123';

      cache.add(key);
      expect(cache.has(key)).toBe(true);

      // Re-add the same key
      cache.add(key);
      expect(cache.has(key)).toBe(true);
      expect(cache.size()).toBe(1); // Should still be 1
    });
  });

  describe('Cache Size Tracking', () => {
    it('should start with size 0', () => {
      expect(cache.size()).toBe(0);
    });

    it('should increment size when adding keys', () => {
      cache.add('key1');
      expect(cache.size()).toBe(1);

      cache.add('key2');
      expect(cache.size()).toBe(2);

      cache.add('key3');
      expect(cache.size()).toBe(3);
    });

    it('should not increment size when re-adding same key', () => {
      cache.add('key1');
      expect(cache.size()).toBe(1);

      cache.add('key1');
      expect(cache.size()).toBe(1);
    });

    it('should decrement size when entries expire', async () => {
      cache.add('key1', 50);
      cache.add('key2', 50);
      expect(cache.size()).toBe(2);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.size()).toBe(0);
    });
  });

  describe('Clear Functionality', () => {
    it('should clear all entries', () => {
      cache.add('key1');
      cache.add('key2');
      cache.add('key3');
      expect(cache.size()).toBe(3);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(false);
    });

    it('should clear timeouts when clearing cache', async () => {
      cache.add('key1', 1000);
      cache.add('key2', 1000);

      cache.clear();

      // Wait to ensure timeouts were cleared
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Size should still be 0 (no errors from expired timeouts)
      expect(cache.size()).toBe(0);
    });

    it('should allow adding entries after clear', () => {
      cache.add('key1');
      cache.clear();

      cache.add('key2');
      expect(cache.has('key2')).toBe(true);
      expect(cache.size()).toBe(1);
    });
  });

  describe('TTL Behavior', () => {
    it('should use custom TTL when provided', async () => {
      const key = 'test:key:123';
      cache.add(key, 50);

      expect(cache.has(key)).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cache.has(key)).toBe(false);
    });

    it('should use default TTL when not provided', async () => {
      const shortCache = new DedupCache(50);
      const key = 'test:key:123';

      shortCache.add(key);
      expect(shortCache.has(key)).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(shortCache.has(key)).toBe(false);
      shortCache.clear();
    });

    it('should handle zero TTL', async () => {
      const key = 'test:key:123';
      cache.add(key, 0);

      // Should expire immediately
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(cache.has(key)).toBe(false);
    });
  });

  describe('generateDedupKey', () => {
    it('should generate key in correct format', () => {
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T10:30:00Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123',
        },
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          action: 'post_created',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T10:30:00Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        },
      };

      const key = generateDedupKey(event);
      expect(key).toBe('post_created:tweet123:2024-01-15T10:30:00Z');
    });

    it('should generate different keys for different event types', () => {
      const baseEvent: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T10:30:00Z',
        primaryId: 'id123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123',
        },
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          action: 'post_created',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T10:30:00Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        },
      };

      const event1 = { ...baseEvent, type: 'post_created' as const };
      const event2 = { ...baseEvent, type: 'profile_updated' as const };

      const key1 = generateDedupKey(event1);
      const key2 = generateDedupKey(event2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different primaryIds', () => {
      const baseEvent: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T10:30:00Z',
        primaryId: 'id123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123',
        },
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          action: 'post_created',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T10:30:00Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        },
      };

      const event1 = { ...baseEvent, primaryId: 'id123' };
      const event2 = { ...baseEvent, primaryId: 'id456' };

      const key1 = generateDedupKey(event1);
      const key2 = generateDedupKey(event2);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different timestamps', () => {
      const baseEvent: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T10:30:00Z',
        primaryId: 'id123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123',
        },
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          action: 'post_created',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T10:30:00Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        },
      };

      const event1 = { ...baseEvent, timestamp: '2024-01-15T10:30:00Z' };
      const event2 = { ...baseEvent, timestamp: '2024-01-15T10:31:00Z' };

      const key1 = generateDedupKey(event1);
      const key2 = generateDedupKey(event2);

      expect(key1).not.toBe(key2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string keys', () => {
      cache.add('');
      expect(cache.has('')).toBe(true);
    });

    it('should handle keys with special characters', () => {
      const key = 'test:key:with:colons:and:special!@#$%^&*()';
      cache.add(key);
      expect(cache.has(key)).toBe(true);
    });

    it('should handle very long keys', () => {
      const key = 'a'.repeat(10000);
      cache.add(key);
      expect(cache.has(key)).toBe(true);
    });

    it('should handle rapid additions', () => {
      for (let i = 0; i < 1000; i++) {
        cache.add(`key${i}`);
      }
      expect(cache.size()).toBe(1000);
    });
  });
});
