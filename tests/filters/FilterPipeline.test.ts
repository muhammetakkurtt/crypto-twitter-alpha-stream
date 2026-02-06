/**
 * Unit tests for FilterPipeline edge cases
 */

import { FilterPipeline } from '../../src/filters/FilterPipeline';
import { UserFilter, KeywordFilter, EventTypeFilter } from '../../src/filters/EventFilter';
import { TwitterEvent } from '../../src/models/types';

describe('FilterPipeline Unit Tests', () => {
  const createTestEvent = (username: string, text: string): TwitterEvent => ({
    type: 'post_created',
    timestamp: new Date().toISOString(),
    primaryId: 'test-id',
    user: {
      username,
      displayName: 'Test User',
      userId: 'user-123',
    },
    data: {
      username,
      action: 'post_created',
      tweetId: 'tweet-123',
      tweet: {
        id: 'tweet-123',
        type: 'tweet',
        created_at: new Date().toISOString(),
        body: {
          text,
          urls: [],
          mentions: []
        },
        author: {
          handle: username,
          id: 'user-123',
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
    },
  });

  describe('Empty filter lists (allow all)', () => {
    it('should allow all events when no filters are added', () => {
      const pipeline = new FilterPipeline();
      const event = createTestEvent('testuser', 'Hello world');
      
      expect(pipeline.apply(event)).toBe(true);
    });

    it('should allow all events when user filter is empty', () => {
      const pipeline = new FilterPipeline();
      pipeline.addFilter(new UserFilter([]));
      const event = createTestEvent('anyuser', 'Hello world');
      
      expect(pipeline.apply(event)).toBe(true);
    });

    it('should allow all events when keyword filter is empty', () => {
      const pipeline = new FilterPipeline();
      pipeline.addFilter(new KeywordFilter([]));
      const event = createTestEvent('testuser', 'Any text here');
      
      expect(pipeline.apply(event)).toBe(true);
    });

    it('should allow all events when event type filter is empty', () => {
      const pipeline = new FilterPipeline();
      pipeline.addFilter(new EventTypeFilter([]));
      const event = createTestEvent('testuser', 'Hello world');
      
      expect(pipeline.apply(event)).toBe(true);
    });
  });

  describe('Filter with no matches', () => {
    it('should reject events when username does not match', () => {
      const pipeline = new FilterPipeline();
      pipeline.addFilter(new UserFilter(['alice', 'bob']));
      const event = createTestEvent('charlie', 'Hello world');
      
      expect(pipeline.apply(event)).toBe(false);
    });

    it('should reject events when no keywords match', () => {
      const pipeline = new FilterPipeline();
      pipeline.addFilter(new KeywordFilter(['bitcoin', 'crypto']));
      const event = createTestEvent('testuser', 'Hello world');
      
      expect(pipeline.apply(event)).toBe(false);
    });

    it('should reject events when event type does not match', () => {
      const pipeline = new FilterPipeline();
      pipeline.addFilter(new EventTypeFilter(['profile_updated', 'follow_created']));
      const event = createTestEvent('testuser', 'Hello world');
      
      expect(pipeline.apply(event)).toBe(false);
    });

    it('should reject when one filter passes but another fails', () => {
      const pipeline = new FilterPipeline();
      pipeline.addFilter(new UserFilter(['testuser'])); // Will pass
      pipeline.addFilter(new KeywordFilter(['bitcoin'])); // Will fail
      const event = createTestEvent('testuser', 'Hello world');
      
      expect(pipeline.apply(event)).toBe(false);
    });
  });

  describe('Filter removal', () => {
    it('should remove filter by ID', () => {
      const pipeline = new FilterPipeline();
      const userFilter = new UserFilter(['alice'], 'user-filter-1');
      pipeline.addFilter(userFilter);
      
      expect(pipeline.size()).toBe(1);
      
      pipeline.removeFilter('user-filter-1');
      
      expect(pipeline.size()).toBe(0);
    });

    it('should allow events after removing restrictive filter', () => {
      const pipeline = new FilterPipeline();
      const userFilter = new UserFilter(['alice'], 'user-filter-1');
      pipeline.addFilter(userFilter);
      
      const event = createTestEvent('bob', 'Hello world');
      expect(pipeline.apply(event)).toBe(false);
      
      pipeline.removeFilter('user-filter-1');
      expect(pipeline.apply(event)).toBe(true);
    });

    it('should handle removing non-existent filter gracefully', () => {
      const pipeline = new FilterPipeline();
      pipeline.addFilter(new UserFilter(['alice'], 'user-filter-1'));
      
      expect(() => {
        pipeline.removeFilter('non-existent-filter');
      }).not.toThrow();
      
      expect(pipeline.size()).toBe(1);
    });

    it('should replace filter when adding with same ID', () => {
      const pipeline = new FilterPipeline();
      pipeline.addFilter(new UserFilter(['alice'], 'user-filter'));
      pipeline.addFilter(new UserFilter(['bob'], 'user-filter'));
      
      expect(pipeline.size()).toBe(1);
      
      const event1 = createTestEvent('alice', 'Hello');
      const event2 = createTestEvent('bob', 'Hello');
      
      expect(pipeline.apply(event1)).toBe(false);
      expect(pipeline.apply(event2)).toBe(true);
    });
  });

  describe('Pipeline management', () => {
    it('should clear all filters', () => {
      const pipeline = new FilterPipeline();
      pipeline.addFilter(new UserFilter(['alice']));
      pipeline.addFilter(new KeywordFilter(['bitcoin']));
      
      expect(pipeline.size()).toBe(2);
      
      pipeline.clear();
      
      expect(pipeline.size()).toBe(0);
    });

    it('should return all filter IDs', () => {
      const pipeline = new FilterPipeline();
      pipeline.addFilter(new UserFilter(['alice'], 'user-filter'));
      pipeline.addFilter(new KeywordFilter(['bitcoin'], false, 'keyword-filter'));
      
      const ids = pipeline.getFilterIds();
      
      expect(ids).toContain('user-filter');
      expect(ids).toContain('keyword-filter');
      expect(ids.length).toBe(2);
    });
  });
});
