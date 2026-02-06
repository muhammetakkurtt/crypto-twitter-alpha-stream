/**
 * Property-based tests for EventBus
 */

import * as fc from 'fast-check';
import { EventBus } from '../../src/eventbus/EventBus';
import { TwitterEvent, EventType } from '../../src/models/types';

// Arbitrary generators for TwitterEvent
const eventTypeArb = fc.constantFrom<EventType>('post_created', 'post_updated', 'follow_created', 'follow_updated', 'user_updated', 'profile_updated', 'profile_pinned');
const usernameArb = fc.stringMatching(/^[a-zA-Z0-9_]{1,15}$/);

const postDataArb = fc.record({
  username: usernameArb,
  action: fc.constantFrom('post_created', 'post_updated'),
  tweetId: fc.string({ minLength: 1, maxLength: 20 }),
  tweet: fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    type: fc.constant('tweet'),
    created_at: fc.integer({ min: 0, max: Date.now() }).map(ts => new Date(ts).toISOString()),
    body: fc.record({
      text: fc.string({ minLength: 1, maxLength: 280 }),
      urls: fc.array(fc.record({
        name: fc.string(),
        url: fc.webUrl(),
        tco: fc.webUrl()
      })),
      mentions: fc.array(usernameArb)
    }),
    author: fc.record({
      handle: usernameArb,
      id: fc.string({ minLength: 1, maxLength: 20 }),
      verified: fc.boolean(),
      profile: fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        avatar: fc.option(fc.webUrl(), { nil: undefined }),
        bio: fc.option(fc.string(), { nil: undefined })
      })
    }),
    metrics: fc.option(fc.record({
      likes: fc.nat(),
      retweets: fc.nat(),
      replies: fc.nat(),
      views: fc.nat()
    }), { nil: undefined }),
    media: fc.option(fc.record({
      images: fc.array(fc.webUrl()),
      videos: fc.array(fc.webUrl())
    }), { nil: undefined })
  })
});

const profileDataArb = fc.record({
  username: usernameArb,
  action: fc.constantFrom('user_updated', 'profile_updated', 'profile_pinned'),
  user: fc.option(fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    handle: usernameArb,
    profile: fc.option(fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      avatar: fc.option(fc.webUrl(), { nil: undefined }),
      bio: fc.option(fc.string(), { nil: undefined })
    }), { nil: undefined }),
    metrics: fc.option(fc.record({
      followers: fc.nat(),
      following: fc.nat()
    }), { nil: undefined })
  }), { nil: undefined }),
  pinned: fc.option(fc.array(fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    type: fc.constant('tweet'),
    body: fc.record({
      text: fc.string({ minLength: 1, maxLength: 280 })
    })
  })), { nil: undefined })
});

const followingDataArb = fc.record({
  username: usernameArb,
  action: fc.constantFrom('follow_created', 'follow_updated'),
  user: fc.option(fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    handle: usernameArb,
    profile: fc.option(fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      avatar: fc.option(fc.webUrl(), { nil: undefined }),
      bio: fc.option(fc.string(), { nil: undefined })
    }), { nil: undefined }),
    metrics: fc.option(fc.record({
      followers: fc.nat(),
      following: fc.nat()
    }), { nil: undefined })
  }), { nil: undefined }),
  following: fc.option(fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    handle: usernameArb,
    profile: fc.option(fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      avatar: fc.option(fc.webUrl(), { nil: undefined }),
      bio: fc.option(fc.string(), { nil: undefined })
    }), { nil: undefined }),
    metrics: fc.option(fc.record({
      followers: fc.nat(),
      following: fc.nat()
    }), { nil: undefined })
  }), { nil: undefined })
});

const twitterEventArb = fc.record({
  type: eventTypeArb,
  timestamp: fc.integer({ min: 0, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  primaryId: fc.string({ minLength: 1, maxLength: 20 }),
  user: fc.record({
    username: fc.string({ minLength: 1, maxLength: 20 }),
    displayName: fc.string({ minLength: 1, maxLength: 50 }),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
  }),
  data: fc.oneof(postDataArb, profileDataArb, followingDataArb),
}) as fc.Arbitrary<TwitterEvent>;

describe('EventBus - Property Tests', () => {
  /**
   * For any event that passes all filters, the event should be broadcast 
   * to all enabled output channels (CLI, Dashboard, Alerts).
   */
  describe('Property 33: Event Broadcasting to All Enabled Outputs', () => {
    it('should broadcast events to all subscribers on a channel', async () => {
      await fc.assert(
        fc.asyncProperty(
          twitterEventArb,
          fc.constantFrom('cli', 'dashboard', 'alerts'),
          fc.integer({ min: 1, max: 10 }), // Number of subscribers
          async (event, channel, numSubscribers) => {
            const eventBus = new EventBus();
            const receivedEvents: TwitterEvent[][] = [];

            // Subscribe multiple handlers to the same channel
            for (let i = 0; i < numSubscribers; i++) {
              receivedEvents.push([]);
              eventBus.subscribe(channel, (e) => {
                receivedEvents[i].push(e);
              });
            }

            // Publish event
            await eventBus.publish(channel, event);

            // Verify all subscribers received the event
            expect(receivedEvents.length).toBe(numSubscribers);
            for (let i = 0; i < numSubscribers; i++) {
              expect(receivedEvents[i].length).toBe(1);
              expect(receivedEvents[i][0]).toEqual(event);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should broadcast events to all enabled channels independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          twitterEventArb,
          fc.array(fc.constantFrom('cli', 'dashboard', 'alerts'), { minLength: 1, maxLength: 3 }).map(arr => [...new Set(arr)]), // Unique channels
          async (event, enabledChannels) => {
            const eventBus = new EventBus();
            const receivedByChannel: Map<string, TwitterEvent[]> = new Map();

            // Subscribe to each enabled channel
            enabledChannels.forEach(channel => {
              receivedByChannel.set(channel, []);
              eventBus.subscribe(channel, (e) => {
                receivedByChannel.get(channel)!.push(e);
              });
            });

            // Publish to all enabled channels
            for (const channel of enabledChannels) {
              await eventBus.publish(channel, event);
            }

            // Verify each channel received the event
            enabledChannels.forEach(channel => {
              const received = receivedByChannel.get(channel)!;
              expect(received.length).toBe(1);
              expect(received[0]).toEqual(event);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * For any output channel failure, other output channels should continue 
   * to receive and process events without interruption or degradation.
   */
  describe('Property 34: Output Channel Independence', () => {
    it('should isolate handler errors and continue broadcasting to other handlers', async () => {
      await fc.assert(
        fc.asyncProperty(
          twitterEventArb,
          fc.constantFrom('cli', 'dashboard', 'alerts'),
          fc.integer({ min: 2, max: 10 }), // At least 2 subscribers
          fc.integer({ min: 0, max: 9 }), // Index of failing handler
          async (event, channel, numSubscribers, failingIndex) => {
            const actualFailingIndex = failingIndex % numSubscribers;
            const eventBus = new EventBus();
            const receivedEvents: (TwitterEvent | null)[] = [];
            const errors: Error[] = [];

            // Subscribe multiple handlers, one will fail
            for (let i = 0; i < numSubscribers; i++) {
              receivedEvents.push(null);
              eventBus.subscribe(channel, (e) => {
                if (i === actualFailingIndex) {
                  const error = new Error(`Handler ${i} failed`);
                  errors.push(error);
                  throw error;
                } else {
                  receivedEvents[i] = e;
                }
              });
            }

            // Publish event
            await eventBus.publish(channel, event);

            // Verify the failing handler threw an error
            expect(errors.length).toBe(1);

            // Verify all other handlers received the event
            for (let i = 0; i < numSubscribers; i++) {
              if (i !== actualFailingIndex) {
                expect(receivedEvents[i]).toEqual(event);
              } else {
                expect(receivedEvents[i]).toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should continue broadcasting to other channels when one channel has failing handlers', async () => {
      await fc.assert(
        fc.asyncProperty(
          twitterEventArb,
          async (event) => {
            const eventBus = new EventBus();
            const cliReceived: TwitterEvent[] = [];
            const dashboardReceived: TwitterEvent[] = [];
            const alertsReceived: TwitterEvent[] = [];

            // Subscribe to CLI (will succeed)
            eventBus.subscribe('cli', (e) => {
              cliReceived.push(e);
            });

            // Subscribe to Dashboard (will fail)
            eventBus.subscribe('dashboard', () => {
              throw new Error('Dashboard handler failed');
            });

            // Subscribe to Alerts (will succeed)
            eventBus.subscribe('alerts', (e) => {
              alertsReceived.push(e);
            });

            // Publish to all channels
            await eventBus.publish('cli', event);
            await eventBus.publish('dashboard', event);
            await eventBus.publish('alerts', event);

            // Verify CLI and Alerts received the event despite Dashboard failure
            expect(cliReceived.length).toBe(1);
            expect(cliReceived[0]).toEqual(event);
            expect(alertsReceived.length).toBe(1);
            expect(alertsReceived[0]).toEqual(event);
            expect(dashboardReceived.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle async handler failures without affecting other handlers', async () => {
      await fc.assert(
        fc.asyncProperty(
          twitterEventArb,
          fc.constantFrom('cli', 'dashboard', 'alerts'),
          fc.integer({ min: 2, max: 5 }),
          async (event, channel, numSubscribers) => {
            const eventBus = new EventBus();
            const receivedEvents: (TwitterEvent | null)[] = [];

            // Subscribe handlers with alternating success/failure
            for (let i = 0; i < numSubscribers; i++) {
              receivedEvents.push(null);
              eventBus.subscribe(channel, async (e) => {
                // Simulate async operation
                await new Promise(resolve => setTimeout(resolve, 1));
                
                if (i % 2 === 0) {
                  // Even handlers fail
                  throw new Error(`Async handler ${i} failed`);
                } else {
                  // Odd handlers succeed
                  receivedEvents[i] = e;
                }
              });
            }

            // Publish event
            await eventBus.publish(channel, event);

            // Verify odd-indexed handlers received the event
            for (let i = 0; i < numSubscribers; i++) {
              if (i % 2 === 1) {
                expect(receivedEvents[i]).toEqual(event);
              } else {
                expect(receivedEvents[i]).toBeNull();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
