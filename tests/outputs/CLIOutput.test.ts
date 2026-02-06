/**
 * Unit tests for CLIOutput
 */

import { CLIOutput } from '../../src/outputs/CLIOutput';
import { EventBus } from '../../src/eventbus/EventBus';
import { TwitterEvent, PostData, ProfileData, FollowingData } from '../../src/models/types';

describe('CLIOutput Unit Tests', () => {
  let originalConsoleLog: typeof console.log;
  let logOutput: string[];

  beforeEach(() => {
    logOutput = [];
    originalConsoleLog = console.log;
    console.log = jest.fn((...args: any[]) => {
      logOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
  });

  describe('Event Formatting', () => {
    test('should format post_created events correctly with complete data', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: 'tweet123',
        user: {
          username: 'elonmusk',
          displayName: 'Elon Musk',
          userId: 'user123'
        },
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22Z',
            body: {
              text: 'Bitcoin is the future of money'
            },
            author: {
              handle: 'elonmusk',
              id: 'user123'
            }
          }
        } as PostData
      };

      cliOutput.start();
      eventBus.publish('cli', event);
      cliOutput.stop();

      const eventLine = logOutput.find(line => line.includes('[post_created]'));
      expect(eventLine).toBeDefined();
      expect(eventLine).toContain('[post_created]');
      expect(eventLine).toContain('@elonmusk');
      expect(eventLine).toContain('Bitcoin is the future of money');
    });

    test('should format user_updated events correctly', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      const event: TwitterEvent = {
        type: 'user_updated',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: 'user123',
        user: {
          username: 'vitalikbuterin',
          displayName: 'Vitalik Buterin',
          userId: 'user123'
        },
        data: {
          username: 'vitalikbuterin',
          action: 'user_updated',
          user: {
            id: 'user123',
            handle: 'vitalikbuterin'
          }
        } as ProfileData
      };

      cliOutput.start();
      eventBus.publish('cli', event);
      cliOutput.stop();

      const eventLine = logOutput.find(line => line.includes('[user_updated]'));
      expect(eventLine).toBeDefined();
      expect(eventLine).toContain('[user_updated]');
      expect(eventLine).toContain('@vitalikbuterin');
      expect(eventLine).toMatch(/profile|updated/);
    });

    test('should format follow_created events correctly', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      const event: TwitterEvent = {
        type: 'follow_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: 'user123',
        user: {
          username: 'cz_binance',
          displayName: 'CZ',
          userId: 'user123'
        },
        data: {
          username: 'cz_binance',
          action: 'follow_created',
          user: {
            id: 'user123',
            handle: 'cz_binance'
          },
          following: {
            id: 'user456',
            handle: 'SBF_FTX'
          }
        } as FollowingData
      };

      cliOutput.start();
      eventBus.publish('cli', event);
      cliOutput.stop();

      const eventLine = logOutput.find(line => line.includes('[follow_created]'));
      expect(eventLine).toBeDefined();
      expect(eventLine).toContain('[follow_created]');
      expect(eventLine).toContain('@cz_binance');
      expect(eventLine).toContain('@SBF_FTX');
      expect(eventLine).toContain('followed');
    });

    test('should format events with missing fields using fallbacks', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      // Event with missing tweet.body.text
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          username: 'testuser',
          action: 'post_created',
          tweetId: 'tweet123'
          // Missing tweet object
        } as any
      };

      cliOutput.start();
      eventBus.publish('cli', event);
      cliOutput.stop();

      const eventLine = logOutput.find(line => line.includes('[post_created]'));
      expect(eventLine).toBeDefined();
      expect(eventLine).toContain('@testuser');
      expect(eventLine).toContain('No text available'); // Fallback text
    });

    test('should truncate text at exactly 100 characters', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      const text100 = 'A'.repeat(100);
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          username: 'testuser',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22Z',
            body: {
              text: text100
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        } as PostData
      };

      cliOutput.start();
      eventBus.publish('cli', event);
      cliOutput.stop();

      const eventLine = logOutput.find(line => line.includes('[post_created]'));
      expect(eventLine).toBeDefined();
      expect(eventLine).toContain(text100); // Should not be truncated at exactly 100
      expect(eventLine).not.toContain('...'); // No ellipsis
    });

    test('should truncate text at 101 characters', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      const text101 = 'A'.repeat(101);
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          username: 'testuser',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22Z',
            body: {
              text: text101
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        } as PostData
      };

      cliOutput.start();
      eventBus.publish('cli', event);
      cliOutput.stop();

      const eventLine = logOutput.find(line => line.includes('[post_created]'));
      expect(eventLine).toBeDefined();
      expect(eventLine).toContain('...'); // Should have ellipsis
      expect(eventLine).not.toContain(text101); // Full text should not appear
    });

    test('should truncate long text', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      const longText = 'A'.repeat(200);
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          username: 'testuser',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22Z',
            body: {
              text: longText
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        } as PostData
      };

      cliOutput.start();
      eventBus.publish('cli', event);
      cliOutput.stop();

      const eventLine = logOutput.find(line => line.includes('[post_created]'));
      expect(eventLine).toBeDefined();
      expect(eventLine).toContain('...');
      expect(eventLine!.length).toBeLessThan(longText.length + 50);
    });

    test('should remove newlines from event text', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          username: 'testuser',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22Z',
            body: {
              text: 'Line 1\nLine 2\rLine 3'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        } as PostData
      };

      cliOutput.start();
      eventBus.publish('cli', event);
      cliOutput.stop();

      const eventLine = logOutput.find(line => line.includes('[post_created]'));
      expect(eventLine).toBeDefined();
      expect(eventLine).not.toContain('\n');
      expect(eventLine).not.toContain('\r');
      // Verify newlines are replaced with spaces
      expect(eventLine).toMatch(/Line 1 Line 2/);
    });

    test('should include @ symbol in username format', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          username: 'testuser',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        } as PostData
      };

      cliOutput.start();
      eventBus.publish('cli', event);
      cliOutput.stop();

      const eventLine = logOutput.find(line => line.includes('[post_created]'));
      expect(eventLine).toBeDefined();
      expect(eventLine).toContain('@testuser'); // Username with @ symbol
      expect(eventLine).toMatch(/@testuser:/); // @ symbol before colon
    });
  });

  describe('Stats Display', () => {
    test('should display stats with correct timing', (done) => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus, { statsInterval: 100 });
      
      cliOutput.start();
      
      // Wait for stats to be displayed
      setTimeout(() => {
        cliOutput.stop();
        
        const statsLine = logOutput.find(line => line.includes('events_total='));
        expect(statsLine).toBeDefined();
        expect(statsLine).toContain('events_total=');
        expect(statsLine).toContain('delivered=');
        expect(statsLine).toContain('deduped=');
        
        done();
      }, 150);
    });

    test('should display correct event counts', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          username: 'testuser',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        } as PostData
      };

      cliOutput.start();
      
      // Publish 3 events
      eventBus.publish('cli', event);
      eventBus.publish('cli', event);
      eventBus.publish('cli', event);
      
      // Manually increment deduped count
      cliOutput.incrementDeduped();
      cliOutput.incrementDeduped();
      
      // Display stats
      cliOutput.displayStats();
      
      cliOutput.stop();

      const statsLine = logOutput.find(line => line.includes('events_total=3'));
      expect(statsLine).toBeDefined();
      expect(statsLine).toContain('events_total=3');
      expect(statsLine).toContain('delivered=3');
      expect(statsLine).toContain('deduped=2');
    });
  });

  describe('Counter Accuracy', () => {
    test('should accurately count total events', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22Z',
        primaryId: 'tweet123',
        user: {
          username: 'testuser',
          displayName: 'Test User',
          userId: 'user123'
        },
        data: {
          username: 'testuser',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            id: 'tweet123',
            type: 'tweet',
            created_at: '2024-01-15T14:30:22Z',
            body: {
              text: 'Test tweet'
            },
            author: {
              handle: 'testuser',
              id: 'user123'
            }
          }
        } as PostData
      };

      cliOutput.start();
      
      for (let i = 0; i < 10; i++) {
        eventBus.publish('cli', event);
      }
      
      const stats = cliOutput.getStats();
      expect(stats.total).toBe(10);
      expect(stats.delivered).toBe(10);
      expect(stats.deduped).toBe(0);
      
      cliOutput.stop();
    });

    test('should accurately count deduped events', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      cliOutput.start();
      
      for (let i = 0; i < 5; i++) {
        cliOutput.incrementDeduped();
      }
      
      const stats = cliOutput.getStats();
      expect(stats.deduped).toBe(5);
      
      cliOutput.stop();
    });

    test('should track start time', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      const beforeStart = new Date();
      cliOutput.start();
      const afterStart = new Date();
      
      const stats = cliOutput.getStats();
      expect(stats.startTime.getTime()).toBeGreaterThanOrEqual(beforeStart.getTime());
      expect(stats.startTime.getTime()).toBeLessThanOrEqual(afterStart.getTime());
      
      cliOutput.stop();
    });
  });

  describe('Start/Stop Behavior', () => {
    test('should not start twice', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      cliOutput.start();
      const subscriberCount1 = eventBus.getSubscriberCount('cli');
      
      cliOutput.start();
      const subscriberCount2 = eventBus.getSubscriberCount('cli');
      
      expect(subscriberCount1).toBe(1);
      expect(subscriberCount2).toBe(1);
      
      cliOutput.stop();
    });

    test('should properly unsubscribe on stop', () => {
      const eventBus = new EventBus();
      const cliOutput = new CLIOutput(eventBus);
      
      cliOutput.start();
      expect(eventBus.getSubscriberCount('cli')).toBe(1);
      
      cliOutput.stop();
      expect(eventBus.getSubscriberCount('cli')).toBe(0);
    });
  });
});
