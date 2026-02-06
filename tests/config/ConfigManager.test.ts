/**
 * Unit tests for ConfigManager
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../../src/config/ConfigManager';

describe('ConfigManager - Unit Tests', () => {
  const testConfigDir = path.join(__dirname, 'test-configs');
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear all APIFY-related env vars to ensure clean test state
    delete process.env.APIFY_TOKEN;
    delete process.env.APIFY_ACTOR_URL;
    delete process.env.ENDPOINT;
    delete process.env.USERS;
    delete process.env.KEYWORDS;
    delete process.env.DASHBOARD_ENABLED;
    delete process.env.DASHBOARD_PORT;
    delete process.env.DEDUP_TTL;
    
    // Create test config directory
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clean up test config files
    if (fs.existsSync(testConfigDir)) {
      try {
        const files = fs.readdirSync(testConfigDir);
        files.forEach(file => {
          const filePath = path.join(testConfigDir, file);
          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            // Ignore errors for individual files
          }
        });
      } catch (err) {
        // Ignore errors reading directory
      }
    }
  });

  afterAll(() => {
    // Remove test config directory
    if (fs.existsSync(testConfigDir)) {
      try {
        const files = fs.readdirSync(testConfigDir);
        files.forEach(file => {
          const filePath = path.join(testConfigDir, file);
          try {
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
            }
          } catch (err) {
            // Ignore errors for individual files
          }
        });
        fs.rmdirSync(testConfigDir);
      } catch (err) {
        // Ignore errors removing directory
      }
    }
  });

  describe('Environment Variable Parsing', () => {
    it('should parse APIFY_TOKEN from environment', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.apify.token).toBe('valid-token-abc123');
    });

    it('should parse APIFY_ACTOR_URL from environment', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://muhammetakkurtt--crypto-twitter-tracker.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.apify.actorUrl).toBe('https://muhammetakkurtt--crypto-twitter-tracker.apify.actor');
    });

    it('should parse ENDPOINT from environment', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.ENDPOINT = 'tweets';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.apify.endpoint).toBe('tweets');
    });

    it('should parse USERS from environment as comma-separated list', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.USERS = 'user1,user2,user3';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.filters.users).toEqual(['user1', 'user2', 'user3']);
    });

    it('should parse KEYWORDS from environment as comma-separated list', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.KEYWORDS = 'bitcoin,ethereum,solana';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.filters.keywords).toEqual(['bitcoin', 'ethereum', 'solana']);
    });

    it('should trim whitespace from comma-separated values', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.USERS = ' user1 , user2 , user3 ';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.filters.users).toEqual(['user1', 'user2', 'user3']);
    });

    it('should parse DASHBOARD_PORT from environment', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.DASHBOARD_PORT = '8080';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.outputs.dashboard.port).toBe(8080);
    });

    it('should parse boolean flags from environment', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.CLI_ENABLED = 'false';
      process.env.DASHBOARD_ENABLED = 'true';
      process.env.TELEGRAM_ENABLED = 'true';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.outputs.cli.enabled).toBe(false);
      expect(config.outputs.dashboard.enabled).toBe(true);
      expect(config.outputs.alerts.telegram.enabled).toBe(true);
    });

    it('should parse Telegram configuration from environment', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.TELEGRAM_BOT_TOKEN = 'bot-token-123';
      process.env.TELEGRAM_CHAT_ID = 'chat-id-456';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.outputs.alerts.telegram.botToken).toBe('bot-token-123');
      expect(config.outputs.alerts.telegram.chatId).toBe('chat-id-456');
    });

    it('should parse Discord configuration from environment', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/webhook/123';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.outputs.alerts.discord.webhookUrl).toBe('https://discord.com/webhook/123');
    });

    it('should parse webhook configuration from environment', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.WEBHOOK_URL = 'https://example.com/webhook';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.outputs.alerts.webhook.url).toBe('https://example.com/webhook');
    });

    it('should parse reconnect configuration from environment', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.RECONNECT_INITIAL_DELAY = '2000';
      process.env.RECONNECT_MAX_DELAY = '60000';
      process.env.RECONNECT_BACKOFF_MULTIPLIER = '2.5';
      process.env.RECONNECT_MAX_ATTEMPTS = '15';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.reconnect.initialDelay).toBe(2000);
      expect(config.reconnect.maxDelay).toBe(60000);
      expect(config.reconnect.backoffMultiplier).toBe(2.5);
      expect(config.reconnect.maxAttempts).toBe(15);
    });
  });

  describe('Config.json Loading', () => {
    it('should load configuration from config.json file', () => {
      const configPath = path.join(testConfigDir, 'test-config.json');
      const testConfig = {
        apify: {
          endpoint: 'following'
        },
        filters: {
          users: ['testuser1', 'testuser2'],
          keywords: ['test', 'keyword']
        },
        outputs: {
          dashboard: {
            port: 4000
          }
        },
        dedup: {
          ttl: 120
        }
      };
      
      fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
      
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      const configManager = new ConfigManager(configPath, true);
      const config = configManager.load();
      
      expect(config.apify.endpoint).toBe('following');
      expect(config.filters.users).toEqual(['testuser1', 'testuser2']);
      expect(config.filters.keywords).toEqual(['test', 'keyword']);
      expect(config.outputs.dashboard.port).toBe(4000);
      expect(config.dedup.ttl).toBe(120);
    });

    it('should handle missing config.json file gracefully', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent-file.json', true);
      const config = configManager.load();
      
      // Should use default values
      expect(config.apify.endpoint).toBe('all');
      expect(config.filters.users).toEqual([]);
      expect(config.outputs.dashboard.port).toBe(3000);
    });

    it('should handle malformed config.json gracefully', () => {
      const configPath = path.join(testConfigDir, 'malformed-config.json');
      fs.writeFileSync(configPath, '{ invalid json }');
      
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      const configManager = new ConfigManager(configPath, true);
      const config = configManager.load();
      
      // Should use default values
      expect(config.apify.endpoint).toBe('all');
    });
  });

  describe('Default Values', () => {
    it('should use default values when no config is provided', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.apify.endpoint).toBe('all');
      expect(config.filters.users).toEqual([]);
      expect(config.filters.keywords).toEqual([]);
      expect(config.outputs.cli.enabled).toBe(true);
      expect(config.outputs.dashboard.enabled).toBe(false);
      expect(config.outputs.dashboard.port).toBe(3000);
      expect(config.outputs.alerts.telegram.enabled).toBe(false);
      expect(config.outputs.alerts.discord.enabled).toBe(false);
      expect(config.outputs.alerts.webhook.enabled).toBe(false);
      expect(config.dedup.ttl).toBe(60);
      expect(config.reconnect.initialDelay).toBe(1000);
      expect(config.reconnect.maxDelay).toBe(30000);
      expect(config.reconnect.backoffMultiplier).toBe(2.0);
      expect(config.reconnect.maxAttempts).toBe(10);
    });
  });

  describe('Missing Required Config Error Handling', () => {
    it('should throw error when APIFY_TOKEN is missing', () => {
      delete process.env.APIFY_TOKEN;
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      
      expect(() => configManager.load()).toThrow('Missing required configuration: APIFY_TOKEN');
    });

    it('should throw error when APIFY_ACTOR_URL is missing', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      delete process.env.APIFY_ACTOR_URL;
      
      const configManager = new ConfigManager('nonexistent.json', true);
      
      expect(() => configManager.load()).toThrow('Missing required configuration: APIFY_ACTOR_URL');
    });

    it('should throw error when APIFY_TOKEN is empty string', () => {
      process.env.APIFY_TOKEN = '';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      
      expect(() => configManager.load()).toThrow('Missing required configuration: APIFY_TOKEN');
    });

    it('should throw error when APIFY_TOKEN is whitespace only', () => {
      process.env.APIFY_TOKEN = '   ';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      
      expect(() => configManager.load()).toThrow('Missing required configuration: APIFY_TOKEN');
    });

    it('should ignore invalid endpoint from environment and keep default', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.ENDPOINT = 'invalid-endpoint';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      // Invalid endpoint is ignored, default 'all' is used
      expect(config.apify.endpoint).toBe('all');
    });
  });

  describe('get() method', () => {
    it('should retrieve nested configuration values by key path', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.DASHBOARD_PORT = '5000';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      configManager.load();
      
      expect(configManager.get('apify.token')).toBe('valid-token-abc123');
      expect(configManager.get('outputs.dashboard.port')).toBe(5000);
      expect(configManager.get('dedup.ttl')).toBe(60);
    });

    it('should return undefined for non-existent keys', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      configManager.load();
      
      expect(configManager.get('nonexistent.key')).toBeUndefined();
    });

    it('should throw error when called before load()', () => {
      const configManager = new ConfigManager('nonexistent.json', true);
      
      expect(() => configManager.get('apify.token')).toThrow('Configuration not loaded');
    });
  });

  describe('reload() method', () => {
    it('should reload configuration with updated environment variables', () => {
      process.env.APIFY_TOKEN = 'valid-token-abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.ENDPOINT = 'tweets';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      let config = configManager.load();
      
      expect(config.apify.endpoint).toBe('tweets');
      
      // Change environment variable
      process.env.ENDPOINT = 'following';
      
      config = configManager.reload();
      expect(config.apify.endpoint).toBe('following');
    });
  });
});
