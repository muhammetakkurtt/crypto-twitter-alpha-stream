/**
 * Integration tests for Actor Reconnection Handling
 * Tests the complete shutdown and reconnection flow
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
    simulateShutdown() {
      const shutdownListeners = this.eventListeners.get('shutdown');
      if (shutdownListeners) {
        shutdownListeners.forEach(listener => {
          listener({ type: 'shutdown', data: '{}' });
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

describe('Actor Reconnection - Integration Tests', () => {
  let client: SSEClient;
  let config: ConnectionConfig;

  beforeEach(() => {
    config = {
      endpoint: 'http://test.example.com/events/twitter/all',
      token: 'test-token-123',
      reconnectDelay: 1000,
      maxReconnectDelay: 30000,
      reconnectBackoffMultiplier: 2.0,
      maxReconnectAttempts: 5,
    };
    client = new SSEClient(config);

    // Mock global fetch for health checks
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ status: 'ok' })
    });
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
    jest.clearAllTimers();
    jest.restoreAllMocks();
  });

  describe('Complete Shutdown and Reconnection Flow', () => {
    it('should handle actor shutdown and reconnect successfully', async () => {
      // Connect initially
      await client.connect();
      expect(client.getConnectionStatus()).toBe(true);

      const eventSource = (client as any).eventSource;
      expect(eventSource).not.toBeNull();

      // Simulate actor shutdown
      eventSource.simulateShutdown();

      // Verify shutdown was detected
      expect((client as any).isExpectedShutdown).toBe(true);
      expect(client.getConnectionStatus()).toBe(false);

      // Wait for health check and reconnection
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Verify reconnection occurred
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      );
    });

    it('should not log errors for expected shutdowns', async () => {
      const errorCallback = jest.fn();
      client.onError(errorCallback);

      await client.connect();

      const eventSource = (client as any).eventSource;

      // Simulate shutdown
      eventSource.simulateShutdown();

      // Simulate error after shutdown (should be ignored)
      eventSource.simulateError({ message: 'Connection lost' });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Error callback should not be called for expected shutdown
      expect(errorCallback).not.toHaveBeenCalled();
    });

    it('should prevent duplicate connections during reconnection', async () => {
      await client.connect();

      const eventSource = (client as any).eventSource;

      // Simulate shutdown
      eventSource.simulateShutdown();

      // Try to connect manually while reconnection is in progress
      const connectPromise1 = client.connect();
      const connectPromise2 = client.connect();

      await Promise.all([connectPromise1, connectPromise2]);

      // Should only have one connection
      expect((client as any).eventSource).not.toBeNull();
    });

    it('should reset reconnection state after successful reconnection', async () => {
      await client.connect();

      const eventSource = (client as any).eventSource;

      // Simulate shutdown
      eventSource.simulateShutdown();

      // Wait for reconnection
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Verify state is reset
      expect((client as any).isExpectedShutdown).toBe(false);
      expect((client as any).reconnectAttempts).toBe(0);
    });
  });

  describe('Error Handling During Reconnection', () => {
    it('should handle health check failures gracefully', async () => {
      // Mock fetch to fail
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await client.connect();

      const eventSource = (client as any).eventSource;

      // Simulate shutdown
      eventSource.simulateShutdown();

      // Wait for health check attempts
      await new Promise(resolve => setTimeout(resolve, 2200));

      // Should continue polling despite failures
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle unexpected errors during normal operation', async () => {
      const errorCallback = jest.fn();
      client.onError(errorCallback);

      await client.connect();

      const eventSource = (client as any).eventSource;

      // Simulate unexpected error (not shutdown)
      eventSource.simulateError({ message: 'Unexpected error' });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Error callback should be called for unexpected errors
      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('SSE connection error')
        })
      );
    });
  });
});
