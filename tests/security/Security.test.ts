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
      // Test exact placeholder matches and obvious patterns that will be rejected
      const placeholders = [
        'your-token-here',      // Starts with "your"
        'placeholder',          // Exact match
        'your_token_here',      // Starts with "your"
        'example_token',        // Exact match
        'test_token'            // Exact match
      ];
      
      for (const placeholder of placeholders) {
        process.env.APIFY_TOKEN = placeholder;
        process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
        
        const configManager = new ConfigManager('nonexistent.json', true);
        
        expect(() => configManager.load()).toThrow('Invalid APIFY_TOKEN: Token appears to be a placeholder value');
      }
    });
    
    it('should accept real tokens that contain common words', () => {
      // These should be accepted - they're real tokens that happen to contain "test" or "example"
      const realTokens = [
        'apify_api_mytesttoken_abc123',
        'sk_test_abc123def456',
        'real_token_with_test_in_name'
      ];
      
      for (const token of realTokens) {
        process.env.APIFY_TOKEN = token;
        process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
        
        const configManager = new ConfigManager('nonexistent.json', true);
        
        expect(() => configManager.load()).not.toThrow();
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
          channels: ['all']
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
          channels: ['all']
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

    it('should sanitize error objects', () => {
      const token = 'secret_token_12345';
      LogSanitizer.registerSensitiveValue(token);
      
      const error = new Error(`Authentication failed with token: ${token}`);
      const sanitized = LogSanitizer.sanitizeAny(error);
      
      expect(sanitized.name).toBe('Error');
      expect(sanitized.message).not.toContain(token);
      expect(sanitized.message).toContain('[REDACTED]');
      expect(sanitized.stack).not.toContain(token);
    });

    it('should sanitize nested objects', () => {
      const token = 'secret_api_key';
      LogSanitizer.registerSensitiveValue(token);
      
      const obj = {
        config: {
          auth: {
            apiKey: token,
            endpoint: 'https://api.example.com'
          }
        },
        metadata: {
          user: 'testuser'
        }
      };
      
      const sanitized = LogSanitizer.sanitizeAny(obj);
      
      expect(sanitized.config.auth.apiKey).not.toContain(token);
      expect(sanitized.config.auth.apiKey).toBe('[REDACTED]');
      expect(sanitized.config.auth.endpoint).toBe('https://api.example.com');
      expect(sanitized.metadata.user).toBe('testuser');
    });

    it('should sanitize arrays', () => {
      const token = 'secret_token';
      LogSanitizer.registerSensitiveValue(token);
      
      const arr = [
        `Token: ${token}`,
        'Normal message',
        { key: token },
        [token, 'nested']
      ];
      
      const sanitized = LogSanitizer.sanitizeAny(arr);
      
      expect(sanitized[0]).not.toContain(token);
      expect(sanitized[0]).toContain('[REDACTED]');
      expect(sanitized[1]).toBe('Normal message');
      expect(sanitized[2].key).toBe('[REDACTED]');
      expect(sanitized[3][0]).toBe('[REDACTED]');
      expect(sanitized[3][1]).toBe('nested');
    });

    it('should handle circular references safely', () => {
      const token = 'secret_token';
      LogSanitizer.registerSensitiveValue(token);
      
      const obj: any = {
        name: 'test',
        token: token
      };
      obj.self = obj; // Create circular reference
      
      const sanitized = LogSanitizer.sanitizeAny(obj);
      
      expect(sanitized.name).toBe('test');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.self).toBe('[Circular]');
    });

    it('should sanitize error objects with custom properties', () => {
      const token = 'secret_token';
      LogSanitizer.registerSensitiveValue(token);
      
      const error: any = new Error('Test error');
      error.token = token;
      error.config = { apiKey: token };
      
      const sanitized = LogSanitizer.sanitizeAny(error);
      
      expect(sanitized.message).toBe('Test error');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.config.apiKey).toBe('[REDACTED]');
    });

    it('should handle functions in objects', () => {
      const obj = {
        name: 'test',
        callback: () => console.log('test')
      };
      
      const sanitized = LogSanitizer.sanitizeAny(obj);
      
      expect(sanitized.name).toBe('test');
      expect(sanitized.callback).toBe('[Function]');
    });

    it('should handle symbols in objects', () => {
      const sym = Symbol('test');
      const obj = {
        name: 'test',
        symbol: sym
      };
      
      const sanitized = LogSanitizer.sanitizeAny(obj);
      
      expect(sanitized.name).toBe('test');
      expect(sanitized.symbol).toBe(sym.toString());
    });

    it('should handle null and undefined values', () => {
      const obj = {
        nullValue: null,
        undefinedValue: undefined,
        normalValue: 'test'
      };
      
      const sanitized = LogSanitizer.sanitizeAny(obj);
      
      expect(sanitized.nullValue).toBeNull();
      expect(sanitized.undefinedValue).toBeUndefined();
      expect(sanitized.normalValue).toBe('test');
    });

    it('should sanitize deeply nested circular structures', () => {
      const token = 'secret_token';
      LogSanitizer.registerSensitiveValue(token);
      
      const obj: any = {
        level1: {
          token: token,
          level2: {
            data: 'test'
          }
        }
      };
      obj.level1.level2.parent = obj.level1; // Create circular reference
      
      const sanitized = LogSanitizer.sanitizeAny(obj);
      
      expect(sanitized.level1.token).toBe('[REDACTED]');
      expect(sanitized.level1.level2.data).toBe('test');
      expect(sanitized.level1.level2.parent).toBe('[Circular]');
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

  describe('Console Wrapping Idempotency', () => {
    let originalConsoleLog: typeof console.log;
    let originalConsoleWarn: typeof console.warn;
    let originalConsoleError: typeof console.error;
    let originalConsoleInfo: typeof console.info;

    beforeEach(() => {
      // Save original console methods before any wrapping
      originalConsoleLog = console.log;
      originalConsoleWarn = console.warn;
      originalConsoleError = console.error;
      originalConsoleInfo = console.info;

      // Reset the wrapped flag for testing
      // @ts-ignore - accessing private static field for testing
      LogSanitizer.isConsoleWrapped = false;
    });

    afterEach(() => {
      // Restore original console methods
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
      console.info = originalConsoleInfo;

      // Reset the wrapped flag
      // @ts-ignore - accessing private static field for testing
      LogSanitizer.isConsoleWrapped = false;
    });

    it('should wrap console methods on first call', () => {
      const token = 'secret_token_12345';
      LogSanitizer.registerSensitiveValue(token);

      // Mock console.log to capture output
      const mockLog = jest.fn();
      console.log = mockLog;

      // Wrap console
      LogSanitizer.wrapConsole();

      // Call console.log
      console.log(`Token: ${token}`);
      
      // Should have been called with sanitized output
      expect(mockLog).toHaveBeenCalled();
      expect(mockLog.mock.calls[0][0]).toContain('[REDACTED]');
      expect(mockLog.mock.calls[0][0]).not.toContain(token);
    });

    it('should not wrap console methods multiple times', () => {
      const token = 'secret_token_12345';
      LogSanitizer.registerSensitiveValue(token);

      // Wrap console multiple times
      LogSanitizer.wrapConsole();
      const firstWrappedLog = console.log;
      
      LogSanitizer.wrapConsole();
      const secondWrappedLog = console.log;
      
      LogSanitizer.wrapConsole();
      const thirdWrappedLog = console.log;

      // All should be the same reference (not re-wrapped)
      expect(firstWrappedLog).toBe(secondWrappedLog);
      expect(secondWrappedLog).toBe(thirdWrappedLog);
    });

    it('should maintain sanitization after multiple wrap calls', () => {
      const token = 'secret_token_12345';
      LogSanitizer.registerSensitiveValue(token);

      // Mock console.log to capture output
      const mockLog = jest.fn();
      console.log = mockLog;

      // Wrap console multiple times
      LogSanitizer.wrapConsole();
      LogSanitizer.wrapConsole();
      LogSanitizer.wrapConsole();

      // Call console.log
      console.log(`Token: ${token}`);
      
      // Should still sanitize correctly
      expect(mockLog).toHaveBeenCalled();
      expect(mockLog.mock.calls[0][0]).toContain('[REDACTED]');
      expect(mockLog.mock.calls[0][0]).not.toContain(token);
    });

    it('should not degrade performance with multiple wrap calls', () => {
      const token = 'secret_token_12345';
      LogSanitizer.registerSensitiveValue(token);

      // Mock console.log to avoid actual output
      const mockLog = jest.fn();
      console.log = mockLog;

      // Wrap console once
      LogSanitizer.wrapConsole();
      
      // Measure time for single wrap
      const start1 = Date.now();
      for (let i = 0; i < 1000; i++) {
        console.log(`Test message ${i} with ${token}`);
      }
      const time1 = Date.now() - start1;

      // Reset and wrap multiple times
      mockLog.mockClear();
      // @ts-ignore - accessing private static field for testing
      LogSanitizer.isConsoleWrapped = false;
      console.log = mockLog;

      LogSanitizer.wrapConsole();
      LogSanitizer.wrapConsole();
      LogSanitizer.wrapConsole();
      LogSanitizer.wrapConsole();
      LogSanitizer.wrapConsole();

      // Measure time for multiple wraps (should be same since idempotent)
      const start2 = Date.now();
      for (let i = 0; i < 1000; i++) {
        console.log(`Test message ${i} with ${token}`);
      }
      const time2 = Date.now() - start2;

      // Time should be similar (no significant degradation from layering)
      // Since we're idempotent, times should be nearly identical
      // Allow up to 50% difference due to timing variations
      expect(time2).toBeLessThan(time1 * 1.5);
    });

    it('should work correctly with ConfigManager reload', () => {
      process.env.APIFY_TOKEN = 'apify_token_12345';
      process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';

      // Mock console.log to capture output
      const mockLog = jest.fn();
      console.log = mockLog;

      const configManager = new ConfigManager('nonexistent.json', true);
      
      // Load config (wraps console)
      configManager.load();
      const firstWrappedLog = console.log;

      // Reload config (should not re-wrap)
      configManager.reload();
      const secondWrappedLog = console.log;

      // Should be the same reference
      expect(firstWrappedLog).toBe(secondWrappedLog);

      // Call console.log
      console.log(`Token: ${process.env.APIFY_TOKEN}`);
      
      // Should still sanitize correctly
      expect(mockLog).toHaveBeenCalled();
      const lastCall = mockLog.mock.calls[mockLog.mock.calls.length - 1];
      expect(lastCall[0]).toContain('[REDACTED]');
      expect(lastCall[0]).not.toContain('apify_token_12345');
    });
  });
});