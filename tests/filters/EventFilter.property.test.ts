/**
 * Property-based tests for EventFilter classes
 */

import * as fc from 'fast-check';
import { UserFilter, KeywordFilter } from '../../src/filters/EventFilter';
import { TwitterEvent, EventType, PostData, ProfileData, FollowingData } from '../../src/models/types';

// Arbitraries for generating test data
const eventTypeArb = fc.constantFrom<EventType>('post_created', 'post_updated', 'follow_created', 'follow_updated', 'user_updated', 'profile_updated', 'profile_pinned');

const usernameArb = fc.stringMatching(/^[a-zA-Z0-9_]{1,15}$/);

const postDataArb: fc.Arbitrary<PostData> = fc.record({
  username: usernameArb,
  action: fc.constantFrom('post_created', 'post_updated'),
  tweetId: fc.uuid(),
  tweet: fc.record({
    id: fc.uuid(),
    type: fc.constant('tweet'),
    created_at: fc.integer({ min: 1577836800000, max: 1924905600000 }).map(ms => new Date(ms).toISOString()),
    body: fc.record({
      text: fc.string({ minLength: 1, maxLength: 280 }),
      urls: fc.array(fc.record({
        name: fc.string(),
        url: fc.webUrl(),
        tco: fc.webUrl()
      })),
      mentions: fc.array(usernameArb)
    }),
    author: fc.record({
      handle: usernameArb,
      id: fc.uuid(),
      verified: fc.boolean(),
      profile: fc.record({
        name: fc.string({ minLength: 1, maxLength: 50 }),
        avatar: fc.option(fc.webUrl(), { nil: undefined }),
        bio: fc.option(fc.string(), { nil: undefined })
      })
    }),
    metrics: fc.option(fc.record({
      likes: fc.nat(),
      retweets: fc.nat(),
      replies: fc.nat(),
      views: fc.nat()
    }), { nil: undefined }),
    media: fc.option(fc.record({
      images: fc.array(fc.webUrl()),
      videos: fc.array(fc.webUrl())
    }), { nil: undefined })
  })
});

const profileDataArb: fc.Arbitrary<ProfileData> = fc.record({
  username: usernameArb,
  action: fc.constantFrom('user_updated', 'profile_updated', 'profile_pinned'),
  user: fc.option(fc.record({
    id: fc.uuid(),
    handle: usernameArb,
    profile: fc.option(fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      avatar: fc.option(fc.webUrl(), { nil: undefined }),
      bio: fc.option(fc.string(), { nil: undefined })
    }), { nil: undefined }),
    metrics: fc.option(fc.record({
      followers: fc.nat(),
      following: fc.nat()
    }), { nil: undefined })
  }), { nil: undefined }),
  pinned: fc.option(fc.array(fc.record({
    id: fc.uuid(),
    type: fc.constant('tweet'),
    created_at: fc.integer({ min: 0, max: Date.now() }).map(ts => new Date(ts).toISOString()),
    body: fc.record({
      text: fc.string({ minLength: 1, maxLength: 280 })
    }),
    author: fc.option(fc.record({
      handle: usernameArb,
      profile: fc.option(fc.record({
        avatar: fc.webUrl(),
        name: fc.string({ minLength: 1, maxLength: 50 })
      }), { nil: undefined })
    }), { nil: undefined }),
    media: fc.option(fc.record({
      images: fc.option(fc.array(fc.webUrl()), { nil: undefined }),
      videos: fc.option(fc.array(fc.webUrl()), { nil: undefined })
    }), { nil: undefined })
  })), { nil: undefined })
});

const followingDataArb: fc.Arbitrary<FollowingData> = fc.record({
  username: usernameArb,
  action: fc.constantFrom('follow_created', 'follow_updated'),
  user: fc.option(fc.record({
    id: fc.uuid(),
    handle: usernameArb,
    profile: fc.option(fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      avatar: fc.option(fc.webUrl(), { nil: undefined }),
      bio: fc.option(fc.string(), { nil: undefined })
    }), { nil: undefined }),
    metrics: fc.option(fc.record({
      followers: fc.nat(),
      following: fc.nat()
    }), { nil: undefined })
  }), { nil: undefined }),
  following: fc.option(fc.record({
    id: fc.uuid(),
    handle: usernameArb,
    profile: fc.option(fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      avatar: fc.option(fc.webUrl(), { nil: undefined }),
      bio: fc.option(fc.string(), { nil: undefined })
    }), { nil: undefined }),
    metrics: fc.option(fc.record({
      followers: fc.nat(),
      following: fc.nat()
    }), { nil: undefined })
  }), { nil: undefined })
});

const twitterEventArb: fc.Arbitrary<TwitterEvent> = fc.record({
  type: eventTypeArb,
  timestamp: fc.integer({ min: 1577836800000, max: 1924905600000 }).map(ms => new Date(ms).toISOString()),
  primaryId: fc.uuid(),
  user: fc.record({
    username: usernameArb,
    displayName: fc.string({ minLength: 1, maxLength: 50 }),
    userId: fc.uuid(),
  }),
  data: fc.oneof(postDataArb, profileDataArb, followingDataArb),
});

describe('EventFilter Property Tests', () => {
  describe('Property 6: User Filter Correctness', () => {
    /**
     * For any non-empty user filter list and any event, the event should pass 
     * the filter if and only if the event's username is in the filter list.
     */
    it('should pass events only when username is in filter list', () => {
      fc.assert(
        fc.property(
          fc.array(usernameArb, { minLength: 1, maxLength: 10 }),
          twitterEventArb,
          (usernames, event) => {
            const filter = new UserFilter(usernames);
            const result = filter.apply(event);
            const expected = usernames.includes(event.user.username);
            
            return result === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow all events when filter list is empty', () => {
      fc.assert(
        fc.property(
          twitterEventArb,
          (event) => {
            const filter = new UserFilter([]);
            return filter.apply(event) === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 7: Keyword Filter Correctness', () => {
    /**
     * For any non-empty keyword filter list and any event, the event should pass 
     * the filter if and only if the event's text contains at least one keyword (case-insensitive).
     */
    it('should pass events only when text contains at least one keyword', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          twitterEventArb,
          (keywords, event) => {
            const filter = new KeywordFilter(keywords, false);
            const result = filter.apply(event);
            
            // Extract searchable text (same logic as KeywordFilter)
            const parts: string[] = [];
            parts.push(event.user.username);
            parts.push(event.user.displayName);
            
            const data = event.data;
            if ('tweet' in data && data.tweet) {
              if (data.tweet?.body?.text) {
                parts.push(data.tweet.body.text);
              }
            }
            
            if ('user' in data && data.user) {
              if (data.user.profile?.name) {
                parts.push(data.user.profile.name);
              }
              if (data.user.profile?.description?.text) {
                parts.push(data.user.profile.description.text);
              }
            }
            
            if ('following' in data && data.following) {
              if (data.following.handle) {
                parts.push(data.following.handle);
              }
              if (data.following.profile?.name) {
                parts.push(data.following.profile.name);
              }
            }
            
            const searchText = parts.join(' ').toLowerCase();
            const expected = keywords.some(keyword => searchText.includes(keyword.toLowerCase()));
            
            return result === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow all events when keyword list is empty', () => {
      fc.assert(
        fc.property(
          twitterEventArb,
          (event) => {
            const filter = new KeywordFilter([]);
            return filter.apply(event) === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Case-Insensitive Keyword Matching', () => {
    /**
     * For any keyword K and any event text T, if T contains K in any case variation 
     * (uppercase, lowercase, mixed), the keyword filter should match.
     */
    it('should match keywords regardless of case', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 3, maxLength: 15 }).filter(s => s.trim().length > 0),
          fc.constantFrom('lower', 'upper', 'mixed'),
          (keyword, caseVariant) => {
            // Create a post event with the keyword in different cases
            let textWithKeyword: string;
            if (caseVariant === 'lower') {
              textWithKeyword = `This text contains ${keyword.toLowerCase()} in it`;
            } else if (caseVariant === 'upper') {
              textWithKeyword = `This text contains ${keyword.toUpperCase()} in it`;
            } else {
              // Mixed case
              textWithKeyword = `This text contains ${keyword.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('')} in it`;
            }
            
            const event: TwitterEvent = {
              type: 'post_created',
              timestamp: new Date().toISOString(),
              primaryId: 'test-id',
              user: {
                username: 'testuser',
                displayName: 'Test User',
                userId: 'user-123',
              },
              data: {
                username: 'testuser',
                action: 'post_created',
                tweetId: 'tweet-123',
                tweet: {
                  id: 'tweet-123',
                  type: 'tweet',
                  created_at: new Date().toISOString(),
                  body: {
                    text: textWithKeyword,
                    urls: [],
                    mentions: []
                  },
                  author: {
                    handle: 'testuser',
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
            };
            
            // Test with original keyword (any case)
            const filter = new KeywordFilter([keyword], false);
            return filter.apply(event) === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
