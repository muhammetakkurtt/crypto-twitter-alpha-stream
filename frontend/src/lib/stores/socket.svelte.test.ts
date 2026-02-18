import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { socketStore } from './socket.svelte';
import { eventsStore } from './events.svelte';
import { toastStore } from './toast.svelte';
import { subscriptionStore } from './subscription.svelte';
import type { TwitterEvent, RuntimeSubscriptionState, UpdateRuntimeSubscriptionPayload } from '$lib/types';

vi.mock('socket.io-client', () => {
  const mockSocket = {
    connected: false,
    on: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn()
  };
  
  const mockIo = vi.fn(() => mockSocket);
  
  return {
    default: mockIo,
    io: mockIo,
    Socket: vi.fn()
  };
});

describe('SocketStore Integration Tests', () => {
  beforeEach(() => {
    eventsStore.clear();
    toastStore.clear();
    socketStore.disconnect();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    socketStore.disconnect();
  });
  
  it('should initialize with disconnected status', () => {
    expect(socketStore.connectionStatus).toBe('disconnected');
    expect(socketStore.socket).toBeNull();
  });
  
  it('should create socket connection when connect is called', () => {
    socketStore.connect();
    expect(socketStore.socket).not.toBeNull();
  });
  
  it('should not create duplicate connection if already connected', async () => {
    const ioClient = (await import('socket.io-client')).default;
    
    socketStore.connect();
    const firstSocket = socketStore.socket;
    
    if (firstSocket) {
      firstSocket.connected = true;
    }
    
    socketStore.connect();
    expect(ioClient).toHaveBeenCalledTimes(1);
  });
  
  it('should register connect event handler', () => {
    socketStore.connect();
    expect(socketStore.socket?.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });
  
  it('should register disconnect event handler', () => {
    socketStore.connect();
    expect(socketStore.socket?.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });
  
  it('should register event handler for incoming events', () => {
    socketStore.connect();
    expect(socketStore.socket?.on).toHaveBeenCalledWith('event', expect.any(Function));
  });
  
  it('should register state handler', () => {
    socketStore.connect();
    expect(socketStore.socket?.on).toHaveBeenCalledWith('state', expect.any(Function));
  });
  
  it('should register reconnect handler', () => {
    socketStore.connect();
    expect(socketStore.socket?.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
  });
  
  it('should register connect_error handler', () => {
    socketStore.connect();
    expect(socketStore.socket?.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
  });
  
  it('should show toast on reconnect', () => {
    socketStore.connect();
    toastStore.clear();
    
    const reconnectHandler = (socketStore.socket?.on as any).mock.calls.find(
      (call: any[]) => call[0] === 'reconnect'
    )?.[1];
    
    if (reconnectHandler) {
      reconnectHandler();
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].type).toBe('success');
      expect(toastStore.toasts[0].message).toBe('Reconnected to event stream');
    }
  });
  
  it('should show toast on connect_error', () => {
    socketStore.connect();
    toastStore.clear();
    
    const errorHandler = (socketStore.socket?.on as any).mock.calls.find(
      (call: any[]) => call[0] === 'connect_error'
    )?.[1];
    
    if (errorHandler) {
      const mockError = new Error('Connection failed');
      errorHandler(mockError);
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].type).toBe('error');
      expect(toastStore.toasts[0].message).toBe('Connection error: Connection failed');
    }
  });
  
  it('should update connection status on connect event', () => {
    socketStore.connect();
    const connectHandler = (socketStore.socket?.on as any).mock.calls.find(
      (call: any[]) => call[0] === 'connect'
    )?.[1];
    
    if (connectHandler) {
      connectHandler();
      expect(socketStore.connectionStatus).toBe('connected');
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].type).toBe('success');
      expect(toastStore.toasts[0].message).toBe('Connected to event stream');
    }
  });
  
  it('should update connection status on disconnect event', () => {
    socketStore.connect();
    socketStore.connectionStatus = 'connected';
    toastStore.clear();
    
    const disconnectHandler = (socketStore.socket?.on as any).mock.calls.find(
      (call: any[]) => call[0] === 'disconnect'
    )?.[1];
    
    if (disconnectHandler) {
      disconnectHandler();
      expect(socketStore.connectionStatus).toBe('disconnected');
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].type).toBe('error');
      expect(toastStore.toasts[0].message).toBe('Disconnected from event stream');
    }
  });
  
  it('should add event to store when event is received', () => {
    socketStore.connect();
    
    const mockEvent: TwitterEvent = {
      type: 'post_created',
      timestamp: new Date().toISOString(),
      primaryId: 'test-123',
      user: {
        username: 'testuser',
        displayName: 'Test User',
        userId: 'user-123'
      },
      data: {
        tweetId: 'tweet-123',
        username: 'testuser',
        action: 'created'
      }
    };
    
    const eventHandler = (socketStore.socket?.on as any).mock.calls.find(
      (call: any[]) => call[0] === 'event'
    )?.[1];
    
    if (eventHandler) {
      eventHandler(mockEvent);
      expect(eventsStore.events).toHaveLength(1);
      expect(eventsStore.events[0]).toEqual(mockEvent);
    }
  });
  
  it('should handle state payload with events array', () => {
    socketStore.connect();
    
    const mockEvents: TwitterEvent[] = [
      {
        type: 'post_created',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: {
          username: 'user1',
          displayName: 'User 1',
          userId: 'uid-1'
        },
        data: {
          tweetId: 'tweet-1',
          username: 'user1',
          action: 'created'
        }
      },
      {
        type: 'post_created',
        timestamp: new Date().toISOString(),
        primaryId: 'test-2',
        user: {
          username: 'user2',
          displayName: 'User 2',
          userId: 'uid-2'
        },
        data: {
          tweetId: 'tweet-2',
          username: 'user2',
          action: 'created'
        }
      }
    ];
    
    const stateHandler = (socketStore.socket?.on as any).mock.calls.find(
      (call: any[]) => call[0] === 'state'
    )?.[1];
    
    if (stateHandler) {
      stateHandler({ events: mockEvents });
      expect(eventsStore.events).toHaveLength(2);
    }
  });
  
  it('should handle state payload without events', () => {
    socketStore.connect();
    
    const stateHandler = (socketStore.socket?.on as any).mock.calls.find(
      (call: any[]) => call[0] === 'state'
    )?.[1];
    
    if (stateHandler) {
      stateHandler({ stats: { total: 10 } });
      expect(eventsStore.events).toHaveLength(0);
    }
  });
  
  it('should disconnect socket and reset state', () => {
    socketStore.connect();
    socketStore.connectionStatus = 'connected';
    const socket = socketStore.socket;
    
    socketStore.disconnect();
    
    expect(socket?.disconnect).toHaveBeenCalled();
    expect(socketStore.socket).toBeNull();
    expect(socketStore.connectionStatus).toBe('disconnected');
  });
  
  it('should handle disconnect when socket is null', () => {
    socketStore.disconnect();
    expect(socketStore.socket).toBeNull();
    expect(socketStore.connectionStatus).toBe('disconnected');
  });
  
  it('should configure socket with correct options', async () => {
    const ioClient = (await import('socket.io-client')).default;
    
    socketStore.connect();
    
    expect(ioClient).toHaveBeenCalledWith({
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });
  });
});

describe('Runtime Subscription Methods', () => {
  beforeEach(() => {
    eventsStore.clear();
    toastStore.clear();
    socketStore.disconnect();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    socketStore.disconnect();
  });
  
  it('should emit getRuntimeSubscription event and resolve with state', async () => {
    socketStore.connect();
    
    const mockState: RuntimeSubscriptionState = {
      channels: ['all', 'tweets'],
      users: ['testuser'],
      mode: 'active',
      source: 'runtime',
      updatedAt: '2024-01-01T00:00:00.000Z'
    };
    
    // Mock the emit method to call the callback with success response
    const mockEmit = vi.fn((event: string, ...args: any[]) => {
      if (event === 'getRuntimeSubscription') {
        const callback = args[0];
        callback({ success: true, data: mockState });
      }
      return socketStore.socket;
    });
    
    if (socketStore.socket) {
      socketStore.socket.emit = mockEmit as any;
    }
    
    const result = await socketStore.getRuntimeSubscription();
    
    expect(mockEmit).toHaveBeenCalledWith('getRuntimeSubscription', expect.any(Function));
    expect(result).toEqual(mockState);
  });
  
  it('should reject getRuntimeSubscription when socket is not connected', async () => {
    socketStore.disconnect();
    
    await expect(socketStore.getRuntimeSubscription()).rejects.toThrow('Socket not connected');
  });
  
  it('should reject getRuntimeSubscription when server returns error', async () => {
    socketStore.connect();
    
    const mockEmit = vi.fn((event: string, ...args: any[]) => {
      if (event === 'getRuntimeSubscription') {
        const callback = args[0];
        callback({ error: 'StreamCore not initialized' });
      }
      return socketStore.socket;
    });
    
    if (socketStore.socket) {
      socketStore.socket.emit = mockEmit as any;
    }
    
    await expect(socketStore.getRuntimeSubscription()).rejects.toThrow('StreamCore not initialized');
  });
  
  it('should emit setRuntimeSubscription event with payload and resolve with new state', async () => {
    socketStore.connect();
    
    const payload: UpdateRuntimeSubscriptionPayload = {
      channels: ['tweets', 'following'],
      users: ['user1', 'user2']
    };
    
    const mockNewState: RuntimeSubscriptionState = {
      channels: ['following', 'tweets'],
      users: ['user1', 'user2'],
      mode: 'active',
      source: 'runtime',
      updatedAt: '2024-01-01T00:00:00.000Z'
    };
    
    const mockEmit = vi.fn((event: string, ...args: any[]) => {
      if (event === 'setRuntimeSubscription') {
        const callback = args[1];
        callback({ success: true, data: mockNewState });
      }
      return socketStore.socket;
    });
    
    if (socketStore.socket) {
      socketStore.socket.emit = mockEmit as any;
    }
    
    const result = await socketStore.setRuntimeSubscription(payload);
    
    expect(mockEmit).toHaveBeenCalledWith('setRuntimeSubscription', payload, expect.any(Function));
    expect(result).toEqual(mockNewState);
  });
  
  it('should reject setRuntimeSubscription when socket is not connected', async () => {
    socketStore.disconnect();
    
    const payload: UpdateRuntimeSubscriptionPayload = {
      channels: ['tweets'],
      users: []
    };
    
    await expect(socketStore.setRuntimeSubscription(payload)).rejects.toThrow('Socket not connected');
  });
  
  it('should reject setRuntimeSubscription when server returns error', async () => {
    socketStore.connect();
    
    const payload: UpdateRuntimeSubscriptionPayload = {
      channels: ['invalid_channel'] as any,
      users: []
    };
    
    const mockEmit = vi.fn((event: string, ...args: any[]) => {
      if (event === 'setRuntimeSubscription') {
        const callback = args[1];
        callback({ error: 'Invalid channel: invalid_channel' });
      }
      return socketStore.socket;
    });
    
    if (socketStore.socket) {
      socketStore.socket.emit = mockEmit as any;
    }
    
    await expect(socketStore.setRuntimeSubscription(payload)).rejects.toThrow('Invalid channel: invalid_channel');
  });
  
  it('should handle runtimeSubscriptionUpdated broadcast event', () => {
    socketStore.connect();
    toastStore.clear();
    
    const mockState: RuntimeSubscriptionState = {
      channels: ['all'],
      users: [],
      mode: 'active',
      source: 'runtime',
      updatedAt: '2024-01-01T00:00:00.000Z'
    };
    
    const updateHandler = (socketStore.socket?.on as any).mock.calls.find(
      (call: any[]) => call[0] === 'runtimeSubscriptionUpdated'
    )?.[1];
    
    expect(updateHandler).toBeDefined();
    
    if (updateHandler) {
      updateHandler(mockState);
      
      // Verify subscriptionStore was initialized with the new state
      expect(subscriptionStore.appliedState).toEqual(mockState);
      expect(subscriptionStore.stagedChannels).toEqual(mockState.channels);
      expect(subscriptionStore.stagedUsers).toEqual(mockState.users);
      
      // Verify toast notification was shown
      expect(toastStore.toasts).toHaveLength(1);
      expect(toastStore.toasts[0].type).toBe('info');
      expect(toastStore.toasts[0].message).toBe('Subscription updated');
    }
  });
  
  it('should register runtimeSubscriptionUpdated event handler on connect', () => {
    socketStore.connect();
    expect(socketStore.socket?.on).toHaveBeenCalledWith('runtimeSubscriptionUpdated', expect.any(Function));
  });
  
  it('should timeout getRuntimeSubscription after 10 seconds if no response', async () => {
    socketStore.connect();
    
    // Mock emit to never call the callback (simulating no response)
    const mockEmit = vi.fn((_event: string, ..._args: any[]) => {
      // Don't call the callback - simulate timeout
      return socketStore.socket;
    });
    
    if (socketStore.socket) {
      socketStore.socket.emit = mockEmit as any;
    }
    
    // Use fake timers to speed up the test
    vi.useFakeTimers();
    
    const promise = socketStore.getRuntimeSubscription();
    
    // Fast-forward time by 10 seconds
    vi.advanceTimersByTime(10000);
    
    await expect(promise).rejects.toThrow('getRuntimeSubscription timeout after 10000ms');
    
    vi.useRealTimers();
  });
  
  it('should timeout setRuntimeSubscription after 10 seconds if no response', async () => {
    socketStore.connect();
    
    const payload: UpdateRuntimeSubscriptionPayload = {
      channels: ['tweets'],
      users: []
    };
    
    // Mock emit to never call the callback (simulating no response)
    const mockEmit = vi.fn((_event: string, ..._args: any[]) => {
      // Don't call the callback - simulate timeout
      return socketStore.socket;
    });
    
    if (socketStore.socket) {
      socketStore.socket.emit = mockEmit as any;
    }
    
    // Use fake timers to speed up the test
    vi.useFakeTimers();
    
    const promise = socketStore.setRuntimeSubscription(payload);
    
    // Fast-forward time by 10 seconds
    vi.advanceTimersByTime(10000);
    
    await expect(promise).rejects.toThrow('setRuntimeSubscription timeout after 10000ms');
    
    vi.useRealTimers();
  });
  
  it('should clear timeout when getRuntimeSubscription receives response', async () => {
    socketStore.connect();
    
    const mockState: RuntimeSubscriptionState = {
      channels: ['all'],
      users: [],
      mode: 'active',
      source: 'config',
      updatedAt: '2024-01-01T00:00:00.000Z'
    };
    
    // Mock emit to call callback immediately
    const mockEmit = vi.fn((event: string, ...args: any[]) => {
      if (event === 'getRuntimeSubscription') {
        const callback = args[0];
        callback({ success: true, data: mockState });
      }
      return socketStore.socket;
    });
    
    if (socketStore.socket) {
      socketStore.socket.emit = mockEmit as any;
    }
    
    vi.useFakeTimers();
    
    const promise = socketStore.getRuntimeSubscription();
    
    // Response comes immediately, timeout should be cleared
    const result = await promise;
    
    expect(result).toEqual(mockState);
    
    // Advance time to verify timeout was cleared (no rejection)
    vi.advanceTimersByTime(10000);
    
    vi.useRealTimers();
  });
  
  it('should clear timeout when setRuntimeSubscription receives response', async () => {
    socketStore.connect();
    
    const payload: UpdateRuntimeSubscriptionPayload = {
      channels: ['tweets'],
      users: ['testuser']
    };
    
    const mockState: RuntimeSubscriptionState = {
      channels: ['tweets'],
      users: ['testuser'],
      mode: 'active',
      source: 'runtime',
      updatedAt: '2024-01-01T00:00:00.000Z'
    };
    
    // Mock emit to call callback immediately
    const mockEmit = vi.fn((event: string, ...args: any[]) => {
      if (event === 'setRuntimeSubscription') {
        const callback = args[1];
        callback({ success: true, data: mockState });
      }
      return socketStore.socket;
    });
    
    if (socketStore.socket) {
      socketStore.socket.emit = mockEmit as any;
    }
    
    vi.useFakeTimers();
    
    const promise = socketStore.setRuntimeSubscription(payload);
    
    // Response comes immediately, timeout should be cleared
    const result = await promise;
    
    expect(result).toEqual(mockState);
    
    // Advance time to verify timeout was cleared (no rejection)
    vi.advanceTimersByTime(10000);
    
    vi.useRealTimers();
  });
});
