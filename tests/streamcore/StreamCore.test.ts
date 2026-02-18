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
          channels: ['all']
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
          channels: ['all']
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
          channels: ['all']
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

    it('should deduplicate same event with different timestamps', () => {
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
          channels: ['all']
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      const event1: TwitterEvent = {
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

      // Same event but with different timestamp (e.g., received after reconnection)
      const event2: TwitterEvent = {
        ...event1,
        timestamp: '2024-01-01T00:05:00.000Z' // 5 minutes later
      };

      // Process both events
      (streamCore as any).handleEvent(event1);
      (streamCore as any).handleEvent(event2);

      // Only one event should be received (deduplication based on stable ID)
      expect(receivedEvents).toHaveLength(1);
      
      const stats = streamCore.getStats();
      expect(stats.totalEvents).toBe(2);
      expect(stats.deliveredEvents).toBe(1);
      expect(stats.dedupedEvents).toBe(1);

      streamCore.stop();
    });

    it('should use stable tweet ID for post events', () => {
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
          channels: ['all']
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      // Two different events with different tweet IDs should both be delivered
      const event1: TwitterEvent = {
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
              text: 'Test tweet 1'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        }
      };

      const event2: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-01T00:01:00.000Z',
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
            created_at: '2024-01-01T00:01:00.000Z',
            body: {
              text: 'Test tweet 2'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        }
      };

      // Process both events
      (streamCore as any).handleEvent(event1);
      (streamCore as any).handleEvent(event2);

      // Both events should be received (different stable IDs)
      expect(receivedEvents).toHaveLength(2);
      
      const stats = streamCore.getStats();
      expect(stats.totalEvents).toBe(2);
      expect(stats.deliveredEvents).toBe(2);
      expect(stats.dedupedEvents).toBe(0);

      streamCore.stop();
    });

    it('should use stable user ID for user events', () => {
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
          channels: ['all']
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      const event1: TwitterEvent = {
        type: 'user_updated',
        timestamp: '2024-01-01T00:00:00.000Z',
        primaryId: 'user123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          username: 'testuser',
          action: 'user_update',
          user: {
            id: 'user123',
            handle: 'testuser',
            profile: {
              name: 'Test User'
            }
          }
        }
      };

      // Same user update but received at different time
      const event2: TwitterEvent = {
        ...event1,
        timestamp: '2024-01-01T00:05:00.000Z'
      };

      // Process both events
      (streamCore as any).handleEvent(event1);
      (streamCore as any).handleEvent(event2);

      // Only one event should be received (same stable user ID)
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
          channels: ['all']
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

  describe('Channel management', () => {
    it('should initialize with correct channels', () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          channels: ['tweets']
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      expect(streamCore.getChannels()).toEqual(['tweets']);
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
          channels: ['all']
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
          channels: ['all']
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
          channels: ['all']
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
    it('should pass user filters to WSSClient when configured', () => {
      const filterPipeline = new FilterPipeline();
      dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          channels: ['all'],
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
          channels: ['all']
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
          channels: ['all'],
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
          channels: ['all']
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
          channels: ['all']
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
          channels: ['all']
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
          channels: ['all']
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
          channels: ['all']
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
          channels: ['all']
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
          channels: ['all']
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
          channels: ['all']
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
          channels: ['all']
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
          channels: ['all']
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


  describe('Runtime Subscription Management', () => {
    it('should return correct runtime subscription state', () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          channels: ['tweets', 'following'],
          userFilters: ['elonmusk', 'vitalikbuterin']
        },
        filterPipeline,
        dedupCache,
        eventBus
      );

      const state = streamCore.getRuntimeSubscriptionState();
      
      expect(state.channels).toEqual(['tweets', 'following']);
      expect(state.users).toEqual(['elonmusk', 'vitalikbuterin']);
      expect(state.mode).toBe('active');
      expect(state.source).toBe('config');
      expect(state.updatedAt).toBeDefined();
      expect(new Date(state.updatedAt).getTime()).toBeLessThanOrEqual(Date.now());

      streamCore.stop();
      dedupCache.clear();
    });

    it('should initialize with idle mode when channels array is empty', () => {
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

      const state = streamCore.getRuntimeSubscriptionState();
      
      expect(state.channels).toEqual([]);
      expect(state.mode).toBe('idle');
      expect(state.source).toBe('config');

      streamCore.stop();
      dedupCache.clear();
    });

    it('should initialize with config source', () => {
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

      const state = streamCore.getRuntimeSubscriptionState();
      expect(state.source).toBe('config');

      streamCore.stop();
      dedupCache.clear();
    });

    it('should reject updateRuntimeSubscription with invalid channels', async () => {
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

      // Mock wssClient to simulate connected state
      const mockWssClient = {
        getConnectionState: jest.fn().mockReturnValue('connected'),
        updateSubscription: jest.fn(),
        disconnect: jest.fn()
      };
      (streamCore as any).wssClient = mockWssClient;

      await expect(
        streamCore.updateRuntimeSubscription({
          channels: ['invalid' as any],
          users: []
        })
      ).rejects.toThrow('Invalid channel: invalid');

      streamCore.stop();
      dedupCache.clear();
    });

    it('should reject updateRuntimeSubscription with invalid users (non-array)', async () => {
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

      // Mock wssClient to simulate connected state
      const mockWssClient = {
        getConnectionState: jest.fn().mockReturnValue('connected'),
        updateSubscription: jest.fn(),
        disconnect: jest.fn()
      };
      (streamCore as any).wssClient = mockWssClient;

      await expect(
        streamCore.updateRuntimeSubscription({
          channels: ['all'],
          users: 'not-an-array' as any
        })
      ).rejects.toThrow('Users must be an array');

      streamCore.stop();
      dedupCache.clear();
    });

    it('should reject updateRuntimeSubscription during disconnection', async () => {
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

      // Mock wssClient to simulate disconnected state
      const mockWssClient = {
        getConnectionState: jest.fn().mockReturnValue('disconnected'),
        updateSubscription: jest.fn(),
        disconnect: jest.fn()
      };
      (streamCore as any).wssClient = mockWssClient;

      await expect(
        streamCore.updateRuntimeSubscription({
          channels: ['tweets'],
          users: []
        })
      ).rejects.toThrow('Cannot update subscription: connection state is disconnected');

      streamCore.stop();
      dedupCache.clear();
    });

    it('should reject concurrent update requests', async () => {
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

      // Mock wssClient to simulate connected state with slow update
      const mockWssClient = {
        getConnectionState: jest.fn().mockReturnValue('connected'),
        updateSubscription: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 100))
        ),
        disconnect: jest.fn()
      };
      (streamCore as any).wssClient = mockWssClient;

      // Start first update
      const firstUpdate = streamCore.updateRuntimeSubscription({
        channels: ['tweets'],
        users: []
      });

      // Try second update immediately (should be rejected)
      await expect(
        streamCore.updateRuntimeSubscription({
          channels: ['following'],
          users: []
        })
      ).rejects.toThrow('Another subscription update is already in progress');

      // Wait for first update to complete
      await firstUpdate;

      streamCore.stop();
      dedupCache.clear();
    });

    it('should transition to idle mode with empty channels', async () => {
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
        channels: [],
        users: []
      });

      expect(newState.channels).toEqual([]);
      expect(newState.mode).toBe('idle');
      expect(newState.source).toBe('runtime');

      streamCore.stop();
      dedupCache.clear();
    });

    it('should update to runtime source after modification', async () => {
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

      // Initial state should be config
      const initialState = streamCore.getRuntimeSubscriptionState();
      expect(initialState.source).toBe('config');

      // Mock wssClient
      const mockWssClient = {
        getConnectionState: jest.fn().mockReturnValue('connected'),
        updateSubscription: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn()
      };
      (streamCore as any).wssClient = mockWssClient;

      const newState = await streamCore.updateRuntimeSubscription({
        channels: ['tweets'],
        users: []
      });

      expect(newState.source).toBe('runtime');

      streamCore.stop();
      dedupCache.clear();
    });

    it('should update runtime subscription with valid payload', async () => {
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
        channels: ['tweets', 'following'],
        users: ['elonmusk', 'vitalikbuterin']
      });

      expect(newState.channels).toEqual(['following', 'tweets']); // Sorted
      expect(newState.users).toEqual(['elonmusk', 'vitalikbuterin']); // Normalized
      expect(newState.mode).toBe('active');
      expect(newState.source).toBe('runtime');
      expect(mockWssClient.updateSubscription).toHaveBeenCalledWith(
        ['following', 'tweets'],
        ['elonmusk', 'vitalikbuterin'],
        10000
      );

      streamCore.stop();
      dedupCache.clear();
    });

    it('should normalize ["all", "tweets"] to ["all"]', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          channels: ['tweets']
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
        channels: ['all', 'tweets'],
        users: []
      });

      // Should normalize to ["all"] only, matching ConfigManager behavior
      expect(newState.channels).toEqual(['all']);
      expect(newState.mode).toBe('active');
      expect(mockWssClient.updateSubscription).toHaveBeenCalledWith(
        ['all'],
        undefined,
        10000
      );

      streamCore.stop();
      dedupCache.clear();
    });

    it('should normalize ["tweets", "all", "following"] to ["all"]', async () => {
      const filterPipeline = new FilterPipeline();
      const dedupCache = new DedupCache();
      const eventBus = new EventBus();

      const streamCore = new StreamCore(
        {
          baseUrl: 'http://localhost:3000',
          token: 'test-token',
          channels: ['tweets']
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
        channels: ['tweets', 'all', 'following'],
        users: []
      });

      // Should normalize to ["all"] only, matching ConfigManager behavior
      expect(newState.channels).toEqual(['all']);
      expect(newState.mode).toBe('active');
      expect(mockWssClient.updateSubscription).toHaveBeenCalledWith(
        ['all'],
        undefined,
        10000
      );

      streamCore.stop();
      dedupCache.clear();
    });
  });
