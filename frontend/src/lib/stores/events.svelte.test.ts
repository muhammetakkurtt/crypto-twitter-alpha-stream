import { describe, it, expect, beforeEach } from 'vitest';
import { eventsStore } from './events.svelte';
import type { TwitterEvent } from '$lib/types';

describe('EventStore', () => {
  const createMockEvent = (id: string, type: string = 'post_created'): TwitterEvent => ({
    type: type as any,
    timestamp: new Date().toISOString(),
    primaryId: id,
    user: {
      username: 'testuser',
      displayName: 'Test User',
      userId: 'user123',
    },
    data: {
      tweetId: id,
      username: 'testuser',
      action: 'created',
    } as any,
  });

  beforeEach(() => {
    eventsStore.clear();
  });

  describe('addEvent', () => {
    it('should add a new event to the store', () => {
      const event = createMockEvent('123');
      eventsStore.addEvent(event);
      
      expect(eventsStore.events).toHaveLength(1);
      expect(eventsStore.events[0]).toEqual(event);
    });

    it('should add event to eventMap with primaryId', () => {
      const event = createMockEvent('123');
      eventsStore.addEvent(event);
      
      expect(eventsStore.eventMap.has('123')).toBe(true);
      expect(eventsStore.eventMap.get('123')).toEqual(event);
    });

    it('should add events in reverse chronological order (newest first)', () => {
      const event1 = createMockEvent('1');
      const event2 = createMockEvent('2');
      
      eventsStore.addEvent(event1);
      eventsStore.addEvent(event2);
      
      expect(eventsStore.events[0]).toEqual(event2);
      expect(eventsStore.events[1]).toEqual(event1);
    });

    it('should deduplicate events by primaryId', () => {
      const event1 = createMockEvent('123');
      const event2 = { ...createMockEvent('123'), timestamp: 'updated' };
      
      eventsStore.addEvent(event1);
      eventsStore.addEvent(event2);
      
      expect(eventsStore.events).toHaveLength(1);
      expect(eventsStore.events[0].timestamp).toBe('updated');
    });

    it('should limit events to 100 items', () => {
      for (let i = 0; i < 150; i++) {
        eventsStore.addEvent(createMockEvent(`event-${i}`));
      }
      
      expect(eventsStore.events).toHaveLength(100);
    });

    it('should keep newest 100 events when limit is exceeded', () => {
      for (let i = 0; i < 150; i++) {
        eventsStore.addEvent(createMockEvent(`event-${i}`));
      }
      
      expect(eventsStore.events[0].primaryId).toBe('event-149');
      expect(eventsStore.events[99].primaryId).toBe('event-50');
    });
  });

  describe('updateEvent', () => {
    it('should update an existing event', () => {
      const event1 = createMockEvent('123');
      const event2 = { ...createMockEvent('123'), timestamp: 'updated' };
      
      eventsStore.addEvent(event1);
      eventsStore.updateEvent(event2);
      
      expect(eventsStore.events).toHaveLength(1);
      expect(eventsStore.events[0].timestamp).toBe('updated');
    });

    it('should update event in eventMap', () => {
      const event1 = createMockEvent('123');
      const event2 = { ...createMockEvent('123'), timestamp: 'updated' };
      
      eventsStore.addEvent(event1);
      eventsStore.updateEvent(event2);
      
      expect(eventsStore.eventMap.get('123')?.timestamp).toBe('updated');
    });

    it('should not add new event if primaryId does not exist', () => {
      const event = createMockEvent('123');
      
      eventsStore.updateEvent(event);
      
      expect(eventsStore.events).toHaveLength(0);
    });

    it('should maintain event position when updating', () => {
      const event1 = createMockEvent('1');
      const event2 = createMockEvent('2');
      const event3 = createMockEvent('3');
      
      eventsStore.addEvent(event1);
      eventsStore.addEvent(event2);
      eventsStore.addEvent(event3);
      
      const updatedEvent2 = { ...event2, timestamp: 'updated' };
      eventsStore.updateEvent(updatedEvent2);
      
      expect(eventsStore.events[0].primaryId).toBe('3');
      expect(eventsStore.events[1].primaryId).toBe('2');
      expect(eventsStore.events[1].timestamp).toBe('updated');
      expect(eventsStore.events[2].primaryId).toBe('1');
    });
  });

  describe('clear', () => {
    it('should clear all events', () => {
      eventsStore.addEvent(createMockEvent('1'));
      eventsStore.addEvent(createMockEvent('2'));
      
      eventsStore.clear();
      
      expect(eventsStore.events).toHaveLength(0);
    });

    it('should clear eventMap', () => {
      eventsStore.addEvent(createMockEvent('1'));
      eventsStore.addEvent(createMockEvent('2'));
      
      eventsStore.clear();
      
      expect(eventsStore.eventMap.size).toBe(0);
    });
  });

  describe('filteredEvents', () => {
    it('should return all events by default', () => {
      const event1 = createMockEvent('1');
      const event2 = createMockEvent('2');
      
      eventsStore.addEvent(event1);
      eventsStore.addEvent(event2);
      
      expect(eventsStore.filteredEvents).toHaveLength(2);
      expect(eventsStore.filteredEvents).toEqual(eventsStore.events);
    });

    it('should be reactive to events changes', () => {
      expect(eventsStore.filteredEvents).toHaveLength(0);
      
      eventsStore.addEvent(createMockEvent('1'));
      expect(eventsStore.filteredEvents).toHaveLength(1);
      
      eventsStore.addEvent(createMockEvent('2'));
      expect(eventsStore.filteredEvents).toHaveLength(2);
      
      eventsStore.clear();
      expect(eventsStore.filteredEvents).toHaveLength(0);
    });
  });
});
