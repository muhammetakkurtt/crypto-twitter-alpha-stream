import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { filtersStore } from './filters.svelte';
import type { TwitterEvent, EventType } from '$lib/types';

describe('FilterStore', () => {
  const createMockEvent = (
    type: EventType,
    username: string,
    text?: string
  ): TwitterEvent => ({
    type,
    timestamp: new Date().toISOString(),
    primaryId: `${type}-${username}-${Date.now()}`,
    user: {
      username,
      displayName: `${username} Display`,
      userId: `user-${username}`,
    },
    data: {
      tweetId: '123',
      username,
      action: 'created',
      tweet: text ? {
        id: '123',
        type: 'tweet',
        created_at: new Date().toISOString(),
        body: {
          text,
          mentions: [],
        },
        author: {
          handle: username,
          profile: {
            name: `${username} Display`,
          },
        },
      } : undefined,
    } as any,
  });

  beforeEach(() => {
    localStorage.clear();
    filtersStore.clearAll();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('toggleUser', () => {
    it('should add user to filter list', () => {
      filtersStore.toggleUser('elonmusk');
      
      expect(filtersStore.users).toContain('elonmusk');
      expect(filtersStore.users).toHaveLength(1);
    });

    it('should remove user from filter list if already present', () => {
      filtersStore.toggleUser('elonmusk');
      filtersStore.toggleUser('elonmusk');
      
      expect(filtersStore.users).not.toContain('elonmusk');
      expect(filtersStore.users).toHaveLength(0);
    });

    it('should handle multiple users', () => {
      filtersStore.toggleUser('elonmusk');
      filtersStore.toggleUser('vitalikbuterin');
      filtersStore.toggleUser('cz_binance');
      
      expect(filtersStore.users).toHaveLength(3);
      expect(filtersStore.users).toContain('elonmusk');
      expect(filtersStore.users).toContain('vitalikbuterin');
      expect(filtersStore.users).toContain('cz_binance');
    });

    it('should persist to localStorage', () => {
      filtersStore.toggleUser('elonmusk');
      
      const stored = localStorage.getItem('crypto-twitter-filters');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.users).toContain('elonmusk');
    });
  });

  describe('setKeywords', () => {
    it('should set keywords array', () => {
      filtersStore.setKeywords(['bitcoin', 'ethereum']);
      
      expect(filtersStore.keywords).toEqual(['bitcoin', 'ethereum']);
    });

    it('should replace existing keywords', () => {
      filtersStore.setKeywords(['bitcoin']);
      filtersStore.setKeywords(['ethereum', 'solana']);
      
      expect(filtersStore.keywords).toEqual(['ethereum', 'solana']);
      expect(filtersStore.keywords).not.toContain('bitcoin');
    });

    it('should handle empty array', () => {
      filtersStore.setKeywords(['bitcoin']);
      filtersStore.setKeywords([]);
      
      expect(filtersStore.keywords).toEqual([]);
    });

    it('should persist to localStorage', () => {
      filtersStore.setKeywords(['bitcoin', 'ethereum']);
      
      const stored = localStorage.getItem('crypto-twitter-filters');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.keywords).toEqual(['bitcoin', 'ethereum']);
    });
  });

  describe('toggleEventType', () => {
    it('should remove event type from filter list', () => {
      const initialLength = filtersStore.eventTypes.length;
      
      filtersStore.toggleEventType('post_created');
      
      expect(filtersStore.eventTypes).not.toContain('post_created');
      expect(filtersStore.eventTypes).toHaveLength(initialLength - 1);
    });

    it('should add event type back to filter list', () => {
      filtersStore.toggleEventType('post_created');
      filtersStore.toggleEventType('post_created');
      
      expect(filtersStore.eventTypes).toContain('post_created');
    });

    it('should handle multiple event types', () => {
      filtersStore.toggleEventType('post_created');
      filtersStore.toggleEventType('follow_created');
      
      expect(filtersStore.eventTypes).not.toContain('post_created');
      expect(filtersStore.eventTypes).not.toContain('follow_created');
    });

    it('should persist to localStorage', () => {
      filtersStore.toggleEventType('post_created');
      
      const stored = localStorage.getItem('crypto-twitter-filters');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.eventTypes).not.toContain('post_created');
    });
  });

  describe('shouldDisplayEvent', () => {
    it('should return true for events matching all criteria', () => {
      const event = createMockEvent('post_created', 'elonmusk', 'Hello Bitcoin');
      
      expect(filtersStore.shouldDisplayEvent(event)).toBe(true);
    });

    it('should filter by event type', () => {
      filtersStore.toggleEventType('post_created');
      
      const event = createMockEvent('post_created', 'elonmusk');
      
      expect(filtersStore.shouldDisplayEvent(event)).toBe(false);
    });

    it('should filter by keyword', () => {
      filtersStore.setKeywords(['bitcoin']);
      
      const event1 = createMockEvent('post_created', 'elonmusk', 'Hello Bitcoin');
      const event2 = createMockEvent('post_created', 'elonmusk', 'Hello Ethereum');
      
      expect(filtersStore.shouldDisplayEvent(event1)).toBe(true);
      expect(filtersStore.shouldDisplayEvent(event2)).toBe(false);
    });

    it('should filter by keyword case-insensitively', () => {
      filtersStore.setKeywords(['BITCOIN']);
      
      const event = createMockEvent('post_created', 'elonmusk', 'Hello bitcoin');
      
      expect(filtersStore.shouldDisplayEvent(event)).toBe(true);
    });

    it('should filter by user', () => {
      filtersStore.toggleUser('elonmusk');
      
      const event1 = createMockEvent('post_created', 'elonmusk');
      const event2 = createMockEvent('post_created', 'vitalikbuterin');
      
      expect(filtersStore.shouldDisplayEvent(event1)).toBe(true);
      expect(filtersStore.shouldDisplayEvent(event2)).toBe(false);
    });

    it('should filter by user case-insensitively', () => {
      filtersStore.toggleUser('ElonMusk');
      
      const event = createMockEvent('post_created', 'elonmusk');
      
      expect(filtersStore.shouldDisplayEvent(event)).toBe(true);
    });

    it('should apply AND logic for multiple filters', () => {
      filtersStore.setKeywords(['bitcoin']);
      filtersStore.toggleUser('elonmusk');
      
      const event1 = createMockEvent('post_created', 'elonmusk', 'Hello Bitcoin');
      const event2 = createMockEvent('post_created', 'elonmusk', 'Hello Ethereum');
      const event3 = createMockEvent('post_created', 'vitalikbuterin', 'Hello Bitcoin');
      
      expect(filtersStore.shouldDisplayEvent(event1)).toBe(true);
      expect(filtersStore.shouldDisplayEvent(event2)).toBe(false);
      expect(filtersStore.shouldDisplayEvent(event3)).toBe(false);
    });

    it('should match any keyword in array', () => {
      filtersStore.setKeywords(['bitcoin', 'ethereum']);
      
      const event1 = createMockEvent('post_created', 'elonmusk', 'Hello Bitcoin');
      const event2 = createMockEvent('post_created', 'elonmusk', 'Hello Ethereum');
      const event3 = createMockEvent('post_created', 'elonmusk', 'Hello Solana');
      
      expect(filtersStore.shouldDisplayEvent(event1)).toBe(true);
      expect(filtersStore.shouldDisplayEvent(event2)).toBe(true);
      expect(filtersStore.shouldDisplayEvent(event3)).toBe(false);
    });

    it('should search in username and display name', () => {
      filtersStore.setKeywords(['elon']);
      
      const event = createMockEvent('post_created', 'elonmusk', 'Hello world');
      
      expect(filtersStore.shouldDisplayEvent(event)).toBe(true);
    });

    it('should filter profile_updated events by profile data', () => {
      filtersStore.setKeywords(['crypto']);
      
      const event: TwitterEvent = {
        type: 'profile_updated',
        timestamp: new Date().toISOString(),
        primaryId: 'profile-123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user-123',
        },
        data: {
          user: {
            handle: 'testuser',
            profile: {
              name: 'Test User',
              description: {
                text: 'I love crypto and blockchain',
              },
            },
          },
        } as any,
      };
      
      expect(filtersStore.shouldDisplayEvent(event)).toBe(true);
    });

    it('should filter follow_created events by following data', () => {
      filtersStore.setKeywords(['vitalik']);
      
      const event: TwitterEvent = {
        type: 'follow_created',
        timestamp: new Date().toISOString(),
        primaryId: 'follow-123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user-123',
        },
        data: {
          user: {
            handle: 'testuser',
            profile: {
              name: 'Test User',
            },
          },
          following: {
            handle: 'vitalikbuterin',
            profile: {
              name: 'Vitalik Buterin',
            },
          },
        } as any,
      };
      
      expect(filtersStore.shouldDisplayEvent(event)).toBe(true);
    });

    it('should filter user_updated events by profile data', () => {
      filtersStore.setKeywords(['ethereum']);
      
      const event: TwitterEvent = {
        type: 'user_updated',
        timestamp: new Date().toISOString(),
        primaryId: 'user-123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user-123',
        },
        data: {
          user: {
            handle: 'testuser',
            profile: {
              name: 'Ethereum Developer',
              description: {
                text: 'Building on Ethereum',
              },
            },
          },
        } as any,
      };
      
      expect(filtersStore.shouldDisplayEvent(event)).toBe(true);
    });

    it('should filter profile_pinned events by profile data', () => {
      filtersStore.setKeywords(['bitcoin']);
      
      const event: TwitterEvent = {
        type: 'profile_pinned',
        timestamp: new Date().toISOString(),
        primaryId: 'pinned-123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user-123',
        },
        data: {
          user: {
            handle: 'testuser',
            profile: {
              name: 'Bitcoin Enthusiast',
            },
          },
        } as any,
      };
      
      expect(filtersStore.shouldDisplayEvent(event)).toBe(true);
    });

    it('should filter follow_updated events by following handle', () => {
      filtersStore.setKeywords(['cz_binance']);
      
      const event: TwitterEvent = {
        type: 'follow_updated',
        timestamp: new Date().toISOString(),
        primaryId: 'follow-456',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user-123',
        },
        data: {
          user: {
            handle: 'testuser',
            profile: {
              name: 'Test User',
            },
          },
          following: {
            handle: 'cz_binance',
            profile: {
              name: 'CZ',
            },
          },
        } as any,
      };
      
      expect(filtersStore.shouldDisplayEvent(event)).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should clear all filters', () => {
      filtersStore.setKeywords(['bitcoin']);
      filtersStore.toggleUser('elonmusk');
      filtersStore.toggleEventType('post_created');
      
      filtersStore.clearAll();
      
      expect(filtersStore.keywords).toEqual([]);
      expect(filtersStore.users).toEqual([]);
      expect(filtersStore.eventTypes).toHaveLength(7);
    });

    it('should reset event types to all types', () => {
      filtersStore.toggleEventType('post_created');
      filtersStore.toggleEventType('follow_created');
      
      filtersStore.clearAll();
      
      expect(filtersStore.eventTypes).toContain('post_created');
      expect(filtersStore.eventTypes).toContain('follow_created');
      expect(filtersStore.eventTypes).toContain('profile_updated');
    });

    it('should persist cleared state to localStorage', () => {
      filtersStore.setKeywords(['bitcoin']);
      filtersStore.toggleUser('elonmusk');
      
      filtersStore.clearAll();
      
      const stored = localStorage.getItem('crypto-twitter-filters');
      expect(stored).toBeTruthy();
      
      const parsed = JSON.parse(stored!);
      expect(parsed.keywords).toEqual([]);
      expect(parsed.users).toEqual([]);
    });
  });

  describe('hasActiveFilters', () => {
    it('should return false when no filters are active', () => {
      expect(filtersStore.hasActiveFilters).toBe(false);
    });

    it('should return true when keywords are set', () => {
      filtersStore.setKeywords(['bitcoin']);
      
      expect(filtersStore.hasActiveFilters).toBe(true);
    });

    it('should return true when users are filtered', () => {
      filtersStore.toggleUser('elonmusk');
      
      expect(filtersStore.hasActiveFilters).toBe(true);
    });

    it('should return true when event types are filtered', () => {
      filtersStore.toggleEventType('post_created');
      
      expect(filtersStore.hasActiveFilters).toBe(true);
    });

    it('should return false after clearing all filters', () => {
      filtersStore.setKeywords(['bitcoin']);
      filtersStore.toggleUser('elonmusk');
      
      filtersStore.clearAll();
      
      expect(filtersStore.hasActiveFilters).toBe(false);
    });
  });

  describe('localStorage persistence', () => {
    it('should load filters from localStorage on initialization', () => {
      const state = {
        keywords: ['bitcoin'],
        eventTypes: ['post_created', 'follow_created'] as EventType[],
        users: ['elonmusk'],
      };
      
      localStorage.setItem('crypto-twitter-filters', JSON.stringify(state));
      
      const newStore = new (filtersStore.constructor as any)();
      
      expect(newStore.keywords).toEqual(['bitcoin']);
      expect(newStore.users).toEqual(['elonmusk']);
      expect(newStore.eventTypes).toEqual(['post_created', 'follow_created']);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('crypto-twitter-filters', 'invalid json');
      
      const newStore = new (filtersStore.constructor as any)();
      
      expect(newStore.keywords).toEqual([]);
      expect(newStore.users).toEqual([]);
      expect(newStore.eventTypes).toHaveLength(7);
    });

    it('should handle missing localStorage data', () => {
      const newStore = new (filtersStore.constructor as any)();
      
      expect(newStore.keywords).toEqual([]);
      expect(newStore.users).toEqual([]);
      expect(newStore.eventTypes).toHaveLength(7);
    });
  });
});
