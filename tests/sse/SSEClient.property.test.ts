/**
 * Property-based tests for SSEClient
 */

import * as fc from 'fast-check';
import { SSEClient, ConnectionConfig } from '../../src/sse/SSEClient';

// ============================================================================
// Test Data Generators for Actor Events
// ============================================================================

/**
 * Generator for actor post_created events
 */
const actorPostEventArbitrary = fc.record({
  data: fc.record({
    username: fc.string({ minLength: 1, maxLength: 15 }),
    action: fc.constant('post_created'),
    tweetId: fc.string({ minLength: 1 }),
    tweet: fc.record({
      id: fc.string({ minLength: 1 }),
      type: fc.constant('tweet'),
      created_at: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2025-12-31').getTime() }).map(timestamp => new Date(timestamp).toISOString()),
      body: fc.record({
        text: fc.string({ minLength: 1, maxLength: 280 }),
        urls: fc.option(fc.array(fc.record({
          name: fc.string(),
          url: fc.webUrl(),
          tco: fc.webUrl()
        })), { nil: undefined }),
        mentions: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 15 })), { nil: undefined })
      }),
      author: fc.record({
        handle: fc.string({ minLength: 1, maxLength: 15 }),
        id: fc.string({ minLength: 1 }),
        verified: fc.option(fc.boolean(), { nil: undefined }),
        profile: fc.option(fc.record({
          name: fc.string({ minLength: 1 }),
          avatar: fc.option(fc.webUrl(), { nil: undefined }),
          bio: fc.option(fc.string(), { nil: undefined })
        }), { nil: undefined })
      }),
      metrics: fc.option(fc.record({
        likes: fc.option(fc.nat(), { nil: undefined }),
        retweets: fc.option(fc.nat(), { nil: undefined }),
        replies: fc.option(fc.nat(), { nil: undefined }),
        views: fc.option(fc.nat(), { nil: undefined })
      }), { nil: undefined }),
      media: fc.option(fc.record({
        images: fc.option(fc.array(fc.webUrl()), { nil: undefined }),
        videos: fc.option(fc.array(fc.webUrl()), { nil: undefined })
      }), { nil: undefined })
    })
  }),
  event_type: fc.constant('post_created')
});

/**
 * Generator for actor follow_created events
 */
const actorFollowEventArbitrary = fc.record({
  data: fc.record({
    username: fc.string({ minLength: 1, maxLength: 15 }),
    action: fc.constant('follow_created'),
    user: fc.record({
      id: fc.string({ minLength: 1 }),
      handle: fc.string({ minLength: 1, maxLength: 15 }),
      private: fc.option(fc.boolean(), { nil: undefined }),
      verified: fc.option(fc.boolean(), { nil: undefined }),
      jointed_at: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
      profile: fc.option(fc.record({
        name: fc.string({ minLength: 1 }),
        avatar: fc.option(fc.webUrl(), { nil: undefined }),
        bio: fc.option(fc.string(), { nil: undefined })
      }), { nil: undefined }),
      metrics: fc.option(fc.record({
        followers: fc.option(fc.nat(), { nil: undefined }),
        following: fc.option(fc.nat(), { nil: undefined })
      }), { nil: undefined })
    }),
    following: fc.record({
      id: fc.string({ minLength: 1 }),
      handle: fc.string({ minLength: 1, maxLength: 15 }),
      private: fc.option(fc.boolean(), { nil: undefined }),
      verified: fc.option(fc.boolean(), { nil: undefined }),
      jointed_at: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
      profile: fc.option(fc.record({
        name: fc.string({ minLength: 1 }),
        avatar: fc.option(fc.webUrl(), { nil: undefined }),
        bio: fc.option(fc.string(), { nil: undefined })
      }), { nil: undefined }),
      metrics: fc.option(fc.record({
        followers: fc.option(fc.nat(), { nil: undefined }),
        following: fc.option(fc.nat(), { nil: undefined })
      }), { nil: undefined })
    })
  }),
  event_type: fc.constant('follow_created')
});

/**
 * Generator for actor user_updated events
 */
const actorProfileEventArbitrary = fc.record({
  data: fc.record({
    username: fc.string({ minLength: 1, maxLength: 15 }),
    action: fc.oneof(
      fc.constant('user_updated'),
      fc.constant('profile_update'),
      fc.constant('pin_update')
    ),
    user: fc.record({
      id: fc.string({ minLength: 1 }),
      handle: fc.string({ minLength: 1, maxLength: 15 }),
      private: fc.option(fc.boolean(), { nil: undefined }),
      verified: fc.option(fc.boolean(), { nil: undefined }),
      jointed_at: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
      profile: fc.option(fc.record({
        name: fc.string({ minLength: 1 }),
        avatar: fc.option(fc.webUrl(), { nil: undefined }),
        bio: fc.option(fc.string(), { nil: undefined })
      }), { nil: undefined }),
      metrics: fc.option(fc.record({
        followers: fc.option(fc.nat(), { nil: undefined }),
        following: fc.option(fc.nat(), { nil: undefined })
      }), { nil: undefined })
    }),
    before: fc.option(fc.record({
      id: fc.string({ minLength: 1 }),
      handle: fc.string({ minLength: 1, maxLength: 15 }),
      private: fc.option(fc.boolean(), { nil: undefined }),
      verified: fc.option(fc.boolean(), { nil: undefined }),
      jointed_at: fc.option(fc.integer({ min: 0 }), { nil: undefined }),
      profile: fc.option(fc.record({
        name: fc.string({ minLength: 1 }),
        avatar: fc.option(fc.webUrl(), { nil: undefined }),
        bio: fc.option(fc.string(), { nil: undefined })
      }), { nil: undefined }),
      metrics: fc.option(fc.record({
        followers: fc.option(fc.nat(), { nil: undefined }),
        following: fc.option(fc.nat(), { nil: undefined })
      }), { nil: undefined })
    }), { nil: undefined }),
    pinned: fc.option(fc.array(fc.record({
      id: fc.string({ minLength: 1 }),
      type: fc.constant('tweet'),
      body: fc.record({
        text: fc.string({ minLength: 1, maxLength: 280 })
      })
    })), { nil: undefined })
  }),
  event_type: fc.oneof(
    fc.constant('user_updated'),
    fc.constant('profile_updated'),
    fc.constant('profile_pinned')
  )
});

/**
 * Union generator for all actor event types
 */
const actorEventArbitrary = fc.oneof(
  actorPostEventArbitrary,
  actorFollowEventArbitrary,
  actorProfileEventArbitrary
);

// ============================================================================
// Property Tests
// ============================================================================

describe('SSEClient - Property Tests', () => {
  
  describe('Property 1: Complete Data Preservation', () => {
    it('should preserve all fields and nested structures from actor event data', () => {
      fc.assert(
        fc.property(
          actorEventArbitrary,
          (actorEvent) => {
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: 1000,
              maxReconnectDelay: 30000,
              reconnectBackoffMultiplier: 2.0,
              maxReconnectAttempts: 5,
            };

            const client = new SSEClient(config);
            
            // Access private method for testing
            const transformActorEvent = (client as any).transformActorEvent.bind(client);
            const transformedEvent = transformActorEvent(actorEvent);

            // Verify all top-level fields from actor data are preserved
            const actorData = actorEvent.data;
            const transformedData = transformedEvent.data;

            // Deep equality check - all data should be preserved
            // Note: JSON.parse(JSON.stringify()) removes undefined values
            const expectedData = JSON.parse(JSON.stringify(actorData));
            expect(transformedData).toEqual(expectedData);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Username Extraction Round-Trip', () => {
    it('should extract username correctly from any supported location', () => {
      fc.assert(
        fc.property(
          actorEventArbitrary,
          (actorEvent) => {
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: 1000,
              maxReconnectDelay: 30000,
              reconnectBackoffMultiplier: 2.0,
              maxReconnectAttempts: 5,
            };

            const client = new SSEClient(config);
            
            // Access private method for testing
            const transformActorEvent = (client as any).transformActorEvent.bind(client);
            const transformedEvent = transformActorEvent(actorEvent);

            // Determine expected username from actor event (following priority order)
            const actorData = actorEvent.data as any;
            const expectedUsername = actorData.username || 
                                    actorData.user?.handle || 
                                    actorData.tweet?.author?.handle || 
                                    'unknown';

            // Verify username was extracted correctly
            expect(transformedEvent.user.username).toBe(expectedUsername);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 17: Deep Copy Independence', () => {
    it('should create independent copy - modifying original does not affect transformed', () => {
      fc.assert(
        fc.property(
          actorEventArbitrary,
          (actorEvent) => {
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: 1000,
              maxReconnectDelay: 30000,
              reconnectBackoffMultiplier: 2.0,
              maxReconnectAttempts: 5,
            };

            const client = new SSEClient(config);
            
            // Create a deep copy of the original actor event for comparison
            const originalActorData = JSON.parse(JSON.stringify(actorEvent.data));
            
            // Access private method for testing
            const transformActorEvent = (client as any).transformActorEvent.bind(client);
            const transformedEvent = transformActorEvent(actorEvent);

            // Modify the original actor event data (using type assertion for union types)
            const actorData = actorEvent.data as any;
            if (actorData.username) {
              actorData.username = 'MODIFIED_USERNAME';
            }
            if (actorData.action) {
              actorData.action = 'MODIFIED_ACTION' as any;
            }
            if (actorData.tweet?.body?.text) {
              actorData.tweet.body.text = 'MODIFIED_TEXT';
            }
            if (actorData.user?.handle) {
              actorData.user.handle = 'MODIFIED_HANDLE';
            }

            // Verify transformed event data still matches original (not modified)
            expect(transformedEvent.data).toEqual(originalActorData);
            
            // Verify transformed event data does NOT match the modified actor data
            expect(transformedEvent.data).not.toEqual(actorEvent.data);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Tweet Text Extraction Round-Trip', () => {
    it('should preserve tweet text through transformation', () => {
      fc.assert(
        fc.property(
          actorPostEventArbitrary,
          (actorEvent) => {
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: 1000,
              maxReconnectDelay: 30000,
              reconnectBackoffMultiplier: 2.0,
              maxReconnectAttempts: 5,
            };

            const client = new SSEClient(config);
            
            // Access private method for testing
            const transformActorEvent = (client as any).transformActorEvent.bind(client);
            const transformedEvent = transformActorEvent(actorEvent);

            // Extract original tweet text from actor event
            const originalTweetText = actorEvent.data.tweet.body.text;

            // Extract tweet text from transformed event
            const transformedTweetText = (transformedEvent.data as any).tweet?.body?.text;

            // Verify tweet text is preserved
            expect(transformedTweetText).toBe(originalTweetText);
            expect(transformedTweetText).toBeDefined();
            expect(transformedTweetText).not.toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: Follow Target Extraction Round-Trip', () => {
    it('should preserve follow target information through transformation', () => {
      fc.assert(
        fc.property(
          actorFollowEventArbitrary,
          (actorEvent) => {
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: 1000,
              maxReconnectDelay: 30000,
              reconnectBackoffMultiplier: 2.0,
              maxReconnectAttempts: 5,
            };

            const client = new SSEClient(config);
            
            // Access private method for testing
            const transformActorEvent = (client as any).transformActorEvent.bind(client);
            const transformedEvent = transformActorEvent(actorEvent);

            // Extract original following target from actor event
            const originalFollowingHandle = actorEvent.data.following.handle;
            const originalFollowingId = actorEvent.data.following.id;

            // Extract following target from transformed event
            const transformedFollowingHandle = (transformedEvent.data as any).following?.handle;
            const transformedFollowingId = (transformedEvent.data as any).following?.id;

            // Verify following target information is preserved
            expect(transformedFollowingHandle).toBe(originalFollowingHandle);
            expect(transformedFollowingId).toBe(originalFollowingId);
            expect(transformedFollowingHandle).toBeDefined();
            expect(transformedFollowingId).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 5: Profile Information Preservation', () => {
    it('should preserve complete profile structure through transformation', () => {
      fc.assert(
        fc.property(
          actorProfileEventArbitrary,
          (actorEvent) => {
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: 1000,
              maxReconnectDelay: 30000,
              reconnectBackoffMultiplier: 2.0,
              maxReconnectAttempts: 5,
            };

            const client = new SSEClient(config);
            
            // Access private method for testing
            const transformActorEvent = (client as any).transformActorEvent.bind(client);
            const transformedEvent = transformActorEvent(actorEvent);

            // Extract original user profile from actor event
            const originalUser = actorEvent.data.user;
            const originalUserHandle = originalUser.handle;
            const originalUserId = originalUser.id;
            const originalUserProfile = originalUser.profile;

            // Extract user profile from transformed event
            const transformedUser = (transformedEvent.data as any).user;
            const transformedUserHandle = transformedUser?.handle;
            const transformedUserId = transformedUser?.id;
            const transformedUserProfile = transformedUser?.profile;

            // Verify user profile information is preserved
            expect(transformedUserHandle).toBe(originalUserHandle);
            expect(transformedUserId).toBe(originalUserId);
            
            // Verify nested profile structure is preserved
            if (originalUserProfile) {
              expect(transformedUserProfile).toBeDefined();
              expect(transformedUserProfile?.name).toBe(originalUserProfile.name);
              
              // Check optional fields if present
              if (originalUserProfile.avatar !== undefined) {
                expect(transformedUserProfile?.avatar).toBe(originalUserProfile.avatar);
              }
              if (originalUserProfile.bio !== undefined) {
                expect(transformedUserProfile?.bio).toBe(originalUserProfile.bio);
              }
            }

            // Verify pinned tweets are preserved if present
            if (actorEvent.data.pinned) {
              const transformedPinned = (transformedEvent.data as any).pinned;
              expect(transformedPinned).toBeDefined();
              expect(transformedPinned).toHaveLength(actorEvent.data.pinned.length);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * For any actor event with a valid event_type, the SSEClient SHALL preserve 
   * the event_type directly without modification (post_created→post_created, 
   * follow_created→follow_created, user_updated→user_updated, etc.).
   */
  describe('Property 6: Event Type Preservation', () => {
    it('should preserve event type directly without modification', () => {
      fc.assert(
        fc.property(
          actorEventArbitrary,
          (actorEvent) => {
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: 1000,
              maxReconnectDelay: 30000,
              reconnectBackoffMultiplier: 2.0,
              maxReconnectAttempts: 5,
            };

            const client = new SSEClient(config);
            
            // Access private method for testing
            const transformActorEvent = (client as any).transformActorEvent.bind(client);
            const transformedEvent = transformActorEvent(actorEvent);

            // Extract original event type from actor event
            const originalEventType = actorEvent.event_type;

            // Extract event type from transformed event
            const transformedEventType = transformedEvent.type;

            // Verify event type is preserved without modification
            expect(transformedEventType).toBe(originalEventType);
            
            // Verify it's one of the valid event types
            const validEventTypes = [
              'post_created', 'post_updated',
              'follow_created', 'follow_updated',
              'user_updated', 'profile_updated', 'profile_pinned'
            ];
            expect(validEventTypes).toContain(transformedEventType);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * For any sequence of connection failures, the reconnection delay should follow 
   * exponential backoff pattern: delay = min(initialDelay * multiplier^attempt, maxDelay), 
   * ensuring delays increase exponentially up to the maximum.
   */
  describe('Property 1: Reconnection Exponential Backoff', () => {
    it('should calculate reconnection delays using exponential backoff formula', () => {
      fc.assert(
        fc.property(
          fc.record({
            initialDelay: fc.integer({ min: 100, max: 2000 }),
            maxDelay: fc.integer({ min: 10000, max: 60000 }),
            backoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            attempts: fc.integer({ min: 0, max: 10 }),
          }),
          (testValues) => {
            // Create a config with test values
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: testValues.initialDelay,
              maxReconnectDelay: testValues.maxDelay,
              reconnectBackoffMultiplier: testValues.backoffMultiplier,
              maxReconnectAttempts: 0, // Infinite for this test
            };

            const client = new SSEClient(config);

            // Access the private method through reflection for testing
            const calculateDelay = (client as any).calculateReconnectDelay.bind(client);
            
            // Simulate multiple reconnection attempts
            const delays: number[] = [];
            for (let attempt = 0; attempt < testValues.attempts; attempt++) {
              // Set the reconnect attempts counter
              (client as any).reconnectAttempts = attempt;
              const delay = calculateDelay();
              delays.push(delay);
            }

            // Verify exponential backoff pattern
            for (let i = 0; i < delays.length; i++) {
              const expectedDelay = testValues.initialDelay * 
                                   Math.pow(testValues.backoffMultiplier, i);
              const cappedExpectedDelay = Math.min(expectedDelay, testValues.maxDelay);
              
              // The delay should match the exponential backoff formula
              expect(delays[i]).toBeCloseTo(cappedExpectedDelay, 0);
              
              // Delay should never exceed maxDelay
              expect(delays[i]).toBeLessThanOrEqual(testValues.maxDelay);
              
              // If we haven't hit the cap, delays should be increasing
              if (i > 0 && delays[i - 1] < testValues.maxDelay) {
                expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should ensure delays never exceed maxDelay regardless of attempt count', () => {
      fc.assert(
        fc.property(
          fc.record({
            initialDelay: fc.integer({ min: 100, max: 1000 }),
            maxDelay: fc.integer({ min: 5000, max: 30000 }),
            backoffMultiplier: fc.float({ min: 2.0, max: 5.0, noNaN: true }),
            highAttemptCount: fc.integer({ min: 10, max: 50 }),
          }),
          (testValues) => {
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: testValues.initialDelay,
              maxReconnectDelay: testValues.maxDelay,
              reconnectBackoffMultiplier: testValues.backoffMultiplier,
              maxReconnectAttempts: 0,
            };

            const client = new SSEClient(config);
            const calculateDelay = (client as any).calculateReconnectDelay.bind(client);

            // Test with high attempt counts to ensure capping works
            (client as any).reconnectAttempts = testValues.highAttemptCount;
            const delay = calculateDelay();

            // Delay should be capped at maxDelay
            expect(delay).toBe(testValues.maxDelay);
            expect(delay).toBeLessThanOrEqual(testValues.maxDelay);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce monotonically increasing delays until maxDelay is reached', () => {
      fc.assert(
        fc.property(
          fc.record({
            initialDelay: fc.integer({ min: 100, max: 1000 }),
            maxDelay: fc.integer({ min: 10000, max: 60000 }),
            backoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
          }),
          (testValues) => {
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: testValues.initialDelay,
              maxReconnectDelay: testValues.maxDelay,
              reconnectBackoffMultiplier: testValues.backoffMultiplier,
              maxReconnectAttempts: 0,
            };

            const client = new SSEClient(config);
            const calculateDelay = (client as any).calculateReconnectDelay.bind(client);

            let previousDelay = 0;
            let reachedMax = false;

            // Test first 15 attempts
            for (let attempt = 0; attempt < 15; attempt++) {
              (client as any).reconnectAttempts = attempt;
              const delay = calculateDelay();

              if (!reachedMax) {
                // Delays should be increasing until we hit maxDelay
                expect(delay).toBeGreaterThanOrEqual(previousDelay);
                
                if (delay === testValues.maxDelay) {
                  reachedMax = true;
                }
              } else {
                // Once we hit maxDelay, it should stay at maxDelay
                expect(delay).toBe(testValues.maxDelay);
              }

              previousDelay = delay;
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * For any configured maximum retry count N, after N consecutive connection failures, 
   * the Stream Core should stop attempting reconnection.
   */
  describe('Property 2: Reconnection Attempt Limiting', () => {
    it('should stop reconnecting after maxReconnectAttempts is reached', () => {
      fc.assert(
        fc.property(
          fc.record({
            maxAttempts: fc.integer({ min: 1, max: 20 }),
            initialDelay: fc.integer({ min: 100, max: 1000 }),
          }),
          (testValues) => {
            const config: ConnectionConfig = {
              endpoint: 'http://invalid.example.com/events',
              token: 'test-token',
              reconnectDelay: testValues.initialDelay,
              maxReconnectDelay: 10000,
              reconnectBackoffMultiplier: 2.0,
              maxReconnectAttempts: testValues.maxAttempts,
            };

            const client = new SSEClient(config);
            
            // Simulate reaching max attempts
            (client as any).reconnectAttempts = testValues.maxAttempts;
            (client as any).shouldReconnect = true;

            // Track if error callback was called
            let errorCalled = false;
            let errorMessage = '';
            client.onError((error) => {
              errorCalled = true;
              errorMessage = error.message;
            });

            // Try to schedule reconnect (should fail)
            (client as any).scheduleReconnect();

            // Verify that shouldReconnect is set to false
            expect((client as any).shouldReconnect).toBe(false);
            
            // Verify error was reported
            expect(errorCalled).toBe(true);
            expect(errorMessage).toContain('Max reconnection attempts');
            expect(errorMessage).toContain(testValues.maxAttempts.toString());
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow infinite reconnection attempts when maxReconnectAttempts is 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 20, max: 100 }),
          (highAttemptCount) => {
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: 100,
              maxReconnectDelay: 10000,
              reconnectBackoffMultiplier: 2.0,
              maxReconnectAttempts: 0, // 0 means infinite
            };

            const client = new SSEClient(config);
            
            // Simulate many attempts
            (client as any).reconnectAttempts = highAttemptCount;
            (client as any).shouldReconnect = true;

            let errorCalled = false;
            client.onError((error) => {
              if (error.message.includes('Max reconnection attempts')) {
                errorCalled = true;
              }
            });

            // Try to schedule reconnect (should succeed)
            (client as any).scheduleReconnect();

            // Verify that shouldReconnect is still true (not stopped)
            expect((client as any).shouldReconnect).toBe(true);
            
            // Verify no max attempts error was reported
            expect(errorCalled).toBe(false);

            // Clean up timeout
            if ((client as any).reconnectTimeout) {
              clearTimeout((client as any).reconnectTimeout);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not exceed maxReconnectAttempts for any attempt sequence', () => {
      fc.assert(
        fc.property(
          fc.record({
            maxAttempts: fc.integer({ min: 1, max: 10 }),
            attemptSequence: fc.integer({ min: 0, max: 15 }),
          }),
          (testValues) => {
            const config: ConnectionConfig = {
              endpoint: 'http://test.example.com/events',
              token: 'test-token',
              reconnectDelay: 100,
              maxReconnectDelay: 10000,
              reconnectBackoffMultiplier: 2.0,
              maxReconnectAttempts: testValues.maxAttempts,
            };

            const client = new SSEClient(config);
            
            // Set attempts to the test value
            (client as any).reconnectAttempts = testValues.attemptSequence;
            (client as any).shouldReconnect = true;

            // Try to schedule reconnect
            (client as any).scheduleReconnect();

            // If we've reached or exceeded max attempts, shouldReconnect should be false
            if (testValues.attemptSequence >= testValues.maxAttempts) {
              expect((client as any).shouldReconnect).toBe(false);
            } else {
              // Otherwise, reconnection should still be allowed
              expect((client as any).shouldReconnect).toBe(true);
              
              // Clean up timeout
              if ((client as any).reconnectTimeout) {
                clearTimeout((client as any).reconnectTimeout);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
