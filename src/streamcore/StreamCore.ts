/**
 * StreamCore - Central orchestrator for the Crypto Twitter Alpha Stream
 * 
 * Integrates WSSClient, FilterPipeline, DedupCache, and EventBus to provide
 * the complete event processing flow: receive → parse → filter → dedup → broadcast
 */

import { WSSClient, ConnectionConfig, Channel, ConnectionState } from '../ws/WSSClient';
import { FilterPipeline } from '../filters/FilterPipeline';
import { DedupCache, generateDedupKey } from '../dedup/DedupCache';
import { EventBus } from '../eventbus/EventBus';
import { TwitterEvent } from '../models/types';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface StreamCoreConfig {
  baseUrl: string;
  token: string;
  channels: Channel[]; // Multiple subscription channels for WebSocket
  userFilters?: string[];
  dedupTTL?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectBackoffMultiplier?: number;
  maxReconnectAttempts?: number;
}

export interface StreamCoreStats {
  totalEvents: number;
  deliveredEvents: number;
  dedupedEvents: number;
  connectionStatus: ConnectionStatus;
  channels: Channel[]; // Current subscribed channels
  reconnectAttempts?: number;  // WebSocket reconnection attempts
  bufferedBytes?: number;  // WebSocket buffered bytes
}

export class StreamCore {
  private wssClient: WSSClient | null = null;
  private filterPipeline: FilterPipeline;
  private dedupCache: DedupCache;
  private eventBus: EventBus;
  private config: StreamCoreConfig;

  private connectionStatus: ConnectionStatus = 'disconnected';

  // Statistics
  private totalEvents: number = 0;
  private deliveredEvents: number = 0;
  private dedupedEvents: number = 0;

  constructor(
    config: StreamCoreConfig,
    filterPipeline: FilterPipeline,
    dedupCache: DedupCache,
    eventBus: EventBus
  ) {
    this.config = config;
    this.filterPipeline = filterPipeline;
    this.dedupCache = dedupCache;
    this.eventBus = eventBus;
  }

  /**
   * Start the stream by connecting with configured channels
   */
  async start(): Promise<void> {
    await this.connect();
  }

  /**
   * Stop the stream and disconnect
   */
  stop(): void {
    if (this.wssClient) {
      this.wssClient.disconnect();
      this.wssClient = null;
    }
    this.connectionStatus = 'disconnected';
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get current channels
   */
  getChannels(): Channel[] {
    return this.config.channels;
  }

  /**
   * Get statistics
   */
  getStats(): StreamCoreStats {
    const stats: StreamCoreStats = {
      totalEvents: this.totalEvents,
      deliveredEvents: this.deliveredEvents,
      dedupedEvents: this.dedupedEvents,
      connectionStatus: this.connectionStatus,
      channels: this.config.channels
    };

    // Add WebSocket-specific metrics if client is available
    if (this.wssClient) {
      stats.reconnectAttempts = this.wssClient.getReconnectAttempts();
      stats.bufferedBytes = this.wssClient.getBufferedAmount();
    }

    return stats;
  }

  /**
   * Connect to WebSocket with configured channels
   */
  private async connect(): Promise<void> {
    // Extract user filters from config
    const userFilters = this.getUserFiltersFromConfig();

    const connectionConfig: ConnectionConfig = {
      baseUrl: this.config.baseUrl,  // Can be http/https/ws/wss - will be converted
      token: this.config.token,
      channels: this.config.channels,  // Multiple channels supported
      users: userFilters,
      reconnectDelay: this.config.reconnectDelay ?? 1000,
      maxReconnectDelay: this.config.maxReconnectDelay ?? 30000,
      reconnectBackoffMultiplier: this.config.reconnectBackoffMultiplier ?? 2.0,
      maxReconnectAttempts: this.config.maxReconnectAttempts ?? 0,
    };

    this.wssClient = new WSSClient(connectionConfig);

    // Register event handler
    this.wssClient.onEvent(async (event: TwitterEvent) => {
      await this.handleEvent(event);
    });

    // Register error handler
    this.wssClient.onError((error: Error) => {
      this.handleError(error);
    });

    // Register state change handler
    this.wssClient.onStateChange((state: ConnectionState) => {
      this.connectionStatus = this.mapWSSStateToStreamState(state);
    });

    // Attempt connection
    try {
      this.connectionStatus = 'reconnecting';
      await this.wssClient.connect();
      this.connectionStatus = 'connected';
    } catch (error) {
      this.connectionStatus = 'disconnected';
      throw error;
    }
  }

  /**
   * Map WSSClient ConnectionState to StreamCore ConnectionStatus
   */
  private mapWSSStateToStreamState(wssState: ConnectionState): ConnectionStatus {
    switch (wssState) {
      case 'connected':
        return 'connected';
      case 'disconnected':
        return 'disconnected';
      case 'connecting':
      case 'reconnecting':
        return 'reconnecting';
    }
  }

  /**
   * Extract user filters from config
   * Returns undefined if no filters configured (for backward compatibility)
   */
  private getUserFiltersFromConfig(): string[] | undefined {
    if (!this.config.userFilters || this.config.userFilters.length === 0) {
      return undefined;
    }
    return this.config.userFilters;
  }

  /**
   * Handle incoming event from WebSocket client
   * Flow: receive → parse → filter → dedup → broadcast
   */
  private async handleEvent(event: TwitterEvent): Promise<void> {
    try {
      this.totalEvents++;

      // Validate event structure
      if (!this.isValidEvent(event)) {
        console.error('Invalid event structure, skipping event');
        return;
      }

      // Apply filters
      if (!this.filterPipeline.apply(event)) {
        // Event filtered out
        return;
      }

      // Check for duplicates
      const dedupKey = generateDedupKey(event);
      if (this.dedupCache.has(dedupKey)) {
        this.dedupedEvents++;
        return;
      }

      // Add to dedup cache
      this.dedupCache.add(dedupKey, this.config.dedupTTL);

      // Broadcast to all channels
      this.deliveredEvents++;
      await this.broadcastEvent(event);

      // Log successful event processing (DEBUG only)
      if (process.env.DEBUG === 'true') {
        console.info(`[StreamCore] Event processed: ${event.type} from @${event.user.username}`);
      }

    } catch (error) {
      // Log parsing/processing errors but continue
      console.error('Error processing event:', error);
    }
  }

  /**
   * Validate event structure
   * Accepts internal format only (after WSSClient transformation)
   * WSSClient is responsible for transforming actor format to internal format
   */
  private isValidEvent(event: any): boolean {
    try {
      // Basic structure check
      if (!event || typeof event !== 'object') {
        if (process.env.DEBUG === 'true') {
          console.debug('[StreamCore] Validation failed: not an object');
        }
        return false;
      }

      // Must have type field
      const eventType = event.type;
      if (!eventType || typeof eventType !== 'string') {
        if (process.env.DEBUG === 'true') {
          console.debug('[StreamCore] Validation failed: missing event type');
        }
        return false;
      }

      // Check for internal format (after WSSClient transformation)
      const hasInternalFormat = event.user &&
        typeof event.user === 'object' &&
        typeof event.user.username === 'string' &&
        event.data &&
        typeof event.data === 'object';

      // Must have valid internal format
      if (!hasInternalFormat) {
        if (process.env.DEBUG === 'true') {
          console.debug('[StreamCore] Validation failed: missing required fields');
          console.debug('[StreamCore] Event:', JSON.stringify(event, null, 2));
        }
        return false;
      }

      // Reject events with "unknown" username (indicates missing data from actor)
      if (event.user.username === 'unknown') {
        if (process.env.DEBUG === 'true') {
          console.debug('[StreamCore] Validation failed: username is unknown (missing from source)');
        }
        return false;
      }

      return true;
    } catch (error) {
      if (process.env.DEBUG === 'true') {
        console.debug('[StreamCore] Validation error:', error);
      }
      return false;
    }
  }

  /**
   * Broadcast event to all output channels via EventBus
   */
  private async broadcastEvent(event: TwitterEvent): Promise<void> {
    try {
      // Broadcast to all channels: cli, dashboard, alerts
      const channels = ['cli', 'dashboard', 'alerts'];

      for (const channel of channels) {
        try {
          await this.eventBus.publish(channel, event);
        } catch (error) {
          // Log but don't stop other channels
          console.error(`Error broadcasting to ${channel}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in broadcast:', error);
    }
  }

  /**
   * Handle connection errors
   */
  private handleError(error: Error): void {
    console.error('StreamCore error:', error.message);

    // Update connection status if not already reconnecting
    if (this.connectionStatus === 'connected') {
      this.connectionStatus = 'reconnecting';
    }
  }
}
