/**
 * Unit tests for EventBus
 */

import { EventBus } from '../../src/eventbus/EventBus';
import { TwitterEvent } from '../../src/models/types';

describe('EventBus - Unit Tests', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.clear();
  });

  const createMockEvent = (): TwitterEvent => ({
    type: 'post_created',
    timestamp: new Date().toISOString(),
    primaryId: 'tweet123',
    user: {
      username: 'testuser',
      displayName: 'Test User',
      userId: 'user123',
    },
    data: {
      tweetId: 'tweet123',
      username: 'testuser',
      action: 'post_created',
      tweet: {
        id: 'tweet123',
        type: 'tweet',
        created_at: new Date().toISOString(),
        body: {
          text: 'Test tweet'
        },
        author: {
          handle: 'testuser',
          id: 'user123'
        }
      }
    },
  });

  describe('Subscription Management', () => {
    it('should subscribe a handler and return a subscription ID', () => {
      const handler = jest.fn();
      const subId = eventBus.subscribe('cli', handler);

      expect(subId).toBeDefined();
      expect(typeof subId).toBe('string');
      expect(subId).toMatch(/^sub_\d+$/);
    });

    it('should allow multiple subscriptions to the same channel', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventBus.subscribe('cli', handler1);
      eventBus.subscribe('cli', handler2);
      eventBus.subscribe('cli', handler3);

      expect(eventBus.getSubscriberCount('cli')).toBe(3);
    });

    it('should allow subscriptions to different channels', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventBus.subscribe('cli', handler1);
      eventBus.subscribe('dashboard', handler2);
      eventBus.subscribe('alerts', handler3);

      expect(eventBus.getSubscriberCount('cli')).toBe(1);
      expect(eventBus.getSubscriberCount('dashboard')).toBe(1);
      expect(eventBus.getSubscriberCount('alerts')).toBe(1);
      expect(eventBus.getChannels()).toEqual(['cli', 'dashboard', 'alerts']);
    });

    it('should unsubscribe a handler by subscription ID', async () => {
      const handler = jest.fn();
      const subId = eventBus.subscribe('cli', handler);

      expect(eventBus.getSubscriberCount('cli')).toBe(1);

      eventBus.unsubscribe(subId);

      expect(eventBus.getSubscriberCount('cli')).toBe(0);

      // Verify handler is not called after unsubscribe
      await eventBus.publish('cli', createMockEvent());
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle unsubscribe of non-existent subscription ID gracefully', () => {
      expect(() => {
        eventBus.unsubscribe('non-existent-id');
      }).not.toThrow();
    });

    it('should remove channel when last subscriber unsubscribes', () => {
      const handler = jest.fn();
      const subId = eventBus.subscribe('cli', handler);

      expect(eventBus.getChannels()).toContain('cli');

      eventBus.unsubscribe(subId);

      expect(eventBus.getChannels()).not.toContain('cli');
    });

    it('should clear all subscriptions', () => {
      eventBus.subscribe('cli', jest.fn());
      eventBus.subscribe('dashboard', jest.fn());
      eventBus.subscribe('alerts', jest.fn());

      expect(eventBus.getChannels().length).toBe(3);

      eventBus.clear();

      expect(eventBus.getChannels().length).toBe(0);
    });
  });

  describe('Event Publishing', () => {
    it('should publish events to all subscribers on a channel', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      eventBus.subscribe('cli', handler1);
      eventBus.subscribe('cli', handler2);
      eventBus.subscribe('cli', handler3);

      const event = createMockEvent();
      await eventBus.publish('cli', event);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledWith(event);
      expect(handler3).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledWith(event);
    });

    it('should not publish to subscribers on different channels', async () => {
      const cliHandler = jest.fn();
      const dashboardHandler = jest.fn();
      const alertsHandler = jest.fn();

      eventBus.subscribe('cli', cliHandler);
      eventBus.subscribe('dashboard', dashboardHandler);
      eventBus.subscribe('alerts', alertsHandler);

      const event = createMockEvent();
      await eventBus.publish('cli', event);

      expect(cliHandler).toHaveBeenCalledTimes(1);
      expect(dashboardHandler).not.toHaveBeenCalled();
      expect(alertsHandler).not.toHaveBeenCalled();
    });

    it('should handle publishing to a channel with no subscribers', async () => {
      const event = createMockEvent();

      await expect(eventBus.publish('cli', event)).resolves.not.toThrow();
    });

    it('should support async handlers', async () => {
      const results: string[] = [];
      const asyncHandler = async (event: TwitterEvent) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        results.push(event.primaryId);
      };

      eventBus.subscribe('cli', asyncHandler);

      const event = createMockEvent();
      await eventBus.publish('cli', event);

      expect(results).toEqual(['tweet123']);
    });

    it('should support sync handlers', async () => {
      const results: string[] = [];
      const syncHandler = (event: TwitterEvent) => {
        results.push(event.primaryId);
      };

      eventBus.subscribe('cli', syncHandler);

      const event = createMockEvent();
      await eventBus.publish('cli', event);

      expect(results).toEqual(['tweet123']);
    });
  });

  describe('Handler Error Isolation', () => {
    it('should isolate errors from one handler and continue with others', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn(() => {
        throw new Error('Handler 2 failed');
      });
      const handler3 = jest.fn();

      // Suppress console.error for this test
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      eventBus.subscribe('cli', handler1);
      eventBus.subscribe('cli', handler2);
      eventBus.subscribe('cli', handler3);

      const event = createMockEvent();
      await eventBus.publish('cli', event);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should isolate async handler errors', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        throw new Error('Async handler failed');
      });
      const handler3 = jest.fn();

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      eventBus.subscribe('cli', handler1);
      eventBus.subscribe('cli', handler2);
      eventBus.subscribe('cli', handler3);

      const event = createMockEvent();
      await eventBus.publish('cli', event);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should log errors with handler ID and channel information', async () => {
      const failingHandler = jest.fn(() => {
        throw new Error('Test error');
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      eventBus.subscribe('cli', failingHandler);

      const event = createMockEvent();
      await eventBus.publish('cli', event);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in handler'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Multiple Subscribers Per Channel', () => {
    it('should support many subscribers on a single channel', async () => {
      const handlers = Array.from({ length: 10 }, () => jest.fn());

      handlers.forEach(handler => {
        eventBus.subscribe('cli', handler);
      });

      expect(eventBus.getSubscriberCount('cli')).toBe(10);

      const event = createMockEvent();
      await eventBus.publish('cli', event);

      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(event);
      });
    });

    it('should maintain independent subscriber lists per channel', async () => {
      const cliHandlers = [jest.fn(), jest.fn()];
      const dashboardHandlers = [jest.fn(), jest.fn(), jest.fn()];
      const alertsHandlers = [jest.fn()];

      cliHandlers.forEach(h => eventBus.subscribe('cli', h));
      dashboardHandlers.forEach(h => eventBus.subscribe('dashboard', h));
      alertsHandlers.forEach(h => eventBus.subscribe('alerts', h));

      const event = createMockEvent();
      await eventBus.publish('dashboard', event);

      cliHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
      dashboardHandlers.forEach(h => expect(h).toHaveBeenCalledTimes(1));
      alertsHandlers.forEach(h => expect(h).not.toHaveBeenCalled());
    });
  });

  describe('Utility Methods', () => {
    it('should return correct subscriber count for a channel', () => {
      expect(eventBus.getSubscriberCount('cli')).toBe(0);

      eventBus.subscribe('cli', jest.fn());
      expect(eventBus.getSubscriberCount('cli')).toBe(1);

      eventBus.subscribe('cli', jest.fn());
      expect(eventBus.getSubscriberCount('cli')).toBe(2);
    });

    it('should return 0 for non-existent channel', () => {
      expect(eventBus.getSubscriberCount('non-existent')).toBe(0);
    });

    it('should return all active channels', () => {
      eventBus.subscribe('cli', jest.fn());
      eventBus.subscribe('dashboard', jest.fn());

      const channels = eventBus.getChannels();
      expect(channels).toHaveLength(2);
      expect(channels).toContain('cli');
      expect(channels).toContain('dashboard');
    });

    it('should return empty array when no channels exist', () => {
      expect(eventBus.getChannels()).toEqual([]);
    });
  });
});
