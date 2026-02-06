/**
 * Property-based tests for AlertOutput
 */

import * as fc from 'fast-check';
import { TwitterEvent, EventType, PostData, ProfileData, FollowingData } from '../../src/models/types';
import { AlertOutput } from '../../src/outputs/AlertOutput';
import { AlertChannel, AlertMessage } from '../../src/outputs/AlertChannel';
import { EventBus } from '../../src/eventbus/EventBus';

// Arbitrary generators for TwitterEvent
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
}) as fc.Arbitrary<PostData>;

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
}) as fc.Arbitrary<ProfileData>;

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
}) as fc.Arbitrary<FollowingData>;

// Generate properly typed events
const postCreatedEventArb = fc.record({
  type: fc.constant<EventType>('post_created'),
  timestamp: fc.integer({ min: 0, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  primaryId: fc.string({ minLength: 1, maxLength: 20 }),
  user: fc.record({
    username: fc.string({ minLength: 1, maxLength: 20 }),
    displayName: fc.string({ minLength: 1, maxLength: 50 }),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
  }),
  data: postDataArb,
}) as fc.Arbitrary<TwitterEvent>;

const profileUpdateEventArb = fc.record({
  type: fc.constant<EventType>('profile_updated'),
  timestamp: fc.integer({ min: 0, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  primaryId: fc.string({ minLength: 1, maxLength: 20 }),
  user: fc.record({
    username: fc.string({ minLength: 1, maxLength: 20 }),
    displayName: fc.string({ minLength: 1, maxLength: 50 }),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
  }),
  data: profileDataArb,
}) as fc.Arbitrary<TwitterEvent>;

const followingEventArb = fc.record({
  type: fc.constant<EventType>('follow_created'),
  timestamp: fc.integer({ min: 0, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  primaryId: fc.string({ minLength: 1, maxLength: 20 }),
  user: fc.record({
    username: fc.string({ minLength: 1, maxLength: 20 }),
    displayName: fc.string({ minLength: 1, maxLength: 50 }),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
  }),
  data: followingDataArb,
}) as fc.Arbitrary<TwitterEvent>;

const unfollowingEventArb = fc.record({
  type: fc.constant<EventType>('follow_updated'),
  timestamp: fc.integer({ min: 0, max: Date.now() }).map(ts => new Date(ts).toISOString()),
  primaryId: fc.string({ minLength: 1, maxLength: 20 }),
  user: fc.record({
    username: fc.string({ minLength: 1, maxLength: 20 }),
    displayName: fc.string({ minLength: 1, maxLength: 50 }),
    userId: fc.string({ minLength: 1, maxLength: 20 }),
  }),
  data: followingDataArb,
}) as fc.Arbitrary<TwitterEvent>;

const twitterEventArb = fc.oneof(
  postCreatedEventArb,
  profileUpdateEventArb,
  followingEventArb,
  unfollowingEventArb
) as fc.Arbitrary<TwitterEvent>;

// Mock alert channel for testing
class MockAlertChannel implements AlertChannel {
  name: string;
  enabled: boolean;
  sentMessages: AlertMessage[] = [];
  shouldFail: boolean = false;
  rateLimit: any = { allowRequest: () => true, recordRequest: () => {} };

  constructor(name: string, enabled: boolean = true) {
    this.name = name;
    this.enabled = enabled;
  }

  async send(message: AlertMessage): Promise<void> {
    if (this.shouldFail) {
      throw new Error(`${this.name} channel failed`);
    }
    this.sentMessages.push(message);
  }
}

describe('AlertOutput - Property Tests', () => {
  /**
   * For any event E when Telegram alerts are enabled, a message should be sent 
   * to the configured Telegram chat containing E's data.
   */
  describe('Property 18: Telegram Alert Delivery', () => {
    it('should send messages to Telegram channel for all events when enabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          twitterEventArb,
          async (event) => {
            const eventBus = new EventBus();
            const mockTelegram = new MockAlertChannel('telegram', true);
            
            const alertOutput = new AlertOutput(
              { channels: [mockTelegram] },
              eventBus
            );
            
            alertOutput.start();
            
            // Publish event to alerts channel
            await eventBus.publish('alerts', event);
            
            // Verify message was sent
            expect(mockTelegram.sentMessages.length).toBe(1);
            const message = mockTelegram.sentMessages[0];
            
            // Verify message contains event data
            expect(message.eventType).toBe(event.type);
            expect(message.username).toBe(event.user.username);
            expect(message.timestamp).toBe(event.timestamp);
            expect(message.text).toBeDefined();
            expect(message.text.length).toBeGreaterThan(0);
            
            alertOutput.stop();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * For any event E when Discord alerts are enabled, a webhook POST request 
   * should be made to the configured Discord URL containing E's data.
   */
  describe('Property 19: Discord Alert Delivery', () => {
    it('should send messages to Discord channel for all events when enabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          twitterEventArb,
          async (event) => {
            const eventBus = new EventBus();
            const mockDiscord = new MockAlertChannel('discord', true);
            
            const alertOutput = new AlertOutput(
              { channels: [mockDiscord] },
              eventBus
            );
            
            alertOutput.start();
            
            // Publish event to alerts channel
            await eventBus.publish('alerts', event);
            
            // Verify message was sent
            expect(mockDiscord.sentMessages.length).toBe(1);
            const message = mockDiscord.sentMessages[0];
            
            // Verify message contains event data
            expect(message.eventType).toBe(event.type);
            expect(message.username).toBe(event.user.username);
            expect(message.timestamp).toBe(event.timestamp);
            expect(message.text).toBeDefined();
            
            alertOutput.stop();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * For any event E when generic webhooks are enabled, a POST request should 
   * be made to the configured webhook URL containing E's data.
   */
  describe('Property 20: Generic Webhook Alert Delivery', () => {
    it('should send messages to webhook channel for all events when enabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          twitterEventArb,
          async (event) => {
            const eventBus = new EventBus();
            const mockWebhook = new MockAlertChannel('webhook', true);
            
            const alertOutput = new AlertOutput(
              { channels: [mockWebhook] },
              eventBus
            );
            
            alertOutput.start();
            
            // Publish event to alerts channel
            await eventBus.publish('alerts', event);
            
            // Verify message was sent
            expect(mockWebhook.sentMessages.length).toBe(1);
            const message = mockWebhook.sentMessages[0];
            
            // Verify message contains event data
            expect(message.eventType).toBe(event.type);
            expect(message.username).toBe(event.user.username);
            expect(message.timestamp).toBe(event.timestamp);
            expect(message.text).toBeDefined();
            
            alertOutput.stop();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * For any event, the formatted alert message should contain event type, 
   * username, text content, and timestamp.
   */
  describe('Property 21: Alert Message Format Completeness', () => {
    it('should format all alert messages with complete information', async () => {
      await fc.assert(
        fc.asyncProperty(
          twitterEventArb,
          async (event) => {
            const eventBus = new EventBus();
            const mockChannel = new MockAlertChannel('test', true);
            
            const alertOutput = new AlertOutput(
              { channels: [mockChannel] },
              eventBus
            );
            
            alertOutput.start();
            
            // Publish event
            await eventBus.publish('alerts', event);
            
            // Verify message format
            expect(mockChannel.sentMessages.length).toBe(1);
            const message = mockChannel.sentMessages[0];
            
            // All required fields must be present
            expect(message).toHaveProperty('eventType');
            expect(message).toHaveProperty('username');
            expect(message).toHaveProperty('text');
            expect(message).toHaveProperty('timestamp');
            
            // All fields must have valid values
            expect(message.eventType).toBe(event.type);
            expect(message.username).toBe(event.user.username);
            expect(message.timestamp).toBe(event.timestamp);
            expect(typeof message.text).toBe('string');
            expect(message.text.length).toBeGreaterThan(0);
            
            alertOutput.stop();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * For any alert channel failure, other alert channels should continue 
   * to receive and process events successfully.
   */
  describe('Property 22: Alert Channel Error Isolation', () => {
    it('should isolate channel failures and continue sending to other channels', async () => {
      await fc.assert(
        fc.asyncProperty(
          twitterEventArb,
          fc.integer({ min: 0, max: 2 }), // Index of failing channel
          async (event, failingIndex) => {
            const eventBus = new EventBus();
            
            // Create 3 channels, one will fail
            const channels = [
              new MockAlertChannel('telegram', true),
              new MockAlertChannel('discord', true),
              new MockAlertChannel('webhook', true),
            ];
            
            // Make one channel fail
            channels[failingIndex].shouldFail = true;
            
            const alertOutput = new AlertOutput(
              { channels },
              eventBus
            );
            
            alertOutput.start();
            
            // Publish event
            await eventBus.publish('alerts', event);
            
            // Verify non-failing channels received the message
            for (let i = 0; i < channels.length; i++) {
              if (i === failingIndex) {
                expect(channels[i].sentMessages.length).toBe(0);
              } else {
                expect(channels[i].sentMessages.length).toBe(1);
                expect(channels[i].sentMessages[0].eventType).toBe(event.type);
              }
            }
            
            alertOutput.stop();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should continue processing events after channel failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(twitterEventArb, { minLength: 2, maxLength: 10 }),
          async (events) => {
            const eventBus = new EventBus();
            
            const workingChannel = new MockAlertChannel('working', true);
            const failingChannel = new MockAlertChannel('failing', true);
            failingChannel.shouldFail = true;
            
            const alertOutput = new AlertOutput(
              { channels: [workingChannel, failingChannel] },
              eventBus
            );
            
            alertOutput.start();
            
            // Publish all events
            for (const event of events) {
              await eventBus.publish('alerts', event);
            }
            
            // Verify working channel received all events
            expect(workingChannel.sentMessages.length).toBe(events.length);
            expect(failingChannel.sentMessages.length).toBe(0);
            
            alertOutput.stop();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * For any alert channel, sending more than 10 alerts within a 60-second 
   * window should result in rate limiting (queueing or dropping excess alerts).
   */
  describe('Property 23: Alert Rate Limiting', () => {
    it('should enforce rate limit of 10 messages per minute per channel', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(twitterEventArb, { minLength: 15, maxLength: 20 }),
          async (events) => {
            const eventBus = new EventBus();
            const mockChannel = new MockAlertChannel('test', true);
            
            // Create a real rate limiter for the mock channel
            const RateLimiter = (await import('../../src/outputs/RateLimiter')).RateLimiter;
            mockChannel.rateLimit = new RateLimiter(10, 60000);
            
            // Override send to respect rate limit
            const originalSend = mockChannel.send.bind(mockChannel);
            mockChannel.send = async function(message: AlertMessage) {
              if (!this.rateLimit.allowRequest()) {
                return; // Drop message
              }
              this.rateLimit.recordRequest();
              await originalSend(message);
            };
            
            const alertOutput = new AlertOutput(
              { channels: [mockChannel] },
              eventBus
            );
            
            alertOutput.start();
            
            // Send all events rapidly
            for (const event of events) {
              await eventBus.publish('alerts', event);
            }
            
            // Verify at most 10 messages were sent
            expect(mockChannel.sentMessages.length).toBeLessThanOrEqual(10);
            
            alertOutput.stop();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
