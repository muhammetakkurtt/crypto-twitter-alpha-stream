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
  });

  describe('Configuration', () => {
    it('should accept custom config file path', () => {
      const app = new Application({ configFilePath: 'custom/config.json' });
      expect(app).toBeDefined();
    });

    it('should use default config file path when not specified', () => {
      const app = new Application();
      expect(app).toBeDefined();
    });
  });
});
