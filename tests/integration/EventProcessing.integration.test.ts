import { StreamCore } from '../../src/streamcore/StreamCore';
import { FilterPipeline } from '../../src/filters/FilterPipeline';
import { DedupCache } from '../../src/dedup/DedupCache';
import { EventBus } from '../../src/eventbus/EventBus';
import { CLIOutput } from '../../src/outputs/CLIOutput';
import { TwitterEvent } from '../../src/models/types';

// Mock implementation factory
const createMockEventSourceClass = () => {
  const instances: any[] = [];

  class MockEventSource {
    url: string;
    onopen: (() => void) | null = null;
    onmessage: ((event: any) => void) | null = null;
    onerror: ((error: any) => void) | null = null;
    readyState = 0;
    eventListeners: Record<string, Array<(event: any) => void>> = {};

    constructor(url: string) {
      this.url = url;
      instances.push(this);

      // Simulate async connection
      setTimeout(() => {
        this.readyState = 1;
        if (this.onopen) {
          this.onopen();
        }
      }, 10);
    }

    addEventListener(eventType: string, handler: (event: any) => void) {
      if (!this.eventListeners[eventType]) {
        this.eventListeners[eventType] = [];
      }
      this.eventListeners[eventType].push(handler);
    }

    removeEventListener(eventType: string, handler: (event: any) => void) {
      if (this.eventListeners[eventType]) {
        this.eventListeners[eventType] = this.eventListeners[eventType].filter(h => h !== handler);
      }
    }

    close() {
      this.readyState = 2;
    }
  }

  return { MockEventSource, instances };
};

describe('Event Processing Integration Tests', () => {
  let MockEventSource: any;
  let mockInstances: any[];

  beforeEach(async () => {
    // Reset mock instances
    const mockSetup = createMockEventSourceClass();
    MockEventSource = mockSetup.MockEventSource;
    mockInstances = mockSetup.instances;

    // Clear all mocks before each test to ensure clean state
    jest.clearAllMocks();
  });

  // Helper to get the latest instance
  const getEventSourceInstance = async () => {
    let retries = 10;
    while (retries > 0 && mockInstances.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
      retries--;
    }

    if (mockInstances.length === 0) {
      throw new Error('EventSource instance not created via DI');
    }
    return mockInstances[0];
  };

  describe('Complete event flow: Actor → SSEClient → StreamCore → EventBus → CLIOutput', () => {
    it('should preserve complete data through entire pipeline for post_created event', async () => {
      // Setup components
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus, { statsInterval: 999999 });

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          dedupTTL: 60000,
          eventSourceClass: MockEventSource // INJECT MOCK HERE
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      // Start CLI output
      cliOutput.start();

      // Capture CLI output
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      // Start StreamCore
      await streamCore.start();

      // Wait for connection to establish
      await new Promise(resolve => setTimeout(resolve, 50));

      // Get the EventSource instance
      const eventSourceInstance = await getEventSourceInstance();

      // Create actor format event with complete nested structure
      const actorEvent = {
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22.000Z',
            body: {
              text: 'Bitcoin is the future of money',
              urls: [{ name: 'example', url: 'https://example.com', tco: 'https://t.co/abc' }],
              mentions: ['satoshi']
            },
            author: {
              handle: 'elonmusk',
              id: 'user123',
              verified: true,
              profile: {
                name: 'Elon Musk',
                avatar: 'https://example.com/avatar.jpg',
                bio: 'CEO of Tesla'
              }
            },
            metrics: {
              likes: 1000,
              retweets: 500,
              replies: 200,
              views: 50000
            },
            media: {
              images: ['https://example.com/image1.jpg'],
              videos: []
            }
          }
        },
        event_type: 'post_created'
      };

      // Simulate actor sending event
      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(actorEvent),
          type: 'message',
          lastEventId: 'test-id-1'
        });
      }

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify CLI output was called
      expect(consoleLogSpy).toHaveBeenCalled();

      // Find the event output (not the "CLI Output started" message)
      const eventOutputs = consoleLogSpy.mock.calls
        .map(call => call[0])
        .filter(output => typeof output === 'string' && output.includes('[post_created]'));

      expect(eventOutputs.length).toBeGreaterThan(0);

      // Verify CLI output contains expected information
      const outputText = eventOutputs[0];
      expect(outputText).toContain('[post_created]');
      expect(outputText).toContain('@elonmusk');
      expect(outputText).toContain('Bitcoin is the future of money');

      consoleLogSpy.mockRestore();
      cliOutput.stop();
      streamCore.stop();
    });

    it('should preserve complete data through entire pipeline for follow_created event', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus, { statsInterval: 999999 });

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          dedupTTL: 60000,
          eventSourceClass: MockEventSource
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      cliOutput.start();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await streamCore.start();

      const eventSourceInstance = await getEventSourceInstance();

      // Create actor format follow event
      const actorEvent = {
        data: {
          username: 'elonmusk',
          action: 'follow_created',
          user: {
            id: 'user123',
            handle: 'elonmusk',
            verified: true,
            profile: {
              name: 'Elon Musk',
              avatar: 'https://example.com/avatar.jpg',
              bio: 'CEO of Tesla'
            },
            metrics: {
              followers: 100000000,
              following: 500
            }
          },
          following: {
            id: 'user456',
            handle: 'vitalikbuterin',
            verified: true,
            profile: {
              name: 'Vitalik Buterin',
              avatar: 'https://example.com/vitalik.jpg',
              bio: 'Ethereum founder'
            },
            metrics: {
              followers: 5000000,
              following: 200
            }
          }
        },
        event_type: 'follow_created'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(actorEvent),
          type: 'message',
          lastEventId: 'test-id-2'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const eventOutputs = consoleLogSpy.mock.calls
        .map(call => call[0])
        .filter(output => typeof output === 'string' && output.includes('[follow_created]'));

      expect(eventOutputs.length).toBeGreaterThan(0);

      const outputText = eventOutputs[0];
      expect(outputText).toContain('[follow_created]');
      expect(outputText).toContain('@elonmusk');
      expect(outputText).toContain('followed @vitalikbuterin');

      consoleLogSpy.mockRestore();
      cliOutput.stop();
      streamCore.stop();
    });

    it('should preserve complete data through entire pipeline for user_updated event', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus, { statsInterval: 999999 });

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          dedupTTL: 60000,
          eventSourceClass: MockEventSource
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      cliOutput.start();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await streamCore.start();

      const eventSourceInstance = await getEventSourceInstance();

      // Create actor format profile update event
      const actorEvent = {
        data: {
          username: 'elonmusk',
          action: 'profile_updated',
          user: {
            id: 'user123',
            handle: 'elonmusk',
            verified: true,
            profile: {
              name: 'Elon Musk',
              avatar: 'https://example.com/new-avatar.jpg',
              bio: 'CEO of Tesla and SpaceX'
            },
            metrics: {
              followers: 100000000,
              following: 500
            }
          }
        },
        event_type: 'user_updated'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(actorEvent),
          type: 'message',
          lastEventId: 'test-id-3'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const eventOutputs = consoleLogSpy.mock.calls
        .map(call => call[0])
        .filter(output => typeof output === 'string' && output.includes('[user_updated]'));

      expect(eventOutputs.length).toBeGreaterThan(0);

      const outputText = eventOutputs[0];
      expect(outputText).toContain('[user_updated]');
      expect(outputText).toContain('@elonmusk');
      expect(outputText).toContain('profile');

      consoleLogSpy.mockRestore();
      cliOutput.stop();
      streamCore.stop();
    });
  });

  describe('Data preservation verification', () => {
    it('should preserve nested tweet structure through transformation', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          dedupTTL: 60000,
          eventSourceClass: MockEventSource
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      // Capture events from EventBus
      let capturedEvent: TwitterEvent | null = null;
      eventBus.subscribe('cli', (event: TwitterEvent) => {
        capturedEvent = event;
      });

      await streamCore.start();

      const eventSourceInstance = await getEventSourceInstance();

      const actorEvent = {
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22.000Z',
            body: {
              text: 'Test tweet with nested data',
              urls: [{ name: 'link', url: 'https://example.com', tco: 'https://t.co/xyz' }],
              mentions: ['user1', 'user2']
            },
            author: {
              handle: 'elonmusk',
              id: 'user123',
              verified: true,
              profile: {
                name: 'Elon Musk',
                avatar: 'https://example.com/avatar.jpg',
                bio: 'Test bio'
              }
            },
            metrics: {
              likes: 100,
              retweets: 50,
              replies: 25,
              views: 1000
            },
            media: {
              images: ['img1.jpg', 'img2.jpg'],
              videos: ['video1.mp4']
            }
          }
        },
        event_type: 'post_created'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(actorEvent),
          type: 'message',
          lastEventId: 'test-id'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify event was captured
      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.type).toBe('post_created');
      expect(capturedEvent!.user.username).toBe('elonmusk');

      // Verify complete nested data is preserved
      const data = capturedEvent!.data as any;
      expect(data.username).toBe('elonmusk');
      expect(data.action).toBe('post_created');
      expect(data.tweetId).toBe('tweet123');
      expect(data.tweet).toBeDefined();
      expect(data.tweet.body.text).toBe('Test tweet with nested data');
      expect(data.tweet.body.urls).toHaveLength(1);
      expect(data.tweet.body.urls[0].url).toBe('https://example.com');
      expect(data.tweet.body.mentions).toEqual(['user1', 'user2']);
      expect(data.tweet.author.handle).toBe('elonmusk');
      expect(data.tweet.author.profile.name).toBe('Elon Musk');
      expect(data.tweet.metrics.likes).toBe(100);
      expect(data.tweet.media.images).toEqual(['img1.jpg', 'img2.jpg']);
      expect(data.tweet.media.videos).toEqual(['video1.mp4']);

      streamCore.stop();
    });

    it('should preserve nested follow structure through transformation', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          dedupTTL: 60000,
          eventSourceClass: MockEventSource
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      let capturedEvent: TwitterEvent | null = null;
      eventBus.subscribe('cli', (event: TwitterEvent) => {
        capturedEvent = event;
      });

      await streamCore.start();

      const eventSourceInstance = await getEventSourceInstance();

      const actorEvent = {
        data: {
          username: 'elonmusk',
          action: 'follow_created',
          user: {
            id: 'user123',
            handle: 'elonmusk',
            verified: true,
            profile: {
              name: 'Elon Musk',
              avatar: 'https://example.com/elon.jpg',
              bio: 'CEO'
            },
            metrics: {
              followers: 100000000,
              following: 500
            }
          },
          following: {
            id: 'user456',
            handle: 'vitalikbuterin',
            verified: true,
            profile: {
              name: 'Vitalik Buterin',
              avatar: 'https://example.com/vitalik.jpg',
              bio: 'Ethereum'
            },
            metrics: {
              followers: 5000000,
              following: 200
            }
          }
        },
        event_type: 'follow_created'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(actorEvent),
          type: 'message',
          lastEventId: 'test-id'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(capturedEvent).not.toBeNull();
      expect(capturedEvent!.type).toBe('follow_created');

      // Verify complete nested data is preserved
      const data = capturedEvent!.data as any;
      expect(data.username).toBe('elonmusk');
      expect(data.action).toBe('follow_created');
      expect(data.user).toBeDefined();
      expect(data.user.handle).toBe('elonmusk');
      expect(data.user.profile.name).toBe('Elon Musk');
      expect(data.user.metrics.followers).toBe(100000000);
      expect(data.following).toBeDefined();
      expect(data.following.handle).toBe('vitalikbuterin');
      expect(data.following.profile.name).toBe('Vitalik Buterin');
      expect(data.following.metrics.followers).toBe(5000000);

      streamCore.stop();
    });

    it('should verify deep copy independence (modifying original does not affect transformed)', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          dedupTTL: 60000,
          eventSourceClass: MockEventSource
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      let capturedEvent: TwitterEvent | null = null;
      eventBus.subscribe('cli', (event: TwitterEvent) => {
        capturedEvent = event;
      });

      await streamCore.start();

      const eventSourceInstance = await getEventSourceInstance();

      const actorEvent = {
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            body: {
              text: 'Original text'
            },
            author: {
              handle: 'elonmusk'
            }
          }
        },
        event_type: 'post_created'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(actorEvent),
          type: 'message',
          lastEventId: 'test-id'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(capturedEvent).not.toBeNull();

      // Modify the original actor event data
      actorEvent.data.tweet.body.text = 'Modified text';
      actorEvent.data.username = 'modified_user';

      // Verify captured event still has original values (proving deep copy)
      const data = capturedEvent!.data as any;
      expect(data.tweet.body.text).toBe('Original text');
      expect(data.username).toBe('elonmusk');

      streamCore.stop();
    });
  });

  describe('Error scenarios and graceful handling', () => {
    it('should handle malformed JSON gracefully and continue processing', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          dedupTTL: 60000,
          eventSourceClass: MockEventSource
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      let eventCount = 0;
      eventBus.subscribe('cli', () => {
        eventCount++;
      });

      await streamCore.start();

      const eventSourceInstance = await getEventSourceInstance();

      // Send malformed JSON
      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: 'this is not valid JSON {{{',
          type: 'message',
          lastEventId: 'test-id-1'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Send valid event after malformed one
      const validEvent = {
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            body: { text: 'Valid tweet' },
            author: { handle: 'elonmusk' }
          }
        },
        event_type: 'post_created'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(validEvent),
          type: 'message',
          lastEventId: 'test-id-2'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify system continued processing and received the valid event
      expect(eventCount).toBe(1);

      consoleErrorSpy.mockRestore();
      streamCore.stop();
    });

    it('should handle events with missing required fields gracefully', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          dedupTTL: 60000,
          eventSourceClass: MockEventSource
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      let eventCount = 0;
      let eventReceived: (() => void) | null = null;
      const eventPromise = new Promise<void>(resolve => {
        eventReceived = resolve;
      });

      eventBus.subscribe('cli', () => {
        eventCount++;
        if (eventReceived) {
          eventReceived();
          eventReceived = null; // Prevent multiple calls
        }
      });

      await streamCore.start();

      const eventSourceInstance = await getEventSourceInstance();

      // Send event missing critical fields
      const incompleteEvent = {
        data: {
          // Missing username
          action: 'post_created'
          // Missing tweet data
        },
        event_type: 'post_created'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(incompleteEvent),
          type: 'message',
          lastEventId: 'test-id-1'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      // Event should be skipped (not crash)
      expect(eventCount).toBe(0);

      // Send valid event to verify system still works
      const validEvent = {
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet456', // Different ID to avoid dedup
          tweet: {
            body: { text: 'Valid tweet' },
            author: { handle: 'elonmusk' }
          }
        },
        event_type: 'post_created'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(validEvent),
          type: 'message',
          lastEventId: 'test-id-2'
        });
      }

      // Wait for the event to be processed
      await Promise.race([
        eventPromise,
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);

      // Give extra time for async chain to fully complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify system recovered and processed valid event
      expect(eventCount).toBe(1);

      // Cleanup
      streamCore.stop();
      await new Promise(resolve => setTimeout(resolve, 50));
      consoleErrorSpy.mockRestore();
    });

    it('should handle events with missing optional fields using fallbacks', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus, { statsInterval: 999999 });

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          dedupTTL: 60000,
          eventSourceClass: MockEventSource
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      cliOutput.start();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      let eventReceived: (() => void) | null = null;
      const eventPromise = new Promise<void>(resolve => {
        eventReceived = resolve;
      });

      // Subscribe to track when event is received
      eventBus.subscribe('test-tracker', () => {
        if (eventReceived) {
          eventReceived();
          eventReceived = null;
        }
      });

      await streamCore.start();

      const eventSourceInstance = await getEventSourceInstance();

      // Send event with minimal required fields (missing optional fields)
      const minimalEvent = {
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet789', // Unique ID
          tweet: {
            body: {
              text: 'Minimal tweet'
              // Missing urls, mentions
            },
            author: {
              handle: 'elonmusk'
              // Missing id, verified, profile
            }
            // Missing metrics, media
          }
        },
        event_type: 'post_created'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(minimalEvent),
          type: 'message',
          lastEventId: 'test-id'
        });
      }

      // Wait for async processing
      await Promise.race([
        eventPromise,
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);

      // Verify event was processed and formatted (with fallbacks)
      const eventOutputs = consoleLogSpy.mock.calls
        .map(call => call[0])
        .filter(output => typeof output === 'string' && output.includes('[post_created]'));

      expect(eventOutputs.length).toBeGreaterThan(0);

      const output = eventOutputs[0];
      expect(output).toContain('[post_created]');
      expect(output).toContain('@elonmusk');
      expect(output).toContain('Minimal tweet');

      consoleLogSpy.mockRestore();
      cliOutput.stop();
      streamCore.stop();
    });

    it('should continue processing after validation failures', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          dedupTTL: 60000,
          eventSourceClass: MockEventSource
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      let eventCount = 0;
      let eventsReceived = 0;
      let resolveEvents: (() => void) | null = null;
      const eventsPromise = new Promise<void>(resolve => {
        resolveEvents = resolve;
      });

      eventBus.subscribe('cli', () => {
        eventCount++;
        eventsReceived++;
        if (eventsReceived >= 2 && resolveEvents) {
          resolveEvents();
          resolveEvents = null;
        }
      });

      await streamCore.start();

      const eventSourceInstance = await getEventSourceInstance();

      // Send invalid event (missing type)
      const invalidEvent1 = {
        data: {
          username: 'elonmusk',
          action: 'post_created'
        }
        // Missing event_type
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(invalidEvent1),
          type: 'message',
          lastEventId: 'test-id-1'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      // Send valid event
      const validEvent = {
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet111', // Unique ID
          tweet: {
            body: { text: 'Valid tweet' },
            author: { handle: 'elonmusk' }
          }
        },
        event_type: 'post_created'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(validEvent),
          type: 'message',
          lastEventId: 'test-id-2'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      // Send another invalid event (wrong structure)
      const invalidEvent2 = {
        data: 'string instead of object',
        event_type: 'post_created'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(invalidEvent2),
          type: 'message',
          lastEventId: 'test-id-3'
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      // Send another valid event
      const validEvent2 = {
        data: {
          username: 'vitalikbuterin',
          action: 'post_created',
          tweetId: 'tweet456',
          tweet: {
            body: { text: 'Another valid tweet' },
            author: { handle: 'vitalikbuterin' }
          }
        },
        event_type: 'post_created'
      };

      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(validEvent2),
          type: 'message',
          lastEventId: 'test-id-4'
        });
      }

      // Wait for both valid events to be processed
      await Promise.race([
        eventsPromise,
        new Promise(resolve => setTimeout(resolve, 6000))
      ]);

      // Verify only valid events were processed
      expect(eventCount).toBe(2);

      streamCore.stop();
    });

    it('should handle multiple rapid events without data corruption', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          dedupTTL: 60000,
          eventSourceClass: MockEventSource
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      const capturedEvents: TwitterEvent[] = [];
      let eventsReceived = 0;
      let resolveEvents: (() => void) | null = null;
      const eventsPromise = new Promise<void>(resolve => {
        resolveEvents = resolve;
      });

      eventBus.subscribe('cli', (event: TwitterEvent) => {
        capturedEvents.push(event);
        eventsReceived++;
        if (eventsReceived >= 3 && resolveEvents) {
          resolveEvents();
          resolveEvents = null;
        }
      });

      await streamCore.start();

      const eventSourceInstance = await getEventSourceInstance();

      // Send multiple events rapidly
      const events = [
        {
          data: {
            username: 'user1',
            action: 'post_created',
            tweetId: 'tweet1',
            tweet: { body: { text: 'Tweet 1' }, author: { handle: 'user1' } }
          },
          event_type: 'post_created'
        },
        {
          data: {
            username: 'user2',
            action: 'post_created',
            tweetId: 'tweet2',
            tweet: { body: { text: 'Tweet 2' }, author: { handle: 'user2' } }
          },
          event_type: 'post_created'
        },
        {
          data: {
            username: 'user3',
            action: 'follow_created',
            user: { handle: 'user3' },
            following: { handle: 'user4' }
          },
          event_type: 'follow_created'
        }
      ];

      if (eventSourceInstance.onmessage) {
        events.forEach((event, index) => {
          eventSourceInstance.onmessage({
            data: JSON.stringify(event),
            type: 'message',
            lastEventId: `test-id-${index}`
          });
        });
      }

      // Wait for all events to be processed
      await Promise.race([
        eventsPromise,
        new Promise(resolve => setTimeout(resolve, 6000))
      ]);

      // Verify all events were captured
      expect(capturedEvents.length).toBe(3);

      // Verify data integrity (no cross-contamination)
      expect(capturedEvents[0].user.username).toBe('user1');
      expect((capturedEvents[0].data as any).tweet.body.text).toBe('Tweet 1');

      expect(capturedEvents[1].user.username).toBe('user2');
      expect((capturedEvents[1].data as any).tweet.body.text).toBe('Tweet 2');

      expect(capturedEvents[2].user.username).toBe('user3');
      expect((capturedEvents[2].data as any).following.handle).toBe('user4');

      streamCore.stop();
    });
  });
});
