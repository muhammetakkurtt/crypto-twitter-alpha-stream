import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { socketStore } from './socket.svelte';
import { eventsStore } from './events.svelte';
import { toastStore } from './toast.svelte';
import type { TwitterEvent } from '$lib/types';

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
