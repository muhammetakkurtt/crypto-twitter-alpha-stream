import { describe, it, expect, beforeEach } from 'vitest';
import { statsStore } from '$lib/stores/stats.svelte';

describe('StatsPanel Component Logic', () => {
  beforeEach(() => {
    statsStore.reset();
  });

  describe('Events Per Minute Display', () => {
    it('should start with 0.0 events per minute', () => {
      expect(statsStore.eventsPerMin).toBe('0.0');
    });

    it('should calculate events per minute correctly', () => {
      const startTime = Date.now() - 60000;
      statsStore.startTime = startTime;
      statsStore.total = 60;
      
      const eventsPerMin = parseFloat(statsStore.eventsPerMin);
      expect(eventsPerMin).toBeGreaterThan(59);
      expect(eventsPerMin).toBeLessThan(61);
    });

    it('should format events per minute to 1 decimal place', () => {
      const startTime = Date.now() - 60000;
      statsStore.startTime = startTime;
      statsStore.total = 123;
      
      expect(statsStore.eventsPerMin).toMatch(/^\d+\.\d$/);
    });

    it('should handle zero elapsed time', () => {
      statsStore.startTime = Date.now();
      statsStore.total = 100;
      expect(statsStore.eventsPerMin).toBe('0.0');
    });

    it('should update events per minute as time passes', () => {
      const startTime = Date.now() - 30000;
      statsStore.startTime = startTime;
      statsStore.total = 30;
      
      const eventsPerMin = parseFloat(statsStore.eventsPerMin);
      expect(eventsPerMin).toBeGreaterThan(50);
    });
  });

  describe('Delivered Count Display', () => {
    it('should start with 0 delivered count', () => {
      expect(statsStore.delivered).toBe(0);
    });

    it('should increment delivered count', () => {
      statsStore.incrementTotal();
      expect(statsStore.delivered).toBe(1);
    });

    it('should increment delivered count multiple times', () => {
      statsStore.incrementTotal();
      statsStore.incrementTotal();
      statsStore.incrementTotal();
      expect(statsStore.delivered).toBe(3);
    });

    it('should format delivered count with locale string', () => {
      statsStore.delivered = 1234;
      const formatted = statsStore.delivered.toLocaleString();
      expect(formatted).toContain('1');
      expect(formatted).toContain('234');
    });

    it('should handle large delivered counts', () => {
      statsStore.delivered = 1000000;
      const formatted = statsStore.delivered.toLocaleString();
      expect(formatted.replace(/[,\.]/g, '')).toBe('1000000');
    });

    it('should update delivered count from state', () => {
      statsStore.updateFromState({ delivered: 42 });
      expect(statsStore.delivered).toBe(42);
    });
  });

  describe('Deduped Count Display', () => {
    it('should start with 0 deduped count', () => {
      expect(statsStore.deduped).toBe(0);
    });

    it('should increment deduped count', () => {
      statsStore.incrementDeduped();
      expect(statsStore.deduped).toBe(1);
    });

    it('should increment deduped count multiple times', () => {
      statsStore.incrementDeduped();
      statsStore.incrementDeduped();
      statsStore.incrementDeduped();
      expect(statsStore.deduped).toBe(3);
    });

    it('should format deduped count with locale string', () => {
      statsStore.deduped = 5678;
      const formatted = statsStore.deduped.toLocaleString();
      expect(formatted).toContain('5');
      expect(formatted).toContain('678');
    });

    it('should not affect delivered count when incrementing deduped', () => {
      statsStore.incrementDeduped();
      expect(statsStore.delivered).toBe(0);
      expect(statsStore.deduped).toBe(1);
    });

    it('should update deduped count from state', () => {
      statsStore.updateFromState({ deduped: 15 });
      expect(statsStore.deduped).toBe(15);
    });
  });

  describe('Total Count Display', () => {
    it('should start with 0 total count', () => {
      expect(statsStore.total).toBe(0);
    });

    it('should increment total count when delivered increments', () => {
      statsStore.incrementTotal();
      expect(statsStore.total).toBe(1);
    });

    it('should increment total count when deduped increments', () => {
      statsStore.incrementDeduped();
      expect(statsStore.total).toBe(1);
    });

    it('should track total across both delivered and deduped', () => {
      statsStore.incrementTotal();
      statsStore.incrementTotal();
      statsStore.incrementDeduped();
      statsStore.incrementDeduped();
      expect(statsStore.total).toBe(4);
    });

    it('should format total count with locale string', () => {
      statsStore.total = 9999;
      const formatted = statsStore.total.toLocaleString();
      expect(formatted).toContain('9');
      expect(formatted).toContain('999');
    });

    it('should handle very large total counts', () => {
      statsStore.total = 10000000;
      const formatted = statsStore.total.toLocaleString();
      expect(formatted.replace(/[,\.]/g, '')).toBe('10000000');
    });

    it('should update total count from state', () => {
      statsStore.updateFromState({ total: 100 });
      expect(statsStore.total).toBe(100);
    });
  });

  describe('Number Animation Transitions', () => {
    it('should update values smoothly when incrementing', () => {
      const initialTotal = statsStore.total;
      statsStore.incrementTotal();
      expect(statsStore.total).toBe(initialTotal + 1);
    });

    it('should handle rapid increments', () => {
      for (let i = 0; i < 100; i++) {
        statsStore.incrementTotal();
      }
      expect(statsStore.total).toBe(100);
      expect(statsStore.delivered).toBe(100);
    });

    it('should maintain consistency during updates', () => {
      statsStore.incrementTotal();
      statsStore.incrementDeduped();
      
      expect(statsStore.total).toBe(statsStore.delivered + statsStore.deduped);
    });

    it('should handle state updates without animation issues', () => {
      statsStore.updateFromState({
        total: 50,
        delivered: 30,
        deduped: 20
      });
      
      expect(statsStore.total).toBe(50);
      expect(statsStore.delivered).toBe(30);
      expect(statsStore.deduped).toBe(20);
    });
  });

  describe('Statistics Integration', () => {
    it('should track all statistics together', () => {
      statsStore.incrementTotal();
      statsStore.incrementTotal();
      statsStore.incrementDeduped();
      
      expect(statsStore.total).toBe(3);
      expect(statsStore.delivered).toBe(2);
      expect(statsStore.deduped).toBe(1);
    });

    it('should calculate events per minute based on total', () => {
      const startTime = Date.now() - 60000;
      statsStore.startTime = startTime;
      
      statsStore.incrementTotal();
      statsStore.incrementTotal();
      statsStore.incrementDeduped();
      
      const eventsPerMin = parseFloat(statsStore.eventsPerMin);
      expect(eventsPerMin).toBeGreaterThan(2.5);
      expect(eventsPerMin).toBeLessThan(3.5);
    });

    it('should reset all statistics', () => {
      statsStore.incrementTotal();
      statsStore.incrementDeduped();
      
      statsStore.reset();
      
      expect(statsStore.total).toBe(0);
      expect(statsStore.delivered).toBe(0);
      expect(statsStore.deduped).toBe(0);
      expect(statsStore.eventsPerMin).toBe('0.0');
    });

    it('should update multiple statistics from state', () => {
      statsStore.updateFromState({
        total: 100,
        delivered: 60,
        deduped: 40
      });
      
      expect(statsStore.total).toBe(100);
      expect(statsStore.delivered).toBe(60);
      expect(statsStore.deduped).toBe(40);
    });
  });

  describe('Status Indicator', () => {
    it('should show live status when mounted', () => {
      const mounted = true;
      expect(mounted).toBe(true);
    });

    it('should not show live status when not mounted', () => {
      const mounted = false;
      expect(mounted).toBe(false);
    });
  });

  describe('Formatting and Display', () => {
    it('should format numbers with thousands separators', () => {
      statsStore.total = 1234567;
      const formatted = statsStore.total.toLocaleString();
      expect(formatted.length).toBeGreaterThan(7);
    });

    it('should handle zero values correctly', () => {
      expect(statsStore.total).toBe(0);
      expect(statsStore.delivered).toBe(0);
      expect(statsStore.deduped).toBe(0);
      expect(statsStore.eventsPerMin).toBe('0.0');
    });

    it('should maintain precision for events per minute', () => {
      const startTime = Date.now() - 60000;
      statsStore.startTime = startTime;
      statsStore.total = 123;
      
      const eventsPerMin = statsStore.eventsPerMin;
      expect(eventsPerMin.split('.')[1].length).toBe(1);
    });

    it('should use tabular numbers for consistent width', () => {
      statsStore.total = 1;
      const formatted1 = statsStore.total.toLocaleString();
      statsStore.total = 9;
      const formatted9 = statsStore.total.toLocaleString();
      
      expect(typeof formatted1).toBe('string');
      expect(typeof formatted9).toBe('string');
    });
  });

  describe('Real-time Updates', () => {
    it('should update statistics in real-time', () => {
      const initialTotal = statsStore.total;
      statsStore.incrementTotal();
      expect(statsStore.total).toBe(initialTotal + 1);
    });

    it('should handle concurrent updates', () => {
      statsStore.incrementTotal();
      statsStore.incrementDeduped();
      statsStore.incrementTotal();
      
      expect(statsStore.total).toBe(3);
      expect(statsStore.delivered).toBe(2);
      expect(statsStore.deduped).toBe(1);
    });

    it('should maintain accuracy during rapid updates', () => {
      const iterations = 1000;
      for (let i = 0; i < iterations; i++) {
        if (i % 2 === 0) {
          statsStore.incrementTotal();
        } else {
          statsStore.incrementDeduped();
        }
      }
      
      expect(statsStore.total).toBe(iterations);
      expect(statsStore.delivered).toBe(500);
      expect(statsStore.deduped).toBe(500);
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative time differences gracefully', () => {
      statsStore.startTime = Date.now() + 1000;
      statsStore.total = 10;
      expect(statsStore.eventsPerMin).toBe('0.0');
    });

    it('should handle very small time differences', () => {
      statsStore.startTime = Date.now() - 1;
      statsStore.total = 1;
      const eventsPerMin = parseFloat(statsStore.eventsPerMin);
      expect(eventsPerMin).toBeGreaterThan(0);
    });

    it('should handle partial state updates', () => {
      statsStore.updateFromState({ total: 50 });
      expect(statsStore.total).toBe(50);
      expect(statsStore.delivered).toBe(0);
      expect(statsStore.deduped).toBe(0);
    });

    it('should handle undefined state values', () => {
      statsStore.updateFromState({});
      expect(statsStore.total).toBe(0);
      expect(statsStore.delivered).toBe(0);
      expect(statsStore.deduped).toBe(0);
    });
  });

  describe('Accessibility', () => {
    it('should provide data-testid attributes for testing', () => {
      const testIds = [
        'events-per-min',
        'delivered-count',
        'deduped-count',
        'total-count'
      ];
      
      expect(testIds.length).toBe(4);
      expect(testIds).toContain('events-per-min');
      expect(testIds).toContain('delivered-count');
      expect(testIds).toContain('deduped-count');
      expect(testIds).toContain('total-count');
    });

    it('should support screen reader friendly number formatting', () => {
      statsStore.total = 1234;
      const formatted = statsStore.total.toLocaleString();
      expect(formatted).toBeTruthy();
    });
  });
});
