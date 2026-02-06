/**
 * Integration tests for StreamCore
 */

import { StreamCore } from '../../src/streamcore/StreamCore';
import { FilterPipeline } from '../../src/filters/FilterPipeline';
import { UserFilter } from '../../src/filters/EventFilter';
import { DedupCache } from '../../src/dedup/DedupCache';
import { EventBus } from '../../src/eventbus/EventBus';
import { TwitterEvent } from '../../src/models/types';

describe('StreamCore Integration Tests', () => {
  let dedupCache: DedupCache;
  
  afterEach(() => {
    // Clean up timers after each test
    if (dedupCache) {
      dedupCache.clear();
    }
  });
  
  describe('End-to-end event flow', () => {
    it('should process events through the complete pipeline', () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      let receivedEvents: TwitterEvent[] = [];
      eventBus.subscribe('cli', (event) => {
        receivedEvents.push(event);
      });

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

      // Create a test event
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          action: 'post_created',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        }
      };

      // Simulate receiving the event
      (streamCore as any).handleEvent(event);

      // Verify event was processed
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual(event);
      
      const stats = streamCore.getStats();
      expect(stats.totalEvents).toBe(1);
      expect(stats.deliveredEvents).toBe(1);
      expect(stats.dedupedEvents).toBe(0);

      streamCore.stop();
    });

    it('should filter events based on user filter', () => {
      const filterPipeline = new FilterPipeline();
      const userFilter = new UserFilter(['alloweduser']);
      filterPipeline.addFilter(userFilter);
      
      dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      let receivedEvents: TwitterEvent[] = [];
      eventBus.subscribe('cli', (event) => {
        receivedEvents.push(event);
      });

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

      // Create events from different users
      const allowedEvent: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet1',
        user: {
          username: 'alloweduser',
          displayName: 'Allowed User',
          userId: 'user1'
        },
        data: {
          tweetId: 'tweet1',
          username: 'alloweduser',
          action: 'post_created',
          tweet: {
            id: 'tweet1',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: {
              text: 'Allowed tweet'
            },
            author: {
              handle: 'alloweduser',
              id: 'user1'
            }
          }
        }
      };

      const blockedEvent: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:01.000Z',
        primaryId: 'tweet2',
        user: {
          username: 'blockeduser',
          displayName: 'Blocked User',
          userId: 'user2'
        },
        data: {
          tweetId: 'tweet2',
          username: 'blockeduser',
          action: 'post_created',
          tweet: {
            id: 'tweet2',
            type: 'tweet',
            created_at: '2024-01-01T00:00:01.000Z',
            body: {
              text: 'Blocked tweet'
            },
            author: {
              handle: 'blockeduser',
              id: 'user2'
            }
          }
        }
      };

      // Process both events
      (streamCore as any).handleEvent(allowedEvent);
      (streamCore as any).handleEvent(blockedEvent);

      // Only allowed event should be received
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].user.username).toBe('alloweduser');
      
      const stats = streamCore.getStats();
      expect(stats.totalEvents).toBe(2);
      expect(stats.deliveredEvents).toBe(1);

      streamCore.stop();
    });

    it('should deduplicate events', () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      let receivedEvents: TwitterEvent[] = [];
      eventBus.subscribe('cli', (event) => {
        receivedEvents.push(event);
      });

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

      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          action: 'post_created',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        }
      };

      // Process the same event twice
      (streamCore as any).handleEvent(event);
      (streamCore as any).handleEvent(event);

      // Only one event should be received
      expect(receivedEvents).toHaveLength(1);
      
      const stats = streamCore.getStats();
      expect(stats.totalEvents).toBe(2);
      expect(stats.deliveredEvents).toBe(1);
      expect(stats.dedupedEvents).toBe(1);

      streamCore.stop();
    });

    it('should broadcast to multiple channels', async () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      let cliEvents: TwitterEvent[] = [];
      let dashboardEvents: TwitterEvent[] = [];
      let alertEvents: TwitterEvent[] = [];
      
      eventBus.subscribe('cli', (event) => { cliEvents.push(event); });
      eventBus.subscribe('dashboard', (event) => { dashboardEvents.push(event); });
      eventBus.subscribe('alerts', (event) => { alertEvents.push(event); });

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

      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          action: 'post_created',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        }
      };

      // Process event
      (streamCore as any).handleEvent(event);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // All channels should receive the event
      expect(cliEvents).toHaveLength(1);
      expect(dashboardEvents).toHaveLength(1);
      expect(alertEvents).toHaveLength(1);

      streamCore.stop();
    });
  });

  describe('Endpoint management', () => {
    it('should initialize with correct endpoint', () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'tweets'
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      expect(streamCore.getCurrentEndpoint()).toBe('tweets');
      expect(streamCore.getConnectionStatus()).toBe('disconnected');

      streamCore.stop();
    });

    it('should track connection status', () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
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

      // Initial status should be disconnected
      expect(streamCore.getConnectionStatus()).toBe('disconnected');

      streamCore.stop();
    });
  });

  describe('Statistics tracking', () => {
    it('should track event statistics correctly', () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
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

      const event1: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet1',
        user: {
          username: 'user1',
          displayName: 'User 1',
          userId: 'user1'
        },
        data: {
          tweetId: 'tweet1',
          username: 'user1',
          action: 'post_created',
          tweet: {
            id: 'tweet1',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: {
              text: 'Tweet 1'
            },
            author: {
              handle: 'user1',
              id: 'user1'
            }
          }
        }
      };

      const event2: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:01.000Z',
        primaryId: 'tweet2',
        user: {
          username: 'user2',
          displayName: 'User 2',
          userId: 'user2'
        },
        data: {
          tweetId: 'tweet2',
          username: 'user2',
          action: 'post_created',
          tweet: {
            id: 'tweet2',
            type: 'tweet',
            created_at: '2024-01-01T00:00:01.000Z',
            body: {
              text: 'Tweet 2'
            },
            author: {
              handle: 'user2',
              id: 'user2'
            }
          }
        }
      };

      // Process events
      (streamCore as any).handleEvent(event1);
      (streamCore as any).handleEvent(event2);
      (streamCore as any).handleEvent(event1); // Duplicate

      const stats = streamCore.getStats();
      expect(stats.totalEvents).toBe(3);
      expect(stats.deliveredEvents).toBe(2);
      expect(stats.dedupedEvents).toBe(1);

      streamCore.stop();
    });
  });

  describe('Error handling', () => {
    it('should handle malformed events gracefully', () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      let receivedEvents: TwitterEvent[] = [];
      eventBus.subscribe('cli', (event) => {
        receivedEvents.push(event);
      });

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

      // Create a malformed event (missing data field)
      const malformedEvent: any = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        }
        // Missing data field
      };

      // Process malformed event (should not crash)
      (streamCore as any).handleEvent(malformedEvent);

      // Create a valid event
      const validEvent: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:01.000Z',
        primaryId: 'tweet456',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          tweetId: 'tweet456',
          username: 'testuser',
          action: 'post_created',
          tweet: {
            id: 'tweet456',
            type: 'tweet',
            created_at: '2024-01-01T00:00:01.000Z',
            body: {
              text: 'Valid tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        }
      };

      // Process valid event
      (streamCore as any).handleEvent(validEvent);

      // Valid event should be received
      expect(receivedEvents.length).toBeGreaterThan(0);

      streamCore.stop();
    });
  });

  describe('User filtering integration', () => {
    it('should pass user filters to SSEClient when configured', () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          userFilters: ['elonmusk', 'vitalikbuterin']
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      // Verify getUserFiltersFromConfig returns the configured filters
      const userFilters = (streamCore as any).getUserFiltersFromConfig();
      expect(userFilters).toEqual(['elonmusk', 'vitalikbuterin']);

      streamCore.stop();
    });

    it('should return undefined when no user filters configured', () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
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

      // Verify getUserFiltersFromConfig returns undefined
      const userFilters = (streamCore as any).getUserFiltersFromConfig();
      expect(userFilters).toBeUndefined();

      streamCore.stop();
    });

    it('should return undefined when user filters is empty array', () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          endpoint: 'all',
          userFilters: []
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
  });
});


  describe('Validation scenarios', () => {
    it('should accept events with valid internal format', () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      let receivedEvents: TwitterEvent[] = [];
      eventBus.subscribe('cli', (event) => {
        receivedEvents.push(event);
      });

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

      // Create event with valid internal format
      const validEvent: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          action: 'post_created',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        }
      };

      // Process event
      (streamCore as any).handleEvent(validEvent);

      // Event should be received
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual(validEvent);

      streamCore.stop();
      dedupCache.clear();
    });

    it('should reject events missing required fields', () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      let receivedEvents: TwitterEvent[] = [];
      eventBus.subscribe('cli', (event) => {
        receivedEvents.push(event);
      });

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

      // Test missing user object
      const missingUser: any = {
        type: 'post_created',
        data: { text: 'test' }
      };
      (streamCore as any).handleEvent(missingUser);

      // Test missing user.username
      const missingUsername: any = {
        type: 'post_created',
        user: { displayName: 'Test' },
        data: { text: 'test' }
      };
      (streamCore as any).handleEvent(missingUsername);

      // Test missing data object
      const missingData: any = {
        type: 'post_created',
        user: { username: 'test' }
      };
      (streamCore as any).handleEvent(missingData);

      // Test missing type
      const missingType: any = {
        user: { username: 'test' },
        data: { text: 'test' }
      };
      (streamCore as any).handleEvent(missingType);

      // No events should be received
      expect(receivedEvents).toHaveLength(0);

      streamCore.stop();
      dedupCache.clear();
    });

    it('should accept events with missing optional fields', () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      let receivedEvents: TwitterEvent[] = [];
      eventBus.subscribe('cli', (event) => {
        receivedEvents.push(event);
      });

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

      // Create event with minimal required fields (missing optional fields)
      const minimalEvent: any = {
        type: 'post_created',
        user: {
          username: 'testuser'
          // displayName and userId are optional
        },
        data: {
          // Data can be empty or have any content
        }
      };

      // Process event
      (streamCore as any).handleEvent(minimalEvent);

      // Event should be received even with missing optional fields
      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].user.username).toBe('testuser');

      streamCore.stop();
      dedupCache.clear();
    });

    it('should log validation failures when DEBUG=true', () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';

      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

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

      // Create invalid event
      const invalidEvent: any = {
        type: 'post_created'
        // Missing required fields
      };

      // Process invalid event
      (streamCore as any).handleEvent(invalidEvent);

      // Debug logs should be called
      expect(consoleSpy).toHaveBeenCalled();

      // Restore
      consoleSpy.mockRestore();
      process.env.DEBUG = originalDebug;
      streamCore.stop();
      dedupCache.clear();
    });

    it('should not log validation failures when DEBUG=false', () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'false';

      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

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

      // Create invalid event
      const invalidEvent: any = {
        type: 'post_created'
        // Missing required fields
      };

      // Process invalid event
      (streamCore as any).handleEvent(invalidEvent);

      // Debug logs should not be called
      expect(consoleSpy).not.toHaveBeenCalled();

      // Restore
      consoleSpy.mockRestore();
      process.env.DEBUG = originalDebug;
      streamCore.stop();
      dedupCache.clear();
    });
  });

  describe('Logging Behavior', () => {
    it('should log successful event processing at info level', async () => {
      // Set DEBUG to true for this test
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';

      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

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

      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          action: 'post_created',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        }
      };

      // Process event
      await (streamCore as any).handleEvent(event);

      // Info log should be called with event type and username
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[StreamCore] Event processed: post_created from @testuser'
      );

      consoleInfoSpy.mockRestore();
      process.env.DEBUG = originalDebug;
      streamCore.stop();
      dedupCache.clear();
    });

    it('should always log errors regardless of DEBUG setting', () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'false';

      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

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

      // Create invalid event that will trigger error (missing user.username)
      const invalidEvent: any = {
        type: 'post_created',
        user: {
          displayName: 'Test User'
          // Missing username
        },
        data: {}
      };

      // Process invalid event (will be rejected by validation)
      (streamCore as any).handleEvent(invalidEvent);

      // Error log should be called
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid event structure, skipping event'
      );

      consoleErrorSpy.mockRestore();
      process.env.DEBUG = originalDebug;
      streamCore.stop();
      dedupCache.clear();
    });

    it('should log info for each successfully processed event', async () => {
      // Set DEBUG to true for this test
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';

      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

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

      const event1: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet1',
        user: {
          username: 'user1',
          displayName: 'User 1',
          userId: 'user1'
        },
        data: {
          tweetId: 'tweet1',
          username: 'user1',
          action: 'post_created',
          tweet: {
            id: 'tweet1',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: { text: 'Tweet 1' },
            author: { handle: 'user1', id: 'user1' }
          }
        }
      };

      const event2: TwitterEvent = {
        type: 'follow_created',
        timestamp: '2024-01-01T00:00:01.000Z',
        primaryId: 'follow1',
        user: {
          username: 'user2',
          displayName: 'User 2',
          userId: 'user2'
        },
        data: {
          username: 'user2',
          action: 'follow_created',
          user: { id: 'user2', handle: 'user2' },
          following: { id: 'user3', handle: 'user3' }
        }
      };

      // Process events
      await (streamCore as any).handleEvent(event1);
      await (streamCore as any).handleEvent(event2);

      // Info logs should be called for each event
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[StreamCore] Event processed: post_created from @user1'
      );
      expect(consoleInfoSpy).toHaveBeenCalledWith(
        '[StreamCore] Event processed: follow_created from @user2'
      );
      expect(consoleInfoSpy).toHaveBeenCalledTimes(2);

      consoleInfoSpy.mockRestore();
      process.env.DEBUG = originalDebug;
      streamCore.stop();
      dedupCache.clear();
    });

    it('should not log info for filtered events', async () => {
      const filterPipeline = new FilterPipeline();
      const userFilter = new UserFilter(['alloweduser']);
      filterPipeline.addFilter(userFilter);
      
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

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

      const blockedEvent: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet1',
        user: {
          username: 'blockeduser',
          displayName: 'Blocked User',
          userId: 'user1'
        },
        data: {
          tweetId: 'tweet1',
          username: 'blockeduser',
          action: 'post_created',
          tweet: {
            id: 'tweet1',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: { text: 'Blocked tweet' },
            author: { handle: 'blockeduser', id: 'user1' }
          }
        }
      };

      // Process blocked event
      await (streamCore as any).handleEvent(blockedEvent);

      // Info log should not be called for filtered events
      expect(consoleInfoSpy).not.toHaveBeenCalled();

      consoleInfoSpy.mockRestore();
      streamCore.stop();
      dedupCache.clear();
    });

    it('should not log info for deduplicated events', () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();
      
      const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();

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

      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          action: 'post_created',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-01T00:00:00.000Z',
            body: { text: 'Test tweet' },
            author: { handle: 'testuser', id: 'user123' }
          }
        }
      };

      // Process event twice
      (streamCore as any).handleEvent(event);
      consoleInfoSpy.mockClear();
      (streamCore as any).handleEvent(event); // Duplicate

      // Info log should not be called for duplicate
      expect(consoleInfoSpy).not.toHaveBeenCalled();

      consoleInfoSpy.mockRestore();
      streamCore.stop();
      dedupCache.clear();
    });
  });
