/**
 * Property-based tests for ConfigManager
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManager } from '../../src/config/ConfigManager';

describe('ConfigManager - Property Tests', () => {
  const testConfigDir = path.join(__dirname, 'test-configs');
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Save original environment
    originalEnv = { ...process.env };

    // Create test config directory
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // Clear all APIFY-related env vars to ensure clean test state
    delete process.env.APIFY_TOKEN;
    delete process.env.APIFY_ACTOR_URL;
    delete process.env.ENDPOINT;
    delete process.env.USERS;
    delete process.env.KEYWORDS;
    delete process.env.DASHBOARD_ENABLED;
    delete process.env.DASHBOARD_PORT;
    delete process.env.DEDUP_TTL;
    delete process.env.RECONNECT_INITIAL_DELAY;
    delete process.env.RECONNECT_MAX_DELAY;
    delete process.env.RECONNECT_BACKOFF_MULTIPLIER;
    delete process.env.RECONNECT_MAX_ATTEMPTS;
    delete process.env.CLI_ENABLED;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_ENABLED;
    delete process.env.DISCORD_WEBHOOK_URL;
    delete process.env.DISCORD_ENABLED;
    delete process.env.WEBHOOK_URL;
    delete process.env.WEBHOOK_ENABLED;
    delete process.env.FILE_LOGGING;

    // Ensure test config directory exists before each test
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clear all test-related env vars
    delete process.env.APIFY_TOKEN;
    delete process.env.APIFY_ACTOR_URL;
    delete process.env.ENDPOINT;
    delete process.env.USERS;
    delete process.env.KEYWORDS;
    delete process.env.DASHBOARD_ENABLED;
    delete process.env.DASHBOARD_PORT;
    delete process.env.DEDUP_TTL;
    delete process.env.RECONNECT_INITIAL_DELAY;
    delete process.env.RECONNECT_MAX_DELAY;
    delete process.env.RECONNECT_BACKOFF_MULTIPLIER;
    delete process.env.RECONNECT_MAX_ATTEMPTS;
    delete process.env.CLI_ENABLED;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.TELEGRAM_ENABLED;
    delete process.env.DISCORD_WEBHOOK_URL;
    delete process.env.DISCORD_ENABLED;
    delete process.env.WEBHOOK_URL;
    delete process.env.WEBHOOK_ENABLED;
    delete process.env.FILE_LOGGING;
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;

    // Clean up test config directory
    if (fs.existsSync(testConfigDir)) {
      try {
        const files = fs.readdirSync(testConfigDir);
        files.forEach(file => {
          try {
            const filePath = path.join(testConfigDir, file);
            if (fs.existsSync(filePath)) {
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

  /**
   * For any configuration setting S that exists in both environment variables 
   * and config.json, the value from environment variables should be used.
   */
  describe('Property 24: Configuration Priority', () => {
    it('should prioritize environment variables over config.json for all settings', () => {
      fc.assert(
        fc.asyncProperty(
          // Generate arbitrary configuration values (excluding comma which is the delimiter)
          fc.record({
            endpoint: fc.constantFrom('all', 'tweets', 'following', 'profile'),
            users: fc.array(
              fc.string({ minLength: 1, maxLength: 20 })
                .filter(s => s.trim().length > 0 && !s.includes(',')),
              { maxLength: 5 }
            ),
            keywords: fc.array(
              fc.string({ minLength: 1, maxLength: 20 })
                .filter(s => s.trim().length > 0 && !s.includes(',')),
              { maxLength: 5 }
            ),
            dashboardPort: fc.integer({ min: 3000, max: 9999 }),
            dedupTtl: fc.integer({ min: 10, max: 300 }),
            reconnectInitialDelay: fc.integer({ min: 100, max: 5000 }),
            reconnectMaxDelay: fc.integer({ min: 10000, max: 60000 }),
            reconnectBackoffMultiplier: fc.float({ min: 1.5, max: 3.0, noNaN: true }),
            reconnectMaxAttempts: fc.integer({ min: 1, max: 20 }),
          }),
          async (testValues) => {
            // Create a unique config file for this test
            const configFileName = `config-${Date.now()}-${Math.random()}.json`;
            const configFilePath = path.join(testConfigDir, configFileName);

            // Ensure test config directory exists
            if (!fs.existsSync(testConfigDir)) {
              fs.mkdirSync(testConfigDir, { recursive: true });
            }

            // Write config.json with different values
            const fileConfig = {
              apify: {
                endpoint: 'all', // Will be overridden by env
              },
              filters: {
                users: ['fileUser1', 'fileUser2'],
                keywords: ['fileKeyword1'],
              },
              outputs: {
                dashboard: {
                  port: 8080, // Will be overridden by env
                },
              },
              dedup: {
                ttl: 30, // Will be overridden by env
              },
              reconnect: {
                initialDelay: 500,
                maxDelay: 15000,
                backoffMultiplier: 1.5,
                maxAttempts: 5,
              },
            };

            fs.writeFileSync(configFilePath, JSON.stringify(fileConfig, null, 2));

            // Wait for file system io
            // Using a loop to block slightly or forcing a brief pause if possible
            // But since this is fc.property, async await inside property requires returning promise. 
            // The predicate IS async (async (testValues) => ...).
            await new Promise(r => setTimeout(r, 20));

            // Set environment variables (these should take priority)
            const originalEnv = { ...process.env };
            process.env.APIFY_TOKEN = 'valid-token-from-env';
            process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
            process.env.ENDPOINT = testValues.endpoint;
            process.env.USERS = testValues.users.join(',');
            process.env.KEYWORDS = testValues.keywords.join(',');
            process.env.DASHBOARD_PORT = testValues.dashboardPort.toString();
            process.env.DEDUP_TTL = testValues.dedupTtl.toString();
            process.env.RECONNECT_INITIAL_DELAY = testValues.reconnectInitialDelay.toString();
            process.env.RECONNECT_MAX_DELAY = testValues.reconnectMaxDelay.toString();
            process.env.RECONNECT_BACKOFF_MULTIPLIER = testValues.reconnectBackoffMultiplier.toString();
            process.env.RECONNECT_MAX_ATTEMPTS = testValues.reconnectMaxAttempts.toString();

            try {
              // Load configuration
              const configManager = new ConfigManager(configFilePath, true);
              const config = configManager.load();

              // Verify environment variables take priority
              // Note: ConfigManager trims values, so we need to compare trimmed versions
              const expectedUsers = testValues.users.map(u => u.trim());
              const expectedKeywords = testValues.keywords.map(k => k.trim());

              expect(config.apify.endpoint).toBe(testValues.endpoint);
              expect(config.filters.users).toEqual(expectedUsers);
              expect(config.filters.keywords).toEqual(expectedKeywords);
              expect(config.outputs.dashboard.port).toBe(testValues.dashboardPort);
              expect(config.dedup.ttl).toBe(testValues.dedupTtl);
              expect(config.reconnect.initialDelay).toBe(testValues.reconnectInitialDelay);
              expect(config.reconnect.maxDelay).toBe(testValues.reconnectMaxDelay);
              expect(config.reconnect.backoffMultiplier).toBeCloseTo(testValues.reconnectBackoffMultiplier, 2);
              expect(config.reconnect.maxAttempts).toBe(testValues.reconnectMaxAttempts);
            } finally {
              // Restore original environment
              process.env = originalEnv;
              // Clean up config file - use existsSync to avoid errors
              if (fs.existsSync(configFilePath)) {
                fs.unlinkSync(configFilePath);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use config.json values when environment variables are not set', () => {
      fc.assert(
        fc.asyncProperty(
          fc.record({
            endpoint: fc.constantFrom('all', 'tweets', 'following', 'profile'),
            users: fc.array(
              fc.string({ minLength: 1, maxLength: 20 })
                .filter(s => s.trim().length > 0 && !s.includes(',')),
              { maxLength: 5 }
            ),
            keywords: fc.array(
              fc.string({ minLength: 1, maxLength: 20 })
                .filter(s => s.trim().length > 0 && !s.includes(',')),
              { maxLength: 5 }
            ),
            dashboardPort: fc.integer({ min: 3000, max: 9999 }),
            dedupTtl: fc.integer({ min: 10, max: 300 }),
          }),
          async (testValues) => {
            const configFileName = `config-${Date.now()}-${Math.random()}.json`;
            const configFilePath = path.join(testConfigDir, configFileName);

            // Ensure test config directory exists
            if (!fs.existsSync(testConfigDir)) {
              fs.mkdirSync(testConfigDir, { recursive: true });
            }

            // Write config.json with test values
            const fileConfig = {
              apify: {
                endpoint: testValues.endpoint,
              },
              filters: {
                users: testValues.users,
                keywords: testValues.keywords,
              },
              outputs: {
                dashboard: {
                  port: testValues.dashboardPort,
                },
              },
              dedup: {
                ttl: testValues.dedupTtl,
              },
            };

            fs.writeFileSync(configFilePath, JSON.stringify(fileConfig, null, 2));

            await new Promise(r => setTimeout(r, 20));

            // Clear relevant environment variables
            const originalEnv = { ...process.env };
            process.env.APIFY_TOKEN = 'valid-token-abc123';
            process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
            delete process.env.ENDPOINT;
            delete process.env.USERS;
            delete process.env.KEYWORDS;
            delete process.env.DASHBOARD_PORT;
            delete process.env.DEDUP_TTL;

            try {
              const configManager = new ConfigManager(configFilePath, true);
              const config = configManager.load();

              // Verify config.json values are used
              expect(config.apify.endpoint).toBe(testValues.endpoint);
              expect(config.filters.users).toEqual(testValues.users);
              expect(config.filters.keywords).toEqual(testValues.keywords);
              expect(config.outputs.dashboard.port).toBe(testValues.dashboardPort);
              expect(config.dedup.ttl).toBe(testValues.dedupTtl);
            } finally {
              process.env = originalEnv;
              // Clean up config file - use existsSync to avoid errors
              if (fs.existsSync(configFilePath)) {
                fs.unlinkSync(configFilePath);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
