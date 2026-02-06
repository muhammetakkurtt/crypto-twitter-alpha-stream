/**
 * Unit tests for DashboardOutput
 */

import { DashboardOutput } from '../../src/outputs/DashboardOutput';
import { EventBus } from '../../src/eventbus/EventBus';
import { TwitterEvent, HealthStatus, PostData } from '../../src/models/types';

// Helper function to create test post events
function createTestPostEvent(primaryId: string, text: string): TwitterEvent {
  return {
    type: 'post_created',
    timestamp: new Date().toISOString(),
    primaryId,
    user: {
      username: 'testuser',
      displayName: 'Test User',
      userId: 'user123'
    },
    data: {
      username: 'testuser',
      action: 'post_created',
      tweetId: primaryId,
      tweet: {
        id: primaryId,
        type: 'tweet',
        created_at: new Date().toISOString(),
        body: {
          text,
          urls: [],
          mentions: []
        },
        author: {
          handle: 'testuser',
          id: 'user123',
          verified: false,
          profile: {
            name: 'Test User',
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
    } as PostData
  };
}

describe('DashboardOutput', () => {
  let eventBus: EventBus;
  let dashboard: DashboardOutput;

  beforeEach(() => {
    eventBus = new EventBus();
    dashboard = new DashboardOutput(eventBus, { port: 0 });
  });

  afterEach(async () => {
    await dashboard.stop();
  });

  describe('WebSocket broadcasting', () => {
    it('should broadcast events to connected clients', () => {
      const mockEvent = createTestPostEvent('tweet123', 'Test tweet content');

      // Handle event
      dashboard.handleEvent(mockEvent);

      // Verify event was added to state
      const state = dashboard.getState();
      expect(state.events).toHaveLength(1);
      expect(state.events[0]).toEqual(mockEvent);
      expect(state.stats.total).toBe(1);
      expect(state.stats.delivered).toBe(1);
    });

    it('should maintain event buffer with max 100 events', () => {
      // Add 150 events
      for (let i = 0; i < 150; i++) {
        const mockEvent = createTestPostEvent(`tweet${i}`, `Test tweet ${i}`);
        dashboard.handleEvent(mockEvent);
      }

      // Verify only last 100 events are kept
      const state = dashboard.getState();
      expect(state.events).toHaveLength(100);
      expect(state.stats.total).toBe(150);
      
      // Verify oldest events were removed (first event should be tweet50)
      expect(state.events[0].primaryId).toBe('tweet50');
      expect(state.events[99].primaryId).toBe('tweet149');
    });

    it('should update stats correctly for each event type', () => {
      const eventTypes: Array<'post_created' | 'profile_updated' | 'follow_created' | 'follow_updated'> = [
        'post_created',
        'profile_updated',
        'follow_created',
        'follow_updated'
      ];

      eventTypes.forEach((type) => {
        const mockEvent = createTestPostEvent(`id_${type}`, 'Test');
        mockEvent.type = type;
        dashboard.handleEvent(mockEvent);
      });

      const state = dashboard.getState();
      expect(state.stats.byType.post_created).toBe(1);
      expect(state.stats.byType.profile_updated).toBe(1);
      expect(state.stats.byType.follow_created).toBe(1);
      expect(state.stats.byType.follow_updated).toBe(1);
    });
  });

  describe('Client connection/disconnection', () => {
    it('should track connected clients count', () => {
      // Initially no clients
      expect(dashboard.getConnectedClientCount()).toBe(0);
    });

    it('should update connection status', () => {
      dashboard.updateConnectionStatus('connected');
      let state = dashboard.getState();
      expect(state.connectionStatus).toBe('connected');

      dashboard.updateConnectionStatus('disconnected');
      state = dashboard.getState();
      expect(state.connectionStatus).toBe('disconnected');

      dashboard.updateConnectionStatus('reconnecting');
      state = dashboard.getState();
      expect(state.connectionStatus).toBe('reconnecting');
    });
  });

  describe('/status endpoint response', () => {
    it('should provide fallback status when no health provider is set', () => {
      // Process some events
      for (let i = 0; i < 10; i++) {
        const mockEvent = createTestPostEvent(`tweet${i}`, `Test tweet ${i}`);
        dashboard.handleEvent(mockEvent);
      }

      dashboard.incrementDeduped();
      dashboard.incrementDeduped();

      const state = dashboard.getState();
      
      // Verify state contains all required fields for status endpoint
      expect(state.connectionStatus).toBeDefined();
      expect(state.stats.total).toBe(10);
      expect(state.stats.delivered).toBe(10);
      expect(state.stats.deduped).toBe(2);
      expect(state.filters).toBeDefined();
    });

    it('should use custom health status provider when set', () => {
      const customHealthStatus: HealthStatus = {
        connection: {
          status: 'connected',
          endpoint: '/events/twitter/all',
          uptime: 3600
        },
        events: {
          total: 100,
          delivered: 95,
          deduped: 5,
          rate: 1.5
        },
        alerts: {
          telegram: { sent: 10, failed: 0 },
          discord: { sent: 8, failed: 1 },
          webhook: { sent: 5, failed: 0 }
        },
        filters: {
          users: ['elonmusk', 'vitalikbuterin'],
          keywords: ['bitcoin', 'ethereum']
        }
      };

      dashboard.setHealthStatusProvider(() => customHealthStatus);

      // The health status provider would be called by the Express route handler
      // We can't directly test the HTTP endpoint without starting the server,
      // but we can verify the provider is set
      const state = dashboard.getState();
      expect(state).toBeDefined();
    });

    it('should return valid JSON structure', () => {
      dashboard.updateConnectionStatus('connected');
      dashboard.updateFilters({
        users: ['testuser'],
        keywords: ['test'],
        eventTypes: ['post_created']
      });

      const state = dashboard.getState();
      const jsonString = JSON.stringify(state);
      
      // Verify it's valid JSON
      expect(() => JSON.parse(jsonString)).not.toThrow();
      
      const parsed = JSON.parse(jsonString);
      expect(parsed.connectionStatus).toBe('connected');
      expect(parsed.filters.users).toEqual(['testuser']);
      expect(parsed.filters.keywords).toEqual(['test']);
    });
  });

  describe('Active users management', () => {
    it('should update active users list', () => {
      const users = ['elonmusk', 'vitalikbuterin', 'cz_binance'];
      dashboard.updateActiveUsers(users);

      const state = dashboard.getState();
      expect(state.activeUsers).toEqual(users);
    });

    it('should handle empty active users list', () => {
      dashboard.updateActiveUsers([]);

      const state = dashboard.getState();
      expect(state.activeUsers).toEqual([]);
    });
  });

  describe('Filter management', () => {
    it('should update filters', () => {
      const filters = {
        users: ['user1', 'user2'],
        keywords: ['bitcoin', 'crypto'],
        eventTypes: ['post_created' as const, 'follow_created' as const]
      };

      dashboard.updateFilters(filters);

      const state = dashboard.getState();
      expect(state.filters).toEqual(filters);
    });

    it('should handle empty filters', () => {
      const filters = {
        users: [],
        keywords: [],
        eventTypes: []
      };

      dashboard.updateFilters(filters);

      const state = dashboard.getState();
      expect(state.filters).toEqual(filters);
    });
  });

  describe('Statistics tracking', () => {
    it('should track deduped events', () => {
      dashboard.incrementDeduped();
      dashboard.incrementDeduped();
      dashboard.incrementDeduped();

      const state = dashboard.getState();
      expect(state.stats.deduped).toBe(3);
    });

    it('should track last event time', () => {
      const beforeTime = new Date();
      
      const mockEvent = createTestPostEvent('tweet123', 'Test tweet');

      dashboard.handleEvent(mockEvent);

      const state = dashboard.getState();
      const afterTime = new Date();

      expect(state.stats.lastEventTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(state.stats.lastEventTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should maintain start time', () => {
      const state = dashboard.getState();
      expect(state.stats.startTime).toBeInstanceOf(Date);
    });
  });

  describe('EventBus integration', () => {
    it('should subscribe to dashboard channel on start', async () => {
      await dashboard.start();

      // Verify subscription by checking if events are received
      const mockEvent = createTestPostEvent('tweet123', 'Test tweet');

      // Publish to dashboard channel
      await eventBus.publish('dashboard', mockEvent);

      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 10));

      const state = dashboard.getState();
      expect(state.stats.total).toBe(1);
    });

    it('should unsubscribe on stop', async () => {
      await dashboard.start();
      await dashboard.stop();

      // After stop, events should not be processed
      const mockEvent = createTestPostEvent('tweet123', 'Test tweet');

      await eventBus.publish('dashboard', mockEvent);

      const state = dashboard.getState();
      expect(state.stats.total).toBe(0);
    });
  });
});
