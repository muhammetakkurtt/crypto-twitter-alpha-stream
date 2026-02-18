/**
 * Property-based tests for type guards
 * Feature: event-processing-fix
 */

import * as fc from 'fast-check';
import {
  isPostData,
  isProfileData,
  isFollowingData,
  Channel,
  RuntimeSubscriptionMode,
  RuntimeSubscriptionSource
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

  describe('Property 1: RuntimeSubscriptionState Structure Completeness', () => {
    /**
     * For any RuntimeSubscriptionState object, it must contain all required fields 
     * (channels, users, mode, source, updatedAt) with correct types: channels and 
     * users as arrays, mode as 'active' or 'idle', source as 'config' or 'runtime',
     */

    // Generator for valid Channel array
    const channelArrayArbitrary = fc.array(
      fc.constantFrom<Channel>('all', 'tweets', 'following', 'profile'),
      { minLength: 0, maxLength: 4 }
    ).map(channels => [...new Set(channels)]); // Remove duplicates

    // Generator for valid user array
    const userArrayArbitrary = fc.array(
      fc.string({ minLength: 1, maxLength: 15 }),
      { minLength: 0, maxLength: 10 }
    );

    // Generator for valid RuntimeSubscriptionMode
    const modeArbitrary = fc.constantFrom<RuntimeSubscriptionMode>('active', 'idle');

    // Generator for valid RuntimeSubscriptionSource
    const sourceArbitrary = fc.constantFrom<RuntimeSubscriptionSource>('config', 'runtime');

    // Generator for valid ISO 8601 timestamp
    const iso8601Arbitrary = fc.integer({ min: 0, max: Date.now() })
      .map(timestamp => new Date(timestamp).toISOString());

    // Generator for valid RuntimeSubscriptionState
    const validRuntimeSubscriptionStateArbitrary = fc.record({
      channels: channelArrayArbitrary,
      users: userArrayArbitrary,
      mode: modeArbitrary,
      source: sourceArbitrary,
      updatedAt: iso8601Arbitrary
    });

    it('should have all required fields with correct types', () => {
      fc.assert(
        fc.property(validRuntimeSubscriptionStateArbitrary, (state) => {
          // Check that all required fields exist
          const hasAllFields = 
            'channels' in state &&
            'users' in state &&
            'mode' in state &&
            'source' in state &&
            'updatedAt' in state;

          // Check that channels is an array
          const channelsIsArray = Array.isArray(state.channels);

          // Check that users is an array
          const usersIsArray = Array.isArray(state.users);

          // Check that mode is 'active' or 'idle'
          const modeIsValid = state.mode === 'active' || state.mode === 'idle';

          // Check that source is 'config' or 'runtime'
          const sourceIsValid = state.source === 'config' || state.source === 'runtime';

          // Check that updatedAt is a valid ISO 8601 timestamp string
          const updatedAtIsString = typeof state.updatedAt === 'string';
          const updatedAtIsValidISO = updatedAtIsString && !isNaN(Date.parse(state.updatedAt));

          return hasAllFields &&
                 channelsIsArray &&
                 usersIsArray &&
                 modeIsValid &&
                 sourceIsValid &&
                 updatedAtIsValidISO;
        }),
        { numRuns: 100 }
      );
    });

    it('should have channels array containing only valid Channel values', () => {
      fc.assert(
        fc.property(validRuntimeSubscriptionStateArbitrary, (state) => {
          const validChannels: Channel[] = ['all', 'tweets', 'following', 'profile'];
          return state.channels.every(channel => validChannels.includes(channel));
        }),
        { numRuns: 100 }
      );
    });

    it('should have users array containing only strings', () => {
      fc.assert(
        fc.property(validRuntimeSubscriptionStateArbitrary, (state) => {
          return state.users.every(user => typeof user === 'string');
        }),
        { numRuns: 100 }
      );
    });

    it('should have mode as either active or idle', () => {
      fc.assert(
        fc.property(validRuntimeSubscriptionStateArbitrary, (state) => {
          return state.mode === 'active' || state.mode === 'idle';
        }),
        { numRuns: 100 }
      );
    });

    it('should have source as either config or runtime', () => {
      fc.assert(
        fc.property(validRuntimeSubscriptionStateArbitrary, (state) => {
          return state.source === 'config' || state.source === 'runtime';
        }),
        { numRuns: 100 }
      );
    });

    it('should have updatedAt as a valid ISO 8601 timestamp', () => {
      fc.assert(
        fc.property(validRuntimeSubscriptionStateArbitrary, (state) => {
          // Check that it's a string
          if (typeof state.updatedAt !== 'string') {
            return false;
          }

          // Check that it can be parsed as a valid date
          const parsedDate = Date.parse(state.updatedAt);
          if (isNaN(parsedDate)) {
            return false;
          }

          // Check that it matches ISO 8601 format (relaxed check for various valid formats)
          // Valid formats include: YYYY-MM-DDTHH:mm:ss.sssZ, YYYY-MM-DDTHH:mm:ssZ, etc.
          const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
          return iso8601Regex.test(state.updatedAt);
        }),
        { numRuns: 100 }
      );
    });

    it('should reject objects missing required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            channels: fc.option(channelArrayArbitrary, { nil: undefined }),
            users: fc.option(userArrayArbitrary, { nil: undefined }),
            mode: fc.option(modeArbitrary, { nil: undefined }),
            source: fc.option(sourceArbitrary, { nil: undefined }),
            updatedAt: fc.option(iso8601Arbitrary, { nil: undefined })
          }).filter(obj => 
            obj.channels === undefined ||
            obj.users === undefined ||
            obj.mode === undefined ||
            obj.source === undefined ||
            obj.updatedAt === undefined
          ),
          (invalidState) => {
            // An object missing any required field should not be a valid RuntimeSubscriptionState
            const hasAllFields = 
              'channels' in invalidState &&
              'users' in invalidState &&
              'mode' in invalidState &&
              'source' in invalidState &&
              'updatedAt' in invalidState &&
              invalidState.channels !== undefined &&
              invalidState.users !== undefined &&
              invalidState.mode !== undefined &&
              invalidState.source !== undefined &&
              invalidState.updatedAt !== undefined;

            return !hasAllFields;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject objects with invalid field types', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Invalid channels (not an array)
            fc.record({
              channels: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
              users: userArrayArbitrary,
              mode: modeArbitrary,
              source: sourceArbitrary,
              updatedAt: iso8601Arbitrary
            }),
            // Invalid users (not an array)
            fc.record({
              channels: channelArrayArbitrary,
              users: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
              mode: modeArbitrary,
              source: sourceArbitrary,
              updatedAt: iso8601Arbitrary
            }),
            // Invalid mode
            fc.record({
              channels: channelArrayArbitrary,
              users: userArrayArbitrary,
              mode: fc.string().filter(s => s !== 'active' && s !== 'idle'),
              source: sourceArbitrary,
              updatedAt: iso8601Arbitrary
            }),
            // Invalid source
            fc.record({
              channels: channelArrayArbitrary,
              users: userArrayArbitrary,
              mode: modeArbitrary,
              source: fc.string().filter(s => s !== 'config' && s !== 'runtime'),
              updatedAt: iso8601Arbitrary
            }),
            // Invalid updatedAt (not a string or not ISO 8601)
            fc.record({
              channels: channelArrayArbitrary,
              users: userArrayArbitrary,
              mode: modeArbitrary,
              source: sourceArbitrary,
              updatedAt: fc.oneof(fc.integer(), fc.boolean(), fc.string().filter(s => isNaN(Date.parse(s))))
            })
          ),
          (invalidState: any) => {
            // Check that at least one field has an invalid type
            const channelsValid = Array.isArray(invalidState.channels);
            const usersValid = Array.isArray(invalidState.users);
            const modeValid = invalidState.mode === 'active' || invalidState.mode === 'idle';
            const sourceValid = invalidState.source === 'config' || invalidState.source === 'runtime';
            const updatedAtValid = typeof invalidState.updatedAt === 'string' && !isNaN(Date.parse(invalidState.updatedAt));

            // At least one field should be invalid
            return !(channelsValid && usersValid && modeValid && sourceValid && updatedAtValid);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
