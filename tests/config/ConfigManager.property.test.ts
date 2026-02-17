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
    it('should prioritize environment variables over config.json for all settings', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary configuration values (excluding comma which is the delimiter)
          fc.record({
            channels: fc.array(
              fc.constantFrom('all', 'tweets', 'following', 'profile'),
              { minLength: 1, maxLength: 4 }
            ),
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
                channels: ['all'], // Will be overridden by env
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

            // Verify file was written correctly with retry logic
            let fileExists = false;
            for (let i = 0; i < 5; i++) {
              await new Promise(r => setTimeout(r, 20));
              if (fs.existsSync(configFilePath)) {
                fileExists = true;
                break;
              }
            }
            
            if (!fileExists) {
              // Skip this test iteration if file creation failed
              return; // Property test will continue with next iteration
            }

            // Set environment variables (these should take priority)
            const savedEnvVars = {
              CHANNELS: process.env.CHANNELS,
              USERS: process.env.USERS,
              KEYWORDS: process.env.KEYWORDS,
              DASHBOARD_PORT: process.env.DASHBOARD_PORT,
              DEDUP_TTL: process.env.DEDUP_TTL,
              RECONNECT_INITIAL_DELAY: process.env.RECONNECT_INITIAL_DELAY,
              RECONNECT_MAX_DELAY: process.env.RECONNECT_MAX_DELAY,
              RECONNECT_BACKOFF_MULTIPLIER: process.env.RECONNECT_BACKOFF_MULTIPLIER,
              RECONNECT_MAX_ATTEMPTS: process.env.RECONNECT_MAX_ATTEMPTS,
            };
            
            process.env.APIFY_TOKEN = 'valid-token-from-env';
            process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
            process.env.CHANNELS = testValues.channels.join(',');
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
              
              // Normalize expected channels to match ConfigManager behavior
              // Empty array normalizes to ["all"]
              // ["all", ...others] normalizes to ["all"]
              // Duplicates are removed
              let expectedChannels = [...new Set(testValues.channels)]; // Remove duplicates
              if (expectedChannels.length === 0) {
                expectedChannels = ['all'];
              } else if (expectedChannels.includes('all')) {
                expectedChannels = ['all'];
              }

              expect(config.apify.channels).toEqual(expectedChannels);
              expect(config.filters.users).toEqual(expectedUsers);
              expect(config.filters.keywords).toEqual(expectedKeywords);
              expect(config.outputs.dashboard.port).toBe(testValues.dashboardPort);
              expect(config.dedup.ttl).toBe(testValues.dedupTtl);
              expect(config.reconnect.initialDelay).toBe(testValues.reconnectInitialDelay);
              expect(config.reconnect.maxDelay).toBe(testValues.reconnectMaxDelay);
              expect(config.reconnect.backoffMultiplier).toBeCloseTo(testValues.reconnectBackoffMultiplier, 2);
              expect(config.reconnect.maxAttempts).toBe(testValues.reconnectMaxAttempts);
            } finally {
              // Restore environment variables
              if (savedEnvVars.CHANNELS !== undefined) process.env.CHANNELS = savedEnvVars.CHANNELS;
              else delete process.env.CHANNELS;
              
              if (savedEnvVars.USERS !== undefined) process.env.USERS = savedEnvVars.USERS;
              else delete process.env.USERS;
              
              if (savedEnvVars.KEYWORDS !== undefined) process.env.KEYWORDS = savedEnvVars.KEYWORDS;
              else delete process.env.KEYWORDS;
              
              if (savedEnvVars.DASHBOARD_PORT !== undefined) process.env.DASHBOARD_PORT = savedEnvVars.DASHBOARD_PORT;
              else delete process.env.DASHBOARD_PORT;
              
              if (savedEnvVars.DEDUP_TTL !== undefined) process.env.DEDUP_TTL = savedEnvVars.DEDUP_TTL;
              else delete process.env.DEDUP_TTL;
              
              if (savedEnvVars.RECONNECT_INITIAL_DELAY !== undefined) process.env.RECONNECT_INITIAL_DELAY = savedEnvVars.RECONNECT_INITIAL_DELAY;
              else delete process.env.RECONNECT_INITIAL_DELAY;
              
              if (savedEnvVars.RECONNECT_MAX_DELAY !== undefined) process.env.RECONNECT_MAX_DELAY = savedEnvVars.RECONNECT_MAX_DELAY;
              else delete process.env.RECONNECT_MAX_DELAY;
              
              if (savedEnvVars.RECONNECT_BACKOFF_MULTIPLIER !== undefined) process.env.RECONNECT_BACKOFF_MULTIPLIER = savedEnvVars.RECONNECT_BACKOFF_MULTIPLIER;
              else delete process.env.RECONNECT_BACKOFF_MULTIPLIER;
              
              if (savedEnvVars.RECONNECT_MAX_ATTEMPTS !== undefined) process.env.RECONNECT_MAX_ATTEMPTS = savedEnvVars.RECONNECT_MAX_ATTEMPTS;
              else delete process.env.RECONNECT_MAX_ATTEMPTS;
              
              // Clean up config file - use existsSync to avoid errors
              if (fs.existsSync(configFilePath)) {
                fs.unlinkSync(configFilePath);
              }
            }
          }
        ),
        { numRuns: 50 } 
      );
    }, 30000); // 30 second timeout for property test

    it('should use config.json values when environment variables are not set', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            channels: fc.array(
              fc.constantFrom('all', 'tweets', 'following', 'profile'),
              { minLength: 1, maxLength: 4 }
            ),
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
                channels: testValues.channels,
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

            // Verify file was written correctly with retry logic
            let fileExists = false;
            for (let i = 0; i < 5; i++) {
              await new Promise(r => setTimeout(r, 20));
              if (fs.existsSync(configFilePath)) {
                fileExists = true;
                break;
              }
            }
            
            if (!fileExists) {
              // Skip this test iteration if file creation failed
              return; // Property test will continue with next iteration
            }

            // Clear relevant environment variables
            const savedEnvVars = {
              CHANNELS: process.env.CHANNELS,
              USERS: process.env.USERS,
              KEYWORDS: process.env.KEYWORDS,
              DASHBOARD_PORT: process.env.DASHBOARD_PORT,
              DEDUP_TTL: process.env.DEDUP_TTL,
            };
            
            process.env.APIFY_TOKEN = 'valid-token-abc123';
            process.env.APIFY_ACTOR_URL = 'https://test-actor.apify.actor';
            delete process.env.CHANNELS;
            delete process.env.USERS;
            delete process.env.KEYWORDS;
            delete process.env.DASHBOARD_PORT;
            delete process.env.DEDUP_TTL;

            try {
              const configManager = new ConfigManager(configFilePath, true);
              const config = configManager.load();

              // Normalize expected channels to match ConfigManager behavior
              // Empty array normalizes to ["all"]
              // ["all", ...others] normalizes to ["all"]
              // Duplicates are removed
              let expectedChannels = [...new Set(testValues.channels)]; // Remove duplicates
              if (expectedChannels.length === 0) {
                expectedChannels = ['all'];
              } else if (expectedChannels.includes('all')) {
                expectedChannels = ['all'];
              }

              // Verify config.json values are used
              expect(config.apify.channels).toEqual(expectedChannels);
              expect(config.filters.users).toEqual(testValues.users);
              expect(config.filters.keywords).toEqual(testValues.keywords);
              expect(config.outputs.dashboard.port).toBe(testValues.dashboardPort);
              expect(config.dedup.ttl).toBe(testValues.dedupTtl);
            } finally {
              // Restore environment variables
              if (savedEnvVars.CHANNELS !== undefined) process.env.CHANNELS = savedEnvVars.CHANNELS;
              else delete process.env.CHANNELS;
              
              if (savedEnvVars.USERS !== undefined) process.env.USERS = savedEnvVars.USERS;
              else delete process.env.USERS;
              
              if (savedEnvVars.KEYWORDS !== undefined) process.env.KEYWORDS = savedEnvVars.KEYWORDS;
              else delete process.env.KEYWORDS;
              
              if (savedEnvVars.DASHBOARD_PORT !== undefined) process.env.DASHBOARD_PORT = savedEnvVars.DASHBOARD_PORT;
              else delete process.env.DASHBOARD_PORT;
              
              if (savedEnvVars.DEDUP_TTL !== undefined) process.env.DEDUP_TTL = savedEnvVars.DEDUP_TTL;
              else delete process.env.DEDUP_TTL;
              
              // Clean up config file - use existsSync to avoid errors
              if (fs.existsSync(configFilePath)) {
                fs.unlinkSync(configFilePath);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    }, 30000); // 30 second timeout for property test
  });
});
