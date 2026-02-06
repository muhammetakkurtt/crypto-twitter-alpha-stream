import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { socketStore } from '$lib/stores/socket.svelte';
import { eventsStore } from '$lib/stores/events.svelte';
import type { TwitterEvent } from '$lib/types';

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    connected: false,
    on: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn()
  };
  
  const mockIo = vi.fn(() => mockSocket);
  
  return {
    default: mockIo,
    io: mockIo
  };
});

describe('Socket.IO Connection Flow Integration', () => {
  let mockSocket: any;
  
  beforeEach(async () => {
    const ioClient = (await import('socket.io-client')).default;
    socketStore.disconnect();
    eventsStore.clear();
    mockSocket = ioClient();
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    socketStore.disconnect();
    eventsStore.clear();
  });
  
  it('should establish connection and update status', () => {
    socketStore.connect();
    
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    
    const connectHandler = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'connect'
    )?.[1];
    
    connectHandler?.();
    
    expect(socketStore.connectionStatus).toBe('connected');
  });
  
  it('should handle disconnect and update status', () => {
    socketStore.connect();
    
    const connectHandler = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'connect'
    )?.[1];
    connectHandler?.();
    
    const disconnectHandler = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'disconnect'
    )?.[1];
    disconnectHandler?.();
    
    expect(socketStore.connectionStatus).toBe('disconnected');
  });
  
  it('should receive events and add to store', () => {
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
        action: 'created',
        tweet: {
          id: 'tweet-123',
          type: 'tweet',
          created_at: new Date().toISOString(),
          body: {
            text: 'Test tweet content'
          },
          author: {
            handle: 'testuser',
            profile: {
              name: 'Test User'
            }
          }
        }
      }
    };
    
    const eventHandler = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'event'
    )?.[1];
    
    eventHandler?.(mockEvent);
    
    expect(eventsStore.events).toHaveLength(1);
    expect(eventsStore.events[0]).toEqual(mockEvent);
  });
  
  it('should receive state and populate events', () => {
    socketStore.connect();
    
    const mockEvents: TwitterEvent[] = [
      {
        type: 'post_created',
        timestamp: new Date().toISOString(),
        primaryId: 'test-1',
        user: {
          username: 'user1',
          displayName: 'User One',
          userId: 'uid-1'
        },
        data: {
          tweetId: 'tweet-1',
          username: 'user1',
          action: 'created'
        }
      },
      {
        type: 'follow_created',
        timestamp: new Date().toISOString(),
        primaryId: 'test-2',
        user: {
          username: 'user2',
          displayName: 'User Two',
          userId: 'uid-2'
        },
        data: {
          username: 'user2',
          action: 'followed'
        }
      }
    ];
    
    const stateHandler = mockSocket.on.mock.calls.find(
      (call: any[]) => call[0] === 'state'
    )?.[1];
    
    stateHandler?.({ events: mockEvents });
    
    expect(eventsStore.events).toHaveLength(2);
  });
  
  it('should not reconnect if already connected', async () => {
    // Set socket as already connected
    mockSocket.connected = true;
    socketStore.socket = mockSocket;
    
    vi.clearAllMocks();
    
    // Try to connect again
    socketStore.connect();
    
    const ioClient = (await import('socket.io-client')).default;
    // Should not create a new socket if already connected
    expect(ioClient).not.toHaveBeenCalled();
  });
  
  it('should clean up on disconnect', () => {
    socketStore.connect();
    socketStore.disconnect();
    
    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(socketStore.socket).toBeNull();
    expect(socketStore.connectionStatus).toBe('disconnected');
  });
});
