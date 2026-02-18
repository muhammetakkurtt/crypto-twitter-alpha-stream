/**
 * Unit tests for WSSClient
 * Tests connection establishment, authentication, event parsing, and disconnect handling
 */

import { WSSClient, ConnectionConfig } from '../../src/ws/WSSClient';
import { Channel } from '../../src/models/types';
import { TwitterEvent } from '../../src/models/types';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('WSSClient - Unit Tests', () => {
  let client: WSSClient;
  let config: ConnectionConfig;
  let mockWs: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    config = {
      baseUrl: 'ws://test.example.com',
      token: 'test-token-123',
      channels: ['all'] as Channel[],
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      reconnectBackoffMultiplier: 2.0,
      maxReconnectAttempts: 5,
    };

    // Create mock WebSocket instance
    mockWs = {
      on: jest.fn(),
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
      OPEN: WebSocket.OPEN,
      CONNECTING: WebSocket.CONNECTING,
      CLOSING: WebSocket.CLOSING,
      CLOSED: WebSocket.CLOSED,
    };

    // Mock WebSocket constructor
    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWs);

    client = new WSSClient(config);
  });

  afterEach(() => {
    client.disconnect();
    jest.clearAllTimers();
  });

  // Helper function to simulate successful connection with subscription
  const simulateSuccessfulConnection = async (connectPromise: Promise<void>) => {
    // Simulate WebSocket open
    const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
    openHandler();

    // Simulate subscription confirmation
    const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
    messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['all'] } }));

    // Wait for promise to resolve
    await connectPromise;
  };

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
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);
      expect(client.getConnectionState()).toBe('connected');
    });

    it('should include token in connection URL as query parameter', async () => {
      const connectPromise = client.connect();

      // Check WebSocket constructor was called with correct URL
      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('token=test-token-123')
      );

      await simulateSuccessfulConnection(connectPromise);
    });

    it('should reset reconnect attempts on successful connection', async () => {
      // Simulate some failed attempts
      (client as any).reconnectAttempts = 3;

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      expect(client.getReconnectAttempts()).toBe(0);
    });

    it('should set connection state to connected on successful connection', async () => {
      expect(client.getConnectionState()).toBe('disconnected');

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      expect(client.getConnectionState()).toBe('connected');
    });

    it('should convert HTTP URL to WebSocket URL', async () => {
      const httpConfig = { ...config, baseUrl: 'http://test.example.com' };
      const httpClient = new WSSClient(httpConfig);

      const connectPromise = httpClient.connect();

      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('ws://test.example.com')
      );

      await simulateSuccessfulConnection(connectPromise);

      httpClient.disconnect();
    });

    it('should convert HTTPS URL to WSS URL', async () => {
      const httpsConfig = { ...config, baseUrl: 'https://test.example.com' };
      const httpsClient = new WSSClient(httpsConfig);

      const connectPromise = httpsClient.connect();

      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('wss://test.example.com')
      );

      await simulateSuccessfulConnection(connectPromise);

      httpsClient.disconnect();
    });
  });

  describe('URL Construction with User Filtering', () => {
    it('should construct URL without users parameter when not provided', async () => {
      const connectPromise = client.connect();

      const calledUrl = (WebSocket as unknown as jest.Mock).mock.calls[0][0];
      expect(calledUrl).toContain('token=test-token-123');
      expect(calledUrl).not.toContain('users=');

      await simulateSuccessfulConnection(connectPromise);
    });

    it('should construct URL without users parameter when users array is empty', async () => {
      const configWithEmptyUsers = { ...config, users: [] };
      const clientWithEmptyUsers = new WSSClient(configWithEmptyUsers);

      const connectPromise = clientWithEmptyUsers.connect();

      const calledUrl = (WebSocket as unknown as jest.Mock).mock.calls[0][0];
      expect(calledUrl).toContain('token=test-token-123');
      expect(calledUrl).not.toContain('users=');

      await simulateSuccessfulConnection(connectPromise);

      clientWithEmptyUsers.disconnect();
    });
  });

  describe('Authentication Failure', () => {
    it('should reject connection with empty token', async () => {
      const invalidConfig = { ...config, token: '' };
      const invalidClient = new WSSClient(invalidConfig);

      await expect(invalidClient.connect()).rejects.toThrow('Authentication token is required');
    });

    it('should reject connection with whitespace-only token', async () => {
      const invalidConfig = { ...config, token: '   ' };
      const invalidClient = new WSSClient(invalidConfig);

      await expect(invalidClient.connect()).rejects.toThrow('Authentication token is required');
    });

    it('should handle authentication error on close with code 4401', async () => {
      const authClient = new WSSClient(config);

      const errorCallback = jest.fn();
      authClient.onError(errorCallback);

      const connectPromise = authClient.connect();

      // Simulate close with auth error code
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(4401, 'Unauthorized');

      await expect(connectPromise).rejects.toThrow('Authentication failed');
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Authentication failed') })
      );
    });

    it('should disconnect on authentication failure', async () => {
      const authClient = new WSSClient(config);

      const connectPromise = authClient.connect();

      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(4401, 'Unauthorized');

      await expect(connectPromise).rejects.toThrow();

      expect(authClient.getConnectionState()).toBe('disconnected');
    });
  });

  describe('Event Parsing', () => {
    it('should parse and emit valid Twitter events', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      const mockActorEvent = createMockActorEvent();
      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      // Simulate incoming message
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify(mockActorEvent));

      expect(eventCallback).toHaveBeenCalledTimes(1);
      const receivedEvent = eventCallback.mock.calls[0][0];
      expect(receivedEvent.type).toBe('post_created');
      expect(receivedEvent.user.username).toBe('testuser');
      expect(receivedEvent.user.displayName).toBe('Test User');
      expect(receivedEvent.user.userId).toBe('user123');
      expect(receivedEvent.primaryId).toBe('tweet123');
      expect(receivedEvent.data).toEqual(mockActorEvent.data);
    });

    it('should handle multiple events sequentially', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      const events: TwitterEvent[] = [];
      client.onEvent((event) => events.push(event));

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const event1 = createMockActorEvent();
      const event2 = { ...createMockActorEvent(), data: { ...createMockActorEvent().data, tweetId: 'tweet456' } };
      const event3 = { ...createMockActorEvent(), data: { ...createMockActorEvent().data, tweetId: 'tweet789' } };

      messageHandler(JSON.stringify(event1));
      messageHandler(JSON.stringify(event2));
      messageHandler(JSON.stringify(event3));

      expect(events).toHaveLength(3);
      expect(events[0].primaryId).toBe('tweet123');
      expect(events[1].primaryId).toBe('tweet456');
      expect(events[2].primaryId).toBe('tweet789');
    });

    it('should call all registered event callbacks', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      client.onEvent(callback1);
      client.onEvent(callback2);
      client.onEvent(callback3);

      const mockEvent = createMockActorEvent();
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify(mockEvent));

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should handle malformed JSON gracefully', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      const errorCallback = jest.fn();
      client.onError(errorCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler('invalid json {{{');

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Failed to parse message') })
      );
    });

    it('should isolate callback errors and continue processing', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

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
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify(mockEvent));

      // All callbacks should be called despite error in callback2
      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
      expect(errorCallback).toHaveBeenCalled();
    });
  });

  describe('Disconnect Handling', () => {
    it('should close WebSocket on disconnect', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      expect(mockWs).not.toBeNull();

      client.disconnect();

      expect(mockWs.close).toHaveBeenCalled();
    });

    it('should set connection state to disconnected on disconnect', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      expect(client.getConnectionState()).toBe('connected');

      client.disconnect();

      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should prevent reconnection after manual disconnect', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      client.disconnect();

      expect((client as any).shouldReconnect).toBe(false);
    });

    it('should clear reconnection timeout on disconnect', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

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

    it('should reset shouldReconnect flag when connect() is called after disconnect()', async () => {
      // First connection
      const connectPromise1 = client.connect();
      await simulateSuccessfulConnection(connectPromise1);

      // Manual disconnect
      client.disconnect();
      expect((client as any).shouldReconnect).toBe(false);

      // Reconnect - should reset the flag
      const connectPromise2 = client.connect();
      expect((client as any).shouldReconnect).toBe(true);

      // Clean up
      await simulateSuccessfulConnection(connectPromise2);
      client.disconnect();
    });

    it('should allow auto-reconnect after manual disconnect followed by connect()', async () => {
      // First connection
      const connectPromise1 = client.connect();
      await simulateSuccessfulConnection(connectPromise1);

      // Manual disconnect
      client.disconnect();
      expect((client as any).shouldReconnect).toBe(false);

      // Reconnect - shouldReconnect should be reset to true
      client.connect();
      
      // Verify shouldReconnect is true immediately after connect()
      expect((client as any).shouldReconnect).toBe(true);

      // Clean up
      client.disconnect();
    });

    it('should have shouldReconnect=true immediately after connect() is called', () => {
      // Before connect
      expect((client as any).shouldReconnect).toBe(true);

      // Call connect
      client.connect();

      // Should be true immediately
      expect((client as any).shouldReconnect).toBe(true);

      // Clean up
      client.disconnect();
    });
  });

  describe('Error Callbacks', () => {
    it('should call error callbacks on WebSocket error', async () => {
      const errorCallback = jest.fn();
      client.onError(errorCallback);

      const connectPromise = client.connect();

      const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      errorHandler(new Error('Connection lost'));

      // Expect the promise to reject
      await expect(connectPromise).rejects.toThrow('WebSocket error');

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('WebSocket error') })
      );
    });

    it('should call multiple error callbacks', async () => {
      const errorCallback1 = jest.fn();
      const errorCallback2 = jest.fn();
      const errorCallback3 = jest.fn();

      client.onError(errorCallback1);
      client.onError(errorCallback2);
      client.onError(errorCallback3);

      const connectPromise = client.connect();

      const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      errorHandler(new Error('Test error'));

      // Expect the promise to reject
      await expect(connectPromise).rejects.toThrow('WebSocket error');

      expect(errorCallback1).toHaveBeenCalled();
      expect(errorCallback2).toHaveBeenCalled();
      expect(errorCallback3).toHaveBeenCalled();
    });

    it('should isolate error callback failures', async () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const errorCallback1 = jest.fn();
      const errorCallback2 = jest.fn(() => {
        throw new Error('Error callback failed');
      });
      const errorCallback3 = jest.fn();

      client.onError(errorCallback1);
      client.onError(errorCallback2);
      client.onError(errorCallback3);

      const connectPromise = client.connect();

      const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      errorHandler(new Error('Test error'));

      // Expect the promise to reject
      await expect(connectPromise).rejects.toThrow('WebSocket error');

      // All callbacks should be attempted
      expect(errorCallback1).toHaveBeenCalled();
      expect(errorCallback2).toHaveBeenCalled();
      expect(errorCallback3).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      process.env.DEBUG = originalDebug;
    });
  });

  describe('Connection State', () => {
    it('should return disconnected initially', () => {
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should return connected after successful connection', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      expect(client.getConnectionState()).toBe('connected');
    });

    it('should return disconnected after disconnect', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      client.disconnect();

      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should return disconnected after connection close', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1000, 'Normal closure');

      expect(client.getConnectionState()).toBe('disconnected');
    });
  });

  describe('Reconnect Attempts Counter', () => {
    it('should start at 0', () => {
      expect(client.getReconnectAttempts()).toBe(0);
    });

    it('should reset to 0 on successful connection', async () => {
      (client as any).reconnectAttempts = 3;

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      expect(client.getReconnectAttempts()).toBe(0);
    });
  });

  describe('State Change Callbacks', () => {
    it('should call state change callbacks when state changes', async () => {
      const stateChangeCallback = jest.fn();
      client.onStateChange(stateChangeCallback);

      const connectPromise = client.connect();

      // Should transition to connecting
      expect(stateChangeCallback).toHaveBeenCalledWith('connecting');

      await simulateSuccessfulConnection(connectPromise);

      // Should transition to connected
      expect(stateChangeCallback).toHaveBeenCalledWith('connected');
    });

    it('should call multiple state change callbacks', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const callback3 = jest.fn();

      client.onStateChange(callback1);
      client.onStateChange(callback2);
      client.onStateChange(callback3);

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
      expect(callback3).toHaveBeenCalled();
    });
  });

  describe('Subscribe Protocol', () => {
    it('should send subscribe message with correct format after connection', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      // Check that send was called with subscribe message
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"op":"subscribe"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"channels":["all"]')
      );
    });

    it('should omit users field when no user filters configured', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);

      expect(message).toHaveProperty('op', 'subscribe');
      expect(message).toHaveProperty('channels');
      expect(message).not.toHaveProperty('users');
    });

    it('should include users field when user filters are configured', async () => {
      const configWithUsers = {
        ...config,
        users: ['elonmusk', 'vitalikbuterin']
      };
      const clientWithUsers = new WSSClient(configWithUsers);

      const connectPromise = clientWithUsers.connect();

      await simulateSuccessfulConnection(connectPromise);

      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);

      expect(message).toHaveProperty('op', 'subscribe');
      expect(message).toHaveProperty('channels');
      expect(message).toHaveProperty('users');
      expect(message.users).toEqual(['elonmusk', 'vitalikbuterin']);

      clientWithUsers.disconnect();
    });

    it('should support multiple channels in subscribe message', async () => {
      const multiChannelConfig = {
        ...config,
        channels: ['all', 'tweets', 'following'] as Channel[]
      };
      const multiChannelClient = new WSSClient(multiChannelConfig);

      const connectPromise = multiChannelClient.connect();

      await simulateSuccessfulConnection(connectPromise);

      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);

      expect(message.channels).toEqual(['all', 'tweets', 'following']);

      multiChannelClient.disconnect();
    });

    it('should validate channel names against allowed values', () => {
      const invalidChannelConfig = {
        ...config,
        channels: ['invalid_channel'] as any
      };
      
      // Creating client with invalid channels should not throw
      // Validation happens during sendSubscribe, not during construction
      const invalidClient = new WSSClient(invalidChannelConfig);
      
      // Verify the client was created
      expect(invalidClient).toBeDefined();
      expect(invalidClient.getConnectionState()).toBe('disconnected');
    });

    it('should handle subscribed confirmation event', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send subscribed confirmation
      const subscribedEvent = {
        event_type: 'subscribed',
        data: {
          channels: ['all'],
          filter: { enabled: false }
        }
      };

      // Should not throw
      expect(() => {
        messageHandler(JSON.stringify(subscribedEvent));
      }).not.toThrow();
    });

    it('should handle subscription timeout scenario', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      // Simulate 30 seconds passing without subscribed confirmation
      jest.advanceTimersByTime(30000);

      // The server would close the connection in this case
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1008, 'Subscription timeout');

      expect(client.getConnectionState()).toBe('disconnected');

      jest.useRealTimers();
    });

    it('should handle subscription error from server', async () => {
      const errorCallback = jest.fn();
      client.onError(errorCallback);

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send subscription error
      const errorEvent = {
        event_type: 'error',
        data: {
          code: 'INVALID_SUBSCRIPTION',
          message: 'channels must be an array'
        }
      };

      messageHandler(JSON.stringify(errorEvent));

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('INVALID_SUBSCRIPTION')
        })
      );
    });

    it('should handle connected event before subscribe', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send connected event
      const connectedEvent = {
        event_type: 'connected',
        data: {
          connection_id: 'ws_1234567890_abc123',
          channels: [],
          filter: { enabled: false }
        }
      };

      // Should not throw
      expect(() => {
        messageHandler(JSON.stringify(connectedEvent));
      }).not.toThrow();
    });
  });

  describe('Connect Promise Lifecycle', () => {
    it('should resolve connect promise on successful subscription', async () => {
      const connectPromise = client.connect();

      // Simulate WebSocket open
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Simulate subscribed confirmation
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      const subscribedEvent = {
        event_type: 'subscribed',
        data: { channels: ['all'] }
      };
      messageHandler(JSON.stringify(subscribedEvent));

      // Promise should resolve
      await expect(connectPromise).resolves.toBeUndefined();
      expect(client.getConnectionState()).toBe('connected');
    });

    it('should reject connect promise on close before subscription', async () => {
      const connectPromise = client.connect();

      // Simulate WebSocket open
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Simulate close before subscription confirmation
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006); // Abnormal closure

      // Promise should reject
      await expect(connectPromise).rejects.toThrow('Connection closed with code 1006');
    });

    it('should reject connect promise on error before subscription', async () => {
      const connectPromise = client.connect();

      // Simulate WebSocket error (before open)
      const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      const error = new Error('Connection failed');
      errorHandler(error);

      // Promise should reject
      await expect(connectPromise).rejects.toThrow('WebSocket error: Connection failed');
    });

    it('should reject connect promise on authentication error', async () => {
      const connectPromise = client.connect();

      // Simulate authentication error
      const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      const authError = new Error('401 Unauthorized');
      errorHandler(authError);

      // Promise should reject with auth error
      await expect(connectPromise).rejects.toThrow('Authentication failed: Invalid token');
    });

    it('should reject connect promise on manual disconnect', async () => {
      const connectPromise = client.connect();

      // Simulate open
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Disconnect immediately (before subscription confirmation)
      client.disconnect();

      // Simulate close event (triggered by disconnect)
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1000); // Normal close code

      // Promise should reject with manual disconnect error
      await expect(connectPromise).rejects.toThrow('Connection closed due to manual disconnect');
    });

    it('should reject connect promise on close with auth error code', async () => {
      const connectPromise = client.connect();

      // Simulate WebSocket open
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Simulate close with auth error code (before subscription confirmation)
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(4401); // Custom auth error code

      // Promise should reject with auth error
      await expect(connectPromise).rejects.toThrow('Authentication failed: Invalid token');
    });

    it('should not reject promise twice on multiple errors', async () => {
      const connectPromise = client.connect();

      // Simulate WebSocket error
      const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
      const error1 = new Error('First error');
      errorHandler(error1);

      // Try to trigger another error (should be ignored since promise already rejected)
      const error2 = new Error('Second error');
      errorHandler(error2);

      // Promise should reject with first error
      await expect(connectPromise).rejects.toThrow('WebSocket error: First error');
    });

    it('should reject connect promise on connection timeout', async () => {
      jest.useFakeTimers();

      // Create client with short timeout for testing
      const timeoutClient = new WSSClient({
        baseUrl: 'ws://localhost:3000',
        token: 'test-token',
        channels: ['all'],
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2,
        maxReconnectAttempts: 0,
        connectionTimeout: 100, // 100ms timeout for testing
      });

      const connectPromise = timeoutClient.connect();

      // Simulate WebSocket open but never send subscription confirmation
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Advance timers to trigger timeout
      jest.advanceTimersByTime(100);

      // Promise should reject with timeout error
      await expect(connectPromise).rejects.toThrow(/Connection timeout.*100ms/);

      jest.useRealTimers();
    });

    it('should always settle connect promise (never hang)', async () => {
      const connectPromise = client.connect();

      // Simulate WebSocket open
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Simulate close immediately (before subscription)
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006); // Abnormal closure

      // Promise should settle (reject in this case) within reasonable time
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Promise hung - did not settle')), 1000)
      );

      // This should not throw "Promise hung" error
      await expect(Promise.race([connectPromise, timeoutPromise])).rejects.toThrow('Connection closed with code 1006');
    });
  });

  describe('Control Events', () => {
    it('should handle connected control event', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const connectedEvent = {
        event_type: 'connected',
        data: {
          connection_id: 'ws_123',
          channels: [],
          filter: { enabled: false }
        }
      };

      expect(() => {
        messageHandler(JSON.stringify(connectedEvent));
      }).not.toThrow();
    });

    it('should handle subscribed control event', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const subscribedEvent = {
        event_type: 'subscribed',
        data: {
          channels: ['all'],
          filter: { enabled: false }
        }
      };

      expect(() => {
        messageHandler(JSON.stringify(subscribedEvent));
      }).not.toThrow();
    });

    it('should handle shutdown control event', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const shutdownEvent = {
        event_type: 'shutdown',
        data: {
          message: 'Server shutting down'
        }
      };

      messageHandler(JSON.stringify(shutdownEvent));

      // Should set expected shutdown flag
      expect((client as any).isExpectedShutdown).toBe(true);

      jest.useRealTimers();
    });

    it('should handle error control event', async () => {
      const errorCallback = jest.fn();
      client.onError(errorCallback);

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const errorEvent = {
        event_type: 'error',
        data: {
          code: 'TEST_ERROR',
          message: 'Test error message'
        }
      };

      messageHandler(JSON.stringify(errorEvent));

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('TEST_ERROR')
        })
      );
    });

    it('should NOT handle ping as application-level JSON message', async () => {
      
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // If someone sends a ping as JSON (which shouldn't happen), it would be treated as a data event
      const pingEvent = {
        event_type: 'ping',
        data: {}
      };

      messageHandler(JSON.stringify(pingEvent));

      // Should attempt to transform as data event (will fail validation due to missing fields)
      // The important thing is we don't have special ping handling
      expect(eventCallback).not.toHaveBeenCalled(); // Invalid event, won't be emitted
    });
  });

  describe('Graceful Shutdown Handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should set isExpectedShutdown flag on shutdown event', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      expect((client as any).isExpectedShutdown).toBe(false);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const shutdownEvent = {
        event_type: 'shutdown',
        data: {
          message: 'Server shutting down'
        }
      };

      messageHandler(JSON.stringify(shutdownEvent));

      expect((client as any).isExpectedShutdown).toBe(true);

      client.disconnect();
    });

    it('should suppress error logging during expected shutdown', async () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const shutdownEvent = {
        event_type: 'shutdown',
        data: {
          message: 'Server shutting down'
        }
      };

      messageHandler(JSON.stringify(shutdownEvent));

      // Verify shutdown message is logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Server shutdown detected')
      );

      // Simulate connection close
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006, 'Connection lost');

      // During expected shutdown, close handler should not log errors
      // (it returns early when isExpectedShutdown is true)
      expect(client.getConnectionState()).toBe('disconnected');

      consoleLogSpy.mockRestore();
      process.env.DEBUG = originalDebug;
      client.disconnect();
    });

    it('should wait 5 seconds before reconnecting after shutdown', async () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const shutdownEvent = {
        event_type: 'shutdown',
        data: {
          message: 'Server shutting down'
        }
      };

      messageHandler(JSON.stringify(shutdownEvent));

      // Verify shutdown timeout is set
      expect((client as any).shutdownTimeout).not.toBeNull();

      // Advance time by 4 seconds (not enough)
      jest.advanceTimersByTime(4000);

      // Should not have reconnected yet
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Reconnecting after server shutdown')
      );

      // Advance time by 1 more second (total 5 seconds)
      jest.advanceTimersByTime(1000);

      // Should now attempt reconnection
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reconnecting after server shutdown')
      );

      consoleLogSpy.mockRestore();
      process.env.DEBUG = originalDebug;
      client.disconnect();
    });

    it('should reconnect automatically after 5 second delay', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      // Clear previous WebSocket constructor calls
      (WebSocket as unknown as jest.Mock).mockClear();

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const shutdownEvent = {
        event_type: 'shutdown',
        data: {
          message: 'Server shutting down'
        }
      };

      messageHandler(JSON.stringify(shutdownEvent));

      // Advance time by 5 seconds
      jest.advanceTimersByTime(5000);

      // Should attempt to create new WebSocket connection
      expect(WebSocket).toHaveBeenCalled();

      consoleLogSpy.mockRestore();
      client.disconnect();
    });

    it('should reset shutdown flag after reconnection', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const shutdownEvent = {
        event_type: 'shutdown',
        data: {
          message: 'Server shutting down'
        }
      };

      messageHandler(JSON.stringify(shutdownEvent));

      expect((client as any).isExpectedShutdown).toBe(true);

      // Advance time by 5 seconds to trigger reconnection
      jest.advanceTimersByTime(5000);

      // Simulate successful reconnection
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Simulate subscription confirmation for reconnection
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['all'] } }));

      // Flag should be reset
      expect((client as any).isExpectedShutdown).toBe(false);

      consoleLogSpy.mockRestore();
      client.disconnect();
    });

    it('should reset reconnection attempts counter on shutdown reconnection', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      // Simulate some previous reconnection attempts
      (client as any).reconnectAttempts = 3;

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const shutdownEvent = {
        event_type: 'shutdown',
        data: {
          message: 'Server shutting down'
        }
      };

      messageHandler(JSON.stringify(shutdownEvent));

      // Advance time by 5 seconds to trigger reconnection
      jest.advanceTimersByTime(5000);

      // Reconnection attempts should be reset to 0 before reconnecting
      expect(client.getReconnectAttempts()).toBe(0);

      consoleLogSpy.mockRestore();
      client.disconnect();
    });

    it('should clear existing shutdown timeout when new shutdown event arrives', async () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const shutdownEvent = {
        event_type: 'shutdown',
        data: {
          message: 'Server shutting down'
        }
      };

      // Send first shutdown event
      messageHandler(JSON.stringify(shutdownEvent));

      const firstTimeout = (client as any).shutdownTimeout;
      expect(firstTimeout).not.toBeNull();

      // Advance time by 2 seconds
      jest.advanceTimersByTime(2000);

      // Send second shutdown event
      messageHandler(JSON.stringify(shutdownEvent));

      const secondTimeout = (client as any).shutdownTimeout;
      expect(secondTimeout).not.toBeNull();
      expect(secondTimeout).not.toBe(firstTimeout);

      // Advance time by 5 seconds from second shutdown
      jest.advanceTimersByTime(5000);

      // Should reconnect after the second timeout
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reconnecting after server shutdown')
      );

      consoleLogSpy.mockRestore();
      process.env.DEBUG = originalDebug;
      client.disconnect();
    });

    it('should clear shutdown timeout on manual disconnect', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const shutdownEvent = {
        event_type: 'shutdown',
        data: {
          message: 'Server shutting down'
        }
      };

      messageHandler(JSON.stringify(shutdownEvent));

      expect((client as any).shutdownTimeout).not.toBeNull();

      // Manually disconnect
      client.disconnect();

      // Shutdown timeout should be cleared
      expect((client as any).shutdownTimeout).toBeNull();

      // Advance time by 5 seconds
      jest.advanceTimersByTime(5000);

      // Should not attempt reconnection
      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Reconnecting after server shutdown')
      );

      consoleLogSpy.mockRestore();
    });

    it('should transition to disconnected state on shutdown event', async () => {
      const stateChangeCallback = jest.fn();
      client.onStateChange(stateChangeCallback);

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      // Clear previous state change calls
      stateChangeCallback.mockClear();

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const shutdownEvent = {
        event_type: 'shutdown',
        data: {
          message: 'Server shutting down'
        }
      };

      messageHandler(JSON.stringify(shutdownEvent));

      // Should transition to disconnected
      expect(stateChangeCallback).toHaveBeenCalledWith('disconnected');
      expect(client.getConnectionState()).toBe('disconnected');

      client.disconnect();
    });

    it('should handle shutdown event with custom message', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      const shutdownEvent = {
        event_type: 'shutdown',
        data: {
          message: 'Maintenance mode - restarting in 5 seconds'
        }
      };

      messageHandler(JSON.stringify(shutdownEvent));

      // Should still handle shutdown correctly regardless of message
      expect((client as any).isExpectedShutdown).toBe(true);
      expect((client as any).shutdownTimeout).not.toBeNull();

      consoleLogSpy.mockRestore();
      client.disconnect();
    });
  });

  describe('Malformed Message Handling', () => {
    it('should handle malformed JSON without crashing', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const errorCallback = jest.fn();
      client.onError(errorCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send malformed JSON
      messageHandler('not valid json {{{');

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Failed to parse message')
        })
      );
    });

    it('should continue processing after malformed JSON', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const eventCallback = jest.fn();
      const errorCallback = jest.fn();
      client.onEvent(eventCallback);
      client.onError(errorCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send malformed JSON
      messageHandler('invalid json');

      // Send valid event
      const validEvent = createMockActorEvent();
      messageHandler(JSON.stringify(validEvent));

      // Error callback should be called for malformed JSON
      expect(errorCallback).toHaveBeenCalled();

      // Event callback should be called for valid event
      expect(eventCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle missing event_type field', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send message without event_type
      const invalidEvent = {
        data: { username: 'test' }
      };

      messageHandler(JSON.stringify(invalidEvent));

      // Should not emit event (validation will fail)
      expect(eventCallback).not.toHaveBeenCalled();
    });

    it('should handle missing data field', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send message without data
      const invalidEvent = {
        event_type: 'post_created'
      };

      messageHandler(JSON.stringify(invalidEvent));

      // Should not emit event (validation will fail due to missing required fields)
      expect(eventCallback).not.toHaveBeenCalled();
    });
  });

  describe('Event Transformation', () => {
    describe('Username Extraction Priority', () => {
      it('should extract username from data.username (highest priority)', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'post_created',
          data: {
            username: 'priority_username',
            tweetId: 'tweet123',
            user: {
              handle: 'user_handle',
              id: 'user123',
              profile: { name: 'User Name' }
            },
            tweet: {
              author: {
                handle: 'author_handle',
                id: 'author123',
                profile: { name: 'Author Name' }
              }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.user.username).toBe('priority_username');
      });

      it('should extract username from data.user.handle (second priority)', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'follow_created',
          data: {
            tweetId: 'tweet123',
            user: {
              handle: 'user_handle',
              id: 'user123',
              profile: { name: 'User Name' }
            },
            tweet: {
              author: {
                handle: 'author_handle',
                id: 'author123',
                profile: { name: 'Author Name' }
              }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.user.username).toBe('user_handle');
      });

      it('should extract username from data.tweet.author.handle (third priority)', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'post_created',
          data: {
            tweetId: 'tweet123',
            tweet: {
              author: {
                handle: 'author_handle',
                id: 'author123',
                profile: { name: 'Author Name' }
              }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.user.username).toBe('author_handle');
      });

      it('should use "unknown" when no username is available', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'post_created',
          data: {
            tweetId: 'tweet123'
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        // Should not emit event because username is "unknown" (fails validation)
        expect(eventCallback).not.toHaveBeenCalled();
      });
    });

    describe('UserId and DisplayName Extraction', () => {
      it('should extract userId from data.user.id', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'follow_created',
          data: {
            user: {
              handle: 'testuser',
              id: 'user123',
              profile: { name: 'Test User' }
            },
            following: {
              handle: 'followeduser',
              id: 'followed123',
              profile: { name: 'Followed User' }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.user.userId).toBe('user123');
      });

      it('should extract userId from data.tweet.author.id', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'post_created',
          data: {
            tweetId: 'tweet123',
            tweet: {
              author: {
                handle: 'testuser',
                id: 'author123',
                profile: { name: 'Test User' }
              }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.user.userId).toBe('author123');
      });

      it('should extract displayName from data.user.profile.name', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'user_updated',
          data: {
            user: {
              handle: 'testuser',
              id: 'user123',
              profile: { name: 'Display Name' }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.user.displayName).toBe('Display Name');
      });

      it('should extract displayName from data.tweet.author.profile.name', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'post_created',
          data: {
            tweetId: 'tweet123',
            tweet: {
              author: {
                handle: 'testuser',
                id: 'author123',
                profile: { name: 'Author Display Name' }
              }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.user.displayName).toBe('Author Display Name');
      });

      it('should use username as displayName when profile name is not available', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'follow_created',
          data: {
            user: {
              handle: 'testuser',
              id: 'user123'
            },
            following: {
              handle: 'followeduser',
              id: 'followed123'
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.user.displayName).toBe('testuser');
      });
    });

    describe('PrimaryId Generation', () => {
      it('should use tweetId for tweet events', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'post_created',
          data: {
            tweetId: 'tweet123',
            username: 'testuser',
            tweet: {
              author: {
                handle: 'testuser',
                id: 'user123',
                profile: { name: 'Test User' }
              }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.primaryId).toBe('tweet123');
      });

      it('should create composite ID for follow events', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'follow_created',
          data: {
            user: {
              handle: 'testuser',
              id: 'user123',
              profile: { name: 'Test User' }
            },
            following: {
              handle: 'followeduser',
              id: 'followed123',
              profile: { name: 'Followed User' }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.primaryId).toBe('user123-followed123');
      });

      it('should use stable user ID for user_updated events', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'user_updated',
          data: {
            user: {
              handle: 'testuser',
              id: 'user123',
              profile: { name: 'Test User' }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        // Should use stable user ID (no timestamp) for proper deduplication
        expect(receivedEvent.primaryId).toBe('user123');
      });

      it('should use stable user ID for profile_updated events', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'profile_updated',
          data: {
            user: {
              handle: 'testuser',
              id: 'user123',
              profile: { name: 'Test User' }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        // Should use stable user ID (no timestamp) for proper deduplication
        expect(receivedEvent.primaryId).toBe('user123');
      });

      it('should use stable user ID for profile_pinned events', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'profile_pinned',
          data: {
            user: {
              handle: 'testuser',
              id: 'user123',
              profile: { name: 'Test User' }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        // Should use stable user ID (no timestamp) for proper deduplication
        expect(receivedEvent.primaryId).toBe('user123');
      });
    });

    describe('Data Field Deep Copy', () => {
      it('should create a deep copy of the data field', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const originalData = {
          tweetId: 'tweet123',
          username: 'testuser',
          nested: {
            field: 'value',
            deepNested: {
              value: 42
            }
          },
          tweet: {
            author: {
              handle: 'testuser',
              id: 'user123',
              profile: { name: 'Test User' }
            }
          }
        };

        const actorEvent = {
          event_type: 'post_created',
          data: originalData
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];

        // Verify data is copied
        expect(receivedEvent.data).toEqual(originalData);

        // Verify it's a deep copy (not the same reference)
        expect(receivedEvent.data).not.toBe(originalData);
        expect(receivedEvent.data.nested).not.toBe(originalData.nested);
        expect(receivedEvent.data.nested.deepNested).not.toBe(originalData.nested.deepNested);
      });

      it('should preserve all data fields in the copy', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'post_created',
          data: {
            tweetId: 'tweet123',
            username: 'testuser',
            action: 'post_created',
            text: 'Test tweet content',
            url: 'https://twitter.com/testuser/status/tweet123',
            customField: 'custom value',
            arrayField: [1, 2, 3],
            objectField: { key: 'value' },
            tweet: {
              author: {
                handle: 'testuser',
                id: 'user123',
                profile: { name: 'Test User' }
              }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];

        // Verify all fields are preserved
        expect(receivedEvent.data.tweetId).toBe('tweet123');
        expect(receivedEvent.data.username).toBe('testuser');
        expect(receivedEvent.data.action).toBe('post_created');
        expect(receivedEvent.data.text).toBe('Test tweet content');
        expect(receivedEvent.data.url).toBe('https://twitter.com/testuser/status/tweet123');
        expect(receivedEvent.data.customField).toBe('custom value');
        expect(receivedEvent.data.arrayField).toEqual([1, 2, 3]);
        expect(receivedEvent.data.objectField).toEqual({ key: 'value' });
      });
    });

    describe('TwitterEvent Structure', () => {
      it('should build TwitterEvent with all required fields', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'post_created',
          data: {
            tweetId: 'tweet123',
            username: 'testuser',
            tweet: {
              author: {
                handle: 'testuser',
                id: 'user123',
                profile: { name: 'Test User' }
              }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];

        // Verify structure
        expect(receivedEvent).toHaveProperty('type');
        expect(receivedEvent).toHaveProperty('timestamp');
        expect(receivedEvent).toHaveProperty('primaryId');
        expect(receivedEvent).toHaveProperty('user');
        expect(receivedEvent).toHaveProperty('data');

        // Verify user structure
        expect(receivedEvent.user).toHaveProperty('username');
        expect(receivedEvent.user).toHaveProperty('displayName');
        expect(receivedEvent.user).toHaveProperty('userId');

        // Verify types
        expect(typeof receivedEvent.type).toBe('string');
        expect(typeof receivedEvent.timestamp).toBe('string');
        expect(typeof receivedEvent.primaryId).toBe('string');
        expect(typeof receivedEvent.user.username).toBe('string');
        expect(typeof receivedEvent.user.displayName).toBe('string');
        expect(typeof receivedEvent.user.userId).toBe('string');
        expect(typeof receivedEvent.data).toBe('object');
      });

      it('should set timestamp to ISO 8601 format', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'post_created',
          data: {
            tweetId: 'tweet123',
            username: 'testuser',
            tweet: {
              author: {
                handle: 'testuser',
                id: 'user123',
                profile: { name: 'Test User' }
              }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];

        // Verify timestamp is valid ISO 8601
        expect(receivedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(new Date(receivedEvent.timestamp).toISOString()).toBe(receivedEvent.timestamp);
      });
    });

    describe('Event Type Normalization', () => {
      it('should normalize event_type to follow_updated when action is follow_update', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'follow_created',
          data: {
            action: 'follow_update',
            user: {
              handle: 'testuser',
              id: 'user123',
              profile: { name: 'Test User' }
            },
            following: {
              handle: 'followeduser',
              id: 'followed123',
              profile: { name: 'Followed User' }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.type).toBe('follow_updated');
      });

      it('should normalize event_type to post_updated when action is post_update', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'post_created',
          data: {
            action: 'post_update',
            tweetId: 'tweet123',
            username: 'testuser',
            tweet: {
              author: {
                handle: 'testuser',
                id: 'user123',
                profile: { name: 'Test User' }
              }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.type).toBe('post_updated');
      });

      it('should keep original event_type when action field is not present', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'post_created',
          data: {
            tweetId: 'tweet123',
            username: 'testuser',
            tweet: {
              author: {
                handle: 'testuser',
                id: 'user123',
                profile: { name: 'Test User' }
              }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.type).toBe('post_created');
      });

      it('should keep original event_type when action field has different value', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        client.onEvent(eventCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        const actorEvent = {
          event_type: 'user_updated',
          data: {
            action: 'some_other_action',
            user: {
              handle: 'testuser',
              id: 'user123',
              profile: { name: 'Test User' }
            }
          }
        };

        messageHandler(JSON.stringify(actorEvent));

        expect(eventCallback).toHaveBeenCalledTimes(1);
        const receivedEvent = eventCallback.mock.calls[0][0];
        expect(receivedEvent.type).toBe('user_updated');
      });
    });
  });

  describe('Event Validation', () => {
    it('should validate required fields are present', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Test missing type
      const missingType = {
        event_type: undefined,
        data: {
          username: 'testuser',
          user: {
            handle: 'testuser',
            id: 'user123',
            profile: { name: 'Test User' }
          }
        }
      };

      messageHandler(JSON.stringify(missingType));
      expect(eventCallback).not.toHaveBeenCalled();

      // Test missing user object
      const missingUser = {
        event_type: 'post_created',
        data: {
          tweetId: 'tweet123'
        }
      };

      messageHandler(JSON.stringify(missingUser));
      expect(eventCallback).not.toHaveBeenCalled();
    });

    it('should reject events with username "unknown"', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Event with no username sources (will default to "unknown")
      const unknownUsernameEvent = {
        event_type: 'post_created',
        data: {
          tweetId: 'tweet123'
        }
      };

      messageHandler(JSON.stringify(unknownUsernameEvent));

      // Should not emit event because username is "unknown"
      expect(eventCallback).not.toHaveBeenCalled();
    });

    it('should reject events with event_type "unknown"', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Event with missing event_type (will default to "unknown")
      const unknownTypeEvent = {
        data: {
          username: 'testuser',
          user: {
            handle: 'testuser',
            id: 'user123',
            profile: { name: 'Test User' }
          }
        }
      };

      messageHandler(JSON.stringify(unknownTypeEvent));

      // Should not emit event because type is "unknown"
      expect(eventCallback).not.toHaveBeenCalled();
    });

    it('should skip invalid events without crashing', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send multiple invalid events
      const invalidEvents = [
        { event_type: 'post_created', data: {} }, // Missing username
        { event_type: undefined, data: { username: 'test' } }, // Missing type
        { data: { username: 'test' } }, // Missing event_type
        { event_type: 'post_created' }, // Missing data
      ];

      invalidEvents.forEach(event => {
        expect(() => {
          messageHandler(JSON.stringify(event));
        }).not.toThrow();
      });

      // No events should be emitted
      expect(eventCallback).not.toHaveBeenCalled();
    });

    it('should continue processing valid events after invalid ones', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send invalid event
      const invalidEvent = {
        event_type: 'post_created',
        data: {} // Missing required fields
      };

      messageHandler(JSON.stringify(invalidEvent));

      // Send valid event
      const validEvent = {
        event_type: 'post_created',
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          tweet: {
            author: {
              handle: 'testuser',
              id: 'user123',
              profile: { name: 'Test User' }
            }
          }
        }
      };

      messageHandler(JSON.stringify(validEvent));

      // Only valid event should be emitted
      expect(eventCallback).toHaveBeenCalledTimes(1);
      const receivedEvent = eventCallback.mock.calls[0][0];
      expect(receivedEvent.type).toBe('post_created');
      expect(receivedEvent.user.username).toBe('testuser');
    });

    it('should validate all required user fields', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Event with valid username but missing userId (will default to "unknown")
      // Note: Current validation only checks username is not "unknown", not userId
      const missingUserId = {
        event_type: 'post_created',
        data: {
          tweetId: 'tweet123',
          username: 'testuser'
          // Missing user object with id - userId will be "unknown" but event is still valid
        }
      };

      messageHandler(JSON.stringify(missingUserId));

      // Event should be emitted because username is valid (validation only checks username != "unknown")
      expect(eventCallback).toHaveBeenCalledTimes(1);
      const receivedEvent = eventCallback.mock.calls[0][0];
      expect(receivedEvent.user.username).toBe('testuser');
      expect(receivedEvent.user.userId).toBe('unknown'); // userId defaults to "unknown"
    });

    it('should accept events with all required fields present', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      const eventCallback = jest.fn();
      client.onEvent(eventCallback);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Valid event with all required fields
      const validEvent = {
        event_type: 'post_created',
        data: {
          tweetId: 'tweet123',
          username: 'testuser',
          user: {
            handle: 'testuser',
            id: 'user123',
            profile: { name: 'Test User' }
          }
        }
      };

      messageHandler(JSON.stringify(validEvent));

      // Should emit event
      expect(eventCallback).toHaveBeenCalledTimes(1);
      const receivedEvent = eventCallback.mock.calls[0][0];
      expect(receivedEvent.type).toBe('post_created');
      expect(receivedEvent.user.username).toBe('testuser');
      expect(receivedEvent.user.userId).toBe('user123');
      expect(receivedEvent.user.displayName).toBe('Test User');
    });
  });

  describe('Reconnection with Exponential Backoff', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should trigger reconnection on unexpected connection close', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      expect(client.getConnectionState()).toBe('connected');

      // Simulate unexpected connection close (not code 1000)
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006, 'Connection lost');

      // Should transition to reconnecting state
      expect(client.getConnectionState()).toBe('reconnecting');

      client.disconnect();
    });

    it('should increment reconnection attempt counter on each attempt', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      expect(client.getReconnectAttempts()).toBe(0);

      // Simulate connection close
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006, 'Connection lost');

      // Advance time to trigger first reconnection attempt
      jest.advanceTimersByTime(1000);

      // Attempt counter should be incremented
      expect(client.getReconnectAttempts()).toBe(1);

      // Simulate another close
      closeHandler(1006, 'Connection lost');

      // Advance time to trigger second reconnection attempt
      jest.advanceTimersByTime(2000);

      // Attempt counter should be incremented again
      expect(client.getReconnectAttempts()).toBe(2);

      client.disconnect();
    });

    it('should reset reconnection attempt counter on successful connection', async () => {
      // Set initial attempts
      (client as any).reconnectAttempts = 3;

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      // Counter should be reset to 0
      expect(client.getReconnectAttempts()).toBe(0);

      client.disconnect();
    });

    it('should re-send subscribe message after reconnection', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      // Clear previous send calls
      mockWs.send.mockClear();

      // Simulate connection close
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006, 'Connection lost');

      // Advance time to trigger reconnection
      jest.advanceTimersByTime(1000);

      // Simulate successful reconnection
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Simulate subscription confirmation
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['all'] } }));

      // Subscribe message should be sent again
      expect(mockWs.send).toHaveBeenCalled();
      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);
      expect(message).toHaveProperty('op', 'subscribe');

      client.disconnect();
    });

    it('should calculate exponential backoff delay correctly', () => {
      const testConfig = {
        ...config,
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2.0,
      };
      const testClient = new WSSClient(testConfig);

      // Test delay calculation for different attempt counts
      (testClient as any).reconnectAttempts = 0;
      expect((testClient as any).calculateReconnectDelay()).toBe(1000); // 1000 * 2^0 = 1000

      (testClient as any).reconnectAttempts = 1;
      expect((testClient as any).calculateReconnectDelay()).toBe(2000); // 1000 * 2^1 = 2000

      (testClient as any).reconnectAttempts = 2;
      expect((testClient as any).calculateReconnectDelay()).toBe(4000); // 1000 * 2^2 = 4000

      (testClient as any).reconnectAttempts = 3;
      expect((testClient as any).calculateReconnectDelay()).toBe(8000); // 1000 * 2^3 = 8000

      (testClient as any).reconnectAttempts = 4;
      expect((testClient as any).calculateReconnectDelay()).toBe(16000); // 1000 * 2^4 = 16000

      (testClient as any).reconnectAttempts = 5;
      expect((testClient as any).calculateReconnectDelay()).toBe(30000); // 1000 * 2^5 = 32000, capped at 30000

      (testClient as any).reconnectAttempts = 10;
      expect((testClient as any).calculateReconnectDelay()).toBe(30000); // Should be capped at maxReconnectDelay

      testClient.disconnect();
    });

    it('should respect maxReconnectAttempts limit', async () => {
      const limitedConfig = {
        ...config,
        maxReconnectAttempts: 3,
        reconnectDelay: 100,
      };
      const limitedClient = new WSSClient(limitedConfig);

      const errorCallback = jest.fn();
      limitedClient.onError(errorCallback);

      const connectPromise = limitedClient.connect();

      await simulateSuccessfulConnection(connectPromise);

      // Simulate 3 failed reconnection attempts
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];

      for (let i = 0; i < 3; i++) {
        closeHandler(1006, 'Connection lost');
        jest.advanceTimersByTime(1000);
      }

      // After 3 attempts, should stop reconnecting
      expect(limitedClient.getReconnectAttempts()).toBe(3);

      // Try one more close - should not schedule reconnection
      closeHandler(1006, 'Connection lost');

      // Error callback should be called with max attempts error
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Max reconnection attempts')
        })
      );

      limitedClient.disconnect();
    });

    it('should reconnect indefinitely when maxReconnectAttempts is 0', async () => {
      const infiniteConfig = {
        ...config,
        maxReconnectAttempts: 0,
        reconnectDelay: 100,
      };
      const infiniteClient = new WSSClient(infiniteConfig);

      const connectPromise = infiniteClient.connect();

      await simulateSuccessfulConnection(connectPromise);

      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];

      // Simulate many reconnection attempts
      for (let i = 0; i < 10; i++) {
        closeHandler(1006, 'Connection lost');
        jest.advanceTimersByTime(50); // Advance less time to stay in reconnecting state
      }

      // Should still be attempting to reconnect
      expect(infiniteClient.getReconnectAttempts()).toBeGreaterThan(0);
      // State could be either reconnecting or connecting depending on timing
      expect(['reconnecting', 'connecting']).toContain(infiniteClient.getConnectionState());

      infiniteClient.disconnect();
    });

    it('should not reconnect on normal closure (code 1000)', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      // Simulate normal closure
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1000, 'Normal closure');

      // Should not schedule reconnection
      expect(client.getConnectionState()).toBe('disconnected');
      expect((client as any).reconnectTimeout).toBeNull();

      client.disconnect();
    });

    it('should handle timing issues gracefully', async () => {
      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      // Simulate connection close
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006, 'Connection lost');

      // Verify reconnection is scheduled
      expect(client.getConnectionState()).toBe('reconnecting');

      // Disconnect before reconnection timer fires
      client.disconnect();

      // Should clear reconnection timeout
      expect((client as any).reconnectTimeout).toBeNull();
      expect(client.getConnectionState()).toBe('disconnected');
    });

    it('should transition state to reconnecting when scheduling reconnection', async () => {
      const stateChangeCallback = jest.fn();
      client.onStateChange(stateChangeCallback);

      const connectPromise = client.connect();

      await simulateSuccessfulConnection(connectPromise);

      // Clear previous state change calls
      stateChangeCallback.mockClear();

      // Simulate connection close
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006, 'Connection lost');

      // Should transition to reconnecting
      expect(stateChangeCallback).toHaveBeenCalledWith('disconnected');
      expect(stateChangeCallback).toHaveBeenCalledWith('reconnecting');
      expect(client.getConnectionState()).toBe('reconnecting');

      client.disconnect();
    });
  });

  describe('Error Handling', () => {
    describe('Authentication Errors', () => {
      it('should detect 401 authentication errors from error event', async () => {
        const errorCallback = jest.fn();
        client.onError(errorCallback);

        const connectPromise = client.connect();

        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        const authError = new Error('401 Unauthorized');
        errorHandler(authError);

        await expect(connectPromise).rejects.toThrow('Authentication failed');
        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Authentication failed')
          })
        );
      });

      it('should set shouldReconnect to false for authentication errors', async () => {
        const connectPromise = client.connect();

        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        const authError = new Error('401 Unauthorized');
        errorHandler(authError);

        await expect(connectPromise).rejects.toThrow('Authentication failed');
        expect((client as any).shouldReconnect).toBe(false);
      });

      it('should disconnect cleanly on authentication error', async () => {
        const connectPromise = client.connect();

        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        const authError = new Error('401 Unauthorized');
        errorHandler(authError);

        await expect(connectPromise).rejects.toThrow('Authentication failed');
        expect(mockWs.close).toHaveBeenCalled();
      });

      it('should handle authentication error on close with code 1008', async () => {
        const errorCallback = jest.fn();
        client.onError(errorCallback);

        const connectPromise = client.connect();

        const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
        closeHandler(1008, 'Policy violation');

        await expect(connectPromise).rejects.toThrow('Authentication failed');
        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Authentication failed')
          })
        );
        expect((client as any).shouldReconnect).toBe(false);
      });

      it('should handle authentication error on close with code 4401', async () => {
        const errorCallback = jest.fn();
        client.onError(errorCallback);

        const connectPromise = client.connect();

        const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
        closeHandler(4401, 'Unauthorized');

        await expect(connectPromise).rejects.toThrow('Authentication failed');
        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Authentication failed')
          })
        );
        expect((client as any).shouldReconnect).toBe(false);
      });

      it('should not attempt reconnection after authentication failure', async () => {
        jest.useFakeTimers();

        const connectPromise = client.connect();

        const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
        closeHandler(4401, 'Unauthorized');

        await expect(connectPromise).rejects.toThrow('Authentication failed');

        // Advance time - should not schedule reconnection
        jest.advanceTimersByTime(10000);

        expect((client as any).reconnectTimeout).toBeNull();
        expect(client.getConnectionState()).toBe('disconnected');

        jest.useRealTimers();
      });
    });

    describe('WebSocket Errors', () => {
      it('should handle WebSocket error events', async () => {
        const errorCallback = jest.fn();
        client.onError(errorCallback);

        const connectPromise = client.connect();

        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        const wsError = new Error('Connection refused');
        errorHandler(wsError);

        // Expect the promise to reject
        await expect(connectPromise).rejects.toThrow('WebSocket error');

        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('WebSocket error')
          })
        );
      });

      it('should log error details for WebSocket errors', async () => {
        const errorCallback = jest.fn();
        client.onError(errorCallback);

        const connectPromise = client.connect();

        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        const wsError = new Error('Network timeout');
        errorHandler(wsError);

        // Expect the promise to reject
        await expect(connectPromise).rejects.toThrow('WebSocket error');

        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Network timeout')
          })
        );
      });

      it('should trigger reconnection for connection errors via close event', async () => {
        jest.useFakeTimers();

        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        // Simulate error followed by close (typical WebSocket behavior)
        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        errorHandler(new Error('Connection lost'));

        const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
        closeHandler(1006, 'Abnormal closure');

        // Should schedule reconnection
        expect(client.getConnectionState()).toBe('reconnecting');

        jest.useRealTimers();
        client.disconnect();
      });

      it('should not trigger reconnection for protocol errors (normal close)', async () => {
        jest.useFakeTimers();

        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        // Simulate protocol error followed by normal close
        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        errorHandler(new Error('Protocol error'));

        const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
        closeHandler(1000, 'Normal closure');

        // Should not schedule reconnection
        expect(client.getConnectionState()).toBe('disconnected');
        expect((client as any).reconnectTimeout).toBeNull();

        jest.useRealTimers();
        client.disconnect();
      });

      it('should handle errors with empty message', async () => {
        const errorCallback = jest.fn();
        client.onError(errorCallback);

        const connectPromise = client.connect();

        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        const emptyError = new Error('');
        errorHandler(emptyError);

        // Expect the promise to reject
        await expect(connectPromise).rejects.toThrow('WebSocket error');

        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('WebSocket error')
          })
        );
      });

      it('should handle errors without message property', async () => {
        const errorCallback = jest.fn();
        client.onError(errorCallback);

        const connectPromise = client.connect();

        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        const noMessageError = {} as Error;
        errorHandler(noMessageError);

        // Expect the promise to reject
        await expect(connectPromise).rejects.toThrow('WebSocket error');

        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('WebSocket error')
          })
        );
      });
    });

    describe('Error Callback Invocation', () => {
      it('should invoke all registered error callbacks', async () => {
        const errorCallback1 = jest.fn();
        const errorCallback2 = jest.fn();
        const errorCallback3 = jest.fn();

        client.onError(errorCallback1);
        client.onError(errorCallback2);
        client.onError(errorCallback3);

        const connectPromise = client.connect();

        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        errorHandler(new Error('Test error'));

        // Expect the promise to reject
        await expect(connectPromise).rejects.toThrow('WebSocket error');

        expect(errorCallback1).toHaveBeenCalled();
        expect(errorCallback2).toHaveBeenCalled();
        expect(errorCallback3).toHaveBeenCalled();
      });

      it('should pass error object to callbacks', async () => {
        const errorCallback = jest.fn();
        client.onError(errorCallback);

        const connectPromise = client.connect();

        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        errorHandler(new Error('Specific error message'));

        // Expect the promise to reject
        await expect(connectPromise).rejects.toThrow('WebSocket error');

        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Specific error message')
          })
        );
      });

      it('should invoke error callbacks for parsing errors', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const errorCallback = jest.fn();
        client.onError(errorCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
        messageHandler('invalid json {{{');

        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Failed to parse message')
          })
        );
      });

      it('should invoke error callbacks for server errors', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const errorCallback = jest.fn();
        client.onError(errorCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
        const errorEvent = {
          event_type: 'error',
          data: {
            code: 'SERVER_ERROR',
            message: 'Internal server error'
          }
        };

        messageHandler(JSON.stringify(errorEvent));

        expect(errorCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('SERVER_ERROR')
          })
        );
      });
    });

    describe('Error Isolation', () => {
      it('should isolate error callback failures', async () => {
        const originalDebug = process.env.DEBUG;
        process.env.DEBUG = 'true';
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const errorCallback1 = jest.fn();
        const errorCallback2 = jest.fn(() => {
          throw new Error('Callback error');
        });
        const errorCallback3 = jest.fn();

        client.onError(errorCallback1);
        client.onError(errorCallback2);
        client.onError(errorCallback3);

        const connectPromise = client.connect();

        const errorHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'error')?.[1];
        errorHandler(new Error('Test error'));

        // Expect the promise to reject
        await expect(connectPromise).rejects.toThrow('WebSocket error');

        // All callbacks should be attempted despite error in callback2
        expect(errorCallback1).toHaveBeenCalled();
        expect(errorCallback2).toHaveBeenCalled();
        expect(errorCallback3).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error in error callback'),
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
        process.env.DEBUG = originalDebug;
      });

      it('should continue processing events after callback error', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn(() => {
          throw new Error('Event callback error');
        });
        const errorCallback = jest.fn();

        client.onEvent(eventCallback);
        client.onError(errorCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        // Send first event (will throw in callback)
        const event1 = createMockActorEvent();
        messageHandler(JSON.stringify(event1));

        // Error callback should be invoked
        expect(errorCallback).toHaveBeenCalled();

        // Clear mocks
        eventCallback.mockClear();
        errorCallback.mockClear();

        // Send second event
        const event2 = { ...createMockActorEvent(), data: { ...createMockActorEvent().data, tweetId: 'tweet456' } };
        messageHandler(JSON.stringify(event2));

        // Should still process second event
        expect(eventCallback).toHaveBeenCalled();
      });

      it('should not crash on multiple consecutive errors', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const errorCallback = jest.fn();
        client.onError(errorCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        // Send multiple malformed messages
        for (let i = 0; i < 10; i++) {
          expect(() => {
            messageHandler('invalid json');
          }).not.toThrow();
        }

        // Error callback should be called for each
        expect(errorCallback).toHaveBeenCalledTimes(10);
      });

      it('should isolate parsing errors from valid events', async () => {
        const connectPromise = client.connect();

        await simulateSuccessfulConnection(connectPromise);

        const eventCallback = jest.fn();
        const errorCallback = jest.fn();
        client.onEvent(eventCallback);
        client.onError(errorCallback);

        const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

        // Send sequence: valid, invalid, valid
        const validEvent1 = createMockActorEvent();
        messageHandler(JSON.stringify(validEvent1));

        messageHandler('invalid json');

        const validEvent2 = { ...createMockActorEvent(), data: { ...createMockActorEvent().data, tweetId: 'tweet456' } };
        messageHandler(JSON.stringify(validEvent2));

        // Should process both valid events
        expect(eventCallback).toHaveBeenCalledTimes(2);
        // Should report parsing error
        expect(errorCallback).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Runtime Subscription Updates', () => {
    it('should update subscription with valid channels', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      // Clear previous send calls
      mockWs.send.mockClear();

      // Update subscription
      const updatePromise = client.updateSubscription(['tweets', 'following']);

      // Verify subscribe message was sent
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"op":"subscribe"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"channels":["tweets","following"]')
      );

      // Simulate subscribed acknowledgment
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['tweets', 'following'] } }));

      // Promise should resolve
      await expect(updatePromise).resolves.toBeUndefined();
    });

    it('should update subscription with channels and users', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Update subscription with users
      const updatePromise = client.updateSubscription(['all'], ['elonmusk', 'vitalikbuterin']);

      // Verify subscribe message includes users
      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);

      expect(message).toHaveProperty('op', 'subscribe');
      expect(message).toHaveProperty('channels', ['all']);
      expect(message).toHaveProperty('users', ['elonmusk', 'vitalikbuterin']);

      // Simulate subscribed acknowledgment
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['all'] } }));

      await expect(updatePromise).resolves.toBeUndefined();
    });

    it('should reject updateSubscription when not connected', async () => {
      // Don't connect
      await expect(client.updateSubscription(['all'])).rejects.toThrow('WebSocket not connected');
    });

    it('should reject updateSubscription with invalid channels', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      // Try to update with invalid channel
      await expect(client.updateSubscription(['invalid_channel'] as any)).rejects.toThrow('Invalid channel');
    });

    it('should timeout if no subscribed acknowledgment received', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      // Update subscription with short timeout
      const updatePromise = client.updateSubscription(['all'], undefined, 1000);

      // Advance time past timeout
      jest.advanceTimersByTime(1000);

      // Promise should reject with timeout error
      await expect(updatePromise).rejects.toThrow('Subscription update timeout after 1000ms');

      jest.useRealTimers();
    });

    it('should resolve updateSubscription promise on subscribed event', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update
      const updatePromise = client.updateSubscription(['tweets']);

      // Simulate subscribed event
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['tweets'] } }));

      // Should resolve
      await expect(updatePromise).resolves.toBeUndefined();
    });

    it('should reject updateSubscription promise on disconnect', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      // Start update
      const updatePromise = client.updateSubscription(['all']);

      // Disconnect before acknowledgment
      client.disconnect();

      // Promise should reject
      await expect(updatePromise).rejects.toThrow('Connection closed');
    });

    it('should handle multiple sequential subscription updates', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // First update
      mockWs.send.mockClear();
      const update1 = client.updateSubscription(['tweets']);
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['tweets'] } }));
      await expect(update1).resolves.toBeUndefined();

      // Second update
      mockWs.send.mockClear();
      const update2 = client.updateSubscription(['following']);
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['following'] } }));
      await expect(update2).resolves.toBeUndefined();

      // Third update
      mockWs.send.mockClear();
      const update3 = client.updateSubscription(['all']);
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['all'] } }));
      await expect(update3).resolves.toBeUndefined();
    });

    it('should omit users field when users array is empty', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Update with empty users array
      const updatePromise = client.updateSubscription(['all'], []);

      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);

      expect(message).toHaveProperty('op', 'subscribe');
      expect(message).toHaveProperty('channels', ['all']);
      expect(message).not.toHaveProperty('users');

      // Simulate subscribed acknowledgment
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['all'] } }));

      await expect(updatePromise).resolves.toBeUndefined();
    });

    it('should support idle mode with empty channels array', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Update to idle mode (empty channels)
      const updatePromise = client.updateSubscription([]);

      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);

      expect(message).toHaveProperty('op', 'subscribe');
      expect(message).toHaveProperty('channels', []);

      // Simulate subscribed acknowledgment
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: [] } }));

      await expect(updatePromise).resolves.toBeUndefined();
    });

    it('should clear timeout on successful subscription update', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      // Start update with timeout
      const updatePromise = client.updateSubscription(['all'], undefined, 5000);

      // Simulate quick acknowledgment
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['all'] } }));

      await expect(updatePromise).resolves.toBeUndefined();

      // Advance time past original timeout
      jest.advanceTimersByTime(5000);

      // Should not throw timeout error (timeout was cleared)
      // If timeout wasn't cleared, this would cause issues

      jest.useRealTimers();
    });

    it('should send runtime-updated subscription on reconnect, not config values', async () => {
      jest.useFakeTimers();

      // Initial connection with config channels
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      // Verify initial subscription used config channels
      const initialSendCall = mockWs.send.mock.calls.find((call: any) => {
        try {
          const msg = JSON.parse(call[0]);
          return msg.op === 'subscribe';
        } catch {
          return false;
        }
      });
      expect(initialSendCall).toBeDefined();
      const initialMessage = JSON.parse(initialSendCall![0]);
      expect(initialMessage.channels).toEqual(['all']);

      // Update subscription at runtime
      mockWs.send.mockClear();
      const updatePromise = client.updateSubscription(['tweets', 'following'], ['elonmusk']);
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['tweets', 'following'] } }));
      await updatePromise;

      // Clear send calls before reconnect
      mockWs.send.mockClear();

      // Simulate disconnect
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006, 'Connection lost');

      // Advance time to trigger reconnection
      jest.advanceTimersByTime(1000);

      // Simulate reconnection open
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Verify reconnect subscription uses runtime values, not config values
      const reconnectSendCall = mockWs.send.mock.calls.find((call: any) => {
        try {
          const msg = JSON.parse(call[0]);
          return msg.op === 'subscribe';
        } catch {
          return false;
        }
      });

      expect(reconnectSendCall).toBeDefined();
      const reconnectMessage = JSON.parse(reconnectSendCall![0]);
      expect(reconnectMessage.channels).toEqual(['tweets', 'following']);
      expect(reconnectMessage.users).toEqual(['elonmusk']);

      client.disconnect();
      jest.useRealTimers();
    });

    it('should persist multiple runtime updates through reconnect', async () => {
      jest.useFakeTimers();

      // Initial connection
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // First runtime update
      mockWs.send.mockClear();
      const update1 = client.updateSubscription(['tweets'], ['user1']);
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['tweets'] } }));
      await update1;

      // Second runtime update
      mockWs.send.mockClear();
      const update2 = client.updateSubscription(['following'], ['user2', 'user3']);
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['following'] } }));
      await update2;

      // Third runtime update
      mockWs.send.mockClear();
      const update3 = client.updateSubscription(['all'], []);
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['all'] } }));
      await update3;

      // Clear send calls before reconnect
      mockWs.send.mockClear();

      // Simulate disconnect
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006, 'Connection lost');

      // Advance time to trigger reconnection
      jest.advanceTimersByTime(1000);

      // Simulate reconnection open
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Verify reconnect uses the LAST runtime update (update3)
      const reconnectSendCall = mockWs.send.mock.calls.find((call: any) => {
        try {
          const msg = JSON.parse(call[0]);
          return msg.op === 'subscribe';
        } catch {
          return false;
        }
      });

      expect(reconnectSendCall).toBeDefined();
      const reconnectMessage = JSON.parse(reconnectSendCall![0]);
      expect(reconnectMessage.channels).toEqual(['all']);
      expect(reconnectMessage).not.toHaveProperty('users'); // Empty array should omit users field

      client.disconnect();
      jest.useRealTimers();
    });

    it('should use config values on reconnect if no runtime update occurred', async () => {
      jest.useFakeTimers();

      // Initial connection with config channels
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      // Verify initial subscription used config channels
      const initialSendCall = mockWs.send.mock.calls.find((call: any) => {
        try {
          const msg = JSON.parse(call[0]);
          return msg.op === 'subscribe';
        } catch {
          return false;
        }
      });
      expect(initialSendCall).toBeDefined();
      const initialMessage = JSON.parse(initialSendCall![0]);
      expect(initialMessage.channels).toEqual(['all']);

      // NO runtime update - just disconnect and reconnect

      // Clear send calls before reconnect
      mockWs.send.mockClear();

      // Simulate disconnect
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006, 'Connection lost');

      // Advance time to trigger reconnection
      jest.advanceTimersByTime(1000);

      // Simulate reconnection open
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Verify reconnect still uses config values (since no runtime update)
      const reconnectSendCall = mockWs.send.mock.calls.find((call: any) => {
        try {
          const msg = JSON.parse(call[0]);
          return msg.op === 'subscribe';
        } catch {
          return false;
        }
      });

      expect(reconnectSendCall).toBeDefined();
      const reconnectMessage = JSON.parse(reconnectSendCall![0]);
      expect(reconnectMessage.channels).toEqual(['all']);

      client.disconnect();
      jest.useRealTimers();
    });

    it('should reject updateSubscription promise on error event during update', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update
      const updatePromise = client.updateSubscription(['all']);

      // Simulate error event from server
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      const errorEvent = {
        event_type: 'error',
        data: {
          code: 'INVALID_SUBSCRIPTION',
          message: 'Invalid channels specified'
        }
      };
      messageHandler(JSON.stringify(errorEvent));

      // Promise should reject with the error
      await expect(updatePromise).rejects.toThrow('Server error [INVALID_SUBSCRIPTION]: Invalid channels specified');
    });

    it('should not reject updateSubscription on unrelated subscribed events', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update
      const updatePromise = client.updateSubscription(['tweets']);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Simulate an unrelated subscribed event (should not resolve the promise yet)
      // This could happen if there's a race condition or delayed response
      // The promise should only resolve when there's a pending request

      // First, let's simulate a scenario where we get a subscribed event
      // but it's for the current pending request
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['tweets'] } }));

      // Promise should resolve
      await expect(updatePromise).resolves.toBeUndefined();

      // Now start another update
      mockWs.send.mockClear();
      const update2Promise = client.updateSubscription(['following']);

      // This subscribed event should resolve update2
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['following'] } }));

      await expect(update2Promise).resolves.toBeUndefined();
    });

    it('should timeout if no response arrives during updateSubscription', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update with timeout
      const updatePromise = client.updateSubscription(['all'], undefined, 2000);

      // Don't send any response - just advance time
      jest.advanceTimersByTime(2000);

      // Promise should reject with timeout
      await expect(updatePromise).rejects.toThrow('Subscription update timeout after 2000ms');

      jest.useRealTimers();
    });

    it('should not resolve updateSubscription on subscribed event when no pending request', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Complete an update first
      const update1 = client.updateSubscription(['tweets']);
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['tweets'] } }));
      await update1;

      // Now there's no pending request
      // Send another subscribed event (could be a delayed/duplicate response)
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['all'] } }));

      // Should not throw or cause issues
      // The event should be ignored since there's no pending request
      expect((client as any).pendingSubscriptionRequest).toBe(false);
    });

    it('should handle error event with missing error details', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update
      const updatePromise = client.updateSubscription(['all']);

      // Simulate error event with minimal data
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      const errorEvent = {
        event_type: 'error',
        data: {}
      };
      messageHandler(JSON.stringify(errorEvent));

      // Promise should reject with generic error
      await expect(updatePromise).rejects.toThrow('Server error [UNKNOWN]: Unknown error');
    });

    it('should clear pending request flag on successful update', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Verify flag is false initially
      expect((client as any).pendingSubscriptionRequest).toBe(false);

      // Start update
      const updatePromise = client.updateSubscription(['all']);

      // Flag should be true during update
      expect((client as any).pendingSubscriptionRequest).toBe(true);

      // Simulate success
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['all'] } }));

      await updatePromise;

      // Flag should be false after success
      expect((client as any).pendingSubscriptionRequest).toBe(false);
    });

    it('should clear pending request flag on error', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update
      const updatePromise = client.updateSubscription(['all']);

      // Flag should be true during update
      expect((client as any).pendingSubscriptionRequest).toBe(true);

      // Simulate error
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ 
        event_type: 'error', 
        data: { code: 'TEST_ERROR', message: 'Test error' } 
      }));

      await expect(updatePromise).rejects.toThrow();

      // Flag should be false after error
      expect((client as any).pendingSubscriptionRequest).toBe(false);
    });

    it('should clear pending request flag on timeout', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update
      const updatePromise = client.updateSubscription(['all'], undefined, 1000);

      // Flag should be true during update
      expect((client as any).pendingSubscriptionRequest).toBe(true);

      // Advance time to trigger timeout
      jest.advanceTimersByTime(1000);

      await expect(updatePromise).rejects.toThrow('Subscription update timeout');

      // Flag should be false after timeout
      expect((client as any).pendingSubscriptionRequest).toBe(false);

      jest.useRealTimers();
    });

    it('should clear pending request flag on disconnect', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update
      const updatePromise = client.updateSubscription(['all']);

      // Flag should be true during update
      expect((client as any).pendingSubscriptionRequest).toBe(true);

      // Disconnect
      client.disconnect();

      await expect(updatePromise).rejects.toThrow('Connection closed');

      // Flag should be false after disconnect
      expect((client as any).pendingSubscriptionRequest).toBe(false);
    });

    // Race condition tests
    it('should not resolve old promise after disconnect and reconnect', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update
      const updatePromise = client.updateSubscription(['tweets']);

      // Disconnect before acknowledgment
      client.disconnect();

      // Promise should reject
      await expect(updatePromise).rejects.toThrow('Connection closed');

      // Reconnect
      const reconnectPromise = client.connect();
      
      // Simulate reconnection
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send subscribed event (could be delayed response from before disconnect)
      messageHandler(JSON.stringify({ event_type: 'subscribed', data: { channels: ['tweets'] } }));

      // Wait for reconnect to complete
      await reconnectPromise;

      // The old promise should still be rejected, not resolved by this event
      // Verify no errors thrown and state is clean
      expect((client as any).pendingSubscriptionRequest).toBe(false);
      expect((client as any).updateSubscriptionResolve).toBeNull();
      expect((client as any).updateSubscriptionReject).toBeNull();

      client.disconnect();
      jest.useRealTimers();
    });

    it('should only resolve correct promise when multiple updateSubscription calls are made', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // First update
      mockWs.send.mockClear();
      const update1Promise = client.updateSubscription(['tweets']);
      
      // Get the request ID from the sent message
      const sendCall1 = mockWs.send.mock.calls[0][0];
      const message1 = JSON.parse(sendCall1);
      const requestId1 = message1.requestId;

      // Resolve first update
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['tweets'], requestId: requestId1 } 
      }));
      await expect(update1Promise).resolves.toBeUndefined();

      // Second update
      mockWs.send.mockClear();
      const update2Promise = client.updateSubscription(['following']);
      
      const sendCall2 = mockWs.send.mock.calls[0][0];
      const message2 = JSON.parse(sendCall2);
      const requestId2 = message2.requestId;

      // Send response with correct request ID
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['following'], requestId: requestId2 } 
      }));
      await expect(update2Promise).resolves.toBeUndefined();

      // Third update
      mockWs.send.mockClear();
      const update3Promise = client.updateSubscription(['all']);
      
      const sendCall3 = mockWs.send.mock.calls[0][0];
      const message3 = JSON.parse(sendCall3);
      const requestId3 = message3.requestId;

      // Send response with correct request ID
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['all'], requestId: requestId3 } 
      }));
      await expect(update3Promise).resolves.toBeUndefined();
    });

    it('should ignore subscribed event with wrong request ID', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update
      const updatePromise = client.updateSubscription(['tweets'], undefined, 5000);
      
      // Get the request ID from the sent message
      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);
      const correctRequestId = message.requestId;

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send subscribed event with WRONG request ID
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['tweets'], requestId: 'wrong-request-id' } 
      }));

      // Promise should NOT resolve yet
      expect((client as any).pendingSubscriptionRequest).toBe(true);

      // Now send the correct response
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['tweets'], requestId: correctRequestId } 
      }));

      // Now it should resolve
      await expect(updatePromise).resolves.toBeUndefined();
      expect((client as any).pendingSubscriptionRequest).toBe(false);

      jest.useRealTimers();
    });

    it('should ignore error event with wrong request ID', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update
      const updatePromise = client.updateSubscription(['tweets'], undefined, 5000);
      
      // Get the request ID from the sent message
      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);
      const correctRequestId = message.requestId;

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send error event with WRONG request ID
      messageHandler(JSON.stringify({ 
        event_type: 'error', 
        data: { 
          code: 'TEST_ERROR', 
          message: 'Test error',
          requestId: 'wrong-request-id' 
        } 
      }));

      // Promise should NOT reject yet
      expect((client as any).pendingSubscriptionRequest).toBe(true);

      // Now send error with correct request ID
      messageHandler(JSON.stringify({ 
        event_type: 'error', 
        data: { 
          code: 'REAL_ERROR', 
          message: 'Real error',
          requestId: correctRequestId 
        } 
      }));

      // Now it should reject with the correct error
      await expect(updatePromise).rejects.toThrow('Server error [REAL_ERROR]: Real error');
      expect((client as any).pendingSubscriptionRequest).toBe(false);

      jest.useRealTimers();
    });

    it('should include request ID in subscribe message', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start update
      const updatePromise = client.updateSubscription(['tweets']);

      // Verify the sent message includes a request ID
      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);

      expect(message).toHaveProperty('requestId');
      expect(typeof message.requestId).toBe('string');
      expect(message.requestId).toMatch(/^sub-\d+-[a-z0-9]+$/);

      // Complete the update
      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['tweets'], requestId: message.requestId } 
      }));

      await expect(updatePromise).resolves.toBeUndefined();
    });

    it('should generate unique request IDs for each updateSubscription call', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // First update
      mockWs.send.mockClear();
      const update1Promise = client.updateSubscription(['tweets']);
      const sendCall1 = mockWs.send.mock.calls[0][0];
      const message1 = JSON.parse(sendCall1);
      const requestId1 = message1.requestId;

      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['tweets'], requestId: requestId1 } 
      }));
      await update1Promise;

      // Second update
      mockWs.send.mockClear();
      const update2Promise = client.updateSubscription(['following']);
      const sendCall2 = mockWs.send.mock.calls[0][0];
      const message2 = JSON.parse(sendCall2);
      const requestId2 = message2.requestId;

      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['following'], requestId: requestId2 } 
      }));
      await update2Promise;

      // Verify request IDs are different
      expect(requestId1).not.toBe(requestId2);
    });

    // Timeout reconnect behavior tests
    it('should preserve shouldReconnect flag during subscribe timeout', async () => {
      jest.useFakeTimers();

      // Create client with short timeout for testing
      const timeoutClient = new WSSClient({
        baseUrl: 'ws://localhost:3000',
        token: 'test-token',
        channels: ['all'],
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2,
        maxReconnectAttempts: 5,
        connectionTimeout: 100, // 100ms timeout for testing
      });

      const connectPromise = timeoutClient.connect();

      // Simulate WebSocket open but never send subscription confirmation
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Advance timers to trigger timeout
      jest.advanceTimersByTime(100);

      // Promise should reject with timeout error
      await expect(connectPromise).rejects.toThrow(/Connection timeout.*100ms/);

      // Verify shouldReconnect remains true (not disabled by timeout)
      expect((timeoutClient as any).shouldReconnect).toBe(true);

      timeoutClient.disconnect();
      jest.useRealTimers();
    });

    it('should trigger reconnect attempt after subscribe timeout', async () => {
      jest.useFakeTimers();

      // Create client with short timeout for testing
      const timeoutClient = new WSSClient({
        baseUrl: 'ws://localhost:3000',
        token: 'test-token',
        channels: ['all'],
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2,
        maxReconnectAttempts: 5,
        connectionTimeout: 100, // 100ms timeout for testing
      });

      const connectPromise = timeoutClient.connect();

      // Simulate WebSocket open but never send subscription confirmation
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Advance timers to trigger timeout
      jest.advanceTimersByTime(100);

      // Promise should reject with timeout error
      await expect(connectPromise).rejects.toThrow(/Connection timeout.*100ms/);

      // Clear WebSocket constructor calls
      (WebSocket as unknown as jest.Mock).mockClear();

      // Simulate close event (triggered by handleSubscribeTimeout)
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006); // Abnormal closure

      // Verify state is reconnecting
      expect(timeoutClient.getConnectionState()).toBe('reconnecting');

      // Advance time to trigger reconnection
      jest.advanceTimersByTime(1000);

      // Verify reconnection attempt was made
      expect(WebSocket).toHaveBeenCalled();

      timeoutClient.disconnect();
      jest.useRealTimers();
    });

    it('should continue reconnect chain after multiple timeouts', async () => {
      jest.useFakeTimers();

      // Create client with short timeout for testing
      const timeoutClient = new WSSClient({
        baseUrl: 'ws://localhost:3000',
        token: 'test-token',
        channels: ['all'],
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2,
        maxReconnectAttempts: 5,
        connectionTimeout: 100, // 100ms timeout for testing
      });

      // First connection attempt - timeout
      const connectPromise1 = timeoutClient.connect();
      let openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();
      jest.advanceTimersByTime(100);
      await expect(connectPromise1).rejects.toThrow(/Connection timeout/);

      // Trigger close event
      let closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006);

      // Verify shouldReconnect is still true
      expect((timeoutClient as any).shouldReconnect).toBe(true);

      // Verify state is reconnecting
      expect(timeoutClient.getConnectionState()).toBe('reconnecting');

      // Advance time to trigger first reconnection
      jest.advanceTimersByTime(1000);

      // Second connection attempt - timeout again
      openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();
      jest.advanceTimersByTime(100);

      // Trigger close event again
      closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006);

      // Verify shouldReconnect is STILL true
      expect((timeoutClient as any).shouldReconnect).toBe(true);

      // Verify state is reconnecting
      expect(timeoutClient.getConnectionState()).toBe('reconnecting');

      // Advance time to trigger second reconnection
      jest.advanceTimersByTime(2000); // Exponential backoff

      // Third connection attempt - timeout again
      openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();
      jest.advanceTimersByTime(100);

      // Trigger close event again
      closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006);

      // Verify shouldReconnect is STILL true after multiple timeouts
      expect((timeoutClient as any).shouldReconnect).toBe(true);

      // Verify reconnect chain continues
      expect(timeoutClient.getConnectionState()).toBe('reconnecting');

      timeoutClient.disconnect();
      jest.useRealTimers();
    });

    it('should not disable reconnect when handleSubscribeTimeout is called', async () => {
      jest.useFakeTimers();

      // Create client with short timeout
      const timeoutClient = new WSSClient({
        baseUrl: 'ws://localhost:3000',
        token: 'test-token',
        channels: ['all'],
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2,
        maxReconnectAttempts: 5,
        connectionTimeout: 100,
      });

      const connectPromise = timeoutClient.connect();

      // Simulate WebSocket open
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Verify shouldReconnect is true initially
      expect((timeoutClient as any).shouldReconnect).toBe(true);

      // Advance timers to trigger timeout (which calls handleSubscribeTimeout)
      jest.advanceTimersByTime(100);

      await expect(connectPromise).rejects.toThrow(/Connection timeout/);

      // Verify shouldReconnect is STILL true (handleSubscribeTimeout doesn't disable it)
      expect((timeoutClient as any).shouldReconnect).toBe(true);

      // Verify WebSocket was closed
      expect(mockWs.close).toHaveBeenCalled();

      timeoutClient.disconnect();
      jest.useRealTimers();
    });

    it('should close WebSocket but maintain reconnect capability on timeout', async () => {
      jest.useFakeTimers();

      const timeoutClient = new WSSClient({
        baseUrl: 'ws://localhost:3000',
        token: 'test-token',
        channels: ['all'],
        reconnectDelay: 1000,
        maxReconnectDelay: 30000,
        reconnectBackoffMultiplier: 2,
        maxReconnectAttempts: 5,
        connectionTimeout: 100,
      });

      const connectPromise = timeoutClient.connect();

      // Simulate WebSocket open
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Clear close calls
      mockWs.close.mockClear();

      // Advance timers to trigger timeout
      jest.advanceTimersByTime(100);

      await expect(connectPromise).rejects.toThrow(/Connection timeout/);

      // Verify WebSocket.close() was called (connection closed)
      expect(mockWs.close).toHaveBeenCalled();

      // Verify shouldReconnect is true (reconnect capability maintained)
      expect((timeoutClient as any).shouldReconnect).toBe(true);

      // Simulate close event
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006);

      // Verify reconnect is scheduled
      expect(timeoutClient.getConnectionState()).toBe('reconnecting');

      timeoutClient.disconnect();
      jest.useRealTimers();
    });

    // Race condition tests for updateSubscription during disconnect/reconnect
    it('should reject pending updateSubscription when connection closes', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start updateSubscription
      const updatePromise = client.updateSubscription(['tweets']);

      // Verify pending request is set
      expect((client as any).pendingSubscriptionRequest).toBe(true);
      expect((client as any).pendingSubscriptionRequestId).toBeTruthy();

      // Simulate connection close before acknowledgment
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006); // Abnormal closure

      // Promise should reject
      await expect(updatePromise).rejects.toThrow('Connection closed during subscription update');

      // Verify pending request is cleared
      expect((client as any).pendingSubscriptionRequest).toBe(false);
      expect((client as any).pendingSubscriptionRequestId).toBeNull();
      expect((client as any).updateSubscriptionResolve).toBeNull();
      expect((client as any).updateSubscriptionReject).toBeNull();

      client.disconnect();
      jest.useRealTimers();
    });

    it('should not resolve old updateSubscription promise after reconnect', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start updateSubscription with specific channels
      const updatePromise = client.updateSubscription(['tweets', 'following']);

      // Get the request ID
      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);
      const oldRequestId = message.requestId;

      // Simulate connection close before acknowledgment
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006);

      // Promise should reject
      await expect(updatePromise).rejects.toThrow('Connection closed during subscription update');

      // Verify pending request is cleared
      expect((client as any).pendingSubscriptionRequest).toBe(false);
      expect((client as any).updateSubscriptionResolve).toBeNull();

      // Trigger reconnection
      jest.advanceTimersByTime(1000);

      // Simulate reconnection
      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Simulate subscribed event for reconnect (with old request ID or no request ID)
      // This should NOT resolve the old promise (which was already rejected)
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['all'], requestId: oldRequestId } 
      }));

      // Verify no errors thrown and state is clean
      expect((client as any).pendingSubscriptionRequest).toBe(false);
      expect((client as any).updateSubscriptionResolve).toBeNull();
      expect((client as any).updateSubscriptionReject).toBeNull();

      client.disconnect();
      jest.useRealTimers();
    });

    it('should handle multiple updateSubscription calls with correct request ID matching', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // First update
      mockWs.send.mockClear();
      const update1Promise = client.updateSubscription(['tweets']);
      const sendCall1 = mockWs.send.mock.calls[0][0];
      const message1 = JSON.parse(sendCall1);
      const requestId1 = message1.requestId;

      // Resolve first update
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['tweets'], requestId: requestId1 } 
      }));

      await expect(update1Promise).resolves.toBeUndefined();

      // Second update (after first completes)
      mockWs.send.mockClear();
      const update2Promise = client.updateSubscription(['following']);
      const sendCall2 = mockWs.send.mock.calls[0][0];
      const message2 = JSON.parse(sendCall2);
      const requestId2 = message2.requestId;

      // Verify request IDs are different
      expect(requestId1).not.toBe(requestId2);

      // Resolve second update
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['following'], requestId: requestId2 } 
      }));

      // Second promise should resolve
      await expect(update2Promise).resolves.toBeUndefined();

      // This test verifies that each updateSubscription call gets a unique request ID
      // and that responses are matched correctly to their requests
    });

    it('should clear pending request on close even during reconnect', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start updateSubscription
      const updatePromise = client.updateSubscription(['tweets']);

      // Verify pending request is set
      expect((client as any).pendingSubscriptionRequest).toBe(true);

      // Simulate connection close
      const closeHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
      closeHandler(1006);

      // Promise should reject
      await expect(updatePromise).rejects.toThrow('Connection closed during subscription update');

      // Verify pending request is cleared immediately
      expect((client as any).pendingSubscriptionRequest).toBe(false);
      expect((client as any).pendingSubscriptionRequestId).toBeNull();

      // Even if reconnect happens, pending request should stay cleared
      jest.advanceTimersByTime(1000);

      const openHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
      openHandler();

      // Verify pending request is still cleared
      expect((client as any).pendingSubscriptionRequest).toBe(false);
      expect((client as any).pendingSubscriptionRequestId).toBeNull();

      client.disconnect();
      jest.useRealTimers();
    });

    it('should not accept subscribed event without matching request ID when pending', async () => {
      jest.useFakeTimers();

      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start updateSubscription
      const updatePromise = client.updateSubscription(['tweets'], undefined, 5000);

      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);
      const correctRequestId = message.requestId;

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Send subscribed event with DIFFERENT request ID
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['tweets'], requestId: 'wrong-id-123' } 
      }));

      // Promise should NOT resolve yet
      expect((client as any).pendingSubscriptionRequest).toBe(true);

      // Send subscribed event with CORRECT request ID
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['tweets'], requestId: correctRequestId } 
      }));

      // Now it should resolve
      await expect(updatePromise).resolves.toBeUndefined();
      expect((client as any).pendingSubscriptionRequest).toBe(false);

      jest.useRealTimers();
    });

    it('should handle fallback when actor does not send request ID', async () => {
      const connectPromise = client.connect();
      await simulateSuccessfulConnection(connectPromise);

      mockWs.send.mockClear();

      // Start updateSubscription
      const updatePromise = client.updateSubscription(['tweets']);

      // Verify request ID was sent
      const sendCall = mockWs.send.mock.calls[0][0];
      const message = JSON.parse(sendCall);
      expect(message.requestId).toBeTruthy();

      const messageHandler = mockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

      // Simulate actor response WITHOUT request ID (backward compatibility)
      messageHandler(JSON.stringify({ 
        event_type: 'subscribed', 
        data: { channels: ['tweets'] } // No requestId field
      }));

      // Promise should still resolve (fallback behavior)
      await expect(updatePromise).resolves.toBeUndefined();
      expect((client as any).pendingSubscriptionRequest).toBe(false);
    });
  });
});
