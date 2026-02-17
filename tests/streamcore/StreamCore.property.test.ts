/**
 * Property-based tests for StreamCore
 */

import * as fc from 'fast-check';
import { StreamCore } from '../../src/streamcore/StreamCore';
import { Channel } from '../../src/ws/WSSClient';
import { FilterPipeline } from '../../src/filters/FilterPipeline';
import { DedupCache } from '../../src/dedup/DedupCache';
import { EventBus } from '../../src/eventbus/EventBus';

describe('StreamCore Property Tests', () => {
  
  /**
   * For any valid channel name from the set {all, tweets, following, profile},
   * the Stream Core should successfully establish a connection with that channel.
   */
  describe('Property 3: Channel Support Completeness', () => {
    it('should support all valid channel types', async () => {
      const validChannels: Channel[] = ['all', 'tweets', 'following', 'profile'];
      
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...validChannels),
          async (channel) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache();
            const eventBus = new EventBus();
            
            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: [channel],
                reconnectDelay: 100,
                maxReconnectDelay: 1000,
                reconnectBackoffMultiplier: 2.0,
                maxReconnectAttempts: 0
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            // Verify the channels are set correctly
            expect(streamCore.getChannels()).toEqual([channel]);
            
            // Verify initial status is disconnected
            expect(streamCore.getConnectionStatus()).toBe('disconnected');
            
            // Clean up
            streamCore.stop();
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should support multiple channels simultaneously', () => {
      const validChannels: Channel[] = ['all', 'tweets', 'following', 'profile'];

      fc.assert(
        fc.property(
          fc.subarray(validChannels, { minLength: 1, maxLength: 4 }),
          (channels) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache();
            const eventBus = new EventBus();
            
            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: channels
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            // Verify channels are correctly set
            expect(streamCore.getChannels()).toEqual(channels);
            
            streamCore.stop();
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  /**
   * For any event E, if E is processed and then E is received again within the TTL window,
   * the second occurrence should not be broadcast to any output channel.
   */
  describe('Property 11: Duplicate Event Blocking', () => {
    it('should block duplicate events within TTL window', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            type: fc.constantFrom('post_created', 'profile_update', 'following', 'unfollowing'),
            timestamp: fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms).toISOString()),
            primaryId: fc.uuid(),
            username: fc.string({ minLength: 3, maxLength: 15 }),
            displayName: fc.string({ minLength: 3, maxLength: 30 }),
            userId: fc.uuid(),
            text: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (eventData) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache(5000);
            const eventBus = new EventBus();
            
            let eventCount = 0;
            eventBus.subscribe('cli', () => {
              eventCount++;
            });

            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: ['all'],
                dedupTTL: 5000
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            const event: any = {
              type: eventData.type,
              timestamp: eventData.timestamp,
              primaryId: eventData.primaryId,
              user: {
                username: eventData.username,
                displayName: eventData.displayName,
                userId: eventData.userId
              },
              data: {
                tweetId: eventData.primaryId,
                text: eventData.text,
                url: `https://twitter.com/${eventData.username}/status/${eventData.primaryId}`
              }
            };

            (streamCore as any).handleEvent(event);
            (streamCore as any).handleEvent(event);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(eventCount).toBe(1);
            
            const stats = streamCore.getStats();
            expect(stats.totalEvents).toBe(2);
            expect(stats.deliveredEvents).toBe(1);
            expect(stats.dedupedEvents).toBe(1);

            streamCore.stop();
            dedupCache.clear();
          }
        ),
        { numRuns: 100 }
      );
    }, 30000);

    it('should allow same event after TTL expiration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            type: fc.constantFrom('post_created', 'profile_update', 'following', 'unfollowing'),
            timestamp: fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms).toISOString()),
            primaryId: fc.uuid(),
            username: fc.string({ minLength: 3, maxLength: 15 }),
            displayName: fc.string({ minLength: 3, maxLength: 30 }),
            userId: fc.uuid(),
            text: fc.string({ minLength: 10, maxLength: 100 })
          }),
          async (eventData) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache(50);
            const eventBus = new EventBus();
            
            let eventCount = 0;
            eventBus.subscribe('cli', () => {
              eventCount++;
            });

            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: ['all'],
                dedupTTL: 50
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            const event: any = {
              type: eventData.type,
              timestamp: eventData.timestamp,
              primaryId: eventData.primaryId,
              user: {
                username: eventData.username,
                displayName: eventData.displayName,
                userId: eventData.userId
              },
              data: {
                tweetId: eventData.primaryId,
                text: eventData.text,
                url: `https://twitter.com/${eventData.username}/status/${eventData.primaryId}`
              }
            };

            (streamCore as any).handleEvent(event);
            
            await new Promise(resolve => setTimeout(resolve, 70));
            
            (streamCore as any).handleEvent(event);

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(eventCount).toBe(2);
            
            const stats = streamCore.getStats();
            expect(stats.totalEvents).toBe(2);
            expect(stats.deliveredEvents).toBe(2);
            expect(stats.dedupedEvents).toBe(0);

            streamCore.stop();
            dedupCache.clear();
          }
        ),
        { numRuns: 100 }  // Reduced from 1000 to avoid timeout (100 runs * 80ms = 8s < 30s timeout)
      );
    }, 30000);
  });
});

  /**
   * For any WebSocket connection error, the Stream Core should log the error and initiate
   * reconnection without terminating the application.
   */
  describe('Property 26: Connection Error Resilience', () => {
    it('should handle connection errors without crashing', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 100 }),
          (errorMessage) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache();
            const eventBus = new EventBus();
            
            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: ['all']
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            // Simulate a connection error
            const error = new Error(errorMessage);
            (streamCore as any).handleError(error);

            // StreamCore should still be operational
            expect(streamCore.getConnectionStatus()).toBeDefined();
            
            streamCore.stop();
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should update connection status on error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Network error', 'Timeout', 'Connection refused', 'DNS lookup failed'),
          (errorType) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache();
            const eventBus = new EventBus();
            
            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: ['all']
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            // Set initial status to connected
            (streamCore as any).connectionStatus = 'connected';

            // Simulate a connection error
            const error = new Error(errorType);
            (streamCore as any).handleError(error);

            // Status should be updated to reconnecting
            const status = streamCore.getConnectionStatus();
            expect(['reconnecting', 'disconnected']).toContain(status);
            
            streamCore.stop();
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  /**
   * For any malformed event that fails parsing, the Stream Core should log the error
   * and continue processing subsequent events.
   */
  describe('Property 27: Event Parsing Error Resilience', () => {
    it('should continue processing after parsing errors', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom('post_created', 'profile_update', 'following', 'unfollowing'),
            timestamp: fc.integer({ min: 1577836800000, max: 1893456000000 }).map(ms => new Date(ms).toISOString()),
            primaryId: fc.uuid(),
            username: fc.string({ minLength: 3, maxLength: 15 }),
            displayName: fc.string({ minLength: 3, maxLength: 30 }),
            userId: fc.uuid(),
            text: fc.string({ minLength: 10, maxLength: 100 })
          }),
          (eventData) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache();
            const eventBus = new EventBus();
            
            let eventCount = 0;
            eventBus.subscribe('cli', () => {
              eventCount++;
            });

            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: ['all']
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            // Create a malformed event (missing required fields)
            const malformedEvent: any = {
              type: eventData.type
              // Missing other required fields
            };

            // Create a valid event
            const validEvent: any = {
              type: eventData.type,
              timestamp: eventData.timestamp,
              primaryId: eventData.primaryId,
              user: {
                username: eventData.username,
                displayName: eventData.displayName,
                userId: eventData.userId
              },
              data: {
                tweetId: eventData.primaryId,
                text: eventData.text,
                url: `https://twitter.com/${eventData.username}/status/${eventData.primaryId}`
              }
            };

            // Process malformed event (should not crash)
            (streamCore as any).handleEvent(malformedEvent);
            
            // Process valid event (should work)
            (streamCore as any).handleEvent(validEvent);

            // Valid event should have been processed
            expect(eventCount).toBe(1);
            
            streamCore.stop();
            dedupCache.clear();
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  /**
   * For any transient network error (timeout, connection reset), the application
   * should handle the error and continue operating without termination.
   */
  describe('Property 29: Transient Network Error Resilience', () => {
    it('should handle transient network errors gracefully', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'ETIMEDOUT',
            'ECONNRESET',
            'ECONNREFUSED',
            'ENETUNREACH',
            'EHOSTUNREACH'
          ),
          (errorCode) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache();
            const eventBus = new EventBus();
            
            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: ['all']
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            // Simulate a transient network error
            const error: any = new Error('Network error');
            error.code = errorCode;
            (streamCore as any).handleError(error);

            // StreamCore should still be operational
            expect(streamCore.getConnectionStatus()).toBeDefined();
            const stats = streamCore.getStats();
            expect(stats).toBeDefined();
            
            streamCore.stop();
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  /**
   * For any event with valid internal format (containing user.username, type, and data object),
   * StreamCore.isValidEvent() SHALL return true.
   */
  describe('Property 14: Internal Format Validation', () => {
    it('should accept events with valid internal format', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom('post_created', 'follow_created', 'user_updated', 'profile_updated', 'follow_updated'),
            timestamp: fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms).toISOString()),
            primaryId: fc.uuid(),
            username: fc.string({ minLength: 1, maxLength: 15 }),
            displayName: fc.string({ minLength: 1, maxLength: 50 }),
            userId: fc.uuid(),
            dataContent: fc.record({
              tweetId: fc.option(fc.uuid(), { nil: undefined }),
              text: fc.option(fc.string({ minLength: 1, maxLength: 280 }), { nil: undefined }),
              action: fc.option(fc.string(), { nil: undefined })
            })
          }),
          (eventData) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache();
            const eventBus = new EventBus();
            
            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: ['all']
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            // Create event with valid internal format
            const event: any = {
              type: eventData.type,
              timestamp: eventData.timestamp,
              primaryId: eventData.primaryId,
              user: {
                username: eventData.username,
                displayName: eventData.displayName,
                userId: eventData.userId
              },
              data: eventData.dataContent
            };

            // Validation should pass for internal format
            const isValid = (streamCore as any).isValidEvent(event);
            expect(isValid).toBe(true);
            
            streamCore.stop();
            dedupCache.clear();
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should reject events missing required internal format fields', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            // Missing user object
            { type: 'post_created', data: { text: 'test' } },
            // Missing user.username
            { type: 'post_created', user: { displayName: 'Test' }, data: { text: 'test' } },
            // Missing data object
            { type: 'post_created', user: { username: 'test' } },
            // Missing type
            { user: { username: 'test' }, data: { text: 'test' } },
            // user.username is not a string
            { type: 'post_created', user: { username: 123 }, data: { text: 'test' } }
          ),
          (invalidEvent) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache();
            const eventBus = new EventBus();
            
            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: ['all']
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            // Validation should fail for invalid format
            const isValid = (streamCore as any).isValidEvent(invalidEvent);
            expect(isValid).toBe(false);
            
            streamCore.stop();
            dedupCache.clear();
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  /**
   * For any event with valid required fields but missing optional fields,
   * StreamCore.isValidEvent() SHALL return true and not reject the event.
   */
  describe('Property 16: Optional Fields Tolerance', () => {
    it('should accept events with missing optional fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom('post_created', 'follow_created', 'user_updated', 'profile_updated', 'follow_updated'),
            username: fc.string({ minLength: 1, maxLength: 15 }),
            // Optional fields that may or may not be present
            timestamp: fc.option(fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms).toISOString()), { nil: undefined }),
            primaryId: fc.option(fc.uuid(), { nil: undefined }),
            displayName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
            userId: fc.option(fc.uuid(), { nil: undefined })
          }),
          (eventData) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache();
            const eventBus = new EventBus();
            
            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: ['all']
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            // Create event with required fields only (optional fields may be missing)
            const event: any = {
              type: eventData.type,
              user: {
                username: eventData.username
                // displayName and userId are optional
              },
              data: {
                // Data object can be empty or have any content
              }
            };

            // Add optional fields if they exist
            if (eventData.timestamp) event.timestamp = eventData.timestamp;
            if (eventData.primaryId) event.primaryId = eventData.primaryId;
            if (eventData.displayName) event.user.displayName = eventData.displayName;
            if (eventData.userId) event.user.userId = eventData.userId;

            // Validation should pass even with missing optional fields
            const isValid = (streamCore as any).isValidEvent(event);
            expect(isValid).toBe(true);
            
            streamCore.stop();
            dedupCache.clear();
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should accept events with minimal required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom('post_created', 'follow_created', 'user_updated'),
            username: fc.string({ minLength: 1, maxLength: 15 })
          }),
          (eventData) => {
            const filterPipeline = new FilterPipeline();
            const dedupCache = new DedupCache();
            const eventBus = new EventBus();
            
            const streamCore = new StreamCore(
              {
                baseUrl: 'http://localhost:3000',
                token: 'test-token',
                channels: ['all']
              },
              filterPipeline,
              dedupCache,
              eventBus
            );

            // Create event with absolute minimum required fields
            const minimalEvent: any = {
              type: eventData.type,
              user: {
                username: eventData.username
              },
              data: {}
            };

            // Validation should pass with minimal fields
            const isValid = (streamCore as any).isValidEvent(minimalEvent);
            expect(isValid).toBe(true);
            
            streamCore.stop();
            dedupCache.clear();
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

