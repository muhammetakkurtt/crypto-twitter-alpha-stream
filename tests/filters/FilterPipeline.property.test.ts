/**
 * Property-based tests for FilterPipeline
 */

import * as fc from 'fast-check';
import { FilterPipeline } from '../../src/filters/FilterPipeline';
import { UserFilter, KeywordFilter } from '../../src/filters/EventFilter';
import { TwitterEvent, EventType, PostData } from '../../src/models/types';

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
    created_at: fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms).toISOString()),
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

const twitterEventArb: fc.Arbitrary<TwitterEvent> = fc.record({
  type: eventTypeArb,
  timestamp: fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms).toISOString()),
  primaryId: fc.uuid(),
  user: fc.record({
    username: usernameArb,
    displayName: fc.string({ minLength: 1, maxLength: 50 }),
    userId: fc.uuid(),
  }),
  data: postDataArb,
});

describe('FilterPipeline Property Tests', () => {
  describe('Property 9: Combined Filter AND Logic', () => {
    /**
     * For any user filter U and keyword filter K, an event should pass both filters 
     * if and only if it passes U AND it passes K.
     */
    it('should pass events only when all filters pass (AND logic)', () => {
      fc.assert(
        fc.property(
          fc.array(usernameArb, { minLength: 1, maxLength: 5 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          twitterEventArb,
          (usernames, keywords, event) => {
            const pipeline = new FilterPipeline();
            const userFilter = new UserFilter(usernames);
            const keywordFilter = new KeywordFilter(keywords, false);
            
            pipeline.addFilter(userFilter);
            pipeline.addFilter(keywordFilter);
            
            const pipelineResult = pipeline.apply(event);
            
            // Expected: both filters must pass
            const userFilterPasses = userFilter.apply(event);
            const keywordFilterPasses = keywordFilter.apply(event);
            const expected = userFilterPasses && keywordFilterPasses;
            
            return pipelineResult === expected;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow all events when no filters are configured', () => {
      fc.assert(
        fc.property(
          twitterEventArb,
          (event) => {
            const pipeline = new FilterPipeline();
            return pipeline.apply(event) === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should fail if any single filter fails', () => {
      fc.assert(
        fc.property(
          fc.array(usernameArb, { minLength: 1, maxLength: 5 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
          twitterEventArb,
          (usernames, keywords, event) => {
            const pipeline = new FilterPipeline();
            const userFilter = new UserFilter(usernames);
            const keywordFilter = new KeywordFilter(keywords, false);
            
            pipeline.addFilter(userFilter);
            pipeline.addFilter(keywordFilter);
            
            const pipelineResult = pipeline.apply(event);
            const userFilterPasses = userFilter.apply(event);
            const keywordFilterPasses = keywordFilter.apply(event);
            
            // If pipeline passes, both filters must pass
            // If pipeline fails, at least one filter must fail
            if (pipelineResult) {
              return userFilterPasses && keywordFilterPasses;
            } else {
              return !userFilterPasses || !keywordFilterPasses;
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
