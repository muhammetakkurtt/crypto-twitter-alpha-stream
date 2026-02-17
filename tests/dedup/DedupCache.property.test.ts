/**
 * Property-based tests for DedupCache
 */

import * as fc from 'fast-check';
import { generateDedupKey } from '../../src/dedup/DedupCache';
import { TwitterEvent, EventType } from '../../src/models/types';

describe('DedupCache - Property Tests', () => {
  /**
   * For any two events E1 and E2, they should be considered duplicates 
   * if and only if they have identical event type, primary ID, and content.
   * Content hash ensures that updates with different data are not deduplicated.
   */
  describe('Property 10: Deduplication Key Uniqueness', () => {
    // Arbitrary generator for TwitterEvent
    // Generate valid ISO timestamps from unix timestamps (milliseconds)
    const validDateArb = fc.integer({ 
      min: new Date('2020-01-01T00:00:00.000Z').getTime(), 
      max: new Date('2030-12-31T23:59:59.999Z').getTime() 
    }).map(timestamp => new Date(timestamp).toISOString());

    const twitterEventArb = fc.record({
      type: fc.constantFrom<EventType>('post_created', 'post_updated', 'follow_created', 'follow_updated', 'user_updated', 'profile_updated', 'profile_pinned'),
      timestamp: validDateArb,
      primaryId: fc.string({ minLength: 1, maxLength: 20 }),
      user: fc.record({
        username: fc.string({ minLength: 1, maxLength: 20 }),
        displayName: fc.string({ minLength: 1, maxLength: 30 }),
        userId: fc.string({ minLength: 1, maxLength: 20 }),
      }),
      data: fc.record({
        username: fc.string({ minLength: 1, maxLength: 20 }),
        action: fc.string({ minLength: 1, maxLength: 20 }),
        tweetId: fc.string({ minLength: 1, maxLength: 20 })
      }),
    }) as fc.Arbitrary<TwitterEvent>;

    it('should generate identical keys for events with same type, primaryId, and content', () => {
      fc.assert(
        fc.property(twitterEventArb, (event) => {
          // Create two events with identical type, primaryId, and data
          const event1: TwitterEvent = { ...event };
          const event2: TwitterEvent = {
            ...event,
            timestamp: new Date(Date.now() + 10000).toISOString(), // Different timestamp
            // Keep same data - this is what matters for deduplication
            data: JSON.parse(JSON.stringify(event.data))
          };

          const key1 = generateDedupKey(event1);
          const key2 = generateDedupKey(event2);

          // Keys should be identical because type, primaryId, and content are the same
          // Timestamp difference doesn't matter
          expect(key1).toBe(key2);
        }),
        { numRuns: 100 }
      );
    });

    it('should generate different keys for events with different types', () => {
      fc.assert(
        fc.property(
          twitterEventArb,
          fc.constantFrom<EventType>('post_created', 'post_updated', 'follow_created', 'follow_updated', 'user_updated', 'profile_updated', 'profile_pinned'),
          (event, differentType) => {
            fc.pre(event.type !== differentType); // Ensure types are different

            const event1: TwitterEvent = { ...event };
            const event2: TwitterEvent = {
              ...event,
              type: differentType,
            };

            const key1 = generateDedupKey(event1);
            const key2 = generateDedupKey(event2);

            // Keys should be different because types are different
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different keys for events with different primaryIds', () => {
      fc.assert(
        fc.property(
          twitterEventArb,
          fc.string({ minLength: 1, maxLength: 20 }),
          (event, differentPrimaryId) => {
            fc.pre(event.primaryId !== differentPrimaryId); // Ensure primaryIds are different

            const event1: TwitterEvent = { ...event };
            const event2: TwitterEvent = {
              ...event,
              primaryId: differentPrimaryId,
            };

            const key1 = generateDedupKey(event1);
            const key2 = generateDedupKey(event2);

            // Keys should be different because primaryIds are different
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate different keys for events with same type and primaryId but different content', () => {
      fc.assert(
        fc.property(
          twitterEventArb,
          fc.record({
            username: fc.string({ minLength: 1, maxLength: 20 }),
            action: fc.string({ minLength: 1, maxLength: 20 }),
            tweetId: fc.string({ minLength: 1, maxLength: 20 })
          }),
          (event, differentData) => {
            // Ensure data is actually different
            const originalDataStr = JSON.stringify(event.data);
            const newDataStr = JSON.stringify(differentData);
            fc.pre(originalDataStr !== newDataStr);

            const event1: TwitterEvent = { ...event };
            const event2: TwitterEvent = {
              ...event,
              data: differentData, // Different content
            };

            const key1 = generateDedupKey(event1);
            const key2 = generateDedupKey(event2);

            // Keys should be different because content is different
            // This allows updates with new data to be processed
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate keys in the format {type}:{primaryId}:{contentHash}', () => {
      fc.assert(
        fc.property(twitterEventArb, (event) => {
          const key = generateDedupKey(event);
          
          // Key should have at least 3 parts separated by colons
          // (primaryId might contain colons, so we check minimum)
          const parts = key.split(':');
          expect(parts.length).toBeGreaterThanOrEqual(3);
          
          // First part should be event type
          expect(parts[0]).toBe(event.type);
          
          // Last part should be content hash (alphanumeric string)
          expect(parts[parts.length - 1]).toMatch(/^[a-z0-9]+$/);
          
          // Middle parts (when joined) should be primaryId
          const middleParts = parts.slice(1, -1);
          const reconstructedPrimaryId = middleParts.join(':');
          expect(reconstructedPrimaryId).toBe(event.primaryId);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * For any event E added to the dedup cache with TTL T, 
   * querying the cache for E after time T should return false (not found).
   */
  describe('Property 12: Dedup Cache TTL Expiration', () => {
    it('should expire entries after the specified TTL', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 20, max: 100 }), // TTL in milliseconds (smaller for faster tests)
          async (key, ttl) => {
            const { DedupCache } = await import('../../src/dedup/DedupCache');
            const cache = new DedupCache();

            // Add key with specified TTL
            cache.add(key, ttl);

            // Verify key exists immediately
            expect(cache.has(key)).toBe(true);

            // Wait for TTL to expire (add small buffer for timing)
            await new Promise(resolve => setTimeout(resolve, ttl + 20));

            // Verify key no longer exists
            expect(cache.has(key)).toBe(false);

            // Clean up
            cache.clear();
          }
        ),
        { numRuns: 20 } // Reduced runs for time-based tests
      );
    }, 30000); // 30 second timeout

    it('should not expire entries before the TTL has elapsed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 50, max: 200 }), // TTL in milliseconds
          async (key, ttl) => {
            const { DedupCache } = await import('../../src/dedup/DedupCache');
            const cache = new DedupCache();

            // Add key with specified TTL
            cache.add(key, ttl);

            // Wait for half the TTL
            await new Promise(resolve => setTimeout(resolve, ttl / 2));

            // Verify key still exists
            expect(cache.has(key)).toBe(true);

            // Clean up
            cache.clear();
          }
        ),
        { numRuns: 20 } // Reduced runs for time-based tests
      );
    }, 30000); // 30 second timeout

    it('should use default TTL when no TTL is specified', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 50, max: 200 }), // Default TTL
          async (key, defaultTTL) => {
            const { DedupCache } = await import('../../src/dedup/DedupCache');
            const cache = new DedupCache(defaultTTL);

            // Add key without specifying TTL
            cache.add(key);

            // Verify key exists immediately
            expect(cache.has(key)).toBe(true);

            // Wait for default TTL to expire (add small buffer)
            await new Promise(resolve => setTimeout(resolve, defaultTTL + 20));

            // Verify key no longer exists
            expect(cache.has(key)).toBe(false);

            // Clean up
            cache.clear();
          }
        ),
        { numRuns: 20 } // Reduced runs for time-based tests
      );
    }, 30000); // 30 second timeout
  });
});
