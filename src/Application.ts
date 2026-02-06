/**
 * Application - Main orchestrator for the Crypto Twitter Alpha Stream
 * 
 * Coordinates initialization of all components:
 * - Configuration loading
 * - StreamCore setup
 * - Output channels (CLI, Dashboard, Alerts)
 * - Health monitoring
 * - Graceful shutdown handling
 */

import { ConfigManager } from './config/ConfigManager';
import { AppConfig } from './config/types';
import { StreamCore } from './streamcore/StreamCore';
import { EventBus } from './eventbus/EventBus';
import { FilterPipeline } from './filters/FilterPipeline';
import { UserFilter, KeywordFilter } from './filters/EventFilter';
import { DedupCache } from './dedup/DedupCache';
import { CLIOutput } from './outputs/CLIOutput';
import { DashboardOutput } from './outputs/DashboardOutput';
import { AlertOutput } from './outputs/AlertOutput';
import { TelegramChannel, DiscordChannel, WebhookChannel, AlertChannel } from './outputs/AlertChannel';
import { ActiveUsersFetcher } from './activeusers/ActiveUsersFetcher';
import { HealthMonitor } from './health/HealthMonitor';
import { UserFilterValidator } from './validation/UserFilterValidator';

export interface ApplicationConfig {
  configFilePath?: string;
}

export class Application {
  private configManager: ConfigManager;
  private config: AppConfig | null = null;
  private streamCore: StreamCore | null = null;
  private eventBus: EventBus | null = null;
  private filterPipeline: FilterPipeline | null = null;
  private dedupCache: DedupCache | null = null;
  private cliOutput: CLIOutput | null = null;
  private dashboardOutput: DashboardOutput | null = null;
  private alertOutput: AlertOutput | null = null;
  private activeUsersFetcher: ActiveUsersFetcher | null = null;
  private healthMonitor: HealthMonitor | null = null;
  private isRunning: boolean = false;

  constructor(appConfig: ApplicationConfig = {}) {
    this.configManager = new ConfigManager(appConfig.configFilePath);
  }

  /**
   * Initialize and start the application
   * Sequence: config → components → StreamCore → outputs
   */
  async start(): Promise<void> {
    try {
      console.log('🚀 Starting Crypto Twitter Alpha Stream...');
      
      // Step 1: Load configuration
      console.log('📋 Loading configuration...');
      this.config = this.configManager.load();
      this.validateStartupConfig(this.config);
      console.log(`✓ Configuration loaded (endpoint: ${this.config.apify.endpoint})`);

      // Step 2: Initialize core components
      console.log('🔧 Initializing core components...');
      this.eventBus = new EventBus();
      this.filterPipeline = this.createFilterPipeline(this.config);
      this.dedupCache = new DedupCache(this.config.dedup.ttl * 1000); // Convert to ms
      console.log('✓ Core components initialized');

      // Step 3: Initialize StreamCore
      console.log('🌊 Initializing StreamCore...');
      this.streamCore = new StreamCore(
        {
          baseUrl: this.getBaseUrl(),
          token: this.config.apify.token,
          endpoint: this.config.apify.endpoint,
          userFilters: this.config.filters.users.length > 0 ? this.config.filters.users : undefined,
          dedupTTL: this.config.dedup.ttl * 1000,
          reconnectDelay: this.config.reconnect.initialDelay,
          maxReconnectDelay: this.config.reconnect.maxDelay,
          reconnectBackoffMultiplier: this.config.reconnect.backoffMultiplier,
          maxReconnectAttempts: this.config.reconnect.maxAttempts
        },
        this.filterPipeline,
        this.dedupCache,
        this.eventBus
      );
      console.log('✓ StreamCore initialized');

      // Step 4: Initialize Active Users Fetcher
      console.log('👥 Initializing Active Users Fetcher...');
      this.activeUsersFetcher = new ActiveUsersFetcher({
        baseUrl: this.getBaseUrl(),
        token: this.config.apify.token,
        refreshInterval: this.config.activeUsers.refreshInterval
      });
      await this.activeUsersFetcher.startPeriodicRefresh();
      console.log('✓ Active Users Fetcher initialized');

      // Step 4.5: Validate user filters if configured
      if (this.config.filters.users.length > 0) {
        console.log('🔍 Validating user filters...');
        const validator = new UserFilterValidator(this.activeUsersFetcher);
        const validationResult = await validator.validate(this.config.filters.users);
        validator.logValidationWarnings(validationResult);
        console.log('✓ User filter validation complete');
      }

      // Step 5: Initialize outputs
      console.log('📤 Initializing outputs...');
      await this.initializeOutputs(this.config);
      console.log('✓ Outputs initialized');

      // Step 6: Initialize Health Monitor
      if (this.streamCore && this.filterPipeline) {
        console.log('🏥 Initializing Health Monitor...');
        this.healthMonitor = new HealthMonitor({
          port: this.config.health.port,
          streamCore: this.streamCore,
          cliOutput: this.cliOutput ?? undefined,
          alertOutput: this.alertOutput ?? undefined,
          filterPipeline: this.filterPipeline
        });
        await this.healthMonitor.start();
        console.log(`✓ Health Monitor started on port ${this.config.health.port}`);
      }

      // Step 7: Start StreamCore (connect to SSE)
      console.log('🔌 Connecting to SSE stream...');
      await this.streamCore.start();
      console.log('✓ Connected to SSE stream');

      // Step 7.5: Update dashboard with connection status and active users
      if (this.dashboardOutput) {
        const connectionStatus = this.streamCore.getConnectionStatus();
        this.dashboardOutput.updateConnectionStatus(connectionStatus);
        
        // Send active users to dashboard
        const activeUsers = this.activeUsersFetcher.getCached();
        this.dashboardOutput.updateActiveUsers(activeUsers);
      }

      // Step 8: Set up graceful shutdown
      this.setupShutdownHandlers();

      this.isRunning = true;
      console.log('');
      console.log('✅ Crypto Twitter Alpha Stream is running!');
      console.log('');
      this.printStatus();

    } catch (error) {
      console.error('❌ Failed to start application:', error);
      await this.shutdown();
      throw error;
    }
  }

  /**
   * Gracefully shutdown the application
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('');
    console.log('🛑 Shutting down Crypto Twitter Alpha Stream...');
    this.isRunning = false;

    try {
      // Stop StreamCore first to prevent new events
      if (this.streamCore) {
        console.log('  Stopping StreamCore...');
        this.streamCore.stop();
      }

      // Stop Active Users Fetcher
      if (this.activeUsersFetcher) {
        console.log('  Stopping Active Users Fetcher...');
        this.activeUsersFetcher.stopPeriodicRefresh();
      }

      // Stop outputs
      if (this.cliOutput) {
        console.log('  Stopping CLI Output...');
        this.cliOutput.stop();
      }

      if (this.dashboardOutput) {
        console.log('  Stopping Dashboard Output...');
        await this.dashboardOutput.stop();
      }

      if (this.alertOutput) {
        console.log('  Stopping Alert Output...');
        this.alertOutput.stop();
      }

      // Stop Health Monitor
      if (this.healthMonitor) {
        console.log('  Stopping Health Monitor...');
        await this.healthMonitor.stop();
      }

      // Clear dedup cache
      if (this.dedupCache) {
        console.log('  Clearing dedup cache...');
        this.dedupCache.clear();
      }

      // Clear event bus
      if (this.eventBus) {
        console.log('  Clearing event bus...');
        this.eventBus.clear();
      }

      console.log('✅ Shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }

  /**
   * Get the base URL for the Apify actor
   */
  private getBaseUrl(): string {
    // Use the configured actor URL
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config.apify.actorUrl;
  }

  /**
   * Validate startup configuration
   */
  private validateStartupConfig(config: AppConfig): void {
    // Check that at least one output is enabled
    const hasOutput = config.outputs.cli.enabled ||
                     config.outputs.dashboard.enabled ||
                     config.outputs.alerts.telegram.enabled ||
                     config.outputs.alerts.discord.enabled ||
                     config.outputs.alerts.webhook.enabled;

    if (!hasOutput) {
      throw new Error('At least one output must be enabled (CLI, Dashboard, or Alerts)');
    }

    // Validate alert configurations
    if (config.outputs.alerts.telegram.enabled) {
      if (!config.outputs.alerts.telegram.botToken || !config.outputs.alerts.telegram.chatId) {
        throw new Error('Telegram alerts enabled but botToken or chatId is missing');
      }
    }

    if (config.outputs.alerts.discord.enabled) {
      if (!config.outputs.alerts.discord.webhookUrl) {
        throw new Error('Discord alerts enabled but webhookUrl is missing');
      }
    }

    if (config.outputs.alerts.webhook.enabled) {
      if (!config.outputs.alerts.webhook.url) {
        throw new Error('Generic webhook alerts enabled but url is missing');
      }
    }
  }

  /**
   * Create filter pipeline from configuration
   */
  private createFilterPipeline(config: AppConfig): FilterPipeline {
    const pipeline = new FilterPipeline();

    // Add user filter if configured
    if (config.filters.users.length > 0) {
      const userFilter = new UserFilter(config.filters.users);
      pipeline.addFilter(userFilter);
      console.log(`  Added user filter: ${config.filters.users.join(', ')}`);
    }

    // Add keyword filter if configured
    if (config.filters.keywords.length > 0) {
      const keywordFilter = new KeywordFilter(config.filters.keywords);
      pipeline.addFilter(keywordFilter);
      console.log(`  Added keyword filter: ${config.filters.keywords.join(', ')}`);
    }

    return pipeline;
  }

  /**
   * Initialize output channels based on configuration
   */
  private async initializeOutputs(config: AppConfig): Promise<void> {
    if (!this.eventBus) {
      throw new Error('EventBus not initialized');
    }

    // Initialize CLI Output
    if (config.outputs.cli.enabled) {
      console.log('  Initializing CLI Output...');
      this.cliOutput = new CLIOutput(this.eventBus, {
        statsInterval: config.outputs.cli.statsInterval || 60000,
        colorEnabled: true
      });
      this.cliOutput.start();
      console.log('  ✓ CLI Output started');
    }

    // Initialize Dashboard Output
    if (config.outputs.dashboard.enabled) {
      console.log(`  Initializing Dashboard Output on port ${config.outputs.dashboard.port}...`);
      this.dashboardOutput = new DashboardOutput(this.eventBus, {
        port: config.outputs.dashboard.port,
        staticPath: 'frontend/build'
      });
      
      // Set health status provider if we have streamCore
      if (this.streamCore && this.filterPipeline) {
        this.dashboardOutput.setHealthStatusProvider(() => {
          return this.getHealthStatus();
        });
      }
      
      await this.dashboardOutput.start();
      console.log(`  ✓ Dashboard Output started on http://localhost:${config.outputs.dashboard.port}`);
    }

    // Initialize Alert Output
    const alertChannels = this.createAlertChannels(config);
    if (alertChannels.length > 0) {
      console.log('  Initializing Alert Output...');
      this.alertOutput = new AlertOutput(
        { channels: alertChannels },
        this.eventBus
      );
      this.alertOutput.start();
      console.log(`  ✓ Alert Output started with ${alertChannels.length} channel(s)`);
    }
  }

  /**
   * Create alert channels from configuration
   */
  private createAlertChannels(config: AppConfig): AlertChannel[] {
    const channels: AlertChannel[] = [];

    // Telegram channel
    if (config.outputs.alerts.telegram.enabled &&
        config.outputs.alerts.telegram.botToken &&
        config.outputs.alerts.telegram.chatId) {
      channels.push(new TelegramChannel(
        config.outputs.alerts.telegram.botToken,
        config.outputs.alerts.telegram.chatId,
        true,
        config.outputs.alerts.rateLimit || 10
      ));
      console.log('    Added Telegram channel');
    }

    // Discord channel
    if (config.outputs.alerts.discord.enabled &&
        config.outputs.alerts.discord.webhookUrl) {
      channels.push(new DiscordChannel(
        config.outputs.alerts.discord.webhookUrl,
        true,
        config.outputs.alerts.rateLimit || 10
      ));
      console.log('    Added Discord channel');
    }

    // Generic webhook channel
    if (config.outputs.alerts.webhook.enabled &&
        config.outputs.alerts.webhook.url) {
      channels.push(new WebhookChannel(
        config.outputs.alerts.webhook.url,
        config.outputs.alerts.webhook.method || 'POST',
        config.outputs.alerts.webhook.headers || {},
        true,
        config.outputs.alerts.rateLimit || 10
      ));
      console.log('    Added Webhook channel');
    }

    return channels;
  }

  /**
   * Set up graceful shutdown handlers for SIGINT and SIGTERM
   */
  private setupShutdownHandlers(): void {
    const shutdownHandler = async (signal: string) => {
      console.log(`\nReceived ${signal}, initiating graceful shutdown...`);
      await this.shutdown();
      process.exit(0);
    };

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => shutdownHandler('SIGINT'));

    // Handle SIGTERM (kill command)
    process.on('SIGTERM', () => shutdownHandler('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      this.shutdown().then(() => process.exit(1));
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled rejection at:', promise, 'reason:', reason);
      this.shutdown().then(() => process.exit(1));
    });
  }

  /**
   * Print current application status
   */
  private printStatus(): void {
    if (!this.config) return;

    console.log('📊 Status:');
    console.log(`  Endpoint: ${this.config.apify.endpoint}`);
    console.log(`  Filters: ${this.getFilterSummary()}`);
    console.log(`  Outputs: ${this.getOutputSummary()}`);
    
    if (this.config.outputs.dashboard.enabled) {
      console.log(`  Dashboard: http://localhost:${this.config.outputs.dashboard.port}`);
    }
    console.log(`  Health Monitor: http://localhost:${this.config.health.port}/status`);
    console.log('');
  }

  /**
   * Get filter summary for status display
   */
  private getFilterSummary(): string {
    if (!this.config) return 'none';
    
    const filters: string[] = [];
    if (this.config.filters.users.length > 0) {
      filters.push(`${this.config.filters.users.length} users`);
    }
    if (this.config.filters.keywords.length > 0) {
      filters.push(`${this.config.filters.keywords.length} keywords`);
    }
    
    return filters.length > 0 ? filters.join(', ') : 'none';
  }

  /**
   * Get output summary for status display
   */
  private getOutputSummary(): string {
    if (!this.config) return 'none';
    
    const outputs: string[] = [];
    if (this.config.outputs.cli.enabled) outputs.push('CLI');
    if (this.config.outputs.dashboard.enabled) outputs.push('Dashboard');
    if (this.config.outputs.alerts.telegram.enabled) outputs.push('Telegram');
    if (this.config.outputs.alerts.discord.enabled) outputs.push('Discord');
    if (this.config.outputs.alerts.webhook.enabled) outputs.push('Webhook');
    
    return outputs.join(', ');
  }

  /**
   * Get health status for monitoring
   */
  private getHealthStatus(): any {
    if (!this.streamCore || !this.filterPipeline) {
      return null;
    }

    const streamStats = this.streamCore.getStats();
    const filterConfig = this.filterPipeline.getConfig();
    const alertStats = this.alertOutput?.getStats() ?? {
      telegram: { sent: 0, failed: 0 },
      discord: { sent: 0, failed: 0 },
      webhook: { sent: 0, failed: 0 }
    };

    return {
      connection: {
        status: streamStats.connectionStatus,
        endpoint: streamStats.currentEndpoint,
        uptime: 0 // Will be calculated by HealthMonitor
      },
      events: {
        total: streamStats.totalEvents,
        delivered: streamStats.deliveredEvents,
        deduped: streamStats.dedupedEvents,
        rate: 0 // Will be calculated by HealthMonitor
      },
      alerts: alertStats,
      filters: {
        users: filterConfig.users,
        keywords: filterConfig.keywords
      }
    };
  }

  /**
   * Check if application is running
   */
  isApplicationRunning(): boolean {
    return this.isRunning;
  }
}
