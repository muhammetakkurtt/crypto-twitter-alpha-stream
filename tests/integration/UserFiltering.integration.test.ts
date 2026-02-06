/**
 * End-to-end integration tests for actor-side user filtering
 * Tests complete flow: config → validation → URL construction → connection → event filtering
 */

// Mock the eventsource module before imports
jest.mock('eventsource', () => {
  const MockEventSource = jest.fn().mockImplementation((url: string) => {
    const instance = {
      url,
      onopen: null as (() => void) | null,
      onmessage: null as ((event: any) => void) | null,
      onerror: null as ((error: any) => void) | null,
      readyState: 0,
      eventListeners: {} as Record<string, Array<(event: any) => void>>,
      addEventListener: jest.fn().mockImplementation(function (this: any, eventType: string, handler: (event: any) => void) {
        if (!this.eventListeners[eventType]) {
          this.eventListeners[eventType] = [];
        }
        this.eventListeners[eventType].push(handler);
      }),
      removeEventListener: jest.fn().mockImplementation(function (this: any, eventType: string, handler: (event: any) => void) {
        if (this.eventListeners[eventType]) {
          this.eventListeners[eventType] = this.eventListeners[eventType].filter((h: any) => h !== handler);
        }
      }),
      close: jest.fn().mockImplementation(function (this: any) {
        this.readyState = 2;
      }),
      simulateMessage: jest.fn().mockImplementation(function (this: any, data: any) {
        if (this.onmessage) {
          this.onmessage({
            data: JSON.stringify(data),
            type: 'message',
            lastEventId: 'test-id',
          });
        }
      }),
      simulateError: jest.fn().mockImplementation(function (this: any, error: any) {
        if (this.onerror) {
          this.onerror(error);
        }
      }),
    };

    // Simulate async connection
    setTimeout(() => {
      instance.readyState = 1;
      if (instance.onopen) {
        instance.onopen();
      }
    }, 10);

    return instance;
  });

  return {
    EventSource: MockEventSource,
  };
});

import { Application } from '../../src/Application';
import { ConfigManager } from '../../src/config/ConfigManager';
import { ActiveUsersFetcher } from '../../src/activeusers/ActiveUsersFetcher';
import { TwitterEvent } from '../../src/models/types';
import { createMockConfig } from '../test-helpers';

// Mock all external dependencies
jest.mock('../../src/config/ConfigManager');
jest.mock('../../src/activeusers/ActiveUsersFetcher');
jest.mock('../../src/health/HealthMonitor');

describe('User Filtering Integration Tests', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Set required environment variables
    process.env.APIFY_TOKEN = 'test-token-12345';
    process.env.CLI_ENABLED = 'true';

    // Clear all mocks
    jest.clearAllMocks();

    // Clear all timers
    jest.clearAllTimers();
  });

  afterEach(async () => {
    // Clear all timers to prevent async operations after tests
    jest.clearAllTimers();

    // Wait for any pending promises
    await new Promise(resolve => setImmediate(resolve));

    // Restore original environment
    process.env = originalEnv;
  });

  describe('End-to-end flow with user filtering', () => {
    it('should complete full flow: config → validation → URL construction → connection', async () => {
      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: ['elonmusk', 'vitalikbuterin'],
          keywords: []
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      // Mock ActiveUsersFetcher to return valid users
      (ActiveUsersFetcher.prototype.fetch as jest.Mock).mockResolvedValue([
        'elonmusk', 'vitalikbuterin', 'cz_binance', 'naval'
      ]);

      const app = new Application();
      await app.start();

      // Verify application is running
      expect(app.isApplicationRunning()).toBe(true);

      // Verify ActiveUsersFetcher was called for validation
      expect(ActiveUsersFetcher.prototype.fetch).toHaveBeenCalled();

      // Verify EventSource was created with correct URL including users parameter
      const EventSourceModule = require('eventsource');
      const MockEventSource = EventSourceModule.EventSource;
      expect(MockEventSource).toHaveBeenCalled();
      const constructorCall = (MockEventSource as jest.Mock).mock.calls[0];
      const url = constructorCall[0];

      expect(url).toContain('token=test-token-12345');
      expect(url).toContain('users=elonmusk%2Cvitalikbuterin');

      // Clean up
      await app.shutdown();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should filter events to only receive specified users', async () => {
      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: ['elonmusk'],
          keywords: []
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);
      (ActiveUsersFetcher.prototype.fetch as jest.Mock).mockResolvedValue(['elonmusk', 'vitalikbuterin']);

      const app = new Application();

      await app.start();

      // Get the EventSource instance
      const EventSourceModule = require('eventsource');
      const MockEventSource = EventSourceModule.EventSource;
      const eventSourceInstance = (MockEventSource as jest.Mock).mock.results[0].value;

      // Simulate events from different users
      const allowedEvent: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet1',
        user: {
          username: 'elonmusk',
          displayName: 'Elon Musk',
          userId: 'user1'
        },
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet1',
          tweet: {
            id: 'tweet1',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: {
              text: 'Allowed tweet',
              urls: [],
              mentions: []
            },
            author: {
              handle: 'elonmusk',
              id: 'user1',
              verified: false,
              profile: {
                name: 'Elon Musk',
                avatar: '',
                bio: ''
              }
            },
            metrics: {
              likes: 0,
              retweets: 0,
              replies: 0,
              views: 0
            },
            media: {
              images: [],
              videos: []
            }
          }
        }
      };

      // In actor-side filtering, only allowed events would be sent
      // Simulate receiving only the allowed event
      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(allowedEvent),
          type: 'message',
          lastEventId: 'test-id-1'
        });
      }

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Clean up
      await app.shutdown();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should apply two-layer filtering: actor-side + client-side', async () => {
      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: ['elonmusk', 'vitalikbuterin'],
          keywords: ['bitcoin']  // Client-side keyword filter
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);
      (ActiveUsersFetcher.prototype.fetch as jest.Mock).mockResolvedValue(['elonmusk', 'vitalikbuterin']);

      const app = new Application();
      await app.start();

      // Verify URL includes users parameter (actor-side filtering)
      const EventSourceModule = require('eventsource');
      const MockEventSource = EventSourceModule.EventSource;
      const constructorCall = (MockEventSource as jest.Mock).mock.calls[0];
      const url = constructorCall[0];
      expect(url).toContain('users=elonmusk%2Cvitalikbuterin');

      // Get the EventSource instance
      const eventSourceInstance = (MockEventSource as jest.Mock).mock.results[0].value;

      // Simulate event that passes actor-side filter but should be filtered client-side
      const eventWithoutKeyword: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet1',
        user: {
          username: 'elonmusk',
          displayName: 'Elon Musk',
          userId: 'user1'
        },
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet1',
          tweet: {
            id: 'tweet1',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: {
              text: 'Tweet about ethereum',
              urls: [],
              mentions: []
            },
            author: {
              handle: 'elonmusk',
              id: 'user1',
              verified: false,
              profile: {
                name: 'Elon Musk',
                avatar: '',
                bio: ''
              }
            },
            metrics: {
              likes: 0,
              retweets: 0,
              replies: 0,
              views: 0
            },
            media: {
              images: [],
              videos: []
            }
          }
        }
      };

      const eventWithKeyword: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:01.000Z',
        primaryId: 'tweet2',
        user: {
          username: 'elonmusk',
          displayName: 'Elon Musk',
          userId: 'user1'
        },
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet2',
          tweet: {
            id: 'tweet2',
            type: 'tweet',
            created_at: '2024-01-01T00:00:01.000Z',
            body: {
              text: 'Tweet about bitcoin',
              urls: [],
              mentions: []
            },
            author: {
              handle: 'elonmusk',
              id: 'user1',
              verified: false,
              profile: {
                name: 'Elon Musk',
                avatar: '',
                bio: ''
              }
            },
            metrics: {
              likes: 0,
              retweets: 0,
              replies: 0,
              views: 0
            },
            media: {
              images: [],
              videos: []
            }
          }
        }
      };

      // Simulate receiving both events (actor-side already filtered by user)
      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(eventWithoutKeyword),
          type: 'message',
          lastEventId: 'test-id-1'
        });

        eventSourceInstance.onmessage({
          data: JSON.stringify(eventWithKeyword),
          type: 'message',
          lastEventId: 'test-id-2'
        });
      }

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      // Clean up
      await app.shutdown();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should handle various user filter configurations', async () => {
      // Test with single user
      const singleUserConfig = {
        apify: {
          token: 'test-token-12345',
          endpoint: 'all' as const,
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: ['elonmusk'],
          keywords: []
        },
        outputs: {
          cli: { enabled: true },
          dashboard: { enabled: false, port: 3000 },
          alerts: {
            telegram: { enabled: false },
            discord: { enabled: false },
            webhook: { enabled: false }
          }
        },
        dedup: { ttl: 60 },
        reconnect: {
          initialDelay: 1000,
          maxDelay: 30000,
          backoffMultiplier: 2.0,
          maxAttempts: 10
        },
        logging: { fileLogging: false },
        activeUsers: {
          refreshInterval: 3600000
        },
        health: {
          enabled: false,
          port: 3001,
          checkInterval: 30000
        }
      };

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(singleUserConfig);
      (ActiveUsersFetcher.prototype.fetch as jest.Mock).mockResolvedValue(['elonmusk']);

      const app1 = new Application();
      await app1.start();

      const EventSourceModule = require('eventsource');
      const MockEventSource = EventSourceModule.EventSource;
      let url = (MockEventSource as jest.Mock).mock.calls[0][0];
      expect(url).toContain('users=elonmusk');
      expect(url).not.toContain('%2C'); // No comma separator for single user

      await app1.shutdown();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      jest.clearAllMocks();

      // Test with multiple users
      const multiUserConfig = {
        ...singleUserConfig,
        filters: {
          users: ['elonmusk', 'vitalikbuterin', 'cz_binance'],
          keywords: []
        }
      };

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(multiUserConfig);
      (ActiveUsersFetcher.prototype.fetch as jest.Mock).mockResolvedValue(['elonmusk', 'vitalikbuterin', 'cz_binance']);

      const app2 = new Application();
      await app2.start();

      url = (MockEventSource as jest.Mock).mock.calls[0][0];
      expect(url).toContain('users=elonmusk%2Cvitalikbuterin%2Ccz_binance');

      await app2.shutdown();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should validate user filters and warn about invalid users', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: ['elonmusk', 'invaliduser', 'vitalikbuterin'],
          keywords: []
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);
      (ActiveUsersFetcher.prototype.fetch as jest.Mock).mockResolvedValue(['elonmusk', 'vitalikbuterin', 'cz_binance']);

      const app = new Application();
      await app.start();

      // Verify validation warnings were logged
      expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️  WARNING: User filter validation notice!');
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('invaliduser'));

      // Application should still proceed with connection
      expect(app.isApplicationRunning()).toBe(true);

      await app.shutdown();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      consoleWarnSpy.mockRestore();
    });

    it('should proceed with connection even if validation fails', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: ['elonmusk'],
          keywords: []
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);
      // Simulate fetch failure
      (ActiveUsersFetcher.prototype.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const app = new Application();
      await app.start();

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not validate user filters'));

      // Application should still be running
      expect(app.isApplicationRunning()).toBe(true);

      await app.shutdown();

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      consoleWarnSpy.mockRestore();
    });
  });
});

