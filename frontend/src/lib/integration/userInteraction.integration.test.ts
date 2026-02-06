import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventsStore } from '$lib/stores/events.svelte';
import { filtersStore } from '$lib/stores/filters.svelte';
import { searchStore } from '$lib/stores/search.svelte';
import type { TwitterEvent } from '$lib/types';

describe('User Interaction Flow Integration', () => {
  const mockEvents: TwitterEvent[] = [
    {
      type: 'post_created',
      timestamp: new Date().toISOString(),
      primaryId: 'tweet-1',
      user: {
        username: 'elonmusk',
        displayName: 'Elon Musk',
        userId: 'user-1'
      },
      data: {
        tweetId: 'tweet-1',
        username: 'elonmusk',
        action: 'created',
        tweet: {
          id: 'tweet-1',
          type: 'tweet',
          created_at: new Date().toISOString(),
          body: {
            text: 'Test tweet from Elon'
          },
          author: {
            handle: 'elonmusk',
            profile: {
              name: 'Elon Musk',
              avatar: 'https://example.com/avatar1.jpg'
            }
          }
        }
      }
    },
    {
      type: 'post_created',
      timestamp: new Date().toISOString(),
      primaryId: 'tweet-2',
      user: {
        username: 'vitalikbuterin',
        displayName: 'Vitalik Buterin',
        userId: 'user-2'
      },
      data: {
        tweetId: 'tweet-2',
        username: 'vitalikbuterin',
        action: 'created',
        tweet: {
          id: 'tweet-2',
          type: 'tweet',
          created_at: new Date().toISOString(),
          body: {
            text: 'Test tweet from Vitalik'
          },
          author: {
            handle: 'vitalikbuterin',
            profile: {
              name: 'Vitalik Buterin',
              avatar: 'https://example.com/avatar2.jpg'
            }
          }
        }
      }
    }
  ];
  
  beforeEach(() => {
    eventsStore.clear();
    filtersStore.clearAll();
    searchStore.setQuery('');
    
    mockEvents.forEach(event => eventsStore.addEvent(event));
  });
  
  it('should filter events when user toggles username', () => {
    filtersStore.toggleUser('elonmusk');
    
    expect(filtersStore.users).toContain('elonmusk');
    expect(eventsStore.filteredEvents).toHaveLength(1);
    expect(eventsStore.filteredEvents[0].user.username).toBe('elonmusk');
  });
  
  it('should toggle user filter when toggling same user twice', () => {
    filtersStore.toggleUser('elonmusk');
    expect(filtersStore.users).toContain('elonmusk');
    
    filtersStore.toggleUser('elonmusk');
    expect(filtersStore.users).not.toContain('elonmusk');
    expect(eventsStore.filteredEvents).toHaveLength(2);
  });
  
  it('should filter users by search query', () => {
    const users = ['elonmusk', 'vitalikbuterin', 'satoshi'];
    const searchQuery = 'elon';
    
    const filteredUsers = users.filter(u => 
      u.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    expect(filteredUsers).toContain('elonmusk');
    expect(filteredUsers).not.toContain('vitalikbuterin');
  });
  
  it('should apply keyword filter', () => {
    filtersStore.setKeywords(['Elon']);
    
    expect(filtersStore.keywords).toContain('Elon');
    expect(eventsStore.filteredEvents).toHaveLength(1);
  });
  
  it('should toggle event type filter', () => {
    filtersStore.toggleEventType('post_created');
    
    expect(filtersStore.eventTypes).not.toContain('post_created');
    expect(eventsStore.filteredEvents).toHaveLength(0);
    
    filtersStore.toggleEventType('post_created');
    expect(filtersStore.eventTypes).toContain('post_created');
  });
  
  it('should clear all filters', () => {
    filtersStore.toggleUser('elonmusk');
    filtersStore.setKeywords(['test']);
    
    filtersStore.clearAll();
    
    expect(filtersStore.users).toHaveLength(0);
    expect(filtersStore.keywords).toHaveLength(0);
    expect(eventsStore.filteredEvents).toHaveLength(2);
  });
  
  it('should display filtered events', () => {
    filtersStore.toggleUser('elonmusk');
    
    const filtered = eventsStore.filteredEvents;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].user.username).toBe('elonmusk');
  });
  
  it('should show empty result when no events match filters', () => {
    filtersStore.setKeywords(['nonexistent']);
    
    expect(eventsStore.filteredEvents).toHaveLength(0);
  });
  
  it('should update filtered events when filters change', () => {
    let eventCount = eventsStore.filteredEvents.length;
    expect(eventCount).toBe(2);
    
    filtersStore.toggleUser('elonmusk');
    
    eventCount = eventsStore.filteredEvents.length;
    expect(eventCount).toBe(1);
  });
  
  it('should persist filter state to localStorage', () => {
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true
    });
    
    filtersStore.toggleUser('elonmusk');
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'crypto-twitter-filters',
      expect.stringContaining('elonmusk')
    );
  });
  
  it('should handle multiple user selections', () => {
    filtersStore.toggleUser('elonmusk');
    filtersStore.toggleUser('vitalikbuterin');
    
    expect(filtersStore.users).toHaveLength(2);
    expect(eventsStore.filteredEvents).toHaveLength(2);
  });
  
  it('should handle keyword input with multiple words', () => {
    filtersStore.setKeywords(['test', 'tweet']);
    
    expect(filtersStore.keywords.length).toBeGreaterThan(0);
  });
  
  it('should update when new event arrives', () => {
    const initialCount = eventsStore.filteredEvents.length;
    
    const newEvent: TwitterEvent = {
      type: 'post_created',
      timestamp: new Date().toISOString(),
      primaryId: 'tweet-3',
      user: {
        username: 'satoshi',
        displayName: 'Satoshi Nakamoto',
        userId: 'user-3'
      },
      data: {
        tweetId: 'tweet-3',
        username: 'satoshi',
        action: 'created',
        tweet: {
          id: 'tweet-3',
          type: 'tweet',
          created_at: new Date().toISOString(),
          body: {
            text: 'New tweet'
          },
          author: {
            handle: 'satoshi',
            profile: {
              name: 'Satoshi Nakamoto'
            }
          }
        }
      }
    };
    
    eventsStore.addEvent(newEvent);
    
    expect(eventsStore.filteredEvents.length).toBe(initialCount + 1);
  });
});
