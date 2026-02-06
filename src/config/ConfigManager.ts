/**
 * ConfigManager - Handles application configuration loading and management
 * Priority: Environment Variables > config.json > Defaults
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { AppConfig, EndpointType } from './types';
import { LogSanitizer } from '../utils/LogSanitizer';

export class ConfigManager {
  private config: AppConfig | null = null;
  private configFilePath: string;
  private skipDotenv: boolean;

  constructor(configFilePath: string = 'config/config.json', skipDotenv: boolean = false) {
    this.configFilePath = configFilePath;
    this.skipDotenv = skipDotenv;
  }

  /**
   * Load configuration from all sources with priority resolution
   */
  load(): AppConfig {
    // Load environment variables from .env file if it exists (skip in tests)
    if (!this.skipDotenv) {
      dotenv.config();
    }

    // Start with default configuration
    const config = this.getDefaultConfig();

    // Load and merge config.json if it exists
    const fileConfig = this.loadConfigFile();
    if (fileConfig) {
      this.mergeConfig(config, fileConfig);
    }

    // Override with environment variables (highest priority)
    this.applyEnvironmentVariables(config);

    // Validate required fields
    this.validateConfig(config);

    // Register sensitive values for log sanitization
    this.registerSensitiveData(config);

    // Wrap console methods for automatic sanitization
    LogSanitizer.wrapConsole();

    this.config = config;
    return config;
  }

  /**
   * Reload configuration
   */
  reload(): AppConfig {
    return this.load();
  }

  /**
   * Get a specific configuration value by key path
   */
  get(key: string): any {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }

    const keys = key.split('.');
    let value: any = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AppConfig {
    return {
      apify: {
        token: '',
        actorUrl: '',
        endpoint: 'all',
      },
      filters: {
        users: [],
        keywords: [],
      },
      outputs: {
        cli: {
          enabled: true,
          statsInterval: 60000,
        },
        dashboard: {
          enabled: false,
          port: 3000,
        },
        alerts: {
          telegram: {
            enabled: false,
          },
          discord: {
            enabled: false,
          },
          webhook: {
            enabled: false,
          },
          rateLimit: 10,
        },
      },
      dedup: {
        ttl: 60,
      },
      reconnect: {
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2.0,
        maxAttempts: 10,
      },
      logging: {
        fileLogging: false,
        debug: false,
      },
      health: {
        port: 3001,
      },
      activeUsers: {
        refreshInterval: 240000, // 4 minutes
      },
    };
  }

  /**
   * Load configuration from config.json file
   * Note: Tokens should NEVER be loaded from config files for security
   */
  private loadConfigFile(): Partial<AppConfig> | null {
    try {
      const configPath = path.resolve(this.configFilePath);
      
      if (!fs.existsSync(configPath)) {
        return null;
      }

      const fileContent = fs.readFileSync(configPath, 'utf-8');
      const fileConfig = JSON.parse(fileContent);

      // Security check: Ensure token is not in config file
      if (fileConfig.apify && fileConfig.apify.token) {
        console.warn('WARNING: APIFY_TOKEN found in config file. Tokens should only be set via environment variables. Ignoring token from file.');
        delete fileConfig.apify.token;
      }

      return fileConfig;
    } catch (error) {
      console.warn(`Warning: Failed to load config file: ${error}`);
      return null;
    }
  }

  /**
   * Deep merge source config into target config
   */
  private mergeConfig(target: any, source: any): void {
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          source[key] &&
          typeof source[key] === 'object' &&
          !Array.isArray(source[key])
        ) {
          if (!target[key]) {
            target[key] = {};
          }
          this.mergeConfig(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }

  /**
   * Apply environment variables to configuration (highest priority)
   */
  private applyEnvironmentVariables(config: AppConfig): void {
    // Apify token (required from env)
    if (process.env.APIFY_TOKEN) {
      config.apify.token = process.env.APIFY_TOKEN;
    }

    // Apify actor URL (required from env)
    if (process.env.APIFY_ACTOR_URL) {
      config.apify.actorUrl = process.env.APIFY_ACTOR_URL;
    }

    // Endpoint selection
    if (process.env.ENDPOINT) {
      const endpoint = process.env.ENDPOINT.toLowerCase();
      if (this.isValidEndpoint(endpoint)) {
        config.apify.endpoint = endpoint as EndpointType;
      }
    }

    // User filters
    if (process.env.USERS !== undefined) {
      config.filters.users = process.env.USERS.split(',')
        .map(u => u.trim())
        .filter(u => u.length > 0);
    }

    // Keyword filters
    if (process.env.KEYWORDS !== undefined) {
      config.filters.keywords = process.env.KEYWORDS.split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
    }

    // Dashboard port
    if (process.env.DASHBOARD_PORT) {
      const port = parseInt(process.env.DASHBOARD_PORT, 10);
      if (!isNaN(port)) {
        config.outputs.dashboard.port = port;
      }
    }

    // Dashboard enabled
    if (process.env.DASHBOARD_ENABLED) {
      config.outputs.dashboard.enabled = process.env.DASHBOARD_ENABLED === 'true';
    }

    // CLI enabled
    if (process.env.CLI_ENABLED) {
      config.outputs.cli.enabled = process.env.CLI_ENABLED === 'true';
    }

    // Telegram configuration
    if (process.env.TELEGRAM_BOT_TOKEN) {
      config.outputs.alerts.telegram.botToken = process.env.TELEGRAM_BOT_TOKEN;
    }
    if (process.env.TELEGRAM_CHAT_ID) {
      config.outputs.alerts.telegram.chatId = process.env.TELEGRAM_CHAT_ID;
    }
    if (process.env.TELEGRAM_ENABLED) {
      config.outputs.alerts.telegram.enabled = process.env.TELEGRAM_ENABLED === 'true';
    }

    // Discord configuration
    if (process.env.DISCORD_WEBHOOK_URL) {
      config.outputs.alerts.discord.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    }
    if (process.env.DISCORD_ENABLED) {
      config.outputs.alerts.discord.enabled = process.env.DISCORD_ENABLED === 'true';
    }

    // Generic webhook configuration
    if (process.env.WEBHOOK_URL) {
      config.outputs.alerts.webhook.url = process.env.WEBHOOK_URL;
    }
    if (process.env.WEBHOOK_ENABLED) {
      config.outputs.alerts.webhook.enabled = process.env.WEBHOOK_ENABLED === 'true';
    }

    // Alert rate limit
    if (process.env.ALERT_RATE_LIMIT) {
      const rateLimit = parseInt(process.env.ALERT_RATE_LIMIT, 10);
      if (!isNaN(rateLimit) && rateLimit > 0) {
        config.outputs.alerts.rateLimit = rateLimit;
      }
    }

    // Dedup TTL
    if (process.env.DEDUP_TTL) {
      const ttl = parseInt(process.env.DEDUP_TTL, 10);
      if (!isNaN(ttl)) {
        config.dedup.ttl = ttl;
      }
    }

    // Reconnect configuration
    if (process.env.RECONNECT_INITIAL_DELAY) {
      const delay = parseInt(process.env.RECONNECT_INITIAL_DELAY, 10);
      if (!isNaN(delay)) {
        config.reconnect.initialDelay = delay;
      }
    }
    if (process.env.RECONNECT_MAX_DELAY) {
      const delay = parseInt(process.env.RECONNECT_MAX_DELAY, 10);
      if (!isNaN(delay)) {
        config.reconnect.maxDelay = delay;
      }
    }
    if (process.env.RECONNECT_BACKOFF_MULTIPLIER) {
      const multiplier = parseFloat(process.env.RECONNECT_BACKOFF_MULTIPLIER);
      if (!isNaN(multiplier)) {
        config.reconnect.backoffMultiplier = multiplier;
      }
    }
    if (process.env.RECONNECT_MAX_ATTEMPTS) {
      const attempts = parseInt(process.env.RECONNECT_MAX_ATTEMPTS, 10);
      if (!isNaN(attempts)) {
        config.reconnect.maxAttempts = attempts;
      }
    }

    // Logging configuration
    if (process.env.FILE_LOGGING) {
      config.logging.fileLogging = process.env.FILE_LOGGING === 'true';
    }
    if (process.env.DEBUG) {
      config.logging.debug = process.env.DEBUG === 'true';
    }

    // Health monitor configuration
    if (process.env.HEALTH_PORT) {
      const port = parseInt(process.env.HEALTH_PORT, 10);
      if (!isNaN(port)) {
        config.health.port = port;
      }
    }

    // Active users configuration
    if (process.env.ACTIVE_USERS_REFRESH_INTERVAL) {
      const interval = parseInt(process.env.ACTIVE_USERS_REFRESH_INTERVAL, 10);
      if (!isNaN(interval)) {
        config.activeUsers.refreshInterval = interval;
      }
    }

    // CLI stats interval
    if (process.env.CLI_STATS_INTERVAL) {
      const interval = parseInt(process.env.CLI_STATS_INTERVAL, 10);
      if (!isNaN(interval)) {
        config.outputs.cli.statsInterval = interval;
      }
    }
  }

  /**
   * Validate that required configuration fields are present
   */
  private validateConfig(config: AppConfig): void {
    // Validate token is present and non-empty
    if (!config.apify.token || config.apify.token.trim() === '') {
      throw new Error(
        'Missing required configuration: APIFY_TOKEN must be set in environment variables'
      );
    }

    // Validate actor URL is present and non-empty
    if (!config.apify.actorUrl || config.apify.actorUrl.trim() === '') {
      throw new Error(
        'Missing required configuration: APIFY_ACTOR_URL must be set in environment variables'
      );
    }

    // Validate token format (basic validation)
    this.validateToken(config.apify.token);

    // Validate actor URL format
    this.validateActorUrl(config.apify.actorUrl);

    // Validate endpoint
    if (!this.isValidEndpoint(config.apify.endpoint)) {
      throw new Error(
        `Invalid endpoint: ${config.apify.endpoint}. Must be one of: all, tweets, following, profile`
      );
    }

    // Warn if file logging is enabled
    if (config.logging.fileLogging) {
      console.warn('WARNING: File logging is enabled. Ensure sensitive data is properly sanitized.');
    }
  }

  /**
   * Validate token format
   */
  private validateToken(token: string): void {
    // Basic token validation
    if (token.length < 10) {
      throw new Error('Invalid APIFY_TOKEN: Token appears to be too short');
    }

    // Check for common placeholder values
    const tokenLower = token.toLowerCase();
    const invalidTokens = ['your-token-here', 'test', 'example', 'placeholder'];
    
    // Check if token matches or contains placeholder words
    if (invalidTokens.includes(tokenLower) || 
        invalidTokens.some(invalid => tokenLower.includes(invalid))) {
      throw new Error('Invalid APIFY_TOKEN: Token appears to be a placeholder value');
    }
  }

  /**
   * Validate actor URL format
   */
  private validateActorUrl(url: string): void {
    // Check for common placeholder values
    const urlLower = url.toLowerCase();
    const invalidUrls = ['your_actor_name', 'your-actor', 'example', 'placeholder'];
    
    if (invalidUrls.some(invalid => urlLower.includes(invalid))) {
      throw new Error('Invalid APIFY_ACTOR_URL: URL appears to be a placeholder value. Please set your actual Apify actor URL.');
    }

    // Validate URL format
    try {
      const parsedUrl = new URL(url);
      if (!parsedUrl.protocol.startsWith('http')) {
        throw new Error('Invalid APIFY_ACTOR_URL: URL must use HTTP or HTTPS protocol');
      }
    } catch (error) {
      throw new Error(`Invalid APIFY_ACTOR_URL: ${(error as Error).message}`);
    }
  }

  /**
   * Register sensitive data for log sanitization
   */
  private registerSensitiveData(config: AppConfig): void {
    // Register Apify token
    if (config.apify.token) {
      LogSanitizer.registerSensitiveValue(config.apify.token);
    }

    // Register Telegram bot token
    if (config.outputs.alerts.telegram.botToken) {
      LogSanitizer.registerSensitiveValue(config.outputs.alerts.telegram.botToken);
    }

    // Register Discord webhook URL (may contain sensitive tokens)
    if (config.outputs.alerts.discord.webhookUrl) {
      LogSanitizer.registerSensitiveValue(config.outputs.alerts.discord.webhookUrl);
    }

    // Register generic webhook URL (may contain sensitive tokens)
    if (config.outputs.alerts.webhook.url) {
      LogSanitizer.registerSensitiveValue(config.outputs.alerts.webhook.url);
    }

    // Register pattern for common token formats
    LogSanitizer.registerPattern(/apify_[a-zA-Z0-9_-]+/gi);
    LogSanitizer.registerPattern(/bot[0-9]+:[a-zA-Z0-9_-]+/gi);
  }

  /**
   * Check if endpoint is valid
   */
  private isValidEndpoint(endpoint: string): boolean {
    return ['all', 'tweets', 'following', 'profile'].includes(endpoint);
  }
}
