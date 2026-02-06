import { describe, it, expect, beforeEach } from 'vitest';
import { eventsStore } from '$lib/stores/events.svelte';
import { filtersStore } from '$lib/stores/filters.svelte';
import { searchStore } from '$lib/stores/search.svelte';
import type { TwitterEvent } from '$lib/types';

describe('Event Filtering Flow Integration', () => {
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
            text: 'Bitcoin is the future of money'
          },
          author: {
            handle: 'elonmusk',
            profile: {
              name: 'Elon Musk'
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
            text: 'Ethereum scaling solutions are improving'
          },
          author: {
            handle: 'vitalikbuterin',
            profile: {
              name: 'Vitalik Buterin'
            }
          }
        }
      }
    },
    {
      type: 'follow_created',
      timestamp: new Date().toISOString(),
      primaryId: 'follow-1',
      user: {
        username: 'elonmusk',
        displayName: 'Elon Musk',
        userId: 'user-1'
      },
      data: {
        username: 'elonmusk',
        action: 'followed',
        user: {
          id: 'user-1',
          handle: 'elonmusk',
          profile: {
            name: 'Elon Musk'
          }
        },
        following: {
          id: 'user-3',
          handle: 'satoshi',
          profile: {
            name: 'Satoshi Nakamoto'
          }
        }
      }
    },
    {
      type: 'profile_updated',
      timestamp: new Date().toISOString(),
      primaryId: 'profile-1',
      user: {
        username: 'vitalikbuterin',
        displayName: 'Vitalik Buterin',
        userId: 'user-2'
      },
      data: {
        username: 'vitalikbuterin',
        action: 'updated',
        user: {
          id: 'user-2',
          handle: 'vitalikbuterin',
          profile: {
            name: 'Vitalik Buterin',
            description: {
              text: 'Ethereum co-founder'
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
  
  it('should show all events when no filters are active', () => {
    expect(eventsStore.filteredEvents).toHaveLength(4);
  });
  
  it('should filter events by keyword', () => {
    filtersStore.setKeywords(['bitcoin']);
    
    expect(eventsStore.filteredEvents).toHaveLength(1);
    expect(eventsStore.filteredEvents[0].primaryId).toBe('tweet-1');
  });
  
  it('should filter events by multiple keywords', () => {
    filtersStore.setKeywords(['ethereum', 'scaling']);
    
    // Should match events containing either keyword
    expect(eventsStore.filteredEvents.length).toBeGreaterThan(0);
    const hasEthereum = eventsStore.filteredEvents.some(e => 
      filtersStore['getEventText'](e).toLowerCase().includes('ethereum')
    );
    const hasScaling = eventsStore.filteredEvents.some(e => 
      filtersStore['getEventText'](e).toLowerCase().includes('scaling')
    );
    expect(hasEthereum || hasScaling).toBe(true);
  });
  
  it('should filter events by user', () => {
    filtersStore.toggleUser('elonmusk');
    
    expect(eventsStore.filteredEvents).toHaveLength(2);
    expect(eventsStore.filteredEvents.every(e => e.user.username === 'elonmusk')).toBe(true);
  });
  
  it('should filter events by multiple users', () => {
    filtersStore.toggleUser('elonmusk');
    filtersStore.toggleUser('vitalikbuterin');
    
    expect(eventsStore.filteredEvents).toHaveLength(4);
  });
  
  it('should filter events by event type', () => {
    filtersStore.toggleEventType('post_created');
    
    expect(eventsStore.filteredEvents).toHaveLength(2);
    expect(eventsStore.filteredEvents.every(e => e.type !== 'post_created')).toBe(true);
  });
  
  it('should combine user and keyword filters', () => {
    filtersStore.toggleUser('elonmusk');
    filtersStore.setKeywords(['bitcoin']);
    
    expect(eventsStore.filteredEvents).toHaveLength(1);
    expect(eventsStore.filteredEvents[0].primaryId).toBe('tweet-1');
  });
  
  it('should combine user and event type filters', () => {
    filtersStore.toggleUser('elonmusk');
    filtersStore.toggleEventType('follow_created');
    
    expect(eventsStore.filteredEvents).toHaveLength(1);
    expect(eventsStore.filteredEvents[0].type).toBe('post_created');
  });
  
  it('should combine all filter types', () => {
    filtersStore.toggleUser('vitalikbuterin');
    filtersStore.setKeywords(['ethereum']);
    filtersStore.toggleEventType('profile_updated');
    
    expect(eventsStore.filteredEvents).toHaveLength(1);
    expect(eventsStore.filteredEvents[0].primaryId).toBe('tweet-2');
  });
  
  it('should filter by search query', () => {
    searchStore.setQuery('bitcoin');
    
    expect(eventsStore.filteredEvents).toHaveLength(1);
    expect(eventsStore.filteredEvents[0].primaryId).toBe('tweet-1');
  });
  
  it('should combine search and keyword filters', () => {
    searchStore.setQuery('ethereum');
    filtersStore.setKeywords(['scaling']);
    
    expect(eventsStore.filteredEvents).toHaveLength(1);
    expect(eventsStore.filteredEvents[0].primaryId).toBe('tweet-2');
  });
  
  it('should return empty array when no events match filters', () => {
    filtersStore.setKeywords(['nonexistent']);
    
    expect(eventsStore.filteredEvents).toHaveLength(0);
  });
  
  it('should update filtered events when new event is added', () => {
    filtersStore.toggleUser('elonmusk');
    
    const initialCount = eventsStore.filteredEvents.length;
    
    const newEvent: TwitterEvent = {
      type: 'post_created',
      timestamp: new Date().toISOString(),
      primaryId: 'tweet-3',
      user: {
        username: 'elonmusk',
        displayName: 'Elon Musk',
        userId: 'user-1'
      },
      data: {
        tweetId: 'tweet-3',
        username: 'elonmusk',
        action: 'created',
        tweet: {
          id: 'tweet-3',
          type: 'tweet',
          created_at: new Date().toISOString(),
          body: {
            text: 'New tweet'
          },
          author: {
            handle: 'elonmusk',
            profile: {
              name: 'Elon Musk'
            }
          }
        }
      }
    };
    
    eventsStore.addEvent(newEvent);
    
    expect(eventsStore.filteredEvents).toHaveLength(initialCount + 1);
  });
  
  it('should clear all filters', () => {
    filtersStore.toggleUser('elonmusk');
    filtersStore.setKeywords(['bitcoin']);
    filtersStore.toggleEventType('follow_created');
    
    filtersStore.clearAll();
    
    expect(eventsStore.filteredEvents).toHaveLength(4);
    expect(filtersStore.hasActiveFilters).toBe(false);
  });
  
  it('should handle case-insensitive keyword matching', () => {
    filtersStore.setKeywords(['BITCOIN']);
    
    expect(eventsStore.filteredEvents).toHaveLength(1);
    expect(eventsStore.filteredEvents[0].primaryId).toBe('tweet-1');
  });
  
  it('should handle case-insensitive user matching', () => {
    filtersStore.toggleUser('ELONMUSK');
    
    expect(eventsStore.filteredEvents).toHaveLength(2);
  });
});
