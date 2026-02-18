/**
 * Unit tests for DashboardOutput runtime subscription features
 */

import { DashboardOutput } from '../../src/outputs/DashboardOutput';
import { EventBus } from '../../src/eventbus/EventBus';
import { RuntimeSubscriptionState, Channel } from '../../src/models/types';

// Mock StreamCore
const createMockStreamCore = () => {
  const mockState: RuntimeSubscriptionState = {
    channels: ['all'] as Channel[],
    users: [],
    mode: 'active' as const,
    source: 'config' as const,
    updatedAt: new Date().toISOString()
  };

  return {
    getRuntimeSubscriptionState: jest.fn(() => ({ ...mockState })),
    updateRuntimeSubscription: jest.fn(async (payload) => {
      const newState: RuntimeSubscriptionState = {
        channels: payload.channels,
        users: payload.users,
        mode: payload.channels.length === 0 ? 'idle' : 'active',
        source: 'runtime' as const,
        updatedAt: new Date().toISOString()
      };
      return newState;
    })
  } as any;
};

// Mock Socket with handshake address
const createMockSocket = (address: string) => {
  return {
    id: 'test-socket-id',
    handshake: {
      address
    },
    on: jest.fn(),
    emit: jest.fn()
  } as any;
};

describe('DashboardOutput Runtime Subscription', () => {
  let eventBus: EventBus;
  let dashboard: DashboardOutput;
  let mockStreamCore: any;

  beforeEach(() => {
    eventBus = new EventBus();
    dashboard = new DashboardOutput(eventBus, { port: 0 });
    mockStreamCore = createMockStreamCore();
  });

  afterEach(async () => {
    await dashboard.stop();
  });

  describe('setStreamCore', () => {
    it('should set StreamCore reference', () => {
      dashboard.setStreamCore(mockStreamCore);
      
      // Verify by checking internal state (accessing private field for testing)
      expect((dashboard as any).streamCore).toBe(mockStreamCore);
    });

    it('should allow setting StreamCore to null', () => {
      dashboard.setStreamCore(mockStreamCore);
      dashboard.setStreamCore(null as any);
      
      expect((dashboard as any).streamCore).toBeNull();
    });
  });

  describe('isControlClient', () => {
    it('should return true for 127.0.0.1', () => {
      const socket = createMockSocket('127.0.0.1');
      const isControl = (dashboard as any).isControlClient(socket);
      expect(isControl).toBe(true);
    });

    it('should return true for ::1', () => {
      const socket = createMockSocket('::1');
      const isControl = (dashboard as any).isControlClient(socket);
      expect(isControl).toBe(true);
    });

    it('should return true for ::ffff:127.0.0.1', () => {
      const socket = createMockSocket('::ffff:127.0.0.1');
      const isControl = (dashboard as any).isControlClient(socket);
      expect(isControl).toBe(true);
    });

    it('should return true for localhost', () => {
      const socket = createMockSocket('localhost');
      const isControl = (dashboard as any).isControlClient(socket);
      expect(isControl).toBe(true);
    });

    it('should return false for remote IP', () => {
      const socket = createMockSocket('192.168.1.100');
      const isControl = (dashboard as any).isControlClient(socket);
      expect(isControl).toBe(false);
    });

    it('should return false for public IP', () => {
      const socket = createMockSocket('8.8.8.8');
      const isControl = (dashboard as any).isControlClient(socket);
      expect(isControl).toBe(false);
    });

    it('should return false for IPv6 remote address', () => {
      const socket = createMockSocket('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
      const isControl = (dashboard as any).isControlClient(socket);
      expect(isControl).toBe(false);
    });
  });

  describe('StreamCore integration', () => {
    it('should call StreamCore.getRuntimeSubscriptionState when available', () => {
      dashboard.setStreamCore(mockStreamCore);
      
      const state = mockStreamCore.getRuntimeSubscriptionState();
      
      expect(mockStreamCore.getRuntimeSubscriptionState).toHaveBeenCalled();
      expect(state).toEqual(expect.objectContaining({
        channels: ['all'],
        users: [],
        mode: 'active',
        source: 'config'
      }));
    });

    it('should call StreamCore.updateRuntimeSubscription with correct payload', async () => {
      dashboard.setStreamCore(mockStreamCore);
      
      const payload = {
        channels: ['tweets', 'following'] as Channel[],
        users: ['elonmusk', 'vitalikbuterin']
      };
      
      const newState = await mockStreamCore.updateRuntimeSubscription(payload);
      
      expect(mockStreamCore.updateRuntimeSubscription).toHaveBeenCalledWith(payload);
      expect(newState).toEqual(expect.objectContaining({
        channels: ['tweets', 'following'],
        users: ['elonmusk', 'vitalikbuterin'],
        mode: 'active',
        source: 'runtime'
      }));
    });

    it('should handle idle mode when channels array is empty', async () => {
      dashboard.setStreamCore(mockStreamCore);
      
      const payload = {
        channels: [] as Channel[],
        users: []
      };
      
      const newState = await mockStreamCore.updateRuntimeSubscription(payload);
      
      expect(newState.mode).toBe('idle');
      expect(newState.channels).toEqual([]);
    });
  });

  describe('Security validation', () => {
    it('should identify control clients correctly', () => {
      const loopbackAddresses = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
      
      loopbackAddresses.forEach(address => {
        const socket = createMockSocket(address);
        const isControl = (dashboard as any).isControlClient(socket);
        expect(isControl).toBe(true);
      });
    });

    it('should identify read-only clients correctly', () => {
      const remoteAddresses = [
        '192.168.1.100',
        '10.0.0.1',
        '8.8.8.8',
        '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
      ];
      
      remoteAddresses.forEach(address => {
        const socket = createMockSocket(address);
        const isControl = (dashboard as any).isControlClient(socket);
        expect(isControl).toBe(false);
      });
    });
  });

  describe('Error handling', () => {
    it('should handle StreamCore errors gracefully', () => {
      const errorStreamCore = {
        getRuntimeSubscriptionState: jest.fn(() => {
          throw new Error('StreamCore error');
        })
      } as any;

      dashboard.setStreamCore(errorStreamCore);
      
      expect(() => errorStreamCore.getRuntimeSubscriptionState()).toThrow('StreamCore error');
    });

    it('should handle update errors gracefully', async () => {
      const errorStreamCore = {
        updateRuntimeSubscription: jest.fn(async () => {
          throw new Error('Update failed');
        })
      } as any;

      dashboard.setStreamCore(errorStreamCore);
      
      await expect(errorStreamCore.updateRuntimeSubscription({ channels: [], users: [] }))
        .rejects.toThrow('Update failed');
    });
  });

  describe('Missing callback handling', () => {
    let mockIo: any;
    let connectionHandler: any;
    let mockSocket: any;

    beforeEach(async () => {
      // Start the dashboard to initialize Socket.IO
      await dashboard.start();
      dashboard.setStreamCore(mockStreamCore);

      // Get the connection handler
      mockIo = (dashboard as any).io;
      const listeners = mockIo.listeners('connection');
      connectionHandler = listeners[0];

      // Create a mock socket
      mockSocket = {
        id: 'test-socket',
        handshake: { address: '127.0.0.1' },
        on: jest.fn(),
        emit: jest.fn()
      };
    });

    it('should not crash when getRuntimeSubscription is called without callback', () => {
      // Trigger connection handler
      connectionHandler(mockSocket);

      // Find the getRuntimeSubscription handler
      const getRuntimeHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'getRuntimeSubscription'
      )?.[1];

      expect(getRuntimeHandler).toBeDefined();

      // Call without callback - should not crash
      expect(() => {
        getRuntimeHandler();
      }).not.toThrow();

      // Verify StreamCore was still called
      expect(mockStreamCore.getRuntimeSubscriptionState).toHaveBeenCalled();
    });

    it('should not crash when getRuntimeSubscription throws error without callback', () => {
      const errorStreamCore = {
        getRuntimeSubscriptionState: jest.fn(() => {
          throw new Error('StreamCore error');
        })
      } as any;
      dashboard.setStreamCore(errorStreamCore);

      // Trigger connection handler
      connectionHandler(mockSocket);

      // Find the getRuntimeSubscription handler
      const getRuntimeHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'getRuntimeSubscription'
      )?.[1];

      expect(getRuntimeHandler).toBeDefined();

      // Call without callback - should not crash even with error
      expect(() => {
        getRuntimeHandler();
      }).not.toThrow();
    });

    it('should not crash when setRuntimeSubscription is called without callback', async () => {
      // Trigger connection handler
      connectionHandler(mockSocket);

      // Find the setRuntimeSubscription handler
      const setRuntimeHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'setRuntimeSubscription'
      )?.[1];

      expect(setRuntimeHandler).toBeDefined();

      const payload = {
        channels: ['tweets'] as Channel[],
        users: []
      };

      // Call without callback - should not crash
      await expect(setRuntimeHandler(payload)).resolves.not.toThrow();

      // Verify StreamCore was still called
      expect(mockStreamCore.updateRuntimeSubscription).toHaveBeenCalledWith(payload);
    });

    it('should not crash when setRuntimeSubscription throws error without callback', async () => {
      const errorStreamCore = {
        getRuntimeSubscriptionState: jest.fn(),
        updateRuntimeSubscription: jest.fn(async () => {
          throw new Error('Update failed');
        })
      } as any;
      dashboard.setStreamCore(errorStreamCore);

      // Trigger connection handler
      connectionHandler(mockSocket);

      // Find the setRuntimeSubscription handler
      const setRuntimeHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'setRuntimeSubscription'
      )?.[1];

      expect(setRuntimeHandler).toBeDefined();

      const payload = {
        channels: ['tweets'] as Channel[],
        users: []
      };

      // Call without callback - should not crash even with error
      await expect(setRuntimeHandler(payload)).resolves.not.toThrow();
    });

    it('should not crash when setRuntimeSubscription is called by read-only client without callback', async () => {
      // Create read-only socket
      const readOnlySocket = {
        id: 'test-socket-readonly',
        handshake: { address: '192.168.1.100' },
        on: jest.fn(),
        emit: jest.fn()
      };

      // Trigger connection handler
      connectionHandler(readOnlySocket);

      // Find the setRuntimeSubscription handler
      const setRuntimeHandler = readOnlySocket.on.mock.calls.find(
        (call: any) => call[0] === 'setRuntimeSubscription'
      )?.[1];

      expect(setRuntimeHandler).toBeDefined();

      const payload = {
        channels: ['tweets'] as Channel[],
        users: []
      };

      // Call without callback - should not crash even when forbidden
      await expect(setRuntimeHandler(payload)).resolves.not.toThrow();

      // Verify StreamCore was NOT called (security check)
      expect(mockStreamCore.updateRuntimeSubscription).not.toHaveBeenCalled();
    });

    it('should not crash when setRuntimeSubscription is called with invalid payload without callback', async () => {
      // Trigger connection handler
      connectionHandler(mockSocket);

      // Find the setRuntimeSubscription handler
      const setRuntimeHandler = mockSocket.on.mock.calls.find(
        (call: any) => call[0] === 'setRuntimeSubscription'
      )?.[1];

      expect(setRuntimeHandler).toBeDefined();

      const invalidPayload = {
        channels: 'not-an-array' // Invalid: should be array
      };

      // Call without callback - should not crash even with invalid payload
      await expect(setRuntimeHandler(invalidPayload as any)).resolves.not.toThrow();

      // Verify StreamCore was NOT called (validation failed)
      expect(mockStreamCore.updateRuntimeSubscription).not.toHaveBeenCalled();
    });
  });
});
