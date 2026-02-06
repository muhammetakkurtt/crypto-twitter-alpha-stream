/**
 * Unit tests for AlertOutput and alert channels
 */

import { AlertOutput } from '../../src/outputs/AlertOutput';
import { TelegramChannel, DiscordChannel, WebhookChannel, formatAlertMessage, formatAlertText } from '../../src/outputs/AlertChannel';
import { RateLimiter } from '../../src/outputs/RateLimiter';
import { EventBus } from '../../src/eventbus/EventBus';
import { TwitterEvent, PostData, ProfileData, FollowingData } from '../../src/models/types';

// Mock fetch globally
global.fetch = jest.fn();

describe('AlertOutput', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    jest.clearAllMocks();
  });

  describe('Message Formatting', () => {
    it('should format post_created events correctly', () => {
      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22.000Z',
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
            created_at: '2024-01-15T14:30:22.000Z',
            body: {
              text: 'Bitcoin is the future',
              urls: [],
              mentions: []
            },
            author: {
              handle: 'elonmusk',
              id: 'user123',
              verified: true,
              profile: {
                name: 'Elon Musk',
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
        } as PostData
      };

      const message = formatAlertMessage(event);

      expect(message.eventType).toBe('post_created');
      expect(message.username).toBe('elonmusk');
      expect(message.text).toBe('Bitcoin is the future');
      expect(message.timestamp).toBe('2024-01-15T14:30:22.000Z');
    });

    it('should format profile_updated events correctly', () => {
      const event: TwitterEvent = {
        type: 'profile_updated',
        timestamp: '2024-01-15T14:30:22.000Z',
        primaryId: 'user123',
        user: {
          username: 'vitalikbuterin',
          displayName: 'Vitalik Buterin',
          userId: 'user123'
        },
        data: {
          username: 'vitalikbuterin',
          action: 'profile_updated',
          user: {
            id: 'user123',
            handle: 'vitalikbuterin',
            profile: {
              name: 'Vitalik Buterin',
              avatar: '',
              bio: 'New bio'
            },
            metrics: {
              followers: 1000,
              following: 500
            }
          }
        } as ProfileData
      };

      const message = formatAlertMessage(event);

      expect(message.eventType).toBe('profile_updated');
      expect(message.username).toBe('vitalikbuterin');
      expect(message.text).toContain('profile');
      expect(message.timestamp).toBe('2024-01-15T14:30:22.000Z');
    });

    it('should format follow_created events correctly', () => {
      const event: TwitterEvent = {
        type: 'follow_created',
        timestamp: '2024-01-15T14:30:22.000Z',
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
            handle: 'cz_binance',
            profile: {
              name: 'CZ',
              avatar: '',
              bio: ''
            }
          },
          following: {
            id: 'user456',
            handle: 'SBF_FTX',
            profile: {
              name: 'SBF',
              avatar: '',
              bio: ''
            }
          }
        } as FollowingData
      };

      const message = formatAlertMessage(event);

      expect(message.eventType).toBe('follow_created');
      expect(message.username).toBe('cz_binance');
      expect(message.text).toBe('followed @SBF_FTX');
      expect(message.timestamp).toBe('2024-01-15T14:30:22.000Z');
    });

    it('should format alert text with emoji and timestamp', () => {
      const message = {
        eventType: 'post_created',
        username: 'elonmusk',
        text: 'Bitcoin is the future',
        timestamp: '2024-01-15T14:30:22.000Z'
      };

      const formatted = formatAlertText(message);

      expect(formatted).toContain('New Tweet'); // Event label, not raw event type
      expect(formatted).toContain('@elonmusk');
      expect(formatted).toContain('Bitcoin is the future');
      expect(formatted).toContain('2024-01-15'); // Date portion of timestamp
    });
  });

  describe('RateLimiter', () => {
    it('should allow requests under the limit', () => {
      const limiter = new RateLimiter(10, 60000);

      for (let i = 0; i < 10; i++) {
        expect(limiter.allowRequest()).toBe(true);
        limiter.recordRequest();
      }

      expect(limiter.getRequestCount()).toBe(10);
    });

    it('should block requests over the limit', () => {
      const limiter = new RateLimiter(10, 60000);

      // Fill up the limit
      for (let i = 0; i < 10; i++) {
        limiter.allowRequest();
        limiter.recordRequest();
      }

      // Next request should be blocked
      expect(limiter.allowRequest()).toBe(false);
    });

    it('should reset after the time window', async () => {
      const limiter = new RateLimiter(2, 100); // 2 requests per 100ms

      // Use up the limit
      limiter.allowRequest();
      limiter.recordRequest();
      limiter.allowRequest();
      limiter.recordRequest();

      expect(limiter.allowRequest()).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should allow requests again
      expect(limiter.allowRequest()).toBe(true);
    });
  });

  describe('TelegramChannel', () => {
    it('should send message to Telegram API', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({ ok: true });

      const channel = new TelegramChannel('bot-token', 'chat-id');
      const message = {
        eventType: 'post_created',
        username: 'elonmusk',
        text: 'Test message',
        timestamp: '2024-01-15T14:30:22.000Z'
      };

      await channel.send(message);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.telegram.org/botbot-token/sendMessage',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should respect rate limits', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValue({ ok: true });

      const channel = new TelegramChannel('bot-token', 'chat-id');
      const message = {
        eventType: 'post_created',
        username: 'elonmusk',
        text: 'Test message',
        timestamp: '2024-01-15T14:30:22.000Z'
      };

      // Send 10 messages (should all succeed)
      for (let i = 0; i < 10; i++) {
        await channel.send(message);
      }

      expect(mockFetch).toHaveBeenCalledTimes(10);

      // 11th message should be rate limited
      await channel.send(message);
      expect(mockFetch).toHaveBeenCalledTimes(10); // Still 10, not 11
    });

    it('should throw error on API failure', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({ ok: false, status: 400, statusText: 'Bad Request' });

      const channel = new TelegramChannel('bot-token', 'chat-id');
      const message = {
        eventType: 'post_created',
        username: 'elonmusk',
        text: 'Test message',
        timestamp: '2024-01-15T14:30:22.000Z'
      };

      await expect(channel.send(message)).rejects.toThrow('Failed to send Telegram alert');
    });
  });

  describe('DiscordChannel', () => {
    it('should send message to Discord webhook', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({ ok: true });

      const channel = new DiscordChannel('https://discord.com/webhook/123');
      const message = {
        eventType: 'post_created',
        username: 'elonmusk',
        text: 'Test message',
        timestamp: '2024-01-15T14:30:22.000Z'
      };

      await channel.send(message);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/webhook/123',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should respect rate limits', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValue({ ok: true });

      const channel = new DiscordChannel('https://discord.com/webhook/123');
      const message = {
        eventType: 'post_created',
        username: 'elonmusk',
        text: 'Test message',
        timestamp: '2024-01-15T14:30:22.000Z'
      };

      // Send 10 messages
      for (let i = 0; i < 10; i++) {
        await channel.send(message);
      }

      expect(mockFetch).toHaveBeenCalledTimes(10);

      // 11th message should be rate limited
      await channel.send(message);
      expect(mockFetch).toHaveBeenCalledTimes(10);
    });
  });

  describe('WebhookChannel', () => {
    it('should send message to generic webhook', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({ ok: true });

      const channel = new WebhookChannel('https://example.com/webhook');
      const message = {
        eventType: 'post_created',
        username: 'elonmusk',
        text: 'Test message',
        timestamp: '2024-01-15T14:30:22.000Z'
      };

      await channel.send(message);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });

    it('should support custom HTTP method', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({ ok: true });

      const channel = new WebhookChannel('https://example.com/webhook', 'PUT');
      const message = {
        eventType: 'post_created',
        username: 'elonmusk',
        text: 'Test message',
        timestamp: '2024-01-15T14:30:22.000Z'
      };

      await channel.send(message);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });

    it('should support custom headers', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValueOnce({ ok: true });

      const channel = new WebhookChannel(
        'https://example.com/webhook',
        'POST',
        { 'Authorization': 'Bearer token123' }
      );
      const message = {
        eventType: 'post_created',
        username: 'elonmusk',
        text: 'Test message',
        timestamp: '2024-01-15T14:30:22.000Z'
      };

      await channel.send(message);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123'
          })
        })
      );
    });
  });

  describe('AlertOutput Integration', () => {
    it('should subscribe to alerts channel on start', () => {
      const alertOutput = new AlertOutput({ channels: [] }, eventBus);
      
      expect(eventBus.getSubscriberCount('alerts')).toBe(0);
      
      alertOutput.start();
      
      expect(eventBus.getSubscriberCount('alerts')).toBe(1);
      
      alertOutput.stop();
    });

    it('should unsubscribe on stop', () => {
      const alertOutput = new AlertOutput({ channels: [] }, eventBus);
      
      alertOutput.start();
      expect(eventBus.getSubscriberCount('alerts')).toBe(1);
      
      alertOutput.stop();
      expect(eventBus.getSubscriberCount('alerts')).toBe(0);
    });

    it('should track statistics for sent alerts', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValue({ ok: true });

      const telegramChannel = new TelegramChannel('bot-token', 'chat-id');
      const alertOutput = new AlertOutput({ channels: [telegramChannel] }, eventBus);
      
      alertOutput.start();

      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22.000Z',
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
            created_at: '2024-01-15T14:30:22.000Z',
            body: {
              text: 'Test tweet',
              urls: [],
              mentions: []
            },
            author: {
              handle: 'elonmusk',
              id: 'user123',
              verified: true,
              profile: {
                name: 'Elon Musk',
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
        } as PostData
      };

      await eventBus.publish('alerts', event);

      const stats = alertOutput.getStats();
      expect(stats.telegram.sent).toBe(1);
      expect(stats.telegram.failed).toBe(0);

      alertOutput.stop();
    });

    it('should track statistics for failed alerts', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' });

      const telegramChannel = new TelegramChannel('bot-token', 'chat-id');
      const alertOutput = new AlertOutput({ channels: [telegramChannel] }, eventBus);
      
      alertOutput.start();

      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22.000Z',
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
            created_at: '2024-01-15T14:30:22.000Z',
            body: {
              text: 'Test tweet',
              urls: [],
              mentions: []
            },
            author: {
              handle: 'elonmusk',
              id: 'user123',
              verified: true,
              profile: {
                name: 'Elon Musk',
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
        } as PostData
      };

      await eventBus.publish('alerts', event);

      const stats = alertOutput.getStats();
      expect(stats.telegram.sent).toBe(0);
      expect(stats.telegram.failed).toBe(1);

      alertOutput.stop();
    });

    it('should not send alerts when channel is disabled', async () => {
      const mockFetch = global.fetch as jest.Mock;
      mockFetch.mockResolvedValue({ ok: true });

      const telegramChannel = new TelegramChannel('bot-token', 'chat-id', false); // disabled
      const alertOutput = new AlertOutput({ channels: [telegramChannel] }, eventBus);
      
      alertOutput.start();

      const event: TwitterEvent = {
        type: 'post_created',
        timestamp: '2024-01-15T14:30:22.000Z',
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
            created_at: '2024-01-15T14:30:22.000Z',
            body: {
              text: 'Test tweet',
              urls: [],
              mentions: []
            },
            author: {
              handle: 'elonmusk',
              id: 'user123',
              verified: true,
              profile: {
                name: 'Elon Musk',
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
        } as PostData
      };

      await eventBus.publish('alerts', event);

      expect(mockFetch).not.toHaveBeenCalled();

      alertOutput.stop();
    });
  });
});
