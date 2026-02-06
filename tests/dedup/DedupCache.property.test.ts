/**
 * Property-based tests for DedupCache
 */

import * as fc from 'fast-check';
import { generateDedupKey } from '../../src/dedup/DedupCache';
import { TwitterEvent, EventType } from '../../src/models/types';

describe('DedupCache - Property Tests', () => {
  /**
   * For any two events E1 and E2, they should be considered duplicates 
   * if and only if they have identical event type, primary ID, and timestamp.
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

    it('should generate identical keys for events with same type, primaryId, and timestamp', () => {
      fc.assert(
        fc.property(twitterEventArb, (event) => {
          // Create two events with identical type, primaryId, and timestamp
          const event1: TwitterEvent = { ...event };
          const event2: TwitterEvent = {
            ...event,
            // Change other fields to ensure only type, primaryId, timestamp matter
            user: {
              username: 'different_user',
              displayName: 'Different User',
              userId: 'different_id',
            },
            data: {
              username: 'different_user',
              action: 'post_created',
              tweetId: 'different_tweet'
            },
          };

          const key1 = generateDedupKey(event1);
          const key2 = generateDedupKey(event2);

          // Keys should be identical because type, primaryId, and timestamp are the same
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

    it('should generate different keys for events with different timestamps', () => {
      fc.assert(
        fc.property(
          twitterEventArb,
          fc.integer({ 
            min: new Date('2020-01-01T00:00:00.000Z').getTime(), 
            max: new Date('2030-12-31T23:59:59.999Z').getTime() 
          }),
          (event, differentTimestampMs) => {
            const differentTimestamp = new Date(differentTimestampMs).toISOString();
            fc.pre(event.timestamp !== differentTimestamp); // Ensure timestamps are different

            const event1: TwitterEvent = { ...event };
            const event2: TwitterEvent = {
              ...event,
              timestamp: differentTimestamp,
            };

            const key1 = generateDedupKey(event1);
            const key2 = generateDedupKey(event2);

            // Keys should be different because timestamps are different
            expect(key1).not.toBe(key2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate keys in the format {type}:{primaryId}:{timestamp}', () => {
      fc.assert(
        fc.property(twitterEventArb, (event) => {
          const key = generateDedupKey(event);
          const expectedKey = `${event.type}:${event.primaryId}:${event.timestamp}`;

          expect(key).toBe(expectedKey);
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
