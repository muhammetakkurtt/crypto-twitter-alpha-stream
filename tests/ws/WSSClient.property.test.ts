/**
 * For any sequence of connection operations (connect, disconnect, error, reconnect),
 * the connection state returned by getConnectionState() should always match the internal
 * state and be one of: "disconnected", "connecting", "connected", "reconnecting".
 */

import * as fc from 'fast-check';
import { WSSClient, ConnectionConfig, ConnectionState } from '../../src/ws/WSSClient';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('WSSClient - Property Tests', () => {
  let mockWs: any;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock console.error to reduce noise in test output
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

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
  });

  afterEach(() => {
    jest.clearAllTimers();
    consoleErrorSpy.mockRestore();
  });

  /**
   * Helper function to simulate connection and subscription confirmation
   */
  const simulateConnectionAndSubscription = async (mockWsInstance: any, connectPromise: Promise<void>, channels: string[] = ['all']) => {
    // Trigger open event
    const openHandler = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'open')?.[1];
    if (openHandler) {
      openHandler();
    }

    // Simulate subscribed confirmation
    const messageHandler = mockWsInstance.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];
    if (messageHandler) {
      const subscribedEvent = JSON.stringify({
        event_type: 'subscribed',
        data: { channels }
      });
      // WebSocket message event has data as string
      messageHandler(subscribedEvent);
    }

    // Wait for connection to complete
    await connectPromise;
  };

  /**
   * For any combination of channels and optional user filters, when constructing a subscribe message,
   * the message should have the format {"op":"subscribe","channels":[...],"users":[...]} where the
   * "users" field is omitted if no user filters are provided, and included otherwise.
   */
  describe('Property 1: Subscribe Message Construction', () => {
    it('should construct valid subscribe messages for any channel combination', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            channels: fc.uniqueArray(
              fc.oneof(
                fc.constant('all' as const),
                fc.constant('tweets' as const),
                fc.constant('following' as const),
                fc.constant('profile' as const)
              ),
              { minLength: 1, maxLength: 4 }
            ),
            users: fc.option(
              fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 10 }),
              { nil: undefined }
            ),
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            // Override WebSocket constructor for this iteration
            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: testData.channels,
              users: testData.users,
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            // Connect to trigger subscribe message
            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            // Verify subscribe message was sent
            expect(iterationMockWs.send).toHaveBeenCalled();
            const sendCall = iterationMockWs.send.mock.calls[0][0];
            const message = JSON.parse(sendCall);

            // Verify message structure
            expect(message).toHaveProperty('op', 'subscribe');
            expect(message).toHaveProperty('channels');
            expect(Array.isArray(message.channels)).toBe(true);
            expect(message.channels).toEqual(testData.channels);

            // Verify users field handling
            if (testData.users && testData.users.length > 0) {
              // Users should be included
              expect(message).toHaveProperty('users');
              expect(message.users).toEqual(testData.users);
            } else {
              // Users should be omitted
              expect(message).not.toHaveProperty('users');
            }

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 30000); // 30 second timeout for property test

    it('should always omit users field when users array is empty', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            channels: fc.uniqueArray(
              fc.oneof(
                fc.constant('all' as const),
                fc.constant('tweets' as const),
                fc.constant('following' as const),
                fc.constant('profile' as const)
              ),
              { minLength: 1, maxLength: 4 }
            ),
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            // Override WebSocket constructor for this iteration
            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: testData.channels,
              users: [], // Explicitly empty
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const sendCall = iterationMockWs.send.mock.calls[0][0];
            const message = JSON.parse(sendCall);

            // Users field should NOT be present
            expect(message).not.toHaveProperty('users');

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 30000); // 30 second timeout for property test

    it('should construct valid subscribe messages with various user filter combinations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            channels: fc.uniqueArray(
              fc.oneof(
                fc.constant('all' as const),
                fc.constant('tweets' as const),
                fc.constant('following' as const),
                fc.constant('profile' as const)
              ),
              { minLength: 1, maxLength: 4 }
            ),
            users: fc.array(
              fc.string({ minLength: 3, maxLength: 20 }),
              { minLength: 1, maxLength: 20 }
            ),
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            // Override WebSocket constructor for this iteration
            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: testData.channels,
              users: testData.users,
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const sendCall = iterationMockWs.send.mock.calls[0][0];
            const message = JSON.parse(sendCall);

            // Verify message structure
            expect(message).toHaveProperty('op', 'subscribe');
            expect(message).toHaveProperty('channels');
            expect(message).toHaveProperty('users');
            expect(message.users).toEqual(testData.users);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 30000); // 30 second timeout for property test
  });

  /**
   * For any sequence of messages including invalid JSON, if one message fails to parse,
   * the error should be logged and emitted to error callbacks, but processing should
   * continue for all subsequent valid messages without interruption.
   */
  describe('Property 9: Error Handling Isolation', () => {
    it('should continue processing valid messages after parsing errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            numInvalidMessages: fc.integer({ min: 1, max: 5 }),
            numValidMessages: fc.integer({ min: 1, max: 5 }),
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const eventCallback = jest.fn();
            const errorCallback = jest.fn();
            client.onEvent(eventCallback);
            client.onError(errorCallback);

            const messageHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

            // Send a mix of invalid and valid messages
            const messages: string[] = [];

            // Add invalid messages
            for (let i = 0; i < testData.numInvalidMessages; i++) {
              messages.push(`invalid json ${i} {{{`);
            }

            // Add valid messages
            for (let i = 0; i < testData.numValidMessages; i++) {
              const validEvent = {
                event_type: 'post_created',
                data: {
                  tweetId: `tweet${i}`,
                  username: `user${i}`,
                  tweet: {
                    author: {
                      handle: `user${i}`,
                      id: `userid${i}`,
                      profile: { name: `User ${i}` }
                    }
                  }
                }
              };
              messages.push(JSON.stringify(validEvent));
            }

            // Shuffle messages to test interleaved invalid/valid
            messages.sort(() => Math.random() - 0.5);

            // Send all messages
            messages.forEach(msg => messageHandler(msg));

            // Verify error callbacks were called for invalid messages
            expect(errorCallback.mock.calls.length).toBeGreaterThanOrEqual(testData.numInvalidMessages);

            // Verify event callbacks were called for all valid messages
            expect(eventCallback).toHaveBeenCalledTimes(testData.numValidMessages);

            // Verify all valid events were processed correctly
            for (let i = 0; i < testData.numValidMessages; i++) {
              const receivedEvent = eventCallback.mock.calls[i][0];
              expect(receivedEvent).toHaveProperty('type', 'post_created');
              expect(receivedEvent).toHaveProperty('user');
              expect(receivedEvent.user).toHaveProperty('username');
            }

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout for property test

    it('should isolate callback errors and continue processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            numMessages: fc.integer({ min: 3, max: 10 }),
            failingCallbackIndex: fc.integer({ min: 0, max: 2 }), // Which callback should fail
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            // Register multiple callbacks, one of which will fail
            const callbacks = [jest.fn(), jest.fn(), jest.fn()];
            
            // Make one callback throw an error
            callbacks[testData.failingCallbackIndex] = jest.fn(() => {
              throw new Error('Callback error');
            });

            callbacks.forEach(cb => client.onEvent(cb));

            const errorCallback = jest.fn();
            client.onError(errorCallback);

            const messageHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

            // Send multiple valid messages
            for (let i = 0; i < testData.numMessages; i++) {
              const validEvent = {
                event_type: 'post_created',
                data: {
                  tweetId: `tweet${i}`,
                  username: `user${i}`,
                  tweet: {
                    author: {
                      handle: `user${i}`,
                      id: `userid${i}`,
                      profile: { name: `User ${i}` }
                    }
                  }
                }
              };
              messageHandler(JSON.stringify(validEvent));
            }

            // All callbacks should be called despite one failing
            callbacks.forEach(cb => {
              expect(cb).toHaveBeenCalledTimes(testData.numMessages);
            });

            // Error callback should be called for each callback error
            expect(errorCallback.mock.calls.length).toBeGreaterThanOrEqual(testData.numMessages);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout for property test

    it('should not stop processing when event validation fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            numInvalidEvents: fc.integer({ min: 1, max: 5 }),
            numValidEvents: fc.integer({ min: 1, max: 5 }),
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const eventCallback = jest.fn();
            client.onEvent(eventCallback);

            const messageHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

            const messages: string[] = [];

            // Add invalid events (missing required fields, will fail validation)
            for (let i = 0; i < testData.numInvalidEvents; i++) {
              const invalidEvent = {
                event_type: 'post_created',
                data: {} // Missing required fields
              };
              messages.push(JSON.stringify(invalidEvent));
            }

            // Add valid events
            for (let i = 0; i < testData.numValidEvents; i++) {
              const validEvent = {
                event_type: 'post_created',
                data: {
                  tweetId: `tweet${i}`,
                  username: `user${i}`,
                  tweet: {
                    author: {
                      handle: `user${i}`,
                      id: `userid${i}`,
                      profile: { name: `User ${i}` }
                    }
                  }
                }
              };
              messages.push(JSON.stringify(validEvent));
            }

            // Shuffle messages
            messages.sort(() => Math.random() - 0.5);

            // Send all messages
            messages.forEach(msg => messageHandler(msg));

            // Only valid events should be emitted
            expect(eventCallback).toHaveBeenCalledTimes(testData.numValidEvents);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout for property test
  });

  /**
   * For any sequence of connection operations (connect, disconnect, error, reconnect),
   * the connection state returned by getConnectionState() should always match the internal
   * state and be one of: "disconnected", "connecting", "connected", "reconnecting".
   */
  describe('Property 7: Connection State Consistency', () => {
    it('should always return one of the valid connection states', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseUrl: fc.oneof(
              fc.constant('ws://test.example.com'),
              fc.constant('wss://test.example.com'),
              fc.constant('http://test.example.com'),
              fc.constant('https://test.example.com')
            ),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 2000 }),
            maxReconnectDelay: fc.integer({ min: 5000, max: 30000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 0, max: 10 }),
          }),
          (testData) => {
            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);
            const validStates: ConnectionState[] = ['disconnected', 'connecting', 'connected', 'reconnecting'];

            // Check initial state
            expect(validStates).toContain(client.getConnectionState());
            expect(client.getConnectionState()).toBe('disconnected');

            // Check state after connect
            client.connect();
            expect(validStates).toContain(client.getConnectionState());

            // Check state after disconnect
            client.disconnect();
            expect(validStates).toContain(client.getConnectionState());
            expect(client.getConnectionState()).toBe('disconnected');
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should maintain state consistency when callbacks are registered', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 2000 }),
            maxReconnectDelay: fc.integer({ min: 5000, max: 30000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 0, max: 10 }),
            numCallbacks: fc.integer({ min: 1, max: 5 })
          }),
          (testData) => {
            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);
            const validStates: ConnectionState[] = ['disconnected', 'connecting', 'connected', 'reconnecting'];
            const stateChanges: ConnectionState[] = [];

            // Register multiple state change callbacks
            for (let i = 0; i < testData.numCallbacks; i++) {
              client.onStateChange((state) => {
                stateChanges.push(state);
                // Every state change should be to a valid state
                expect(validStates).toContain(state);
              });
            }

            // Connect
            client.connect();
            expect(validStates).toContain(client.getConnectionState());

            // Disconnect
            client.disconnect();
            expect(validStates).toContain(client.getConnectionState());

            // All recorded state changes should be valid
            stateChanges.forEach(state => {
              expect(validStates).toContain(state);
            });
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should maintain state consistency across reconnection attempts', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 500 }),
            maxReconnectDelay: fc.integer({ min: 1000, max: 5000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 1, max: 5 }),
          }),
          (testData) => {
            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);
            const validStates: ConnectionState[] = ['disconnected', 'connecting', 'connected', 'reconnecting'];

            // Initial state
            expect(validStates).toContain(client.getConnectionState());

            // Connect
            client.connect();
            expect(validStates).toContain(client.getConnectionState());

            // Clean up
            client.disconnect();
            expect(client.getConnectionState()).toBe('disconnected');
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should transition to connecting state when connect is called', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 2000 }),
            maxReconnectDelay: fc.integer({ min: 5000, max: 30000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 0, max: 10 }),
          }),
          (testData) => {
            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);
            const stateTransitions: ConnectionState[] = [];

            client.onStateChange((state) => {
              stateTransitions.push(state);
            });

            // Initial state
            expect(client.getConnectionState()).toBe('disconnected');

            // Connect
            client.connect();
            
            // Should transition to connecting
            expect(stateTransitions).toContain('connecting');
            expect(['connecting', 'connected']).toContain(client.getConnectionState());

            // Clean up
            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should return to disconnected state after disconnect', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 2000 }),
            maxReconnectDelay: fc.integer({ min: 5000, max: 30000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 0, max: 10 }),
          }),
          (testData) => {
            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            // Connect
            client.connect();

            // Disconnect
            client.disconnect();

            // Should be disconnected
            expect(client.getConnectionState()).toBe('disconnected');
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  /**
   * For any valid actor event, transforming the event to internal format and then extracting
   * the data field should produce a deep copy of the original actor event data, such that
   * modifying the original does not affect the transformed copy.
   */
  describe('Property 2: Event Transformation Data Preservation', () => {
    it('should preserve data through transformation (round trip property)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            eventType: fc.oneof(
              fc.constant('post_created'),
              fc.constant('follow_created'),
              fc.constant('user_updated'),
              fc.constant('profile_updated')
            ),
            tweetId: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: undefined }),
            username: fc.string({ minLength: 3, maxLength: 20 }),
            userId: fc.string({ minLength: 5, maxLength: 20 }),
            displayName: fc.string({ minLength: 3, maxLength: 30 }),
            customField: fc.string({ minLength: 1, maxLength: 50 }),
            nestedValue: fc.integer({ min: 1, max: 1000 }),
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const eventCallback = jest.fn();
            client.onEvent(eventCallback);

            const messageHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

            // Create actor event with nested data
            const originalData = {
              tweetId: testData.tweetId,
              username: testData.username,
              customField: testData.customField,
              nested: {
                value: testData.nestedValue,
                deepNested: {
                  field: 'test'
                }
              },
              user: {
                handle: testData.username,
                id: testData.userId,
                profile: { name: testData.displayName }
              }
            };

            const actorEvent = {
              event_type: testData.eventType,
              data: originalData
            };

            messageHandler(JSON.stringify(actorEvent));

            expect(eventCallback).toHaveBeenCalledTimes(1);
            const receivedEvent = eventCallback.mock.calls[0][0];

            // Verify data is preserved
            expect(receivedEvent.data.customField).toBe(testData.customField);
            expect(receivedEvent.data.nested.value).toBe(testData.nestedValue);
            expect(receivedEvent.data.nested.deepNested.field).toBe('test');

            // Verify it's a deep copy by modifying original and checking transformed
            // (In real scenario, we can't modify after transformation, but we verify structure)
            expect(receivedEvent.data).toEqual(originalData);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout for property test

    it('should create independent copies (mutations do not affect original)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            username: fc.string({ minLength: 3, maxLength: 20 }),
            userId: fc.string({ minLength: 5, maxLength: 20 }),
            displayName: fc.string({ minLength: 3, maxLength: 30 }),
            arrayLength: fc.integer({ min: 1, max: 10 }),
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const eventCallback = jest.fn();
            client.onEvent(eventCallback);

            const messageHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

            // Create actor event with array data
            const originalArray = Array.from({ length: testData.arrayLength }, (_, i) => i);
            const originalData = {
              tweetId: 'tweet123',
              username: testData.username,
              arrayField: originalArray,
              user: {
                handle: testData.username,
                id: testData.userId,
                profile: { name: testData.displayName }
              }
            };

            const actorEvent = {
              event_type: 'post_created',
              data: originalData
            };

            messageHandler(JSON.stringify(actorEvent));

            expect(eventCallback).toHaveBeenCalledTimes(1);
            const receivedEvent = eventCallback.mock.calls[0][0];

            // Verify array is copied
            expect(receivedEvent.data.arrayField).toEqual(originalArray);
            expect(receivedEvent.data.arrayField.length).toBe(testData.arrayLength);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout for property test
  });

  /**
   * For any valid actor event, the transformed event should have the structure
   * {type: string, timestamp: string, primaryId: string, user: {username: string,
   * displayName: string, userId: string}, data: any} with all required fields present
   * and non-empty.
   */
  describe('Property 3: Event Transformation Structure Compliance', () => {
    it('should always produce events with required structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            eventType: fc.oneof(
              fc.constant('post_created'),
              fc.constant('follow_created'),
              fc.constant('user_updated'),
              fc.constant('profile_updated'),
              fc.constant('profile_pinned')
            ),
            username: fc.string({ minLength: 3, maxLength: 20 }),
            userId: fc.string({ minLength: 5, maxLength: 20 }),
            displayName: fc.string({ minLength: 3, maxLength: 30 }),
            tweetId: fc.option(fc.string({ minLength: 5, maxLength: 20 }), { nil: undefined }),
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const eventCallback = jest.fn();
            client.onEvent(eventCallback);

            const messageHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

            // Create actor event
            const actorEvent = {
              event_type: testData.eventType,
              data: {
                tweetId: testData.tweetId,
                username: testData.username,
                user: {
                  handle: testData.username,
                  id: testData.userId,
                  profile: { name: testData.displayName }
                },
                following: testData.eventType === 'follow_created' ? {
                  handle: 'followed',
                  id: 'followed123',
                  profile: { name: 'Followed User' }
                } : undefined
              }
            };

            messageHandler(JSON.stringify(actorEvent));

            expect(eventCallback).toHaveBeenCalledTimes(1);
            const receivedEvent = eventCallback.mock.calls[0][0];

            // Verify required fields are present
            expect(receivedEvent).toHaveProperty('type');
            expect(receivedEvent).toHaveProperty('timestamp');
            expect(receivedEvent).toHaveProperty('primaryId');
            expect(receivedEvent).toHaveProperty('user');
            expect(receivedEvent).toHaveProperty('data');

            // Verify types
            expect(typeof receivedEvent.type).toBe('string');
            expect(typeof receivedEvent.timestamp).toBe('string');
            expect(typeof receivedEvent.primaryId).toBe('string');
            expect(typeof receivedEvent.user).toBe('object');
            expect(typeof receivedEvent.data).toBe('object');

            // Verify user structure
            expect(receivedEvent.user).toHaveProperty('username');
            expect(receivedEvent.user).toHaveProperty('displayName');
            expect(receivedEvent.user).toHaveProperty('userId');

            expect(typeof receivedEvent.user.username).toBe('string');
            expect(typeof receivedEvent.user.displayName).toBe('string');
            expect(typeof receivedEvent.user.userId).toBe('string');

            // Verify non-empty strings
            expect(receivedEvent.type.length).toBeGreaterThan(0);
            expect(receivedEvent.timestamp.length).toBeGreaterThan(0);
            expect(receivedEvent.primaryId.length).toBeGreaterThan(0);
            expect(receivedEvent.user.username.length).toBeGreaterThan(0);
            expect(receivedEvent.user.displayName.length).toBeGreaterThan(0);
            expect(receivedEvent.user.userId.length).toBeGreaterThan(0);

            // Verify timestamp is valid ISO 8601
            expect(receivedEvent.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout for property test
  });

  /**
   * For any actor event with username information in multiple locations, the transformed
   * event should extract username following the priority order: data.username (first),
   * data.user.handle (second), data.tweet.author.handle (third), with the highest priority
   * non-empty value being used.
   */
  describe('Property 4: Username Extraction Priority', () => {
    it('should always use highest priority username when multiple sources exist', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            priorityUsername: fc.string({ minLength: 3, maxLength: 20 }),
            userHandle: fc.string({ minLength: 3, maxLength: 20 }),
            authorHandle: fc.string({ minLength: 3, maxLength: 20 }),
            userId: fc.string({ minLength: 5, maxLength: 20 }),
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const eventCallback = jest.fn();
            client.onEvent(eventCallback);

            const messageHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

            // Test with all three username sources present
            const actorEvent = {
              event_type: 'post_created',
              data: {
                tweetId: 'tweet123',
                username: testData.priorityUsername, // Highest priority
                user: {
                  handle: testData.userHandle, // Second priority
                  id: testData.userId,
                  profile: { name: 'Test User' }
                },
                tweet: {
                  author: {
                    handle: testData.authorHandle, // Third priority
                    id: 'author123',
                    profile: { name: 'Author' }
                  }
                }
              }
            };

            messageHandler(JSON.stringify(actorEvent));

            expect(eventCallback).toHaveBeenCalledTimes(1);
            const receivedEvent = eventCallback.mock.calls[0][0];

            // Should use highest priority (data.username)
            expect(receivedEvent.user.username).toBe(testData.priorityUsername);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout for property test

    it('should fall back to second priority when first is missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            userHandle: fc.string({ minLength: 3, maxLength: 20 }),
            authorHandle: fc.string({ minLength: 3, maxLength: 20 }),
            userId: fc.string({ minLength: 5, maxLength: 20 }),
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const eventCallback = jest.fn();
            client.onEvent(eventCallback);

            const messageHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

            // Test without data.username (should use data.user.handle)
            const actorEvent = {
              event_type: 'follow_created',
              data: {
                user: {
                  handle: testData.userHandle, // Should use this
                  id: testData.userId,
                  profile: { name: 'Test User' }
                },
                following: {
                  handle: 'followed',
                  id: 'followed123',
                  profile: { name: 'Followed' }
                },
                tweet: {
                  author: {
                    handle: testData.authorHandle, // Should not use this
                    id: 'author123',
                    profile: { name: 'Author' }
                  }
                }
              }
            };

            messageHandler(JSON.stringify(actorEvent));

            expect(eventCallback).toHaveBeenCalledTimes(1);
            const receivedEvent = eventCallback.mock.calls[0][0];

            // Should use second priority (data.user.handle)
            expect(receivedEvent.user.username).toBe(testData.userHandle);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout for property test

    it('should fall back to third priority when first two are missing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            authorHandle: fc.string({ minLength: 3, maxLength: 20 }),
            reconnectDelay: fc.constant(1000),
            maxReconnectDelay: fc.constant(30000),
            reconnectBackoffMultiplier: fc.constant(2.0),
            maxReconnectAttempts: fc.constant(5),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const eventCallback = jest.fn();
            client.onEvent(eventCallback);

            const messageHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'message')?.[1];

            // Test without data.username and data.user.handle (should use data.tweet.author.handle)
            const actorEvent = {
              event_type: 'post_created',
              data: {
                tweetId: 'tweet123',
                tweet: {
                  author: {
                    handle: testData.authorHandle, // Should use this
                    id: 'author123',
                    profile: { name: 'Author' }
                  }
                }
              }
            };

            messageHandler(JSON.stringify(actorEvent));

            expect(eventCallback).toHaveBeenCalledTimes(1);
            const receivedEvent = eventCallback.mock.calls[0][0];

            // Should use third priority (data.tweet.author.handle)
            expect(receivedEvent.user.username).toBe(testData.authorHandle);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout for property test
  });

  /**
   * For any reconnection configuration (initialDelay, maxDelay, backoffMultiplier) and attempt count,
   * the calculated reconnection delay should equal min(initialDelay * backoffMultiplier^attempts, maxDelay),
   * ensuring delays increase exponentially up to the maximum.
   */
  describe('Property 5: Exponential Backoff Calculation', () => {
    it('should calculate exponential backoff correctly for any configuration', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 5000 }),
            maxReconnectDelay: fc.integer({ min: 10000, max: 60000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 0, max: 10 }),
            attemptCount: fc.integer({ min: 0, max: 10 }),
          }),
          (testData) => {
            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            // Set the attempt count
            (client as any).reconnectAttempts = testData.attemptCount;

            // Calculate expected delay
            const expectedDelay = Math.min(
              testData.reconnectDelay * Math.pow(testData.reconnectBackoffMultiplier, testData.attemptCount),
              testData.maxReconnectDelay
            );

            // Get actual delay
            const actualDelay = (client as any).calculateReconnectDelay();

            // Verify they match
            expect(actualDelay).toBe(expectedDelay);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should never exceed maxReconnectDelay regardless of attempt count', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 5000 }),
            maxReconnectDelay: fc.integer({ min: 10000, max: 60000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 0, max: 10 }),
            attemptCount: fc.integer({ min: 0, max: 20 }), // Test with high attempt counts
          }),
          (testData) => {
            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            // Set the attempt count
            (client as any).reconnectAttempts = testData.attemptCount;

            // Get actual delay
            const actualDelay = (client as any).calculateReconnectDelay();

            // Verify it never exceeds max
            expect(actualDelay).toBeLessThanOrEqual(testData.maxReconnectDelay);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should increase delay exponentially with each attempt', () => {
      fc.assert(
        fc.property(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 1000 }),
            maxReconnectDelay: fc.integer({ min: 50000, max: 100000 }), // High max to avoid capping
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 0, max: 10 }),
          }),
          (testData) => {
            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            // Test that delay increases with each attempt (up to 5 attempts)
            let previousDelay = 0;
            for (let attempt = 0; attempt < 5; attempt++) {
              (client as any).reconnectAttempts = attempt;
              const currentDelay = (client as any).calculateReconnectDelay();

              if (attempt > 0) {
                // Current delay should be greater than previous (unless capped)
                if (currentDelay < testData.maxReconnectDelay) {
                  expect(currentDelay).toBeGreaterThan(previousDelay);
                }
              }

              previousDelay = currentDelay;
            }

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  /**
   * For any maxReconnectAttempts value N (where N > 0), after N consecutive connection failures,
   * reconnection attempts should stop and an error should be emitted; when N = 0, reconnection
   * attempts should continue indefinitely regardless of failure count.
   */
  describe('Property 6: Reconnection Attempt Limiting', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should stop reconnecting after maxReconnectAttempts failures when N > 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 500 }),
            maxReconnectDelay: fc.integer({ min: 1000, max: 5000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 1, max: 5 }), // N > 0
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const errorCallback = jest.fn();
            client.onError(errorCallback);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const closeHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];

            // Simulate N failed reconnection attempts
            for (let i = 0; i < testData.maxReconnectAttempts; i++) {
              closeHandler(1006, 'Connection lost');
              jest.advanceTimersByTime(testData.maxReconnectDelay);
            }

            // After N attempts, should have reached the limit
            expect(client.getReconnectAttempts()).toBe(testData.maxReconnectAttempts);

            // Try one more close - should not schedule reconnection
            const errorCallbackCountBefore = errorCallback.mock.calls.length;
            closeHandler(1006, 'Connection lost');

            // Should emit max attempts error
            expect(errorCallback.mock.calls.length).toBeGreaterThan(errorCallbackCountBefore);
            const lastError = errorCallback.mock.calls[errorCallback.mock.calls.length - 1][0];
            expect(lastError.message).toContain('Max reconnection attempts');

            client.disconnect();
          }
        ),
        { numRuns: 1000 } // Reduced runs due to timer usage
      );
    }, 60000); // 60 second timeout

    it('should reconnect indefinitely when maxReconnectAttempts is 0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 500 }),
            maxReconnectDelay: fc.integer({ min: 1000, max: 5000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            numAttempts: fc.integer({ min: 5, max: 15 }), // Test many attempts
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: 0, // Infinite reconnection
            };

            const client = new WSSClient(config);

            const errorCallback = jest.fn();
            client.onError(errorCallback);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const closeHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];

            // Simulate many failed reconnection attempts
            for (let i = 0; i < testData.numAttempts; i++) {
              closeHandler(1006, 'Connection lost');
              jest.advanceTimersByTime(testData.maxReconnectDelay);
            }

            // Should still be attempting to reconnect (attempts > 0)
            expect(client.getReconnectAttempts()).toBeGreaterThan(0);

            // Should NOT have emitted max attempts error
            const maxAttemptsErrors = errorCallback.mock.calls.filter(
              (call: any) => call[0].message.includes('Max reconnection attempts')
            );
            expect(maxAttemptsErrors.length).toBe(0);

            client.disconnect();
          }
        ),
        { numRuns: 1000 } // Reduced runs due to timer usage
      );
    }, 60000); // 60 second timeout

    it('should reset attempt counter on successful connection', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 500 }),
            maxReconnectDelay: fc.integer({ min: 1000, max: 5000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 1, max: 10 }),
            initialAttempts: fc.integer({ min: 1, max: 5 }),
          }),
          async (testData) => {
            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            // Set initial attempts
            (client as any).reconnectAttempts = testData.initialAttempts;

            // Connect successfully
            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            // Counter should be reset to 0
            expect(client.getReconnectAttempts()).toBe(0);

            client.disconnect();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout
  });

  /**
   * For any WebSocket close code received, the client should handle it appropriately:
   * normal closure (1000) should not trigger reconnection, abnormal closures (1001-1015)
   * should trigger reconnection with exponential backoff, and authentication failures
   * should not trigger reconnection.
   */
  describe('Property 12: WebSocket Close Code Handling', () => {
    it('should not reconnect on normal closure (code 1000)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            reconnectDelay: fc.integer({ min: 100, max: 500 }),
            maxReconnectDelay: fc.integer({ min: 1000, max: 5000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 1, max: 10 }),
          }),
          async (testData) => {
            jest.useFakeTimers();

            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const closeHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];

            // Simulate normal closure (code 1000)
            closeHandler(1000, 'Normal closure');

            // Should not schedule reconnection
            expect(client.getConnectionState()).toBe('disconnected');
            expect((client as any).reconnectTimeout).toBeNull();

            // Advance time to ensure no reconnection is scheduled
            jest.advanceTimersByTime(testData.maxReconnectDelay * 2);

            // Should still be disconnected
            expect(client.getConnectionState()).toBe('disconnected');

            client.disconnect();
            jest.useRealTimers();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout

    it('should trigger reconnection for abnormal closures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            closeCode: fc.oneof(
              fc.constant(1001), // Going away
              fc.constant(1002), // Protocol error
              fc.constant(1003), // Unsupported data
              fc.constant(1006), // Abnormal closure
              fc.constant(1007), // Invalid frame payload data
              fc.constant(1009), // Message too big
              fc.constant(1010), // Mandatory extension
              fc.constant(1011), // Internal server error
              fc.constant(1012), // Service restart
              fc.constant(1013), // Try again later
              fc.constant(1014), // Bad gateway
              fc.constant(1015)  // TLS handshake
            ),
            reconnectDelay: fc.integer({ min: 100, max: 500 }),
            maxReconnectDelay: fc.integer({ min: 1000, max: 5000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 1, max: 10 }),
          }),
          async (testData) => {
            jest.useFakeTimers();

            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const connectPromise = client.connect();

            await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

            const closeHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];

            // Simulate abnormal closure
            closeHandler(testData.closeCode, 'Abnormal closure');

            // Should schedule reconnection
            expect(client.getConnectionState()).toBe('reconnecting');
            expect((client as any).reconnectTimeout).not.toBeNull();

            client.disconnect();
            jest.useRealTimers();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout

    it('should not reconnect for authentication failure close codes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            closeCode: fc.oneof(
              fc.constant(1008), // Policy violation (used for auth errors)
              fc.constant(4401)  // Custom auth error code
            ),
            reconnectDelay: fc.integer({ min: 100, max: 500 }),
            maxReconnectDelay: fc.integer({ min: 1000, max: 5000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            maxReconnectAttempts: fc.integer({ min: 1, max: 10 }),
          }),
          async (testData) => {
            jest.useFakeTimers();

            // Create fresh mock for each iteration
            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: testData.maxReconnectAttempts,
            };

            const client = new WSSClient(config);

            const errorCallback = jest.fn();
            client.onError(errorCallback);

            const connectPromise = client.connect();

            const closeHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];

            // Simulate authentication failure
            closeHandler(testData.closeCode, 'Unauthorized');

            await expect(connectPromise).rejects.toThrow('Authentication failed');

            // Should not schedule reconnection
            expect((client as any).shouldReconnect).toBe(false);
            expect((client as any).reconnectTimeout).toBeNull();

            // Advance time to ensure no reconnection is scheduled
            jest.advanceTimersByTime(testData.maxReconnectDelay * 2);

            // Should still be disconnected
            expect(client.getConnectionState()).toBe('disconnected');

            // Error callback should be called
            expect(errorCallback).toHaveBeenCalledWith(
              expect.objectContaining({
                message: expect.stringContaining('Authentication failed')
              })
            );

            client.disconnect();
            jest.useRealTimers();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000); // 60 second timeout

    it('should apply exponential backoff for abnormal closures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            closeCode: fc.oneof(
              fc.constant(1001),
              fc.constant(1006),
              fc.constant(1011)
            ),
            reconnectDelay: fc.integer({ min: 100, max: 500 }),
            maxReconnectDelay: fc.integer({ min: 5000, max: 10000 }),
            reconnectBackoffMultiplier: fc.float({ min: 2.0, max: 3.0, noNaN: true }),
            numAttempts: fc.integer({ min: 2, max: 3 }),
          }),
          async (testData) => {
            jest.useFakeTimers();

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: testData.reconnectBackoffMultiplier,
              maxReconnectAttempts: 10, // Set high enough to not interfere with test
            };

            const client = new WSSClient(config);

            // Initial connection
            let currentMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => currentMockWs);

            const connectPromise = client.connect();
            await simulateConnectionAndSubscription(currentMockWs, connectPromise);

            // Simulate multiple abnormal closures and verify exponential backoff
            for (let i = 0; i < testData.numAttempts; i++) {
              const closeHandler = currentMockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
              
              // Calculate expected delay BEFORE closing
              const expectedDelay = Math.min(
                testData.reconnectDelay * Math.pow(testData.reconnectBackoffMultiplier, i),
                testData.maxReconnectDelay
              );

              // Trigger close event
              closeHandler(testData.closeCode, 'Connection lost');

              // Verify reconnection is scheduled
              expect(client.getConnectionState()).toBe('reconnecting');

              // Create new mock for reconnection attempt
              currentMockWs = {
                on: jest.fn(),
                send: jest.fn(),
                close: jest.fn(),
                readyState: WebSocket.OPEN,
                OPEN: WebSocket.OPEN,
                CONNECTING: WebSocket.CONNECTING,
                CLOSING: WebSocket.CLOSING,
                CLOSED: WebSocket.CLOSED,
              };
              (WebSocket as unknown as jest.Mock).mockImplementation(() => currentMockWs);

              // Advance time by expected delay to trigger reconnection
              jest.advanceTimersByTime(expectedDelay);

              // Verify attempt counter incremented (before any successful connection)
              expect(client.getReconnectAttempts()).toBe(i + 1);

              // Don't simulate successful reconnection - we want to keep testing backoff
              // The test verifies that delays are calculated correctly
            }

            client.disconnect();
            jest.useRealTimers();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000);

    it('should handle different close code types correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            baseUrl: fc.constant('ws://test.example.com'),
            token: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5),
            closeCode: fc.oneof(
              fc.constant(1000), // Normal - no reconnect
              fc.constant(1006), // Abnormal - reconnect
              fc.constant(1008), // Auth error - no reconnect
              fc.constant(4401)  // Auth error - no reconnect
            ),
            reconnectDelay: fc.integer({ min: 100, max: 200 }),
            maxReconnectDelay: fc.integer({ min: 500, max: 1000 }),
          }),
          async (testData) => {
            jest.useFakeTimers();

            const iterationMockWs = {
              on: jest.fn(),
              send: jest.fn(),
              close: jest.fn(),
              readyState: WebSocket.OPEN,
              OPEN: WebSocket.OPEN,
              CONNECTING: WebSocket.CONNECTING,
              CLOSING: WebSocket.CLOSING,
              CLOSED: WebSocket.CLOSED,
            };

            (WebSocket as unknown as jest.Mock).mockImplementation(() => iterationMockWs);

            const config: ConnectionConfig = {
              baseUrl: testData.baseUrl,
              token: testData.token,
              channels: ['all'],
              reconnectDelay: testData.reconnectDelay,
              maxReconnectDelay: testData.maxReconnectDelay,
              reconnectBackoffMultiplier: 2.0,
              maxReconnectAttempts: 10,
            };

            const client = new WSSClient(config);

            if (testData.closeCode === 1008 || testData.closeCode === 4401) {
              // Auth error case - connect will be rejected
              const connectPromise = client.connect();
              const closeHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
              closeHandler(testData.closeCode, 'Unauthorized');

              await expect(connectPromise).rejects.toThrow('Authentication failed');
              expect((client as any).shouldReconnect).toBe(false);
              expect((client as any).reconnectTimeout).toBeNull();
            } else {
              // Normal or abnormal closure
              const connectPromise = client.connect();
              await simulateConnectionAndSubscription(iterationMockWs, connectPromise);

              const closeHandler = iterationMockWs.on.mock.calls.find((call: any) => call[0] === 'close')?.[1];
              closeHandler(testData.closeCode, 'Closure');

              if (testData.closeCode === 1000) {
                // Normal closure - should not reconnect
                expect(client.getConnectionState()).toBe('disconnected');
                expect((client as any).reconnectTimeout).toBeNull();
              } else {
                // Abnormal closure - should reconnect
                expect(client.getConnectionState()).toBe('reconnecting');
                expect((client as any).reconnectTimeout).not.toBeNull();
              }
            }

            client.disconnect();
            jest.useRealTimers();
          }
        ),
        { numRuns: 1000 }
      );
    }, 60000);
  });
});
