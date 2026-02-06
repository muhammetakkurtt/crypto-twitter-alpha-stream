/**
 * Property-based tests for type guards
 * Feature: event-processing-fix
 */

import * as fc from 'fast-check';
import {
  isPostData,
  isProfileData,
  isFollowingData
} from '../../src/models/types';

describe('Type Guard Property Tests', () => {
  
  describe('Property 7: Type Guard Validation', () => {
    // Generator for valid PostData
    const validPostDataArbitrary = fc.record({
      tweetId: fc.string({ minLength: 1 }),
      username: fc.string({ minLength: 1, maxLength: 15 }),
      action: fc.constantFrom('post_created', 'post_updated'),
      tweet: fc.option(fc.record({
        id: fc.string({ minLength: 1 }),
        type: fc.constant('tweet'),
        created_at: fc.integer({ min: 0, max: Date.now() }).map(ts => new Date(ts).toISOString()),
        body: fc.record({
          text: fc.string({ minLength: 1, maxLength: 280 }),
          urls: fc.option(fc.array(fc.record({
            name: fc.string(),
            url: fc.webUrl(),
            tco: fc.webUrl()
          }))),
          mentions: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 15 })))
        }),
        author: fc.record({
          handle: fc.string({ minLength: 1, maxLength: 15 }),
          id: fc.option(fc.string()),
          verified: fc.option(fc.boolean()),
          profile: fc.option(fc.record({
            name: fc.string(),
            avatar: fc.option(fc.webUrl()),
            bio: fc.option(fc.string())
          }))
        }),
        metrics: fc.option(fc.record({
          likes: fc.option(fc.nat()),
          retweets: fc.option(fc.nat()),
          replies: fc.option(fc.nat()),
          views: fc.option(fc.nat())
        })),
        media: fc.option(fc.record({
          images: fc.option(fc.array(fc.webUrl())),
          videos: fc.option(fc.array(fc.webUrl()))
        }))
      }))
    });

    // Generator for valid FollowingData
    const validFollowingDataArbitrary = fc.record({
      username: fc.string({ minLength: 1, maxLength: 15 }),
      action: fc.constantFrom('follow_created', 'follow_updated'),
      user: fc.option(fc.record({
        id: fc.string({ minLength: 1 }),
        handle: fc.string({ minLength: 1, maxLength: 15 }),
        private: fc.option(fc.boolean()),
        verified: fc.option(fc.boolean()),
        jointed_at: fc.option(fc.integer({ min: 0 })),
        profile: fc.option(fc.record({
          name: fc.string()
        }))
      })),
      following: fc.record({
        id: fc.string({ minLength: 1 }),
        handle: fc.string({ minLength: 1, maxLength: 15 }),
        private: fc.option(fc.boolean()),
        verified: fc.option(fc.boolean()),
        jointed_at: fc.option(fc.integer({ min: 0 })),
        profile: fc.option(fc.record({
          name: fc.string()
        }))
      })
    });

    // Generator for valid ProfileData
    const validProfileDataArbitrary = fc.record({
      username: fc.string({ minLength: 1, maxLength: 15 }),
      action: fc.constantFrom('user_updated', 'profile_updated', 'pin_update'),
      user: fc.option(fc.record({
        id: fc.string({ minLength: 1 }),
        handle: fc.string({ minLength: 1, maxLength: 15 }),
        private: fc.option(fc.boolean()),
        verified: fc.option(fc.boolean()),
        jointed_at: fc.option(fc.integer({ min: 0 })),
        profile: fc.option(fc.record({
          name: fc.string()
        }))
      })),
      before: fc.option(fc.record({
        id: fc.string({ minLength: 1 }),
        handle: fc.string({ minLength: 1, maxLength: 15 }),
        private: fc.option(fc.boolean()),
        verified: fc.option(fc.boolean()),
        jointed_at: fc.option(fc.integer({ min: 0 })),
        profile: fc.option(fc.record({
          name: fc.string()
        }))
      })),
      pinned: fc.option(fc.array(fc.record({
        id: fc.string({ minLength: 1 }),
        type: fc.constant('tweet'),
        created_at: fc.integer({ min: 0, max: Date.now() }).map(ts => new Date(ts).toISOString()),
        body: fc.record({
          text: fc.string({ minLength: 1, maxLength: 280 })
        })
      })))
    }).filter(data => data.user !== null || data.pinned !== null);

    it('should accept all valid PostData structures', () => {
      fc.assert(
        fc.property(validPostDataArbitrary, (postData) => {
          return isPostData(postData) === true;
        }),
        { numRuns: 100 }
      );
    });

    it('should accept all valid FollowingData structures', () => {
      fc.assert(
        fc.property(validFollowingDataArbitrary, (followingData) => {
          return isFollowingData(followingData) === true;
        }),
        { numRuns: 100 }
      );
    });

    it('should accept all valid ProfileData structures', () => {
      fc.assert(
        fc.property(validProfileDataArbitrary, (profileData) => {
          return isProfileData(profileData) === true;
        }),
        { numRuns: 100 }
      );
    });

    it('should reject PostData missing required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            tweetId: fc.option(fc.string(), { nil: undefined }),
            username: fc.option(fc.string(), { nil: undefined }),
            action: fc.option(fc.string(), { nil: undefined })
          }).filter(data => 
            data.tweetId === undefined || 
            data.username === undefined || 
            data.action === undefined
          ),
          (invalidData) => {
            return isPostData(invalidData) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject FollowingData missing required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            username: fc.option(fc.string(), { nil: undefined }),
            action: fc.option(fc.string(), { nil: undefined }),
            following: fc.option(fc.record({ id: fc.string(), handle: fc.string() }), { nil: undefined })
          }).filter(data => 
            data.username === undefined || 
            data.action === undefined || 
            data.following === undefined
          ),
          (invalidData) => {
            return isFollowingData(invalidData) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject ProfileData missing required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            username: fc.option(fc.string(), { nil: undefined }),
            action: fc.option(fc.string(), { nil: undefined })
          }).filter(data => 
            data.username === undefined || 
            data.action === undefined
          ),
          (invalidData) => {
            return isProfileData(invalidData) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject non-object values', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.array(fc.anything())
          ),
          (invalidValue) => {
            return isPostData(invalidValue) === false &&
                   isFollowingData(invalidValue) === false &&
                   isProfileData(invalidValue) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate nested fields in PostData', () => {
      fc.assert(
        fc.property(
          fc.record({
            tweetId: fc.string({ minLength: 1 }),
            username: fc.string({ minLength: 1 }),
            action: fc.string({ minLength: 1 }),
            tweet: fc.record({
              body: fc.record({
                text: fc.string({ minLength: 1 })
              }),
              author: fc.record({
                handle: fc.string({ minLength: 1 })
              })
            })
          }),
          (postData) => {
            // Type guard should accept valid nested structure
            const result = isPostData(postData);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate nested fields in FollowingData', () => {
      fc.assert(
        fc.property(
          fc.record({
            username: fc.string({ minLength: 1 }),
            action: fc.string({ minLength: 1 }),
            following: fc.record({
              id: fc.string({ minLength: 1 }),
              handle: fc.string({ minLength: 1 }),
              profile: fc.record({
                name: fc.string({ minLength: 1 })
              })
            })
          }),
          (followingData) => {
            // Type guard should accept valid nested structure
            const result = isFollowingData(followingData);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should validate nested fields in ProfileData', () => {
      fc.assert(
        fc.property(
          fc.record({
            username: fc.string({ minLength: 1 }),
            action: fc.string({ minLength: 1 }),
            user: fc.record({
              id: fc.string({ minLength: 1 }),
              handle: fc.string({ minLength: 1 }),
              profile: fc.record({
                name: fc.string({ minLength: 1 })
              })
            })
          }),
          (profileData) => {
            // Type guard should accept valid nested structure
            const result = isProfileData(profileData);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
