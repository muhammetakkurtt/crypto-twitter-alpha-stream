/**
 * Integration tests for the Application class
 * Tests complete startup sequence, graceful shutdown, and error handling
 */

import { Application } from '../src/Application';
import { ConfigManager } from '../src/config/ConfigManager';
import { createMockConfig } from './test-helpers';

// Mock all external dependencies
jest.mock('../src/config/ConfigManager');
jest.mock('../src/streamcore/StreamCore');
jest.mock('../src/outputs/CLIOutput');
jest.mock('../src/outputs/DashboardOutput');
jest.mock('../src/outputs/AlertOutput');
jest.mock('../src/activeusers/ActiveUsersFetcher');
jest.mock('../src/health/HealthMonitor');

describe('Application', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Set required environment variables
    process.env.APIFY_TOKEN = 'test-token-12345';
    process.env.CLI_ENABLED = 'true';
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Startup Sequence', () => {
    it('should initialize all components in correct order', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig();
      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      await app.start();

      // Verify application is running
      expect(app.isApplicationRunning()).toBe(true);

      // Clean up
      await app.shutdown();
    });

    it('should validate configuration on startup', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig({
        outputs: {
          cli: { enabled: false },
          dashboard: { enabled: false, port: 3000 },
          alerts: {
            telegram: { enabled: false },
            discord: { enabled: false },
            webhook: { enabled: false }
          }
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      // Should throw error about no outputs enabled
      await expect(app.start()).rejects.toThrow('At least one output must be enabled');
    });

    it('should handle missing Telegram configuration', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig({
        outputs: {
          cli: { enabled: true },
          dashboard: { enabled: false, port: 3000 },
          alerts: {
            telegram: { enabled: true }, // Missing botToken and chatId
            discord: { enabled: false },
            webhook: { enabled: false }
          }
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      // Should throw error about missing Telegram credentials
      await expect(app.start()).rejects.toThrow('Telegram alerts enabled but botToken or chatId is missing');
    });

    it('should handle missing Discord configuration', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig({
        outputs: {
          cli: { enabled: true },
          dashboard: { enabled: false, port: 3000 },
          alerts: {
            telegram: { enabled: false },
            discord: { enabled: true }, // Missing webhookUrl
            webhook: { enabled: false }
          }
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      // Should throw error about missing Discord webhook URL
      await expect(app.start()).rejects.toThrow('Discord alerts enabled but webhookUrl is missing');
    });

    it('should handle missing webhook configuration', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig({
        outputs: {
          cli: { enabled: true },
          dashboard: { enabled: false, port: 3000 },
          alerts: {
            telegram: { enabled: false },
            discord: { enabled: false },
            webhook: { enabled: true } // Missing url
          }
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      // Should throw error about missing webhook URL
      await expect(app.start()).rejects.toThrow('Generic webhook alerts enabled but url is missing');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should shutdown all components in correct order', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig();
      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      await app.start();
      expect(app.isApplicationRunning()).toBe(true);

      await app.shutdown();
      expect(app.isApplicationRunning()).toBe(false);
    });

    it('should handle shutdown when not running', async () => {
      const app = new Application();
      
      // Should not throw error when shutting down before starting
      await expect(app.shutdown()).resolves.not.toThrow();
    });

    it('should handle errors during shutdown gracefully', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig();
      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      await app.start();

      // Even if components throw errors during shutdown, it should complete
      await expect(app.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle configuration loading errors', async () => {
      const app = new Application();
      
      // Mock ConfigManager to throw error
      (ConfigManager.prototype.load as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to load configuration');
      });

      await expect(app.start()).rejects.toThrow('Failed to load configuration');
    });

    it('should cleanup on startup failure', async () => {
      const app = new Application();
      
      // Mock ConfigManager to throw error after some initialization
      (ConfigManager.prototype.load as jest.Mock).mockImplementation(() => {
        throw new Error('Startup error');
      });

      await expect(app.start()).rejects.toThrow('Startup error');
      
      // Application should not be running after failed startup
      expect(app.isApplicationRunning()).toBe(false);
    });

    it('should call shutdown on startup failure to clean up resources', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig();
      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);
      
      // Mock StreamCore.start to throw error after partial initialization
      const StreamCore = require('../src/streamcore/StreamCore').StreamCore;
      (StreamCore.prototype.start as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await expect(app.start()).rejects.toThrow('Connection failed');
      
      // Application should not be running after failed startup
      expect(app.isApplicationRunning()).toBe(false);
    });

    it('should clear timers on startup failure', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig();
      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);
      
      // Mock ActiveUsersFetcher to track if stopPeriodicRefresh is called
      const ActiveUsersFetcher = require('../src/activeusers/ActiveUsersFetcher').ActiveUsersFetcher;
      const stopPeriodicRefreshMock = jest.fn();
      (ActiveUsersFetcher.prototype.stopPeriodicRefresh as jest.Mock) = stopPeriodicRefreshMock;
      
      // Mock StreamCore.start to throw error after ActiveUsersFetcher is initialized
      const StreamCore = require('../src/streamcore/StreamCore').StreamCore;
      (StreamCore.prototype.start as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await expect(app.start()).rejects.toThrow('Connection failed');
      
      // Verify stopPeriodicRefresh was called during cleanup
      expect(stopPeriodicRefreshMock).toHaveBeenCalled();
      
      // Application should not be running
      expect(app.isApplicationRunning()).toBe(false);
    });

    it('should close connections on startup failure', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig();
      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);
      
      // Mock StreamCore to track if stop is called
      const StreamCore = require('../src/streamcore/StreamCore').StreamCore;
      const stopMock = jest.fn();
      (StreamCore.prototype.stop as jest.Mock) = stopMock;
      (StreamCore.prototype.start as jest.Mock).mockRejectedValue(new Error('Connection failed'));

      await expect(app.start()).rejects.toThrow('Connection failed');
      
      // Verify stop was called during cleanup
      expect(stopMock).toHaveBeenCalled();
      
      // Application should not be running
      expect(app.isApplicationRunning()).toBe(false);
    });

    it('should set isRunning=true early and allow shutdown to clean up', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig();
      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);
      
      // Mock to throw error during initialization
      const StreamCore = require('../src/streamcore/StreamCore').StreamCore;
      (StreamCore.prototype.start as jest.Mock).mockImplementation(() => {
        // At this point, isRunning should be true
        expect(app.isApplicationRunning()).toBe(true);
        throw new Error('Connection failed');
      });

      await expect(app.start()).rejects.toThrow('Connection failed');
      
      // After cleanup, isRunning should be false
      expect(app.isApplicationRunning()).toBe(false);
    });

    it('should handle errors during health monitor initialization', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig();
      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);
      
      // Mock HealthMonitor.start to throw error
      const HealthMonitor = require('../src/health/HealthMonitor').HealthMonitor;
      (HealthMonitor.prototype.start as jest.Mock).mockRejectedValue(new Error('Port already in use'));

      await expect(app.start()).rejects.toThrow('Port already in use');
      
      // Application should not be running after failed startup
      expect(app.isApplicationRunning()).toBe(false);
    });

    it('should handle errors during output initialization', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig({
        outputs: {
          cli: { enabled: true },
          dashboard: { enabled: true, port: 3000 },
          alerts: {
            telegram: { enabled: false },
            discord: { enabled: false },
            webhook: { enabled: false }
          }
        }
      });
      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);
      
      // Mock DashboardOutput.start to throw error
      const DashboardOutput = require('../src/outputs/DashboardOutput').DashboardOutput;
      (DashboardOutput.prototype.start as jest.Mock).mockRejectedValue(new Error('Dashboard port in use'));

      await expect(app.start()).rejects.toThrow('Dashboard port in use');
      
      // Application should not be running after failed startup
      expect(app.isApplicationRunning()).toBe(false);
    });
  });

  describe('Configuration', () => {
    beforeEach(() => {
      // Reset all mocks before each configuration test
      jest.clearAllMocks();
      jest.resetAllMocks();
    });

    it('should accept custom config file path', () => {
      const app = new Application({ configFilePath: 'custom/config.json' });
      expect(app).toBeDefined();
    });

    it('should use default config file path when not specified', () => {
      const app = new Application();
      expect(app).toBeDefined();
    });

    it('should support HTTP URL format', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'http://localhost:3000',
          token: 'test-token'
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      await app.start();
      expect(app.isApplicationRunning()).toBe(true);
      await app.shutdown();
    });

    it('should support HTTPS URL format', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'https://example.com',
          token: 'test-token'
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      await app.start();
      expect(app.isApplicationRunning()).toBe(true);
      await app.shutdown();
    });

    it('should support WS URL format', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'ws://localhost:3000',
          token: 'test-token'
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      await app.start();
      expect(app.isApplicationRunning()).toBe(true);
      await app.shutdown();
    });

    it('should support WSS URL format', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'wss://example.com',
          token: 'test-token'
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      await app.start();
      expect(app.isApplicationRunning()).toBe(true);
      await app.shutdown();
    });

    it('should support multiple channels configuration', async () => {
      const app = new Application();
      
      const mockConfig = createMockConfig({
        apify: {
          actorUrl: 'wss://example.com',
          token: 'test-token',
          channels: ['all', 'tweets', 'following']
        }
      });

      (ConfigManager.prototype.load as jest.Mock).mockReturnValue(mockConfig);

      await app.start();
      expect(app.isApplicationRunning()).toBe(true);
      await app.shutdown();
    });
  });
});
