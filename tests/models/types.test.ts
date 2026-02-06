/**
 * Unit tests for type guards
 */

import {
  isPostData,
  isProfileData,
  isFollowingData,
  isValidEventType,
  isTwitterEvent,
  isRawEvent,
  PostData,
  ProfileData,
  FollowingData,
  TwitterEvent,
  RawEvent
} from '../../src/models/types';

describe('Type Guards', () => {
  describe('isValidEventType', () => {
    it('should return true for valid event types', () => {
      expect(isValidEventType('post_created')).toBe(true);
      expect(isValidEventType('post_updated')).toBe(true);
      expect(isValidEventType('follow_created')).toBe(true);
      expect(isValidEventType('follow_updated')).toBe(true);
      expect(isValidEventType('user_updated')).toBe(true);
      expect(isValidEventType('profile_updated')).toBe(true);
      expect(isValidEventType('profile_pinned')).toBe(true);
    });

    it('should return false for invalid event types', () => {
      expect(isValidEventType('invalid')).toBe(false);
      expect(isValidEventType('')).toBe(false);
      expect(isValidEventType(null)).toBe(false);
      expect(isValidEventType(undefined)).toBe(false);
      expect(isValidEventType(123)).toBe(false);
    });
  });

  describe('isPostData', () => {
    it('should return true for valid PostData with complete structure', () => {
      const validPostData: PostData = {
        tweetId: '123',
        username: 'elonmusk',
        action: 'post_created',
        tweet: {
          id: '123',
          type: 'tweet',
          created_at: '2024-01-15T14:30:22Z',
          body: {
            text: 'Hello world'
          },
          author: {
            handle: 'elonmusk'
          }
        }
      };
      expect(isPostData(validPostData)).toBe(true);
    });

    it('should return true for PostData with minimal structure', () => {
      const minimalPostData: PostData = {
        tweetId: '123',
        username: 'elonmusk',
        action: 'post_created'
      };
      expect(isPostData(minimalPostData)).toBe(true);
    });

    it('should return true for PostData with nested optional fields', () => {
      const postDataWithMetrics: PostData = {
        tweetId: '123',
        username: 'elonmusk',
        action: 'post_created',
        tweet: {
          id: '123',
          type: 'tweet',
          created_at: '2024-01-15T14:30:22Z',
          body: {
            text: 'Hello world',
            urls: [{ name: 'example', url: 'https://example.com', tco: 'https://t.co/abc' }],
            mentions: ['vitalikbuterin']
          },
          author: {
            handle: 'elonmusk',
            id: 'user123',
            verified: true,
            profile: {
              name: 'Elon Musk',
              avatar: 'https://example.com/avatar.jpg',
              bio: 'CEO of Tesla'
            }
          },
          metrics: {
            likes: 10,
            retweets: 5,
            replies: 2,
            views: 1000
          },
          media: {
            images: ['https://example.com/image.jpg'],
            videos: ['https://example.com/video.mp4']
          }
        }
      };
      expect(isPostData(postDataWithMetrics)).toBe(true);
    });

    it('should return false for invalid PostData', () => {
      expect(isPostData(null)).toBe(false);
      expect(isPostData(undefined)).toBe(false);
      expect(isPostData({})).toBe(false);
      expect(isPostData({ tweetId: '123' })).toBe(false);
      expect(isPostData({ tweetId: '123', username: 'test' })).toBe(false);
      expect(isPostData({ tweetId: 123, username: 'test', action: 'post_created' })).toBe(false);
      expect(isPostData({ username: 'test', action: 'post_created' })).toBe(false);
    });
  });

  describe('isProfileData', () => {
    it('should return true for valid ProfileData with user object', () => {
      const validProfileData: ProfileData = {
        username: 'elonmusk',
        action: 'user_updated',
        user: {
          id: 'user123',
          handle: 'elonmusk',
          profile: {
            name: 'Elon Musk',
            description: {
              text: 'CEO of Tesla'
            }
          }
        }
      };
      expect(isProfileData(validProfileData)).toBe(true);
    });

    it('should return true for ProfileData with pinned tweets', () => {
      const profileData: ProfileData = {
        username: 'elonmusk',
        action: 'pin_update',
        pinned: [
          {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22Z',
            body: {
              text: 'Pinned tweet text'
            }
          }
        ]
      };
      expect(isProfileData(profileData)).toBe(true);
    });

    it('should return true for ProfileData with both user and pinned', () => {
      const profileData: ProfileData = {
        username: 'elonmusk',
        action: 'profile_updated',
        user: {
          id: 'user123',
          handle: 'elonmusk',
          profile: {
            name: 'Elon Musk'
          }
        },
        pinned: []
      };
      expect(isProfileData(profileData)).toBe(true);
    });

    it('should return false for invalid ProfileData', () => {
      expect(isProfileData(null)).toBe(false);
      expect(isProfileData(undefined)).toBe(false);
      expect(isProfileData({})).toBe(false);
      expect(isProfileData({ username: 'test' })).toBe(false);
      expect(isProfileData({ username: 'test', action: 'update' })).toBe(false);
      expect(isProfileData({ action: 'update', user: {} })).toBe(false);
    });
  });

  describe('isFollowingData', () => {
    it('should return true for valid FollowingData with complete structure', () => {
      const validFollowingData: FollowingData = {
        username: 'elonmusk',
        action: 'follow_created',
        user: {
          id: 'user123',
          handle: 'elonmusk',
          profile: {
            name: 'Elon Musk'
          }
        },
        following: {
          id: 'user456',
          handle: 'vitalikbuterin',
          profile: {
            name: 'Vitalik Buterin'
          }
        }
      };
      expect(isFollowingData(validFollowingData)).toBe(true);
    });

    it('should return true for FollowingData with minimal structure', () => {
      const minimalFollowingData: FollowingData = {
        username: 'elonmusk',
        action: 'follow_created',
        following: {
          id: 'user456',
          handle: 'vitalikbuterin'
        }
      };
      expect(isFollowingData(minimalFollowingData)).toBe(true);
    });

    it('should return false for invalid FollowingData', () => {
      expect(isFollowingData(null)).toBe(false);
      expect(isFollowingData(undefined)).toBe(false);
      expect(isFollowingData({})).toBe(false);
      expect(isFollowingData({ username: 'test' })).toBe(false);
      expect(isFollowingData({ username: 'test', action: 'follow' })).toBe(false);
      expect(isFollowingData({ action: 'follow', following: {} })).toBe(false);
    });
  });

  describe('isTwitterEvent', () => {
    it('should return true for valid TwitterEvent with PostData', () => {
      const validEvent: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: '123',
        user: {
          username: 'elonmusk',
          displayName: 'Elon Musk',
          userId: '456'
        },
        data: {
          tweetId: '123',
          username: 'elonmusk',
          action: 'post_created',
          tweet: {
            id: '123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22Z',
            body: {
              text: 'Hello world'
            },
            author: {
              handle: 'elonmusk'
            }
          }
        }
      };
      expect(isTwitterEvent(validEvent)).toBe(true);
    });

    it('should return true for valid TwitterEvent with ProfileData', () => {
      const validEvent: TwitterEvent = {
        type: 'profile_updated',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: '456',
        user: {
          username: 'elonmusk',
          displayName: 'Elon Musk',
          userId: '456'
        },
        data: {
          username: 'elonmusk',
          action: 'profile_updated',
          user: {
            id: '456',
            handle: 'elonmusk',
            profile: {
              name: 'Elon Musk'
            }
          }
        }
      };
      expect(isTwitterEvent(validEvent)).toBe(true);
    });

    it('should return true for valid TwitterEvent with FollowingData', () => {
      const validEvent: TwitterEvent = {
        type: 'follow_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: '789',
        user: {
          username: 'elonmusk',
          displayName: 'Elon Musk',
          userId: '456'
        },
        data: {
          username: 'elonmusk',
          action: 'follow_created',
          following: {
            id: '789',
            handle: 'vitalikbuterin'
          }
        }
      };
      expect(isTwitterEvent(validEvent)).toBe(true);
    });

    it('should return false for invalid TwitterEvent', () => {
      expect(isTwitterEvent(null)).toBe(false);
      expect(isTwitterEvent(undefined)).toBe(false);
      expect(isTwitterEvent({})).toBe(false);
      expect(isTwitterEvent({ type: 'invalid_type' })).toBe(false);
      expect(isTwitterEvent({ type: 'post_created', timestamp: '2024-01-15' })).toBe(false);
    });
  });

  describe('isRawEvent', () => {
    it('should return true for valid RawEvent', () => {
      const validRawEvent: RawEvent = {
        id: '123',
        event: 'message',
        data: '{"type":"post_created"}'
      };
      expect(isRawEvent(validRawEvent)).toBe(true);
    });

    it('should return false for invalid RawEvent', () => {
      expect(isRawEvent(null)).toBe(false);
      expect(isRawEvent(undefined)).toBe(false);
      expect(isRawEvent({})).toBe(false);
      expect(isRawEvent({ id: '123' })).toBe(false);
      expect(isRawEvent({ id: '123', event: 'message' })).toBe(false);
      expect(isRawEvent({ id: 123, event: 'message', data: 'data' })).toBe(false);
    });
  });
});
