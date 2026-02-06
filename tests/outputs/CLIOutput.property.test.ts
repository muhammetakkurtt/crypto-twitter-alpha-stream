/**
 * Property-based tests for CLIOutput
 */

import * as fc from 'fast-check';
import { CLIOutput } from '../../src/outputs/CLIOutput';
import { EventBus } from '../../src/eventbus/EventBus';
import { TwitterEvent, EventType, PostData } from '../../src/models/types';

// Arbitraries for generating test data
const eventTypeArb = fc.constantFrom<EventType>('post_created', 'post_updated', 'follow_created', 'follow_updated', 'user_updated', 'profile_updated', 'profile_pinned');

const userArb = fc.record({
  username: fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_')),
  displayName: fc.string({ minLength: 1, maxLength: 50 }),
  userId: fc.string({ minLength: 1, maxLength: 20 })
});

const postDataArb = fc.record({
  tweetId: fc.string({ minLength: 1, maxLength: 20 }),
  username: fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_')),
  action: fc.string({ minLength: 1, maxLength: 20 }),
  tweet: fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    type: fc.constant('tweet'),
    created_at: fc.integer({ min: 1577836800000, max: 1924905600000 }).map(ms => new Date(ms).toISOString()),
    body: fc.record({
      text: fc.string({ minLength: 1, maxLength: 280 })
    }),
    author: fc.record({
      handle: fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_')),
      id: fc.string({ minLength: 1, maxLength: 20 })
    })
  })
});

const profileDataArb = fc.record({
  username: fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_')),
  action: fc.string({ minLength: 1, maxLength: 20 })
});

const followingDataArb = fc.record({
  username: fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_')),
  action: fc.string({ minLength: 1, maxLength: 20 }),
  following: fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    handle: fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_'))
  })
});

const twitterEventArb: fc.Arbitrary<TwitterEvent> = fc.tuple(eventTypeArb, userArb).chain(([type, user]) => {
  let dataArb;
  if (type === 'post_created' || type === 'post_updated') {
    dataArb = postDataArb;
  } else if (type === 'user_updated' || type === 'profile_updated' || type === 'profile_pinned') {
    dataArb = profileDataArb;
  } else {
    dataArb = followingDataArb;
  }

  return fc.record({
    type: fc.constant(type),
    timestamp: fc.integer({ min: 1577836800000, max: 1924905600000 }).map(ms => new Date(ms).toISOString()),
    primaryId: fc.string({ minLength: 1, maxLength: 20 }),
    user: fc.constant(user),
    data: dataArb
  }) as fc.Arbitrary<TwitterEvent>;
});

describe('CLIOutput Property Tests', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logOutput: string[];

  beforeEach(() => {
    logOutput = [];
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    console.log = jest.fn((...args: any[]) => {
      logOutput.push(args.join(' '));
    });
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  /**
   * For any event, the CLI output should contain the event type, username, and some content.
   */
  test('Property 13: CLI Event Format Completeness', () => {
    fc.assert(
      fc.property(twitterEventArb, (event: TwitterEvent) => {
        const eventBus = new EventBus();
        const cliOutput = new CLIOutput(eventBus);
        
        logOutput = [];
        cliOutput.start();
        
        // Publish event to CLI channel
        eventBus.publish('cli', event);
        
        cliOutput.stop();
        
        // Find the event output line (skip "CLI Output started" and "CLI Output stopped")
        const eventLine = logOutput.find(line => 
          line.includes('[') && line.includes(']') && line.includes('@')
        );
        
        // Verify the output contains event type, username, and some text
        expect(eventLine).toBeDefined();
        expect(eventLine).toContain(`[${event.type}]`);
        expect(eventLine).toContain(`@${event.user.username}`);
        
        // Verify it contains content based on event type
        if (event.type === 'post_created' || event.type === 'post_updated') {
          const postData = event.data as PostData;
          // Should contain at least part of the text if tweet exists
          if (postData.tweet?.body?.text) {
            const textPreview = postData.tweet.body.text.substring(0, 20);
            expect(eventLine).toContain(textPreview.substring(0, 10));
          }
        } else if (event.type === 'user_updated' || event.type === 'profile_updated' || event.type === 'profile_pinned') {
          // Should mention profile
          expect(eventLine).toMatch(/profile|updated|pinned/);
        } else if (event.type === 'follow_created' || event.type === 'follow_updated') {
          // Should mention follow action
          expect(eventLine).toMatch(/followed|unfollowed/);
        }
      }),
      { numRuns: 100 }
    );
  });

  /**
   * For any event, the CLI output for that event should not contain newline characters.
   */
  test('Property 14: CLI Single-Line Formatting', () => {
    fc.assert(
      fc.property(twitterEventArb, (event: TwitterEvent) => {
        const eventBus = new EventBus();
        const cliOutput = new CLIOutput(eventBus);
        
        logOutput = [];
        cliOutput.start();
        
        // Publish event to CLI channel
        eventBus.publish('cli', event);
        
        cliOutput.stop();
        
        // Find the event output line
        const eventLine = logOutput.find(line => 
          line.includes('[') && line.includes(']') && line.includes('@')
        );
        
        // Verify the output is a single line (no newlines)
        expect(eventLine).toBeDefined();
        expect(eventLine).not.toContain('\n');
        expect(eventLine).not.toContain('\r');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * For any statistics display, the output should contain total events count, 
   * delivered events count, and deduplicated events count.
   */
  test('Property 15: CLI Stats Content Completeness', () => {
    fc.assert(
      fc.property(
        fc.array(twitterEventArb, { minLength: 0, maxLength: 20 }),
        fc.integer({ min: 0, max: 10 }),
        (events: TwitterEvent[], dedupedCount: number) => {
          const eventBus = new EventBus();
          const cliOutput = new CLIOutput(eventBus);
          
          logOutput = [];
          cliOutput.start();
          
          // Publish events to CLI channel
          for (const event of events) {
            eventBus.publish('cli', event);
          }
          
          // Manually set deduped count
          for (let i = 0; i < dedupedCount; i++) {
            cliOutput.incrementDeduped();
          }
          
          // Trigger stats display
          cliOutput.displayStats();
          
          cliOutput.stop();
          
          // Find the stats output line
          const statsLine = logOutput.find(line => 
            line.includes('events_total=') && 
            line.includes('delivered=') && 
            line.includes('deduped=')
          );
          
          // Verify the stats output contains all required fields
          expect(statsLine).toBeDefined();
          expect(statsLine).toContain(`events_total=${events.length}`);
          expect(statsLine).toContain(`delivered=${events.length}`);
          expect(statsLine).toContain(`deduped=${dedupedCount}`);
          expect(statsLine).toMatch(/rate=\d+\.\d+\/s/);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 8: CLI Output Contains Tweet Text', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_')),
        fc.string({ minLength: 1, maxLength: 280 }),
        (username: string, tweetText: string) => {
          const eventBus = new EventBus();
          const cliOutput = new CLIOutput(eventBus);
          
          // Create event with actor format structure
          const event: TwitterEvent = {
            type: 'post_created',
            timestamp: new Date().toISOString(),
            primaryId: 'tweet123',
            user: {
              username: username,
              displayName: username,
              userId: 'user123'
            },
            data: {
              username: username,
              action: 'post_created',
              tweetId: 'tweet123',
              tweet: {
                id: 'tweet123',
                type: 'tweet',
                created_at: new Date().toISOString(),
                body: {
                  text: tweetText
                },
                author: {
                  handle: username,
                  id: 'user123'
                }
              }
            } as PostData
          };
          
          logOutput = [];
          cliOutput.start();
          eventBus.publish('cli', event);
          cliOutput.stop();
          
          // Find the event output line
          const eventLine = logOutput.find(line => 
            line.includes('[post_created]') && line.includes(`@${username}`)
          );
          
          // Verify the output contains the tweet text (or truncated version)
          expect(eventLine).toBeDefined();
          
          // If text is short enough, it should appear in full
          if (tweetText.length <= 100) {
            // Remove newlines from expected text (CLI removes them)
            const expectedText = tweetText.replace(/\n/g, ' ').replace(/\r/g, '');
            expect(eventLine).toContain(expectedText);
          } else {
            // If text is long, should contain truncated version with ...
            const truncatedText = tweetText.substring(0, 97);
            expect(eventLine).toContain(truncatedText.substring(0, 50)); // Check first 50 chars
            expect(eventLine).toContain('...');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 9: CLI Output Contains Follow Information', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_')),
        fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_')),
        (sourceUsername: string, targetUsername: string) => {
          const eventBus = new EventBus();
          const cliOutput = new CLIOutput(eventBus);
          
          // Create follow_created event with actor format structure
          const event: TwitterEvent = {
            type: 'follow_created',
            timestamp: new Date().toISOString(),
            primaryId: 'follow123',
            user: {
              username: sourceUsername,
              displayName: sourceUsername,
              userId: 'user123'
            },
            data: {
              username: sourceUsername,
              action: 'follow_created',
              user: {
                id: 'user123',
                handle: sourceUsername
              },
              following: {
                id: 'user456',
                handle: targetUsername
              }
            }
          };
          
          logOutput = [];
          cliOutput.start();
          eventBus.publish('cli', event);
          cliOutput.stop();
          
          // Find the event output line
          const eventLine = logOutput.find(line => 
            line.includes('[follow_created]') && line.includes(`@${sourceUsername}`)
          );
          
          // Verify the output contains both usernames
          expect(eventLine).toBeDefined();
          expect(eventLine).toContain(`@${sourceUsername}`); // Source user
          expect(eventLine).toContain(`@${targetUsername}`); // Target user
          expect(eventLine).toContain('followed'); // Action word
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 10: CLI Output Contains Profile Changes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_')),
        fc.constantFrom('user_updated', 'profile_updated', 'profile_pinned'),
        fc.string({ minLength: 1, maxLength: 20 }),
        (username: string, eventType: EventType, action: string) => {
          const eventBus = new EventBus();
          const cliOutput = new CLIOutput(eventBus);
          
          // Create user_updated/profile_updated/profile_pinned event
          const event: TwitterEvent = {
            type: eventType,
            timestamp: new Date().toISOString(),
            primaryId: 'user123',
            user: {
              username: username,
              displayName: username,
              userId: 'user123'
            },
            data: {
              username: username,
              action: action,
              user: {
                id: 'user123',
                handle: username
              }
            }
          };
          
          logOutput = [];
          cliOutput.start();
          eventBus.publish('cli', event);
          cliOutput.stop();
          
          // Find the event output line
          const eventLine = logOutput.find(line => 
            line.includes(`[${eventType}]`) && line.includes(`@${username}`)
          );
          
          // Verify the output describes the profile change
          expect(eventLine).toBeDefined();
          expect(eventLine).toContain(`@${username}`);
          // Should mention profile or the action
          expect(eventLine).toMatch(/profile|updated|pinned/);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 11: CLI Output Username Format', () => {
    fc.assert(
      fc.property(twitterEventArb, (event: TwitterEvent) => {
        const eventBus = new EventBus();
        const cliOutput = new CLIOutput(eventBus);
        
        logOutput = [];
        cliOutput.start();
        eventBus.publish('cli', event);
        cliOutput.stop();
        
        // Find the event output line
        const eventLine = logOutput.find(line => 
          line.includes('[') && line.includes(']') && line.includes('@')
        );
        
        // Verify the username is formatted with @ symbol
        expect(eventLine).toBeDefined();
        expect(eventLine).toContain(`@${event.user.username}`);
        
        // Verify the @ symbol appears before the username
        const atIndex = eventLine!.indexOf(`@${event.user.username}`);
        expect(atIndex).toBeGreaterThan(-1);
      }),
      { numRuns: 100 }
    );
  });

  test('Property 12: CLI Text Truncation', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_')),
        fc.string({ minLength: 101, maxLength: 500 }), // Long text that needs truncation
        (username: string, longText: string) => {
          const eventBus = new EventBus();
          const cliOutput = new CLIOutput(eventBus);
          
          // Create post_created event with long text
          const event: TwitterEvent = {
            type: 'post_created',
            timestamp: new Date().toISOString(),
            primaryId: 'tweet123',
            user: {
              username: username,
              displayName: username,
              userId: 'user123'
            },
            data: {
              username: username,
              action: 'post_created',
              tweetId: 'tweet123',
              tweet: {
                id: 'tweet123',
                type: 'tweet',
                created_at: new Date().toISOString(),
                body: {
                  text: longText
                },
                author: {
                  handle: username,
                  id: 'user123'
                }
              }
            } as PostData
          };
          
          logOutput = [];
          cliOutput.start();
          eventBus.publish('cli', event);
          cliOutput.stop();
          
          // Find the event output line
          const eventLine = logOutput.find(line => 
            line.includes('[post_created]') && line.includes(`@${username}`)
          );
          
          // Verify truncation occurred
          expect(eventLine).toBeDefined();
          expect(eventLine).toContain('...'); // Should have ellipsis
          
          // Extract just the text portion (after the username and colon)
          const textStart = eventLine!.indexOf(': ') + 2;
          const textPortion = eventLine!.substring(textStart);
          
          // The text portion should be at most 103 characters (100 + "...")
          expect(textPortion.length).toBeLessThanOrEqual(103);
          
          // Should contain the beginning of the original text
          const expectedStart = longText.substring(0, 50);
          expect(eventLine).toContain(expectedStart.substring(0, 30));
        }
      ),
      { numRuns: 100 }
    );
  });

  test('Property 13: CLI Graceful Error Handling', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).map(s => s.replace(/\s/g, '_')),
        fc.constantFrom('post_created', 'follow_created', 'user_updated'),
        (username: string, eventType: EventType) => {
          const eventBus = new EventBus();
          const cliOutput = new CLIOutput(eventBus);
          
          // Create event with minimal data (missing optional fields)
          const event: TwitterEvent = {
            type: eventType,
            timestamp: new Date().toISOString(),
            primaryId: 'id123',
            user: {
              username: username,
              displayName: username,
              userId: 'user123'
            },
            data: {
              username: username,
              action: eventType,
              tweetId: 'tweet123'
              // Intentionally missing nested fields like tweet, following, etc.
            } as any
          };
          
          logOutput = [];
          
          // Should not throw an exception
          expect(() => {
            cliOutput.start();
            eventBus.publish('cli', event);
            cliOutput.stop();
          }).not.toThrow();
          
          // Find the event output line
          const eventLine = logOutput.find(line => 
            line.includes(`[${eventType}]`) && line.includes(`@${username}`)
          );
          
          // Should produce valid output (even if with fallback values)
          expect(eventLine).toBeDefined();
          expect(eventLine).toContain(`[${eventType}]`);
          expect(eventLine).toContain(`@${username}`);
          // Should contain some text (even if it's a fallback like "No text available" or "unknown")
          expect(eventLine!.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
