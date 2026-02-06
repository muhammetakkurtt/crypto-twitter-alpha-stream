import { describe, it, expect, beforeEach } from 'vitest';
import { shouldNotifyForEvent, getEventNotificationMessage, notifyForImportantEvent } from './eventNotifications';
import { toastStore } from '$lib/stores/toast.svelte';
import type { TwitterEvent } from '$lib/types';

describe('Event Notifications', () => {
  beforeEach(() => {
    toastStore.clear();
  });

  describe('shouldNotifyForEvent', () => {
    it('should notify for follow_created events', () => {
      const event: TwitterEvent = {
        type: 'follow_created',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User 1', userId: 'uid-1' },
        data: { username: 'user1', action: 'created' }
      };
      expect(shouldNotifyForEvent(event)).toBe(true);
    });

    it('should notify for profile_updated events', () => {
      const event: TwitterEvent = {
        type: 'profile_updated',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User 1', userId: 'uid-1' },
        data: { username: 'user1', action: 'updated' }
      };
      expect(shouldNotifyForEvent(event)).toBe(true);
    });

    it('should notify for profile_pinned events', () => {
      const event: TwitterEvent = {
        type: 'profile_pinned',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User 1', userId: 'uid-1' },
        data: { username: 'user1', action: 'pinned' }
      };
      expect(shouldNotifyForEvent(event)).toBe(true);
    });

    it('should notify for popular tweets (high likes)', () => {
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User 1', userId: 'uid-1' },
        data: {
          tweetId: 'tweet-1',
          username: 'user1',
          action: 'created',
          tweet: {
            id: 'tweet-1',
            type: 'tweet',
            created_at: new Date().toISOString(),
            body: { text: 'Popular tweet' },
            author: { handle: 'user1' },
            metrics: { likes: 150, retweets: 20 }
          }
        }
      };
      expect(shouldNotifyForEvent(event)).toBe(true);
    });

    it('should notify for popular tweets (high retweets)', () => {
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User 1', userId: 'uid-1' },
        data: {
          tweetId: 'tweet-1',
          username: 'user1',
          action: 'created',
          tweet: {
            id: 'tweet-1',
            type: 'tweet',
            created_at: new Date().toISOString(),
            body: { text: 'Popular tweet' },
            author: { handle: 'user1' },
            metrics: { likes: 50, retweets: 60 }
          }
        }
      };
      expect(shouldNotifyForEvent(event)).toBe(true);
    });

    it('should not notify for regular tweets', () => {
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User 1', userId: 'uid-1' },
        data: {
          tweetId: 'tweet-1',
          username: 'user1',
          action: 'created',
          tweet: {
            id: 'tweet-1',
            type: 'tweet',
            created_at: new Date().toISOString(),
            body: { text: 'Regular tweet' },
            author: { handle: 'user1' },
            metrics: { likes: 10, retweets: 5 }
          }
        }
      };
      expect(shouldNotifyForEvent(event)).toBe(false);
    });

    it('should not notify for post_updated events', () => {
      const event: TwitterEvent = {
        type: 'post_updated',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User 1', userId: 'uid-1' },
        data: { tweetId: 'tweet-1', username: 'user1', action: 'updated' }
      };
      expect(shouldNotifyForEvent(event)).toBe(false);
    });
  });

  describe('getEventNotificationMessage', () => {
    it('should generate message for follow_created', () => {
      const event: TwitterEvent = {
        type: 'follow_created',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User One', userId: 'uid-1' },
        data: {
          username: 'user1',
          action: 'created',
          following: {
            id: 'uid-2',
            handle: 'user2',
            profile: { name: 'User Two' }
          }
        }
      };
      const message = getEventNotificationMessage(event);
      expect(message).toBe('User One followed User Two');
    });

    it('should generate message for profile_updated', () => {
      const event: TwitterEvent = {
        type: 'profile_updated',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User One', userId: 'uid-1' },
        data: { username: 'user1', action: 'updated' }
      };
      const message = getEventNotificationMessage(event);
      expect(message).toBe('User One updated their profile');
    });

    it('should generate message for profile_pinned', () => {
      const event: TwitterEvent = {
        type: 'profile_pinned',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User One', userId: 'uid-1' },
        data: { username: 'user1', action: 'pinned' }
      };
      const message = getEventNotificationMessage(event);
      expect(message).toBe('User One pinned a new tweet');
    });

    it('should generate message for popular tweet', () => {
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User One', userId: 'uid-1' },
        data: {
          tweetId: 'tweet-1',
          username: 'user1',
          action: 'created',
          tweet: {
            id: 'tweet-1',
            type: 'tweet',
            created_at: new Date().toISOString(),
            body: { text: 'Popular tweet' },
            author: { handle: 'user1' },
            metrics: { likes: 150, retweets: 60 }
          }
        }
      };
      const message = getEventNotificationMessage(event);
      expect(message).toBe('User One posted a popular tweet (150 likes, 60 retweets)');
    });
  });

  describe('notifyForImportantEvent', () => {
    it('should create toast for important events', () => {
      const event: TwitterEvent = {
        type: 'follow_created',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User One', userId: 'uid-1' },
        data: {
          username: 'user1',
          action: 'created',
          following: {
            id: 'uid-2',
            handle: 'user2',
            profile: { name: 'User Two' }
          }
        }
      };
      
      notifyForImportantEvent(event);
      
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].type).toBe('info');
      expect(toastStore.toasts[0].message).toBe('User One followed User Two');
    });

    it('should not create toast for unimportant events', () => {
      const event: TwitterEvent = {
        type: 'post_updated',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: { username: 'user1', displayName: 'User One', userId: 'uid-1' },
        data: { tweetId: 'tweet-1', username: 'user1', action: 'updated' }
      };
      
      notifyForImportantEvent(event);
      
      expect(toastStore.toasts).toHaveLength(0);
    });
  });
});
