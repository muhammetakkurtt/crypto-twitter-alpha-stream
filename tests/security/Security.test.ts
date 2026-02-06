/**
 * Unit tests for security measures
 * Tests token validation, log sanitization, and file logging configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../../src/config/ConfigManager';
import { LogSanitizer } from '../../src/utils/LogSanitizer';

describe('Security Measures - Unit Tests', () => {
  const testConfigDir = path.join(__dirname, 'test-configs');
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear all APIFY-related env vars to ensure clean test state
    delete process.env.APIFY_TOKEN;
    delete process.env.APIFY_ACTOR_URL;
    
    // Create test config directory
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }

    // Clear log sanitizer
    LogSanitizer.clear();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clean up test config files
    if (fs.existsSync(testConfigDir)) {
      const files = fs.readdirSync(testConfigDir);
      files.forEach(file => {
        const filePath = path.join(testConfigDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    }
  });

  afterAll(() => {
    // Remove test config directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmdirSync(testConfigDir);
    }
  });

  describe('Token Validation', () => {
    it('should reject tokens that are too short', () => {
      process.env.APIFY_TOKEN = 'short';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      
      expect(() => configManager.load()).toThrow('Invalid APIFY_TOKEN: Token appears to be too short');
    });

    it('should reject placeholder token values', () => {
      const placeholders = ['your-token-here', 'example-token', 'placeholder-token'];
      
      for (const placeholder of placeholders) {
        process.env.APIFY_TOKEN = placeholder;
        process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
        
        const configManager = new ConfigManager('nonexistent.json', true);
        
        expect(() => configManager.load()).toThrow('Invalid APIFY_TOKEN: Token appears to be a placeholder value');
      }
    });

    it('should accept valid tokens', () => {
      process.env.APIFY_TOKEN = 'apify_1234567890abcdefghijklmnop';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.apify.token).toBe('apify_1234567890abcdefghijklmnop');
    });

    it('should reject empty tokens', () => {
      process.env.APIFY_TOKEN = '';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      
      expect(() => configManager.load()).toThrow('Missing required configuration: APIFY_TOKEN');
    });

    it('should reject whitespace-only tokens', () => {
      process.env.APIFY_TOKEN = '   ';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      
      expect(() => configManager.load()).toThrow('Missing required configuration: APIFY_TOKEN');
    });

    it('should only accept tokens from environment variables, not config files', () => {
      const configPath = path.join(testConfigDir, 'token-in-file.json');
      const testConfig = {
        apify: {
          token: 'token-from-file-should-be-ignored',
          endpoint: 'all'
        }
      };
      
      fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
      
      // Don't set APIFY_TOKEN in environment
      delete process.env.APIFY_TOKEN;
      
      const configManager = new ConfigManager(configPath, true); // Skip dotenv
      
      // Should fail because token from file is ignored
      expect(() => configManager.load()).toThrow('Missing required configuration: APIFY_TOKEN');
    });

    it('should warn when token is found in config file', () => {
      const configPath = path.join(testConfigDir, 'token-warning.json');
      const testConfig = {
        apify: {
          token: 'token-from-file',
          endpoint: 'all'
        }
      };
      
      fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
      
      // Set valid token in environment
      process.env.APIFY_TOKEN = 'valid-token-from-env';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      // Spy on console.warn
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const configManager = new ConfigManager(configPath, true);
      configManager.load();
      
      // Should have warned about token in config file
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('APIFY_TOKEN found in config file')
      );
      
      warnSpy.mockRestore();
    });
  });

  describe('Log Sanitization', () => {
    it('should sanitize registered sensitive values from log messages', () => {
      const token = 'apify_secret_token_12345';
      LogSanitizer.registerSensitiveValue(token);
      
      const message = `Connecting with token: ${token}`;
      const sanitized = LogSanitizer.sanitize(message);
      
      expect(sanitized).not.toContain(token);
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should sanitize multiple occurrences of the same token', () => {
      const token = 'secret123';
      LogSanitizer.registerSensitiveValue(token);
      
      const message = `Token ${token} was used, then ${token} again`;
      const sanitized = LogSanitizer.sanitize(message);
      
      expect(sanitized).not.toContain(token);
      
      // Should have two [REDACTED] occurrences
      const redactedCount = (sanitized.match(/\[REDACTED\]/g) || []).length;
      expect(redactedCount).toBe(2);
    });

    it('should sanitize tokens matching registered patterns', () => {
      LogSanitizer.registerPattern(/apify_[a-zA-Z0-9_-]+/gi);
      
      const message = 'Using token apify_abc123xyz for authentication';
      const sanitized = LogSanitizer.sanitize(message);
      
      expect(sanitized).not.toContain('apify_abc123xyz');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should handle special regex characters in sensitive values', () => {
      const token = 'token.with.dots+and+plus';
      LogSanitizer.registerSensitiveValue(token);
      
      const message = `Token: ${token}`;
      const sanitized = LogSanitizer.sanitize(message);
      
      expect(sanitized).not.toContain(token);
      expect(sanitized).toContain('[REDACTED]');
    });

    it('should preserve non-sensitive parts of messages', () => {
      const token = 'secret_token';
      LogSanitizer.registerSensitiveValue(token);
      
      const message = `Connection established with ${token} successfully`;
      const sanitized = LogSanitizer.sanitize(message);
      
      expect(sanitized).toContain('Connection established');
      expect(sanitized).toContain('successfully');
      expect(sanitized).not.toContain(token);
    });

    it('should handle empty or null messages gracefully', () => {
      LogSanitizer.registerSensitiveValue('token');
      
      expect(LogSanitizer.sanitize('')).toBe('');
      expect(LogSanitizer.sanitize(null as any)).toBe(null);
    });

    it('should clear all registered sensitive data', () => {
      const token = 'secret_token';
      LogSanitizer.registerSensitiveValue(token);
      
      let message = `Token: ${token}`;
      let sanitized = LogSanitizer.sanitize(message);
      expect(sanitized).not.toContain(token);
      
      // Clear and verify token is no longer sanitized
      LogSanitizer.clear();
      
      message = `Token: ${token}`;
      sanitized = LogSanitizer.sanitize(message);
      expect(sanitized).toContain(token);
    });

    it('should register all sensitive values from config', () => {
      process.env.APIFY_TOKEN = 'apify_valid_token_abc123';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.TELEGRAM_BOT_TOKEN = 'bot123456:ABC-DEF1234ghIkl';
      process.env.DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/secret';
      process.env.WEBHOOK_URL = 'https://example.com/webhook?token=secret123';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      configManager.load();
      
      // Test that all sensitive values are sanitized
      const messages = [
        `Using Apify token: ${process.env.APIFY_TOKEN}`,
        `Telegram bot: ${process.env.TELEGRAM_BOT_TOKEN}`,
        `Discord webhook: ${process.env.DISCORD_WEBHOOK_URL}`,
        `Generic webhook: ${process.env.WEBHOOK_URL}`,
      ];
      
      for (const message of messages) {
        const sanitized = LogSanitizer.sanitize(message);
        expect(sanitized).toContain('[REDACTED]');
        expect(sanitized).not.toContain('apify_valid_token_abc123');
        expect(sanitized).not.toContain('bot123456:ABC-DEF1234ghIkl');
        expect(sanitized).not.toContain('https://discord.com/api/webhooks/123/secret');
        expect(sanitized).not.toContain('https://example.com/webhook?token=secret123');
      }
    });
  });

  describe('File Logging Configuration', () => {
    it('should have file logging disabled by default', () => {
      process.env.APIFY_TOKEN = 'valid-token-12345';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.logging.fileLogging).toBe(false);
    });

    it('should allow enabling file logging via environment variable', () => {
      process.env.APIFY_TOKEN = 'valid-token-12345';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.FILE_LOGGING = 'true';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.logging.fileLogging).toBe(true);
    });

    it('should warn when file logging is enabled', () => {
      process.env.APIFY_TOKEN = 'valid-token-12345';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.FILE_LOGGING = 'true';
      
      // Spy on console.warn
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const configManager = new ConfigManager('nonexistent.json', true);
      configManager.load();
      
      // Should have warned about file logging
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('File logging is enabled')
      );
      
      warnSpy.mockRestore();
    });

    it('should allow disabling file logging explicitly', () => {
      process.env.APIFY_TOKEN = 'valid-token-12345';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.FILE_LOGGING = 'false';
      
      const configManager = new ConfigManager('nonexistent.json', true);
      const config = configManager.load();
      
      expect(config.logging.fileLogging).toBe(false);
    });

    it('should load file logging config from config.json', () => {
      const configPath = path.join(testConfigDir, 'logging-config.json');
      const testConfig = {
        logging: {
          fileLogging: true
        }
      };
      
      fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
      
      process.env.APIFY_TOKEN = 'valid-token-12345';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      
      // Spy on console.warn
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const configManager = new ConfigManager(configPath, true);
      const config = configManager.load();
      
      expect(config.logging.fileLogging).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('File logging is enabled')
      );
      
      warnSpy.mockRestore();
    });

    it('should prioritize environment variable over config.json for file logging', () => {
      const configPath = path.join(testConfigDir, 'logging-priority.json');
      const testConfig = {
        logging: {
          fileLogging: true
        }
      };
      
      fs.writeFileSync(configPath, JSON.stringify(testConfig, null, 2));
      
      process.env.APIFY_TOKEN = 'valid-token-12345';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
      process.env.FILE_LOGGING = 'false';
      
      const configManager = new ConfigManager(configPath, true);
      const config = configManager.load();
      
      // Environment variable should override config file
      expect(config.logging.fileLogging).toBe(false);
    });
  });
});
