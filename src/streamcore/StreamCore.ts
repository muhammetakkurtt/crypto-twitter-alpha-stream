/**
 * StreamCore - Central orchestrator for the Crypto Twitter Alpha Stream
 * 
 * Integrates SSEClient, FilterPipeline, DedupCache, and EventBus to provide
 * the complete event processing flow: receive → parse → filter → dedup → broadcast
 */

import { SSEClient, ConnectionConfig } from '../sse/SSEClient';
import { FilterPipeline } from '../filters/FilterPipeline';
import { DedupCache, generateDedupKey } from '../dedup/DedupCache';
import { EventBus } from '../eventbus/EventBus';
import { TwitterEvent } from '../models/types';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';
export type EndpointType = 'all' | 'tweets' | 'following' | 'profile';

export interface StreamCoreConfig {
  baseUrl: string;
  token: string;
  endpoint: EndpointType;
  userFilters?: string[];
  dedupTTL?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectBackoffMultiplier?: number;
  maxReconnectAttempts?: number;
  eventSourceClass?: any; // Optional dependency injection for testing
}

export interface StreamCoreStats {
  totalEvents: number;
  deliveredEvents: number;
  dedupedEvents: number;
  connectionStatus: ConnectionStatus;
  currentEndpoint: EndpointType;
}

export class StreamCore {
  private sseClient: SSEClient | null = null;
  private filterPipeline: FilterPipeline;
  private dedupCache: DedupCache;
  private eventBus: EventBus;
  private config: StreamCoreConfig;

  private connectionStatus: ConnectionStatus = 'disconnected';
  private currentEndpoint: EndpointType;

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
    this.currentEndpoint = config.endpoint;
    this.filterPipeline = filterPipeline;
    this.dedupCache = dedupCache;
    this.eventBus = eventBus;
  }

  /**
   * Start the stream by connecting to the configured endpoint
   */
  async start(): Promise<void> {
    await this.connectToEndpoint(this.currentEndpoint);
  }

  /**
   * Stop the stream and disconnect
   */
  stop(): void {
    if (this.sseClient) {
      this.sseClient.disconnect();
      this.sseClient = null;
    }
    this.connectionStatus = 'disconnected';
  }

  /**
   * Switch to a different endpoint
   * Disconnects from current endpoint and connects to the new one
   */
  async switchEndpoint(endpoint: EndpointType): Promise<void> {
    // Disconnect from current endpoint
    if (this.sseClient) {
      this.sseClient.disconnect();
      this.sseClient = null;
    }

    this.connectionStatus = 'disconnected';
    this.currentEndpoint = endpoint;

    // Connect to new endpoint
    await this.connectToEndpoint(endpoint);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Get current endpoint
   */
  getCurrentEndpoint(): EndpointType {
    return this.currentEndpoint;
  }

  /**
   * Get statistics
   */
  getStats(): StreamCoreStats {
    return {
      totalEvents: this.totalEvents,
      deliveredEvents: this.deliveredEvents,
      dedupedEvents: this.dedupedEvents,
      connectionStatus: this.connectionStatus,
      currentEndpoint: this.currentEndpoint
    };
  }

  /**
   * Connect to a specific endpoint
   */
  private async connectToEndpoint(endpoint: EndpointType): Promise<void> {
    const endpointUrl = this.getEndpointUrl(endpoint);

    // Extract user filters from config
    const userFilters = this.getUserFiltersFromConfig();

    const connectionConfig: ConnectionConfig = {
      endpoint: endpointUrl,
      token: this.config.token,
      users: userFilters,
      reconnectDelay: this.config.reconnectDelay ?? 1000,
      maxReconnectDelay: this.config.maxReconnectDelay ?? 30000,
      reconnectBackoffMultiplier: this.config.reconnectBackoffMultiplier ?? 2.0,
      maxReconnectAttempts: this.config.maxReconnectAttempts ?? 0,
      eventSourceClass: this.config.eventSourceClass
    };

    this.sseClient = new SSEClient(connectionConfig);

    // Register event handler
    this.sseClient.onEvent(async (event: TwitterEvent) => {
      await this.handleEvent(event);
    });

    // Register error handler
    this.sseClient.onError((error: Error) => {
      this.handleError(error);
    });

    // Register reconnect handler
    this.sseClient.onReconnect(() => {
      this.connectionStatus = 'reconnecting';
    });

    // Attempt connection
    try {
      this.connectionStatus = 'reconnecting';
      await this.sseClient.connect();
      this.connectionStatus = 'connected';
    } catch (error) {
      this.connectionStatus = 'disconnected';
      throw error;
    }
  }

  /**
   * Get the full URL for an endpoint type
   */
  private getEndpointUrl(endpoint: EndpointType): string {
    const baseUrl = this.config.baseUrl.replace(/\/$/, ''); // Remove trailing slash

    switch (endpoint) {
      case 'all':
        return `${baseUrl}/events/twitter/all`;
      case 'tweets':
        return `${baseUrl}/events/twitter/tweets`;
      case 'following':
        return `${baseUrl}/events/twitter/following`;
      case 'profile':
        return `${baseUrl}/events/twitter/profile`;
      default:
        throw new Error(`Unknown endpoint type: ${endpoint}`);
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
   * Handle incoming event from SSE client
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
   * Accepts internal format only (after SSEClient transformation)
   * SSEClient is responsible for transforming actor format to internal format
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

      // Check for internal format (after SSEClient transformation)
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
