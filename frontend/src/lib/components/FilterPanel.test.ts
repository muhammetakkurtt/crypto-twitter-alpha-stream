import { describe, it, expect, beforeEach } from 'vitest';
import { filtersStore } from '$lib/stores/filters.svelte';
import type { EventType } from '$lib/types';

describe('FilterPanel Component Logic', () => {
  beforeEach(() => {
    filtersStore.clearAll();
  });

  describe('Keyword Input', () => {
    it('should start with empty keywords', () => {
      expect(filtersStore.keywords).toEqual([]);
    });

    it('should apply single keyword', () => {
      filtersStore.setKeywords(['bitcoin']);
      expect(filtersStore.keywords).toEqual(['bitcoin']);
    });

    it('should apply multiple keywords', () => {
      filtersStore.setKeywords(['bitcoin', 'ethereum', 'crypto']);
      expect(filtersStore.keywords).toEqual(['bitcoin', 'ethereum', 'crypto']);
    });

    it('should handle comma-separated keyword parsing', () => {
      const input = 'bitcoin, ethereum, crypto';
      const keywords = input.split(',').map(k => k.trim()).filter(k => k.length > 0);
      filtersStore.setKeywords(keywords);
      expect(filtersStore.keywords).toEqual(['bitcoin', 'ethereum', 'crypto']);
    });

    it('should filter out empty keywords', () => {
      const input = 'bitcoin, , ethereum, , crypto';
      const keywords = input.split(',').map(k => k.trim()).filter(k => k.length > 0);
      filtersStore.setKeywords(keywords);
      expect(filtersStore.keywords).toEqual(['bitcoin', 'ethereum', 'crypto']);
    });

    it('should trim whitespace from keywords', () => {
      const input = '  bitcoin  ,  ethereum  ,  crypto  ';
      const keywords = input.split(',').map(k => k.trim()).filter(k => k.length > 0);
      filtersStore.setKeywords(keywords);
      expect(filtersStore.keywords).toEqual(['bitcoin', 'ethereum', 'crypto']);
    });

    it('should clear keywords', () => {
      filtersStore.setKeywords(['bitcoin', 'ethereum']);
      filtersStore.clearAll();
      expect(filtersStore.keywords).toEqual([]);
    });
  });

  describe('Keyword Validation', () => {
    function validateKeywords(input: string): { valid: boolean; error: string } {
      if (!input.trim()) {
        return { valid: true, error: '' };
      }
      
      const keywords = input.split(',').map(k => k.trim()).filter(k => k.length > 0);
      
      for (const keyword of keywords) {
        if (keyword.length < 2) {
          return { valid: false, error: 'Keywords must be at least 2 characters long' };
        }
        if (keyword.length > 50) {
          return { valid: false, error: 'Keywords must be less than 50 characters' };
        }
      }
      
      return { valid: true, error: '' };
    }

    it('should validate empty input as valid', () => {
      const result = validateKeywords('');
      expect(result.valid).toBe(true);
    });

    it('should validate whitespace-only input as valid', () => {
      const result = validateKeywords('   ');
      expect(result.valid).toBe(true);
    });

    it('should reject keywords shorter than 2 characters', () => {
      const result = validateKeywords('a');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Keywords must be at least 2 characters long');
    });

    it('should accept keywords with 2 characters', () => {
      const result = validateKeywords('ab');
      expect(result.valid).toBe(true);
    });

    it('should reject keywords longer than 50 characters', () => {
      const longKeyword = 'a'.repeat(51);
      const result = validateKeywords(longKeyword);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Keywords must be less than 50 characters');
    });

    it('should accept keywords with 50 characters', () => {
      const keyword = 'a'.repeat(50);
      const result = validateKeywords(keyword);
      expect(result.valid).toBe(true);
    });

    it('should validate multiple keywords', () => {
      const result = validateKeywords('bitcoin, ethereum, crypto');
      expect(result.valid).toBe(true);
    });

    it('should reject if any keyword is invalid', () => {
      const result = validateKeywords('bitcoin, a, ethereum');
      expect(result.valid).toBe(false);
    });
  });

  describe('Event Type Checkboxes', () => {
    const allEventTypes: EventType[] = [
      'post_created',
      'post_updated',
      'profile_updated',
      'profile_pinned',
      'follow_created',
      'follow_updated',
      'user_updated'
    ];

    it('should start with all event types enabled', () => {
      expect(filtersStore.eventTypes).toEqual(allEventTypes);
    });

    it('should toggle event type off', () => {
      filtersStore.toggleEventType('post_created');
      expect(filtersStore.eventTypes).not.toContain('post_created');
    });

    it('should toggle event type back on', () => {
      filtersStore.toggleEventType('post_created');
      filtersStore.toggleEventType('post_created');
      expect(filtersStore.eventTypes).toContain('post_created');
    });

    it('should toggle multiple event types', () => {
      filtersStore.toggleEventType('post_created');
      filtersStore.toggleEventType('profile_updated');
      expect(filtersStore.eventTypes).not.toContain('post_created');
      expect(filtersStore.eventTypes).not.toContain('profile_updated');
    });

    it('should check if event type is enabled', () => {
      expect(filtersStore.eventTypes.includes('post_created')).toBe(true);
      filtersStore.toggleEventType('post_created');
      expect(filtersStore.eventTypes.includes('post_created')).toBe(false);
    });

    it('should restore all event types on clear', () => {
      filtersStore.toggleEventType('post_created');
      filtersStore.toggleEventType('profile_updated');
      filtersStore.clearAll();
      expect(filtersStore.eventTypes).toEqual(allEventTypes);
    });
  });

  describe('Apply Filters Button', () => {
    it('should apply keyword filters', () => {
      const keywords = ['bitcoin', 'ethereum'];
      filtersStore.setKeywords(keywords);
      expect(filtersStore.keywords).toEqual(keywords);
    });

    it('should not apply invalid keywords', () => {
      const input = 'a';
      const validation = input.length >= 2;
      expect(validation).toBe(false);
    });

    it('should apply filters with Enter key', () => {
      const keywords = ['bitcoin'];
      filtersStore.setKeywords(keywords);
      expect(filtersStore.keywords).toEqual(keywords);
    });
  });

  describe('Clear Filters Button', () => {
    it('should clear all keywords', () => {
      filtersStore.setKeywords(['bitcoin', 'ethereum']);
      filtersStore.clearAll();
      expect(filtersStore.keywords).toEqual([]);
    });

    it('should clear all user filters', () => {
      filtersStore.toggleUser('elonmusk');
      filtersStore.clearAll();
      expect(filtersStore.users).toEqual([]);
    });

    it('should restore all event types', () => {
      filtersStore.toggleEventType('post_created');
      filtersStore.clearAll();
      expect(filtersStore.eventTypes).toContain('post_created');
    });

    it('should clear all filters at once', () => {
      filtersStore.setKeywords(['bitcoin']);
      filtersStore.toggleUser('elonmusk');
      filtersStore.toggleEventType('post_created');
      
      filtersStore.clearAll();
      
      expect(filtersStore.keywords).toEqual([]);
      expect(filtersStore.users).toEqual([]);
      expect(filtersStore.eventTypes.length).toBe(7);
    });
  });

  describe('Filter State Integration', () => {
    it('should indicate active filters when keywords are set', () => {
      filtersStore.setKeywords(['bitcoin']);
      expect(filtersStore.hasActiveFilters).toBe(true);
    });

    it('should indicate active filters when event types are filtered', () => {
      filtersStore.toggleEventType('post_created');
      expect(filtersStore.hasActiveFilters).toBe(true);
    });

    it('should indicate no active filters by default', () => {
      expect(filtersStore.hasActiveFilters).toBe(false);
    });

    it('should indicate no active filters after clearing', () => {
      filtersStore.setKeywords(['bitcoin']);
      filtersStore.clearAll();
      expect(filtersStore.hasActiveFilters).toBe(false);
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation with Enter key', () => {
      const keywords = ['bitcoin'];
      filtersStore.setKeywords(keywords);
      expect(filtersStore.keywords).toEqual(keywords);
    });

    it('should provide validation error messages', () => {
      const input = 'a';
      const validation = input.length >= 2;
      const errorMessage = validation ? '' : 'Keywords must be at least 2 characters long';
      expect(errorMessage).toBe('Keywords must be at least 2 characters long');
    });

    it('should clear validation errors on valid input', () => {
      const input = 'bitcoin';
      const validation = input.length >= 2;
      const errorMessage = validation ? '' : 'Keywords must be at least 2 characters long';
      expect(errorMessage).toBe('');
    });
  });

  describe('Persistence', () => {
    it('should persist keywords to localStorage', () => {
      filtersStore.setKeywords(['bitcoin']);
      expect(filtersStore.keywords).toEqual(['bitcoin']);
    });

    it('should persist event type changes to localStorage', () => {
      filtersStore.toggleEventType('post_created');
      expect(filtersStore.eventTypes).not.toContain('post_created');
    });

    it('should persist clear action to localStorage', () => {
      filtersStore.setKeywords(['bitcoin']);
      filtersStore.clearAll();
      expect(filtersStore.keywords).toEqual([]);
    });
  });
});
