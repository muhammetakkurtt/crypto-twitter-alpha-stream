/**
 * Property-based tests for StreamCore
 */

import * as fc from 'fast-check';
import { StreamCore } from '../../src/streamcore/StreamCore';
import { Channel } from '../../src/models/types';
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


  /**
   * Runtime Subscription Properties
   */
  describe('Runtime Subscription Properties', () => {
    
    /**
     * For any RuntimeSubscriptionState that is set in the Runtime_Subscription_Manager,
     * reading the state back should return an equivalent state with all fields matching.
     */
    describe('Property 2: State Read Consistency', () => {
      it('should return consistent state after reading', () => {
        fc.assert(
          fc.property(
            fc.record({
              channels: fc.subarray(['all', 'tweets', 'following', 'profile'] as const, { minLength: 0, maxLength: 4 }),
              users: fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 10 }),
              mode: fc.constantFrom('active' as const, 'idle' as const),
              source: fc.constantFrom('config' as const, 'runtime' as const)
            }),
            (stateData) => {
              const filterPipeline = new FilterPipeline();
              const dedupCache = new DedupCache();
              const eventBus = new EventBus();

              const streamCore = new StreamCore(
                {
                  baseUrl: 'http://localhost:3000',
                  token: 'test-token',
                  channels: stateData.channels as any,
                  userFilters: stateData.users
                },
                filterPipeline,
                dedupCache,
                eventBus
              );

              // Read state
              const state = streamCore.getRuntimeSubscriptionState();

              // Verify all fields are present and match
              expect(state.channels).toEqual(stateData.channels);
              expect(state.users).toEqual(stateData.users);
              expect(state.mode).toBeDefined();
              expect(state.source).toBe('config'); // Always config on init
              expect(state.updatedAt).toBeDefined();

              // Read again and verify consistency
              const state2 = streamCore.getRuntimeSubscriptionState();
              expect(state2).toEqual(state);

              streamCore.stop();
              dedupCache.clear();
            }
          ),
          { numRuns: 100 }
        );
      });
    });

    /**
     * For any valid subscription update payload, when the update succeeds at the Actor level,
     * the Runtime_Subscription_Manager state should be updated completely with all fields
     * reflecting the new subscription, or if it fails, the state should remain completely unchanged.
     */
    describe('Property 3: Atomic Update Success', () => {
      it('should update state completely on success or not at all on failure', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              initialChannels: fc.subarray(['all', 'tweets', 'following', 'profile'] as const, { minLength: 1, maxLength: 4 }),
              newChannels: fc.subarray(['all', 'tweets', 'following', 'profile'] as const, { minLength: 0, maxLength: 4 }),
              newUsers: fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 5 }),
              shouldSucceed: fc.boolean()
            }),
            async (testData) => {
              const filterPipeline = new FilterPipeline();
              const dedupCache = new DedupCache();
              const eventBus = new EventBus();

              const streamCore = new StreamCore(
                {
                  baseUrl: 'http://localhost:3000',
                  token: 'test-token',
                  channels: testData.initialChannels as any
                },
                filterPipeline,
                dedupCache,
                eventBus
              );

              const initialState = streamCore.getRuntimeSubscriptionState();

              // Mock wssClient
              const mockWssClient = {
                getConnectionState: jest.fn().mockReturnValue('connected'),
                updateSubscription: jest.fn().mockImplementation(() => {
                  if (testData.shouldSucceed) {
                    return Promise.resolve();
                  } else {
                    return Promise.reject(new Error('Actor update failed'));
                  }
                }),
                disconnect: jest.fn()
              };
              (streamCore as any).wssClient = mockWssClient;

              try {
                const newState = await streamCore.updateRuntimeSubscription({
                  channels: testData.newChannels as any,
                  users: testData.newUsers
                });

                // If we get here, update succeeded
                expect(testData.shouldSucceed).toBe(true);
                
                // Verify complete state update
                expect(newState.source).toBe('runtime');
                expect(newState.channels).toBeDefined();
                expect(newState.users).toBeDefined();
                expect(newState.mode).toBeDefined();
                expect(newState.updatedAt).toBeDefined();
                
                // Verify timestamp is valid ISO string (timestamp may be same if update is very fast)
                expect(new Date(newState.updatedAt).getTime()).toBeGreaterThan(0);

              } catch (error) {
                // If we get here, update failed
                expect(testData.shouldSucceed).toBe(false);
                
                // Verify state unchanged
                const currentState = streamCore.getRuntimeSubscriptionState();
                expect(currentState.channels).toEqual(initialState.channels);
                expect(currentState.users).toEqual(initialState.users);
                expect(currentState.source).toBe(initialState.source);
              }

              streamCore.stop();
              dedupCache.clear();
            }
          ),
          { numRuns: 100 }
        );
      }, 30000);
    });

    /**
     * For any two concurrent subscription update requests, the Runtime_Subscription_Manager
     * should reject the second request with a conflict error while the first is in progress.
     */
    describe('Property 4: Concurrent Update Rejection', () => {
      it('should reject concurrent updates', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.record({
              channels1: fc.subarray(['all', 'tweets', 'following', 'profile'] as const, { minLength: 1, maxLength: 4 }),
              channels2: fc.subarray(['all', 'tweets', 'following', 'profile'] as const, { minLength: 1, maxLength: 4 }),
              users1: fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 3 }),
              users2: fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 3 })
            }),
            async (testData) => {
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

              // Mock wssClient with slow update
              const mockWssClient = {
                getConnectionState: jest.fn().mockReturnValue('connected'),
                updateSubscription: jest.fn().mockImplementation(() => 
                  new Promise(resolve => setTimeout(resolve, 50))
                ),
                disconnect: jest.fn()
              };
              (streamCore as any).wssClient = mockWssClient;

              // Start first update
              const firstUpdate = streamCore.updateRuntimeSubscription({
                channels: testData.channels1 as any,
                users: testData.users1
              });

              // Try second update immediately
              let secondUpdateRejected = false;
              try {
                await streamCore.updateRuntimeSubscription({
                  channels: testData.channels2 as any,
                  users: testData.users2
                });
              } catch (error: any) {
                secondUpdateRejected = true;
                expect(error.message).toContain('already in progress');
              }

              expect(secondUpdateRejected).toBe(true);

              // Wait for first update to complete
              await firstUpdate;

              streamCore.stop();
              dedupCache.clear();
            }
          ),
          { numRuns: 100 }
        );
      }, 30000);
    });

    /**
     * For any subscription update with an empty channels array, the Runtime_Subscription_Manager
     * should transition the mode field to 'idle', and this should be treated as a valid state
     * without throwing errors.
     */
    describe('Property 5: Idle Mode Transition', () => {
      it('should transition to idle mode with empty channels', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(fc.string({ minLength: 1, maxLength: 15 }), { maxLength: 5 }),
            async (users) => {
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

              // Mock wssClient
              const mockWssClient = {
                getConnectionState: jest.fn().mockReturnValue('connected'),
                updateSubscription: jest.fn().mockResolvedValue(undefined),
                disconnect: jest.fn()
              };
              (streamCore as any).wssClient = mockWssClient;

              // Update with empty channels
              const newState = await streamCore.updateRuntimeSubscription({
                channels: [],
                users: users
              });

              // Verify idle mode
              expect(newState.channels).toEqual([]);
              expect(newState.mode).toBe('idle');
              expect(newState.source).toBe('runtime');

              streamCore.stop();
              dedupCache.clear();
            }
          ),
          { numRuns: 100 }
        );
      }, 30000);

      it('should transition from idle to active mode', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.subarray(['all', 'tweets', 'following', 'profile'] as const, { minLength: 1, maxLength: 4 }),
            async (channels) => {
              const filterPipeline = new FilterPipeline();
              const dedupCache = new DedupCache();
              const eventBus = new EventBus();

              const streamCore = new StreamCore(
                {
                  baseUrl: 'http://localhost:3000',
                  token: 'test-token',
                  channels: []
                },
                filterPipeline,
                dedupCache,
                eventBus
              );

              // Verify initial idle mode
              const initialState = streamCore.getRuntimeSubscriptionState();
              expect(initialState.mode).toBe('idle');

              // Mock wssClient
              const mockWssClient = {
                getConnectionState: jest.fn().mockReturnValue('connected'),
                updateSubscription: jest.fn().mockResolvedValue(undefined),
                disconnect: jest.fn()
              };
              (streamCore as any).wssClient = mockWssClient;

              // Update with non-empty channels
              const newState = await streamCore.updateRuntimeSubscription({
                channels: channels as any,
                users: []
              });

              // Verify active mode
              expect(newState.channels.length).toBeGreaterThan(0);
              expect(newState.mode).toBe('active');

              streamCore.stop();
              dedupCache.clear();
            }
          ),
          { numRuns: 100 }
        );
      }, 30000);
    });

    /**
     * For any subscription update payload, the Runtime_Subscription_Manager should reject
     * invalid channel names with a validation error, normalize valid inputs by removing
     * duplicates, trimming whitespace, converting to lowercase, and sorting, and accept
     * the normalized result.
     */
    describe('Property 13: Input Validation and Normalization', () => {
      it('should reject invalid channel names', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 20 }).filter(s => 
              !['all', 'tweets', 'following', 'profile'].includes(s)
            ),
            async (invalidChannel) => {
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

              // Mock wssClient
              const mockWssClient = {
                getConnectionState: jest.fn().mockReturnValue('connected'),
                updateSubscription: jest.fn(),
                disconnect: jest.fn()
              };
              (streamCore as any).wssClient = mockWssClient;

              // Try to update with invalid channel
              let errorThrown = false;
              try {
                await streamCore.updateRuntimeSubscription({
                  channels: [invalidChannel as any],
                  users: []
                });
              } catch (error: any) {
                errorThrown = true;
                expect(error.message).toContain('Invalid channel');
              }

              expect(errorThrown).toBe(true);

              streamCore.stop();
              dedupCache.clear();
            }
          ),
          { numRuns: 100 }
        );
      }, 30000);

      it('should normalize channels by removing duplicates and sorting', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(fc.constantFrom('all', 'tweets', 'following', 'profile'), { minLength: 1, maxLength: 10 }),
            async (channels) => {
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

              // Mock wssClient
              const mockWssClient = {
                getConnectionState: jest.fn().mockReturnValue('connected'),
                updateSubscription: jest.fn().mockResolvedValue(undefined),
                disconnect: jest.fn()
              };
              (streamCore as any).wssClient = mockWssClient;

              const newState = await streamCore.updateRuntimeSubscription({
                channels: channels as any,
                users: []
              });

              // Verify no duplicates
              const uniqueChannels = [...new Set(newState.channels)];
              expect(newState.channels).toEqual(uniqueChannels);

              // Verify sorted
              const sortedChannels = [...newState.channels].sort();
              expect(newState.channels).toEqual(sortedChannels);

              streamCore.stop();
              dedupCache.clear();
            }
          ),
          { numRuns: 100 }
        );
      }, 30000);

      it('should normalize users by trimming, lowercasing, deduplicating, and sorting', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.string({ minLength: 1, maxLength: 15 }).map(s => {
                // Add random whitespace and mixed case
                const withSpace = fc.sample(fc.boolean(), 1)[0] ? ` ${s} ` : s;
                const mixedCase = fc.sample(fc.boolean(), 1)[0] ? withSpace.toUpperCase() : withSpace;
                return mixedCase;
              }),
              { minLength: 1, maxLength: 10 }
            ),
            async (users) => {
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

              // Mock wssClient
              const mockWssClient = {
                getConnectionState: jest.fn().mockReturnValue('connected'),
                updateSubscription: jest.fn().mockResolvedValue(undefined),
                disconnect: jest.fn()
              };
              (streamCore as any).wssClient = mockWssClient;

              const newState = await streamCore.updateRuntimeSubscription({
                channels: ['all'],
                users: users
              });

              // Verify all users are trimmed (no leading/trailing spaces)
              for (const user of newState.users) {
                expect(user).toBe(user.trim());
              }

              // Verify all users are lowercase
              for (const user of newState.users) {
                expect(user).toBe(user.toLowerCase());
              }

              // Verify no duplicates
              const uniqueUsers = [...new Set(newState.users)];
              expect(newState.users).toEqual(uniqueUsers);

              // Verify sorted
              const sortedUsers = [...newState.users].sort();
              expect(newState.users).toEqual(sortedUsers);

              streamCore.stop();
              dedupCache.clear();
            }
          ),
          { numRuns: 100 }
        );
      }, 30000);

      it('should remove empty strings from users', async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(
              fc.oneof(
                fc.string({ minLength: 1, maxLength: 15 }),
                fc.constant(''),
                fc.constant('   ')
              ),
              { minLength: 1, maxLength: 10 }
            ),
            async (users) => {
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

              // Mock wssClient
              const mockWssClient = {
                getConnectionState: jest.fn().mockReturnValue('connected'),
                updateSubscription: jest.fn().mockResolvedValue(undefined),
                disconnect: jest.fn()
              };
              (streamCore as any).wssClient = mockWssClient;

              const newState = await streamCore.updateRuntimeSubscription({
                channels: ['all'],
                users: users
              });

              // Verify no empty strings
              for (const user of newState.users) {
                expect(user.length).toBeGreaterThan(0);
              }

              streamCore.stop();
              dedupCache.clear();
            }
          ),
          { numRuns: 100 }
        );
      }, 30000);
    });
  });
