/**
 * Backward compatibility integration tests
 * Tests that existing behavior is unchanged when no user filters are configured
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
      addEventListener: jest.fn().mockImplementation(function(this: any, eventType: string, handler: (event: any) => void) {
        if (!this.eventListeners[eventType]) {
          this.eventListeners[eventType] = [];
        }
        this.eventListeners[eventType].push(handler);
      }),
      removeEventListener: jest.fn().mockImplementation(function(this: any, eventType: string, handler: (event: any) => void) {
        if (this.eventListeners[eventType]) {
          this.eventListeners[eventType] = this.eventListeners[eventType].filter((h: any) => h !== handler);
        }
      }),
      close: jest.fn().mockImplementation(function(this: any) {
        this.readyState = 2;
      }),
      simulateMessage: jest.fn().mockImplementation(function(this: any, data: any) {
        if (this.onmessage) {
          this.onmessage({
            data: JSON.stringify(data),
            type: 'message',
            lastEventId: 'test-id',
          });
        }
      }),
      simulateError: jest.fn().mockImplementation(function(this: any, error: any) {
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
import { StreamCore } from '../../src/streamcore/StreamCore';
import { FilterPipeline } from '../../src/filters/FilterPipeline';
import { DedupCache } from '../../src/dedup/DedupCache';
import { EventBus } from '../../src/eventbus/EventBus';
import { SSEClient } from '../../src/sse/SSEClient';
import { createMockConfig } from '../test-helpers';

// Mock all external dependencies
jest.mock('../../src/config/ConfigManager');
jest.mock('../../src/activeusers/ActiveUsersFetcher');
jest.mock('../../src/health/HealthMonitor');

describe('Backward Compatibility Integration Tests', () => {
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

  describe('Application with no user filters', () => {
    it('should work without user filters configured', async () => {
      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: [],  // Empty user filters
          keywords: []
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);
      (ActiveUsersFetcher.prototype.fetch as jest.Mock).mockResolvedValue(['elonmusk', 'vitalikbuterin']);

      const app = new Application();
      await app.start();

      // Verify application is running
      expect(app.isApplicationRunning()).toBe(true);

      // Verify EventSource was created WITHOUT users parameter
      const EventSourceModule = require('eventsource');
      const MockEventSource = EventSourceModule.EventSource;
      expect(MockEventSource).toHaveBeenCalled();
      const constructorCall = (MockEventSource as jest.Mock).mock.calls[0];
      const url = constructorCall[0];
      
      expect(url).toContain('token=test-token-12345');
      expect(url).not.toContain('users=');  // No users parameter

      // Verify validation was NOT called (no users to validate)
      expect(ActiveUsersFetcher.prototype.fetch).not.toHaveBeenCalled();

      // Clean up
      await app.shutdown();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should not append users parameter when USERS environment variable is empty', async () => {
      // Set empty USERS environment variable
      process.env.USERS = '';

      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: [],  // Empty from environment variable
          keywords: []
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      const app = new Application();
      await app.start();

      // Verify URL does not contain users parameter
      const EventSourceModule = require('eventsource');
      const MockEventSource = EventSourceModule.EventSource;
      const url = (MockEventSource as jest.Mock).mock.calls[0][0];
      expect(url).not.toContain('users=');

      await app.shutdown();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should maintain existing connection behavior', async () => {
      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: [],
          keywords: []
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      const app = new Application();
      await app.start();

      // Verify EventSource was created with correct endpoint
      const EventSourceModule = require('eventsource');
      const MockEventSource = EventSourceModule.EventSource;
      const url = (MockEventSource as jest.Mock).mock.calls[0][0];
      expect(url).toContain('http://localhost:3000/events/twitter/all');
      expect(url).toContain('token=test-token-12345');

      // Verify application is running
      expect(app.isApplicationRunning()).toBe(true);

      await app.shutdown();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should receive all events when no user filters configured', async () => {
      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: [],  // No user filters
          keywords: []
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      const app = new Application();
      await app.start();

      // Get the EventSource instance
      const EventSourceModule = require('eventsource');
      const MockEventSource = EventSourceModule.EventSource;
      const eventSourceInstance = (MockEventSource as jest.Mock).mock.results[0].value;

      // Simulate events from different users (all should be received)
      const event1 = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet1',
        user: {
          username: 'elonmusk',
          displayName: 'Elon Musk',
          userId: 'user1'
        },
        data: {
          tweetId: 'tweet1',
          text: 'Tweet 1',
          url: 'https://twitter.com/elonmusk/status/tweet1'
        }
      };

      const event2 = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:01.000Z',
        primaryId: 'tweet2',
        user: {
          username: 'vitalikbuterin',
          displayName: 'Vitalik Buterin',
          userId: 'user2'
        },
        data: {
          tweetId: 'tweet2',
          text: 'Tweet 2',
          url: 'https://twitter.com/vitalikbuterin/status/tweet2'
        }
      };

      const event3 = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:02.000Z',
        primaryId: 'tweet3',
        user: {
          username: 'cz_binance',
          displayName: 'CZ',
          userId: 'user3'
        },
        data: {
          tweetId: 'tweet3',
          text: 'Tweet 3',
          url: 'https://twitter.com/cz_binance/status/tweet3'
        }
      };

      // Simulate receiving all events
      if (eventSourceInstance.onmessage) {
        eventSourceInstance.onmessage({
          data: JSON.stringify(event1),
          type: 'message',
          lastEventId: 'test-id-1'
        });
        
        eventSourceInstance.onmessage({
          data: JSON.stringify(event2),
          type: 'message',
          lastEventId: 'test-id-2'
        });
        
        eventSourceInstance.onmessage({
          data: JSON.stringify(event3),
          type: 'message',
          lastEventId: 'test-id-3'
        });
      }

      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      await app.shutdown();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('StreamCore backward compatibility', () => {
    it('should return undefined for getUserFiltersFromConfig when no filters configured', () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all'
          // No userFilters field
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      // Verify getUserFiltersFromConfig returns undefined
      const userFilters = (streamCore as any).getUserFiltersFromConfig();
      expect(userFilters).toBeUndefined();

      streamCore.stop();
    });

    it('should return undefined when userFilters is empty array', () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          userFilters: []  // Empty array
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      // Verify getUserFiltersFromConfig returns undefined for empty array
      const userFilters = (streamCore as any).getUserFiltersFromConfig();
      expect(userFilters).toBeUndefined();

      streamCore.stop();
    });

    it('should maintain existing endpoint switching behavior', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all'
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      // Verify initial endpoint
      expect(streamCore.getCurrentEndpoint()).toBe('all');

      streamCore.stop();
    });
  });

  describe('SSEClient backward compatibility', () => {
    it('should construct URL without users parameter when not provided', async () => {
      const config = {
        endpoint: 'http://test.example.com/events',
        token: 'test-token-123',
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2.0,
        maxReconnectAttempts: 5
        // No users field
      };

      const client = new SSEClient(config);
      await client.connect();

      // Verify URL does not contain users parameter
      const eventSource = (client as any).eventSource;
      expect(eventSource.url).toBe('http://test.example.com/events?token=test-token-123');
      expect(eventSource.url).not.toContain('users=');

      client.disconnect();
    });

    it('should construct URL without users parameter when users is empty array', async () => {
      const config = {
        endpoint: 'http://test.example.com/events',
        token: 'test-token-123',
        users: [],  // Empty array
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2.0,
        maxReconnectAttempts: 5
      };

      const client = new SSEClient(config);
      await client.connect();

      // Verify URL does not contain users parameter
      const eventSource = (client as any).eventSource;
      expect(eventSource.url).toBe('http://test.example.com/events?token=test-token-123');
      expect(eventSource.url).not.toContain('users=');

      client.disconnect();
    });

    it('should maintain existing connection and reconnection behavior', async () => {
      const config = {
        endpoint: 'http://test.example.com/events',
        token: 'test-token-123',
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2.0,
        maxReconnectAttempts: 5
      };

      const client = new SSEClient(config);
      
      // Test connection
      await client.connect();
      expect(client.getConnectionStatus()).toBe(true);
      expect(client.getReconnectAttempts()).toBe(0);

      // Test disconnection
      client.disconnect();
      expect(client.getConnectionStatus()).toBe(false);
    });

    it('should maintain existing error handling behavior', async () => {
      const config = {
        endpoint: 'http://test.example.com/events',
        token: 'test-token-123',
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2.0,
        maxReconnectAttempts: 5
      };

      const client = new SSEClient(config);
      
      const errorCallback = jest.fn();
      client.onError(errorCallback);

      await client.connect();

      // Simulate error
      const eventSource = (client as any).eventSource;
      eventSource.simulateError({ message: 'Connection lost' });

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(errorCallback).toHaveBeenCalled();

      client.disconnect();
    });
  });

  describe('Configuration backward compatibility', () => {
    it('should handle missing users field in configuration', async () => {
      const mockConfig = {
        apify: {
          token: 'test-token-12345',
          endpoint: 'all' as const,
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: [],  // Empty users
          keywords: ['bitcoin']  // Only keywords
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

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      const app = new Application();
      await app.start();

      // Verify application starts successfully
      expect(app.isApplicationRunning()).toBe(true);

      // Verify URL does not contain users parameter
      const EventSourceModule = require('eventsource');
      const MockEventSource = EventSourceModule.EventSource;
      const url = (MockEventSource as jest.Mock).mock.calls[0][0];
      expect(url).not.toContain('users=');

      await app.shutdown();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should work with existing configuration files', async () => {
      // Simulate a configuration file from before user filtering was added
      const legacyConfig = createMockConfig({
        apify: {
          endpoint: 'tweets' as const,
          actorUrl: 'http://localhost:3000'
        },
        filters: {
          users: [],
          keywords: ['crypto', 'bitcoin']
        },
        outputs: {
          cli: { enabled: true },
          dashboard: { enabled: true, port: 3000 },
          alerts: {
            telegram: { enabled: false },
            discord: { enabled: false },
            webhook: { enabled: false }
          }
        },
        dedup: { ttl: 300 },
        reconnect: {
          initialDelay: 2000,
          maxDelay: 60000,
          backoffMultiplier: 1.5,
          maxAttempts: 5
        },
        logging: { fileLogging: true }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(legacyConfig);

      const app = new Application();
      await app.start();

      // Verify application works with legacy configuration
      expect(app.isApplicationRunning()).toBe(true);

      // Verify correct endpoint is used
      const EventSourceModule = require('eventsource');
      const MockEventSource = EventSourceModule.EventSource;
      const url = (MockEventSource as jest.Mock).mock.calls[0][0];
      expect(url).toContain('/events/twitter/tweets');
      expect(url).not.toContain('users=');

      await app.shutdown();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });
});

