import { describe, it, expect, beforeEach, vi } from 'vitest';
import { statsStore } from './stats.svelte';

describe('StatsStore', () => {
  beforeEach(() => {
    statsStore.reset();
  });

  describe('incrementTotal', () => {
    it('should increment total and delivered counters', () => {
      expect(statsStore.total).toBe(0);
      expect(statsStore.delivered).toBe(0);
      
      statsStore.incrementTotal();
      
      expect(statsStore.total).toBe(1);
      expect(statsStore.delivered).toBe(1);
    });

    it('should increment multiple times', () => {
      statsStore.incrementTotal();
      statsStore.incrementTotal();
      statsStore.incrementTotal();
      
      expect(statsStore.total).toBe(3);
      expect(statsStore.delivered).toBe(3);
    });
  });

  describe('incrementDeduped', () => {
    it('should increment total and deduped counters', () => {
      expect(statsStore.total).toBe(0);
      expect(statsStore.deduped).toBe(0);
      
      statsStore.incrementDeduped();
      
      expect(statsStore.total).toBe(1);
      expect(statsStore.deduped).toBe(1);
    });

    it('should not affect delivered counter', () => {
      statsStore.incrementDeduped();
      
      expect(statsStore.delivered).toBe(0);
      expect(statsStore.deduped).toBe(1);
    });
  });

  describe('eventsPerMin', () => {
    it('should return 0.0 initially', () => {
      expect(statsStore.eventsPerMin).toBe('0.0');
    });

    it('should calculate events per minute correctly', () => {
      // Set a fixed start time
      const startTime = 1000000;
      statsStore.startTime = startTime;
      
      // Add 3 events
      statsStore.total = 3;
      
      // Mock Date.now to return 1 minute later
      const mockNow = vi.spyOn(Date, 'now').mockReturnValue(startTime + 60000);
      
      expect(statsStore.eventsPerMin).toBe('3.0');
      
      mockNow.mockRestore();
    });

    it('should handle fractional minutes', () => {
      // Set a fixed start time
      const startTime = 1000000;
      statsStore.startTime = startTime;
      
      // Add 2 events
      statsStore.total = 2;
      
      // Mock Date.now to return 30 seconds later (0.5 minutes)
      const mockNow = vi.spyOn(Date, 'now').mockReturnValue(startTime + 30000);
      
      expect(statsStore.eventsPerMin).toBe('4.0');
      
      mockNow.mockRestore();
    });
  });

  describe('updateFromState', () => {
    it('should update total from state', () => {
      statsStore.updateFromState({ total: 10 });
      expect(statsStore.total).toBe(10);
    });

    it('should update delivered from state', () => {
      statsStore.updateFromState({ delivered: 5 });
      expect(statsStore.delivered).toBe(5);
    });

    it('should update deduped from state', () => {
      statsStore.updateFromState({ deduped: 3 });
      expect(statsStore.deduped).toBe(3);
    });

    it('should update all stats from state', () => {
      statsStore.updateFromState({ total: 10, delivered: 7, deduped: 3 });
      
      expect(statsStore.total).toBe(10);
      expect(statsStore.delivered).toBe(7);
      expect(statsStore.deduped).toBe(3);
    });

    it('should handle partial updates', () => {
      statsStore.incrementTotal();
      statsStore.updateFromState({ total: 5 });
      
      expect(statsStore.total).toBe(5);
      expect(statsStore.delivered).toBe(1);
    });
  });

  describe('reset', () => {
    it('should reset all counters to zero', () => {
      statsStore.incrementTotal();
      statsStore.incrementDeduped();
      
      statsStore.reset();
      
      expect(statsStore.total).toBe(0);
      expect(statsStore.delivered).toBe(0);
      expect(statsStore.deduped).toBe(0);
    });

    it('should reset start time', () => {
      const initialStartTime = statsStore.startTime;
      
      vi.spyOn(Date, 'now').mockReturnValue(initialStartTime + 60000);
      statsStore.reset();
      
      expect(statsStore.startTime).toBe(initialStartTime + 60000);
      
      vi.restoreAllMocks();
    });
  });

  describe('mixed operations', () => {
    it('should track delivered and deduped separately', () => {
      statsStore.incrementTotal();
      statsStore.incrementTotal();
      statsStore.incrementDeduped();
      
      expect(statsStore.total).toBe(3);
      expect(statsStore.delivered).toBe(2);
      expect(statsStore.deduped).toBe(1);
    });
  });
});
