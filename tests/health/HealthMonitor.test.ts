/**
 * Unit tests for HealthMonitor
 */

import { HealthMonitor } from '../../src/health/HealthMonitor';
import { StreamCore } from '../../src/streamcore/StreamCore';
import { FilterPipeline } from '../../src/filters/FilterPipeline';
import { UserFilter, KeywordFilter } from '../../src/filters/EventFilter';
import { DedupCache } from '../../src/dedup/DedupCache';
import { EventBus } from '../../src/eventbus/EventBus';
import { AlertOutput } from '../../src/outputs/AlertOutput';
import { TelegramChannel } from '../../src/outputs/AlertChannel';

describe('HealthMonitor', () => {
  let streamCore: StreamCore;
  let filterPipeline: FilterPipeline;
  let eventBus: EventBus;
  let dedupCache: DedupCache;
  let healthMonitor: HealthMonitor;

  beforeEach(() => {
    // Set up dependencies
    filterPipeline = new FilterPipeline();
    dedupCache = new DedupCache();
    eventBus = new EventBus();
    
    streamCore = new StreamCore(
      {
        baseUrl: 'http://localhost:3000',
        token: 'test-token',
        channels: ['all']
      },
      filterPipeline,
      dedupCache,
      eventBus
    );
  });

  afterEach(async () => {
    if (healthMonitor) {
      await healthMonitor.stop();
    }
    if (dedupCache) {
      dedupCache.clear();
    }
  });

  describe('Status Collection', () => {
    it('should collect status from StreamCore', () => {
      healthMonitor = new HealthMonitor({
        port: 3001,
        streamCore,
        filterPipeline
      });

      const status = healthMonitor.getStatus();

      expect(status).toBeDefined();
      expect(status.connection).toBeDefined();
      expect(status.connection.status).toBe('disconnected');
      expect(status.connection.channels).toEqual(['all']);
      expect(status.connection.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should collect WebSocket-specific metrics when available', () => {
      // Create a mock WSSClient with WebSocket metrics
      const mockWSSClient = {
        getReconnectAttempts: jest.fn().mockReturnValue(3),
        getBufferedAmount: jest.fn().mockReturnValue(1024),
        getConnectionState: jest.fn().mockReturnValue('reconnecting'),
        disconnect: jest.fn()
      };

      // Inject mock client into StreamCore
      (streamCore as any).wssClient = mockWSSClient;
      (streamCore as any).connectionStatus = 'reconnecting';

      healthMonitor = new HealthMonitor({
        port: 3001,
        streamCore,
        filterPipeline
      });

      const status = healthMonitor.getStatus();

      expect(status.connection.reconnectAttempts).toBe(3);
      expect(status.connection.bufferedBytes).toBe(1024);
      expect(status.connection.status).toBe('reconnecting');
    });

    it('should not include WebSocket metrics when client is not available', () => {
      // Ensure no WSSClient is set
      (streamCore as any).wssClient = null;

      healthMonitor = new HealthMonitor({
        port: 3001,
        streamCore,
        filterPipeline
      });

      const status = healthMonitor.getStatus();

      expect(status.connection.reconnectAttempts).toBeUndefined();
      expect(status.connection.bufferedBytes).toBeUndefined();
    });

    it('should collect event statistics', () => {
      healthMonitor = new HealthMonitor({
        port: 3001,
        streamCore,
        filterPipeline
      });

      const status = healthMonitor.getStatus();

      expect(status.events).toBeDefined();
      expect(status.events.total).toBe(0);
      expect(status.events.delivered).toBe(0);
      expect(status.events.deduped).toBe(0);
      expect(status.events.rate).toBe(0);
    });

    it('should collect alert statistics when AlertOutput is provided', () => {
      const alertOutput = new AlertOutput(
        {
          channels: [
            new TelegramChannel('test-token', 'test-chat', false)
          ]
        },
        eventBus
      );

      healthMonitor = new HealthMonitor({
        port: 3001,
        streamCore,
        alertOutput,
        filterPipeline
      });

      const status = healthMonitor.getStatus();

      expect(status.alerts).toBeDefined();
      expect(status.alerts.telegram).toEqual({ sent: 0, failed: 0 });
      expect(status.alerts.discord).toEqual({ sent: 0, failed: 0 });
      expect(status.alerts.webhook).toEqual({ sent: 0, failed: 0 });
    });

    it('should provide default alert statistics when AlertOutput is not provided', () => {
      healthMonitor = new HealthMonitor({
        port: 3001,
        streamCore,
        filterPipeline
      });

      const status = healthMonitor.getStatus();

      expect(status.alerts).toBeDefined();
      expect(status.alerts.telegram).toEqual({ sent: 0, failed: 0 });
      expect(status.alerts.discord).toEqual({ sent: 0, failed: 0 });
      expect(status.alerts.webhook).toEqual({ sent: 0, failed: 0 });
    });

    it('should collect filter configuration', () => {
      const userFilter = new UserFilter(['user1', 'user2']);
      const keywordFilter = new KeywordFilter(['bitcoin', 'eth']);
      filterPipeline.addFilter(userFilter);
      filterPipeline.addFilter(keywordFilter);

      healthMonitor = new HealthMonitor({
        port: 3001,
        streamCore,
        filterPipeline
      });

      const status = healthMonitor.getStatus();

      expect(status.filters).toBeDefined();
      expect(status.filters.users).toEqual(['user1', 'user2']);
      expect(status.filters.keywords).toEqual(['bitcoin', 'eth']);
    });

    it('should calculate event rate correctly', async () => {
      healthMonitor = new HealthMonitor({
        port: 3001,
        streamCore,
        filterPipeline
      });

      // Wait a bit to ensure uptime > 0
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = healthMonitor.getStatus();

      expect(status.events.rate).toBeGreaterThanOrEqual(0);
      expect(typeof status.events.rate).toBe('number');
    });
  });

  describe('JSON Response Format', () => {
    it('should return valid JSON structure', () => {
      healthMonitor = new HealthMonitor({
        port: 3001,
        streamCore,
        filterPipeline
      });

      const status = healthMonitor.getStatus();

      // Verify JSON structure
      expect(status).toHaveProperty('connection');
      expect(status).toHaveProperty('events');
      expect(status).toHaveProperty('alerts');
      expect(status).toHaveProperty('filters');

      // Verify connection structure
      expect(status.connection).toHaveProperty('status');
      expect(status.connection).toHaveProperty('channels');
      expect(status.connection).toHaveProperty('uptime');
      // reconnectAttempts and bufferedBytes are optional

      // Verify events structure
      expect(status.events).toHaveProperty('total');
      expect(status.events).toHaveProperty('delivered');
      expect(status.events).toHaveProperty('deduped');
      expect(status.events).toHaveProperty('rate');

      // Verify alerts structure
      expect(status.alerts).toHaveProperty('telegram');
      expect(status.alerts).toHaveProperty('discord');
      expect(status.alerts).toHaveProperty('webhook');

      // Verify filters structure
      expect(status.filters).toHaveProperty('users');
      expect(status.filters).toHaveProperty('keywords');
    });

    it('should include WebSocket metrics in JSON when available', () => {
      // Create a mock WSSClient with WebSocket metrics
      const mockWSSClient = {
        getReconnectAttempts: jest.fn().mockReturnValue(2),
        getBufferedAmount: jest.fn().mockReturnValue(512),
        getConnectionState: jest.fn().mockReturnValue('connected'),
        disconnect: jest.fn()
      };

      // Inject mock client into StreamCore
      (streamCore as any).wssClient = mockWSSClient;

      healthMonitor = new HealthMonitor({
        port: 3001,
        streamCore,
        filterPipeline
      });

      const status = healthMonitor.getStatus();

      // Verify WebSocket-specific fields are present
      expect(status.connection).toHaveProperty('reconnectAttempts');
      expect(status.connection).toHaveProperty('bufferedBytes');
      expect(status.connection.reconnectAttempts).toBe(2);
      expect(status.connection.bufferedBytes).toBe(512);
    });

    it('should be serializable to JSON', () => {
      healthMonitor = new HealthMonitor({
        port: 3001,
        streamCore,
        filterPipeline
      });

      const status = healthMonitor.getStatus();

      // Should not throw
      expect(() => JSON.stringify(status)).not.toThrow();

      const json = JSON.stringify(status);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(status);
    });
  });

  describe('Endpoint Availability', () => {
    it('should start server on specified port', async () => {
      healthMonitor = new HealthMonitor({
        port: 3002,
        streamCore,
        filterPipeline
      });

      await healthMonitor.start();

      // Verify server is running by making a request
      const response = await fetch('http://localhost:3002/status');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toHaveProperty('connection');
    });

    it('should respond to /status endpoint', async () => {
      healthMonitor = new HealthMonitor({
        port: 3003,
        streamCore,
        filterPipeline
      });

      await healthMonitor.start();

      const response = await fetch('http://localhost:3003/status');
      expect(response.ok).toBe(true);
      expect(response.headers.get('content-type')).toContain('application/json');

      const data = await response.json();
      expect(data).toBeDefined();
    });

    it('should respond to root endpoint', async () => {
      healthMonitor = new HealthMonitor({
        port: 3004,
        streamCore,
        filterPipeline
      });

      await healthMonitor.start();

      const response = await fetch('http://localhost:3004/');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.message).toBeDefined();
    });

    it('should stop server cleanly', async () => {
      healthMonitor = new HealthMonitor({
        port: 3005,
        streamCore,
        filterPipeline
      });

      await healthMonitor.start();
      await healthMonitor.stop();

      // Server should no longer respond
      await expect(
        fetch('http://localhost:3005/status')
      ).rejects.toThrow();
    });

    it('should handle errors gracefully', async () => {
      healthMonitor = new HealthMonitor({
        port: 3006,
        streamCore,
        filterPipeline
      });

      await healthMonitor.start();

      // Make request to /status
      const response = await fetch('http://localhost:3006/status');
      expect(response.ok).toBe(true);
    });
  });
});
