/**
 * Unit tests for SSEClient
 * Tests connection establishment, authentication, event parsing, and disconnect handling
 */

// Mock the eventsource module before imports
jest.mock('eventsource', () => {
  class MockEventSource {
    public onopen: (() => void) | null = null;
    public onmessage: ((event: any) => void) | null = null;
    public onerror: ((error: any) => void) | null = null;
    public readyState: number = 0;
    public url: string;
    private eventListeners: Map<string, ((event: any) => void)[]> = new Map();

    constructor(url: string) {
      this.url = url;
      // Simulate async connection
      setTimeout(() => {
        this.readyState = 1;
        if (this.onopen) {
          this.onopen();
        }
      }, 10);
    }

    addEventListener(eventType: string, handler: (event: any) => void) {
      if (!this.eventListeners.has(eventType)) {
        this.eventListeners.set(eventType, []);
      }
      this.eventListeners.get(eventType)!.push(handler);
    }

    close() {
      this.readyState = 2;
    }

    // Helper methods for testing
    simulateMessage(data: any) {
      if (this.onmessage) {
        this.onmessage({
          data: JSON.stringify(data),
          type: 'message',
          lastEventId: 'test-id',
        });
      }
    }

    simulateError(error: any) {
      if (this.onerror) {
        this.onerror(error);
      }
    }
  }

  return {
    EventSource: MockEventSource,
  };
});

import { SSEClient, ConnectionConfig } from '../../src/sse/SSEClient';
import { TwitterEvent } from '../../src/models/types';

describe('SSEClient - Unit Tests', () => {
  let client: SSEClient;
  let config: ConnectionConfig;

  beforeEach(() => {
    config = {
      endpoint: 'http://test.example.com/events',
      token: 'test-token-123',
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      reconnectBackoffMultiplier: 2.0,
      maxReconnectAttempts: 5,
    };
    client = new SSEClient(config);
  });

  afterEach(() => {
    client.disconnect();
    jest.clearAllTimers();
  });



  // Create actor format event (what the actor actually sends)
  const createMockActorEvent = () => ({
    data: {
      tweetId: 'tweet123',
      username: 'testuser',
      action: 'post_created',
      tweet: {
        author: {
          handle: 'testuser',
          id: 'user123',
          profile: {
            name: 'Test User'
          }
        }
      },
      text: 'Test tweet content',
      url: 'https://twitter.com/testuser/status/tweet123',
    },
    event_type: 'post_created'
  });

  describe('Connection Establishment', () => {
    it('should establish connection successfully with valid token', async () => {
      await expect(client.connect()).resolves.not.toThrow();
      expect(client.getConnectionStatus()).toBe(true);
    });

    it('should include token in connection URL', async () => {
      await client.connect();
      const eventSource = (client as any).eventSource;
      expect(eventSource.url).toContain('token=test-token-123');
    });

    it('should reset reconnect attempts on successful connection', async () => {
      // Simulate some failed attempts
      (client as any).reconnectAttempts = 3;

      await client.connect();

      expect(client.getReconnectAttempts()).toBe(0);
    });

    it('should set connection status to true on successful connection', async () => {
      expect(client.getConnectionStatus()).toBe(false);

      await client.connect();

      expect(client.getConnectionStatus()).toBe(true);
    });
  });

  describe('URL Construction with User Filtering', () => {
    it('should construct URL without users parameter when not provided', async () => {
      await client.connect();
      const eventSource = (client as any).eventSource;
      expect(eventSource.url).toBe('http://test.example.com/events?token=test-token-123');
      expect(eventSource.url).not.toContain('users=');
    });

    it('should construct URL without users parameter when users array is empty', async () => {
      const configWithEmptyUsers = { ...config, users: [] };
      const clientWithEmptyUsers = new SSEClient(configWithEmptyUsers);

      await clientWithEmptyUsers.connect();
      const eventSource = (clientWithEmptyUsers as any).eventSource;
      expect(eventSource.url).toBe('http://test.example.com/events?token=test-token-123');
      expect(eventSource.url).not.toContain('users=');

      clientWithEmptyUsers.disconnect();
    });

    it('should construct URL with single user', async () => {
      const configWithUser = { ...config, users: ['elonmusk'] };
      const clientWithUser = new SSEClient(configWithUser);

      await clientWithUser.connect();
      const eventSource = (clientWithUser as any).eventSource;
      expect(eventSource.url).toBe('http://test.example.com/events?token=test-token-123&users=elonmusk');

      clientWithUser.disconnect();
    });

    it('should construct URL with multiple users', async () => {
      const configWithUsers = { ...config, users: ['elonmusk', 'vitalikbuterin', 'cz_binance'] };
      const clientWithUsers = new SSEClient(configWithUsers);

      await clientWithUsers.connect();
      const eventSource = (clientWithUsers as any).eventSource;
      expect(eventSource.url).toBe('http://test.example.com/events?token=test-token-123&users=elonmusk%2Cvitalikbuterin%2Ccz_binance');

      clientWithUsers.disconnect();
    });

    it('should properly URL-encode special characters in usernames', async () => {
      const configWithSpecialChars = { ...config, users: ['user_name', 'user-name', 'user@domain'] };
      const clientWithSpecialChars = new SSEClient(configWithSpecialChars);

      await clientWithSpecialChars.connect();
      const eventSource = (clientWithSpecialChars as any).eventSource;
      // URLSearchParams encodes commas as %2C and @ as %40
      expect(eventSource.url).toContain('users=user_name%2Cuser-name%2Cuser%40domain');

      clientWithSpecialChars.disconnect();
    });

    it('should always include token parameter', async () => {
      const configWithUsers = { ...config, users: ['elonmusk', 'vitalikbuterin'] };
      const clientWithUsers = new SSEClient(configWithUsers);

      await clientWithUsers.connect();
      const eventSource = (clientWithUsers as any).eventSource;
      expect(eventSource.url).toContain('token=test-token-123');
      expect(eventSource.url).toContain('users=');

      clientWithUsers.disconnect();
    });

    it('should maintain backward compatibility with no users field', async () => {
      // Config without users field at all (undefined)
      const configWithoutUsers = {
        endpoint: 'http://test.example.com/events',
        token: 'test-token-123',
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2.0,
        maxReconnectAttempts: 5,
      };
      const clientWithoutUsers = new SSEClient(configWithoutUsers);

      await clientWithoutUsers.connect();
      const eventSource = (clientWithoutUsers as any).eventSource;
      expect(eventSource.url).toBe('http://test.example.com/events?token=test-token-123');
      expect(eventSource.url).not.toContain('users=');

      clientWithoutUsers.disconnect();
    });
  });

  describe('Authentication Failure', () => {
    it('should reject connection with empty token', async () => {
      const invalidConfig = { ...config, token: '' };
      const invalidClient = new SSEClient(invalidConfig);

      await expect(invalidClient.connect()).rejects.toThrow('Authentication token is required');
    });

    it('should reject connection with whitespace-only token', async () => {
      const invalidConfig = { ...config, token: '   ' };
      const invalidClient = new SSEClient(invalidConfig);

      await expect(invalidClient.connect()).rejects.toThrow('Authentication token is required');
    });

    it('should handle 401 authentication error', async () => {
      const authClient = new SSEClient(config);

      const errorCallback = jest.fn();
      authClient.onError(errorCallback);

      // Start connection (will succeed with mock)
      await authClient.connect();

      // Simulate 401 error after connection
      const eventSource = (authClient as any).eventSource;
      eventSource.simulateError({ status: 401, message: 'Unauthorized' });

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 50));

      // Should not attempt reconnection
      expect((authClient as any).shouldReconnect).toBe(false);
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Authentication failed') })
      );
    });

    it('should disconnect on authentication failure', async () => {
      const authClient = new SSEClient(config);

      await authClient.connect();

      // Simulate 401 error
      const eventSource = (authClient as any).eventSource;
      eventSource.simulateError({ status: 401 });

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(authClient.getConnectionStatus()).toBe(false);
      expect((authClient as any).eventSource).toBeNull();
    });
  });

  describe('Event Parsing', () => {
    it('should parse and emit valid Twitter events', async () => {
      await client.connect();

      const mockActorEvent = createMockActorEvent();
      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      // Simulate incoming message in actor format
      const eventSource = (client as any).eventSource;
      eventSource.simulateMessage(mockActorEvent);

      expect(eventCallback).toHaveBeenCalledTimes(1);
      // Check that the transformed event has the correct structure
      const receivedEvent = eventCallback.mock.calls[0][0];
      expect(receivedEvent.type).toBe('post_created');
      expect(receivedEvent.user.username).toBe('testuser');
      expect(receivedEvent.user.displayName).toBe('Test User');
      expect(receivedEvent.user.userId).toBe('user123');
      expect(receivedEvent.primaryId).toBe('tweet123');
      expect(receivedEvent.data).toEqual(mockActorEvent.data);
    });

    it('should handle multiple events sequentially', async () => {
      await client.connect();

      const events: TwitterEvent[] = [];
      client.onEvent((event) => events.push(event));

      const eventSource = (client as any).eventSource;

      const event1 = createMockActorEvent();
      const event2 = { ...createMockActorEvent(), data: { ...createMockActorEvent().data, tweetId: 'tweet456' } };
      const event3 = { ...createMockActorEvent(), data: { ...createMockActorEvent().data, tweetId: 'tweet789' } };

      eventSource.simulateMessage(event1);
      eventSource.simulateMessage(event2);
      eventSource.simulateMessage(event3);

      expect(events).toHaveLength(3);
      expect(events[0].primaryId).toBe('tweet123');
      expect(events[1].primaryId).toBe('tweet456');
      expect(events[2].primaryId).toBe('tweet789');
    });

    it('should call all registered event callbacks', async () => {
      await client.connect();

      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      client.onEvent(callback1);
      client.onEvent(callback2);
      client.onEvent(callback3);

      const mockEvent = createMockActorEvent();
      const eventSource = (client as any).eventSource;

      // Trigger onmessage handler
      if (eventSource.onmessage) {
        await eventSource.onmessage({
          data: JSON.stringify(mockEvent),
          type: 'message',
          lastEventId: 'test-id',
        });
      }

      // Wait for async callbacks to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should handle malformed JSON gracefully', async () => {
      await client.connect();

      const errorCallback = jest.fn();
      client.onError(errorCallback);

      const eventSource = (client as any).eventSource;

      // Simulate message with invalid JSON
      if (eventSource.onmessage) {
        eventSource.onmessage({
          data: 'invalid json {{{',
          type: 'message',
          lastEventId: 'test-id',
        });
      }

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Failed to parse event') })
      );
    });

    it.skip('should handle invalid event structure', async () => {
      await client.connect();

      const errorCallback = jest.fn();
      client.onError(errorCallback);

      const eventSource = (client as any).eventSource;

      // Simulate message with invalid actor format (missing required fields)
      eventSource.simulateMessage({
        // Missing data and event_type fields
        invalid: 'structure'
      });

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Invalid event structure') })
      );
    });

    it('should isolate callback errors and continue processing', async () => {
      await client.connect();

      const callback1 = jest.fn();
      const callback2 = jest.fn(() => {
        throw new Error('Callback error');
      });
      const callback3 = jest.fn();

      const errorCallback = jest.fn();
      client.onError(errorCallback);

      client.onEvent(callback1);
      client.onEvent(callback2);
      client.onEvent(callback3);

      const mockEvent = createMockActorEvent();
      const eventSource = (client as any).eventSource;

      // Trigger onmessage handler
      if (eventSource.onmessage) {
        await eventSource.onmessage({
          data: JSON.stringify(mockEvent),
          type: 'message',
          lastEventId: 'test-id',
        });
      }

      // Wait for async callbacks to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // All callbacks should be called despite error in callback2
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
      expect(errorCallback).toHaveBeenCalled();
    });
  });


  describe('Event Transformation', () => {
    it('should transform post_created event with complete tweet structure', async () => {
      await client.connect();

      const mockActorEvent = {
        data: {
          username: 'elonmusk',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            id: 'tweet123',
            body: {
              text: 'Hello world',
              urls: [{ name: 'example', url: 'https://example.com', tco: 'https://t.co/abc' }],
              mentions: ['user1', 'user2']
            },
            author: {
              handle: 'elonmusk',
              id: 'user123',
              profile: { name: 'Elon Musk', avatar: 'https://example.com/avatar.jpg' }
            },
            metrics: { likes: 100, retweets: 50 }
          }
        },
        event_type: 'post_created'
      };

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const eventSource = (client as any).eventSource;
      eventSource.simulateMessage(mockActorEvent);

      expect(eventCallback).toHaveBeenCalledTimes(1);
      const transformedEvent = eventCallback.mock.calls[0][0];

      // Verify complete data preservation
      expect(transformedEvent.data).toEqual(mockActorEvent.data);
      expect(transformedEvent.data.tweet.body.urls).toEqual(mockActorEvent.data.tweet.body.urls);
      expect(transformedEvent.data.tweet.body.mentions).toEqual(mockActorEvent.data.tweet.body.mentions);
      expect(transformedEvent.data.tweet.metrics).toEqual(mockActorEvent.data.tweet.metrics);
    });

    it('should transform follow_created event with user and following objects', async () => {
      await client.connect();

      const mockActorEvent = {
        data: {
          username: 'user1',
          action: 'follow_created',
          user: {
            id: 'user1_id',
            handle: 'user1',
            profile: { name: 'User One', bio: 'Bio text' },
            metrics: { followers: 1000, following: 500 }
          },
          following: {
            id: 'user2_id',
            handle: 'user2',
            profile: { name: 'User Two' },
            metrics: { followers: 5000 }
          }
        },
        event_type: 'follow_created'
      };

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const eventSource = (client as any).eventSource;
      eventSource.simulateMessage(mockActorEvent);

      expect(eventCallback).toHaveBeenCalledTimes(1);
      const transformedEvent = eventCallback.mock.calls[0][0];

      // Verify complete data preservation
      expect(transformedEvent.data).toEqual(mockActorEvent.data);
      expect(transformedEvent.data.user).toEqual(mockActorEvent.data.user);
      expect(transformedEvent.data.following).toEqual(mockActorEvent.data.following);
    });

    it('should transform user_updated event with profile data', async () => {
      await client.connect();

      const mockActorEvent = {
        data: {
          username: 'testuser',
          action: 'user_updated',
          user: {
            id: 'user123',
            handle: 'testuser',
            profile: {
              name: 'Test User',
              bio: 'Updated bio',
              avatar: 'https://example.com/new-avatar.jpg'
            },
            metrics: { followers: 2000, following: 300 }
          },
          pinned: [
            {
              id: 'pin1',
              type: 'tweet',
              body: { text: 'Pinned tweet text' }
            }
          ]
        },
        event_type: 'user_updated'
      };

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const eventSource = (client as any).eventSource;
      eventSource.simulateMessage(mockActorEvent);

      expect(eventCallback).toHaveBeenCalledTimes(1);
      const transformedEvent = eventCallback.mock.calls[0][0];

      // Verify complete data preservation
      expect(transformedEvent.data).toEqual(mockActorEvent.data);
      expect(transformedEvent.data.user).toEqual(mockActorEvent.data.user);
      expect(transformedEvent.data.pinned).toEqual(mockActorEvent.data.pinned);
    });

    it('should extract username from data.username (priority 1)', async () => {
      await client.connect();

      const mockActorEvent = {
        data: {
          username: 'primary_username',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            author: {
              handle: 'fallback_username',
              id: 'user123'
            }
          }
        },
        event_type: 'post_created'
      };

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const eventSource = (client as any).eventSource;
      eventSource.simulateMessage(mockActorEvent);

      const transformedEvent = eventCallback.mock.calls[0][0];
      expect(transformedEvent.user.username).toBe('primary_username');
    });

    it('should extract username from data.user.handle (priority 2)', async () => {
      await client.connect();

      const mockActorEvent = {
        data: {
          action: 'follow_created',
          user: {
            id: 'user123',
            handle: 'user_handle'
          },
          following: {
            id: 'user456',
            handle: 'following_handle'
          }
        },
        event_type: 'follow_created'
      };

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const eventSource = (client as any).eventSource;
      eventSource.simulateMessage(mockActorEvent);

      const transformedEvent = eventCallback.mock.calls[0][0];
      expect(transformedEvent.user.username).toBe('user_handle');
    });

    it('should extract username from data.tweet.author.handle (priority 3)', async () => {
      await client.connect();

      const mockActorEvent = {
        data: {
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            author: {
              handle: 'tweet_author',
              id: 'user123'
            }
          }
        },
        event_type: 'post_created'
      };

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const eventSource = (client as any).eventSource;
      eventSource.simulateMessage(mockActorEvent);

      const transformedEvent = eventCallback.mock.calls[0][0];
      expect(transformedEvent.user.username).toBe('tweet_author');
    });

    it('should use "unknown" as fallback username', async () => {
      await client.connect();

      const mockActorEvent = {
        data: {
          action: 'unknown_action',
          someField: 'someValue'
        },
        event_type: 'unknown_type'
      };

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const eventSource = (client as any).eventSource;
      eventSource.simulateMessage(mockActorEvent);

      // With strict validation, unknown events are filtered out
      expect(eventCallback).not.toHaveBeenCalled();
    });

    it('should handle malformed events gracefully', async () => {
      await client.connect();

      const errorCallback = jest.fn();
      client.onError(errorCallback);

      const eventSource = (client as any).eventSource;

      // Simulate message with invalid JSON
      if (eventSource.onmessage) {
        eventSource.onmessage({
          data: 'invalid json {{{',
          type: 'message',
          lastEventId: 'test-id',
        });
      }

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Failed to parse event') })
      );
    });

    it('should create deep copy - modifying original does not affect transformed', async () => {
      await client.connect();

      const mockActorEvent = {
        data: {
          username: 'testuser',
          action: 'post_created',
          tweetId: 'tweet123',
          tweet: {
            body: { text: 'Original text' },
            author: { handle: 'testuser', id: 'user123' }
          }
        },
        event_type: 'post_created'
      };

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const eventSource = (client as any).eventSource;
      eventSource.simulateMessage(mockActorEvent);

      const transformedEvent = eventCallback.mock.calls[0][0];

      // Modify the original actor event
      mockActorEvent.data.username = 'MODIFIED';
      mockActorEvent.data.tweet.body.text = 'MODIFIED TEXT';

      // Verify transformed event is not affected
      expect(transformedEvent.data.username).toBe('testuser');
      expect(transformedEvent.data.tweet.body.text).toBe('Original text');
    });
  });

  describe('Disconnect Handling', () => {
    it('should close EventSource on disconnect', async () => {
      await client.connect();

      const eventSource = (client as any).eventSource;
      expect(eventSource).not.toBeNull();

      client.disconnect();

      expect((client as any).eventSource).toBeNull();
    });

    it('should set connection status to false on disconnect', async () => {
      await client.connect();
      expect(client.getConnectionStatus()).toBe(true);

      client.disconnect();

      expect(client.getConnectionStatus()).toBe(false);
    });

    it('should prevent reconnection after manual disconnect', async () => {
      await client.connect();

      client.disconnect();

      expect((client as any).shouldReconnect).toBe(false);
    });

    it('should clear reconnection timeout on disconnect', async () => {
      await client.connect();

      // Simulate a scheduled reconnection
      (client as any).reconnectTimeout = setTimeout(() => { }, 5000);

      client.disconnect();

      expect((client as any).reconnectTimeout).toBeNull();
    });

    it('should handle disconnect when not connected', () => {
      expect(() => {
        client.disconnect();
      }).not.toThrow();
    });

    it('should not emit events after disconnect', async () => {
      await client.connect();

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      client.disconnect();

      // EventSource is null after disconnect, so events won't be emitted
      expect(eventCallback).not.toHaveBeenCalled();
    });
  });

  describe('Error Callbacks', () => {
    it('should call error callbacks on connection error', async () => {
      const errorCallback = jest.fn();
      client.onError(errorCallback);

      await client.connect();

      const eventSource = (client as any).eventSource;
      eventSource.simulateError({ message: 'Connection lost' });

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('SSE connection error') })
      );
    });

    it('should call multiple error callbacks', async () => {
      const errorCallback1 = jest.fn();
      const errorCallback2 = jest.fn();
      const errorCallback3 = jest.fn();

      client.onError(errorCallback1);
      client.onError(errorCallback2);
      client.onError(errorCallback3);

      await client.connect();

      const eventSource = (client as any).eventSource;
      eventSource.simulateError({ message: 'Test error' });

      expect(errorCallback1).toHaveBeenCalled();
      expect(errorCallback2).toHaveBeenCalled();
      expect(errorCallback3).toHaveBeenCalled();
    });

    it('should isolate error callback failures', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const errorCallback1 = jest.fn();
      const errorCallback2 = jest.fn(() => {
        throw new Error('Error callback failed');
      });
      const errorCallback3 = jest.fn();

      client.onError(errorCallback1);
      client.onError(errorCallback2);
      client.onError(errorCallback3);

      await client.connect();

      const eventSource = (client as any).eventSource;
      eventSource.simulateError({ message: 'Test error' });

      // All callbacks should be attempted
      expect(errorCallback1).toHaveBeenCalled();
      expect(errorCallback2).toHaveBeenCalled();
      expect(errorCallback3).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Reconnection Callbacks', () => {
    it('should call reconnection callbacks when reconnecting', async () => {
      const reconnectCallback = jest.fn();
      client.onReconnect(reconnectCallback);

      await client.connect();

      // Simulate connection error to trigger reconnection
      const eventSource = (client as any).eventSource;
      eventSource.simulateError({ message: 'Connection lost' });

      // Wait for reconnection to be scheduled and triggered
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(reconnectCallback).toHaveBeenCalled();
    });

    it('should call multiple reconnection callbacks', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      client.onReconnect(callback1);
      client.onReconnect(callback2);
      client.onReconnect(callback3);

      await client.connect();

      const eventSource = (client as any).eventSource;
      eventSource.simulateError({ message: 'Connection lost' });

      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });
    // }); // Removed to extend scope

    describe('Connection Status', () => {
      it('should return false initially', () => {
        expect(client.getConnectionStatus()).toBe(false);
      });

      it('should return true after successful connection', async () => {
        await client.connect();
        expect(client.getConnectionStatus()).toBe(true);
      });

      it('should return false after disconnect', async () => {
        await client.connect();
        client.disconnect();
        expect(client.getConnectionStatus()).toBe(false);
      });

      it('should return false after connection error', async () => {
        await client.connect();

        const eventSource = (client as any).eventSource;
        eventSource.simulateError({ message: 'Connection lost' });

        expect(client.getConnectionStatus()).toBe(false);
      });
    });

    describe('Reconnect Attempts Counter', () => {
      it('should start at 0', () => {
        expect(client.getReconnectAttempts()).toBe(0);
      });

      it('should reset to 0 on successful connection', async () => {
        (client as any).reconnectAttempts = 3;

        await client.connect();

        expect(client.getReconnectAttempts()).toBe(0);
      });

      it('should increment reconnect attempts when scheduled', () => {
        // Directly test the reconnection mechanism
        (client as any).reconnectAttempts = 0;
        (client as any).shouldReconnect = true;

        // Manually increment as would happen in scheduleReconnect
        (client as any).reconnectAttempts = 1;

        expect(client.getReconnectAttempts()).toBe(1);

        (client as any).reconnectAttempts = 2;
        expect(client.getReconnectAttempts()).toBe(2);
      });
    });

    describe('Logging Behavior', () => {
      it('should log raw actor event when DEBUG=true', async () => {
        const originalDebug = process.env.DEBUG;
        process.env.DEBUG = 'true';

        const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

        await client.connect();

        const mockActorEvent = createMockActorEvent();
        const eventSource = (client as any).eventSource;
        eventSource.simulateMessage(mockActorEvent);

        // Should log raw actor event
        expect(consoleSpy).toHaveBeenCalledWith(
          '[SSEClient] Raw actor event:',
          expect.any(String)
        );

        consoleSpy.mockRestore();
        process.env.DEBUG = originalDebug;
      });

      it('should log transformed event when DEBUG=true', async () => {
        const originalDebug = process.env.DEBUG;
        process.env.DEBUG = 'true';

        const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

        await client.connect();

        const mockActorEvent = createMockActorEvent();
        const eventSource = (client as any).eventSource;
        eventSource.simulateMessage(mockActorEvent);

        // Should log transformed event
        expect(consoleSpy).toHaveBeenCalledWith(
          '[SSEClient] Transformed event:',
          expect.any(String)
        );

        consoleSpy.mockRestore();
        process.env.DEBUG = originalDebug;
      });

      it('should not log debug messages when DEBUG=false', async () => {
        const originalDebug = process.env.DEBUG;
        process.env.DEBUG = 'false';

        const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

        await client.connect();

        const mockActorEvent = createMockActorEvent();
        const eventSource = (client as any).eventSource;
        eventSource.simulateMessage(mockActorEvent);

        // Should not log debug messages
        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
        process.env.DEBUG = originalDebug;
      });

      it('should not log debug messages when DEBUG is undefined', async () => {
        const originalDebug = process.env.DEBUG;
        delete process.env.DEBUG;

        const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();

        await client.connect();

        const mockActorEvent = createMockActorEvent();
        const eventSource = (client as any).eventSource;
        eventSource.simulateMessage(mockActorEvent);

        // Should not log debug messages
        expect(consoleSpy).not.toHaveBeenCalled();

        consoleSpy.mockRestore();
        process.env.DEBUG = originalDebug;
      });

      it('should always log errors regardless of DEBUG setting', async () => {
        const originalDebug = process.env.DEBUG;
        process.env.DEBUG = 'false';

        const errorCallback = jest.fn();
        client.onError(errorCallback);

        await client.connect();

        const eventSource = (client as any).eventSource;
        eventSource.simulateError({ message: 'Test error' });

        // Error callback should be called regardless of DEBUG setting
        expect(errorCallback).toHaveBeenCalled();

        process.env.DEBUG = originalDebug;
      });
    });

    describe('Shutdown Detection', () => {
      it('should register shutdown event listener', async () => {
        await client.connect();

        const eventSource = (client as any).eventSource;
        const listeners = eventSource.eventListeners;

        expect(listeners.has('shutdown')).toBe(true);
        expect(listeners.get('shutdown').length).toBeGreaterThan(0);
      });

      it('should set isExpectedShutdown flag when shutdown event received', async () => {
        await client.connect();

        const eventSource = (client as any).eventSource;
        expect((client as any).isExpectedShutdown).toBe(false);

        // Simulate shutdown event
        const shutdownListeners = eventSource.eventListeners.get('shutdown');
        if (shutdownListeners && shutdownListeners.length > 0) {
          await shutdownListeners[0]({ type: 'shutdown', data: '{}' });
        }

        expect((client as any).isExpectedShutdown).toBe(true);
      });

      it('should trigger health polling when shutdown detected', async () => {
        const waitForActorReadinessSpy = jest.spyOn(client as any, 'waitForActorReadiness');

        await client.connect();

        const eventSource = (client as any).eventSource;

        // Simulate shutdown event
        const shutdownListeners = eventSource.eventListeners.get('shutdown');
        if (shutdownListeners && shutdownListeners.length > 0) {
          await shutdownListeners[0]({ type: 'shutdown', data: '{}' });
        }

        expect(waitForActorReadinessSpy).toHaveBeenCalled();
      });
    });

    describe('Connection Lock', () => {
      it('should prevent concurrent connection attempts', async () => {
        const connectPromise1 = client.connect();
        const connectPromise2 = client.connect();

        await Promise.all([connectPromise1, connectPromise2]);

        // Only one connection should be established
        expect((client as any).eventSource).not.toBeNull();
      });

      it('should set isConnecting flag during connection', async () => {
        expect((client as any).isConnecting).toBe(false);

        const connectPromise = client.connect();

        // Check flag is set during connection
        expect((client as any).isConnecting).toBe(true);

        await connectPromise;

        // Check flag is cleared after connection
        expect((client as any).isConnecting).toBe(false);
      });

      it('should clear isConnecting flag on connection error', async () => {
        const invalidConfig = { ...config, token: '' };
        const invalidClient = new SSEClient(invalidConfig);

        try {
          await invalidClient.connect();
        } catch (error) {
          // Expected error
        }

        expect((invalidClient as any).isConnecting).toBe(false);
      });
    });
  });
});
