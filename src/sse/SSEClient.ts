/**
 * SSE Client with automatic reconnection and exponential backoff
 */

import { EventSource } from 'eventsource';
import { RawEvent, TwitterEvent } from '../models/types';

export interface ConnectionConfig {
  endpoint: string;
  token: string;
  users?: string[];  // Optional user filter list for actor-side filtering
  reconnectDelay: number;  // Initial delay in ms
  maxReconnectDelay: number;  // Max delay in ms
  reconnectBackoffMultiplier: number;  // e.g., 2.0
  maxReconnectAttempts: number;  // 0 = infinite
  eventSourceClass?: any; // Optional dependency injection for testing
}

export type EventCallback = (event: TwitterEvent) => void;
export type ErrorCallback = (error: Error) => void;
export type ReconnectCallback = () => void;

export class SSEClient {
  private config: ConnectionConfig;
  private eventSource: EventSource | null = null;
  private reconnectAttempts: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private pingTimeout: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private shouldReconnect: boolean = true;
  // @ts-ignore
  private isExpectedShutdown: boolean = false;
  // @ts-ignore
  private isConnecting: boolean = false;

  private eventCallbacks: EventCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private reconnectCallbacks: ReconnectCallback[] = [];

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  /**
   * Build connection URL with query parameters
   */
  private buildConnectionUrl(): string {
    const params = new URLSearchParams();
    params.append('token', this.config.token);

    if (this.config.users && this.config.users.length > 0) {
      params.append('users', this.config.users.join(','));
    }

    return `${this.config.endpoint}?${params.toString()}`;
  }

  /**
   * Connect to the SSE endpoint
   */
  async connect(): Promise<void> {
    // Prevent concurrent connection attempts
    if (this.isConnecting) {
      console.log('Connection attempt already in progress, skipping');
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        // Validate token before connecting
        if (!this.config.token || this.config.token.trim() === '') {
          const error = new Error('Authentication token is required');
          this.isConnecting = false;
          reject(error);
          return;
        }

        // Close existing connection if any
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Create EventSource with authentication and optional user filters
        const url = this.buildConnectionUrl();
        const EventSourceClass = this.config.eventSourceClass || EventSource;
        this.eventSource = new EventSourceClass(url);

        // Handle successful connection
        this.eventSource!.onopen = () => {
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.isExpectedShutdown = false;
          resolve();
        };

        // Handle incoming messages (default message event)
        this.eventSource!.onmessage = async (event: any) => {
          try {
            await this.handleMessage(event);
          } catch (error) {
            this.notifyError(error as Error);
          }
        };

        // Listen for specific event types from actor
        const eventTypes = [
          'post_created', 'post_update',
          'follow_created', 'follow_update',
          'user_updated', 'profile_update', 'pin_update',
          'connected', 'ping', 'shutdown'
        ];

        eventTypes.forEach(eventType => {
          this.eventSource!.addEventListener(eventType, async (event: any) => {
            try {
              if (eventType === 'shutdown') {
                console.log('Actor shutdown detected, will reconnect when ready');
                this.isExpectedShutdown = true;
                this.isConnected = false;
                this.stopPingTimeout();
                this.waitForActorReadiness();
                return;
              }
              
              if (eventType === 'ping') {
                // Reset ping timeout on every ping received
                this.resetPingTimeout();
                return;
              }
              
              if (eventType === 'connected') {
                // Start ping timeout monitoring after connection
                this.resetPingTimeout();
                return;
              }
              
              await this.handleMessage(event);
            } catch (error) {
              this.notifyError(error as Error);
            }
          });
        });

        // Handle errors
        this.eventSource!.onerror = (error: any) => {
          this.isConnected = false;
          this.isConnecting = false;

          // Check if this is an expected shutdown
          if (this.isExpectedShutdown) {
            // Don't log error, already handling reconnection
            return;
          }

          // Check if this is an authentication error (401)
          if (error.status === 401) {
            const authError = new Error('Authentication failed: Invalid token');
            this.shouldReconnect = false;
            this.notifyError(authError);
            this.disconnect();
            reject(authError);
            return;
          }

          // For other errors, attempt reconnection
          this.notifyError(new Error(`SSE connection error: ${error.message || 'Connection lost'}`));

          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the SSE endpoint
   */
  disconnect(): void {
    this.shouldReconnect = false;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.isConnected = false;
  }

  /**
   * Wait for actor to be ready after shutdown by polling health endpoint
   */
  private async waitForActorReadiness(): Promise<void> {
    const healthUrl = `${this.config.endpoint.replace('/events/twitter/all', '/health')}`;
    const maxAttempts = 30;
    let attempts = 0;
    let isReconnecting = false; // Flag to prevent multiple reconnection attempts

    const checkHealth = async (): Promise<boolean> => {
      try {
        const response = await fetch(healthUrl, {
          headers: { 'Authorization': `Bearer ${this.config.token}` }
        });
        const data = await response.json();
        return data.status === 'ok';
      } catch (error) {
        return false;
      }
    };

    this.healthCheckInterval = setInterval(async () => {
      attempts++;

      if (attempts > maxAttempts) {
        if (this.healthCheckInterval) {
          clearInterval(this.healthCheckInterval);
          this.healthCheckInterval = null;
        }
        console.log('Actor readiness timeout after 30 seconds');
        this.notifyError(new Error('Actor readiness timeout after 30 seconds'));
        return;
      }

      console.log(`Checking actor health... (attempt ${attempts}/${maxAttempts})`);
      const isReady = await checkHealth();

      if (isReady && !isReconnecting) {
        isReconnecting = true; // Set flag immediately to prevent duplicate attempts
        
        if (this.healthCheckInterval) {
          clearInterval(this.healthCheckInterval);
          this.healthCheckInterval = null;
        }
        
        console.log('Actor is ready, reconnecting...');
        this.isExpectedShutdown = false;
        this.reconnectAttempts = 0;
        await this.connect();
      }
    }, 1000);
  }

  /**
   * Reset ping timeout - called when ping is received
   */
  private resetPingTimeout(): void {
    // Clear existing timeout
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
    }

    // Set new timeout for 30 seconds (6 missed pings at 5s interval)
    this.pingTimeout = setTimeout(() => {
      console.warn('No ping received for 30 seconds, connection may be dead');
      
      // Trigger reconnection
      if (this.shouldReconnect && !this.isExpectedShutdown) {
        this.isConnected = false;
        this.notifyError(new Error('Ping timeout: No ping received for 30 seconds'));
        this.scheduleReconnect();
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop ping timeout monitoring
   */
  private stopPingTimeout(): void {
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  /**
   * Register a callback for incoming events
   */
  onEvent(callback: EventCallback): void {
    this.eventCallbacks.push(callback);
  }

  /**
   * Register a callback for errors
   */
  onError(callback: ErrorCallback): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Register a callback for reconnection events
   */
  onReconnect(callback: ReconnectCallback): void {
    this.reconnectCallbacks.push(callback);
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get current reconnect attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Handle incoming SSE message
   */
  private async handleMessage(event: any): Promise<void> {
    try {
      // Parse the raw event
      const rawEvent: RawEvent = {
        id: event.lastEventId || '',
        event: event.type || 'message',
        data: event.data
      };

      // Parse the data as JSON
      const parsedData = JSON.parse(rawEvent.data);

      // Transform actor format to internal format
      const twitterEvent = this.transformActorEvent(parsedData);

      // Validate the event structure
      if (!this.isValidTwitterEvent(twitterEvent)) {
        // Log validation error but don't throw - continue processing other events
        console.error('Invalid event structure, skipping event');
        return;
      }

      // Notify all event callbacks (await each one)
      for (const callback of this.eventCallbacks) {
        try {
          await callback(twitterEvent);
        } catch (error) {
          // Isolate callback errors
          this.notifyError(error as Error);
        }
      }

    } catch (error) {
      // Log parsing error and notify error callbacks
      const errorMessage = `Failed to parse event: ${(error as Error).message}`;
      console.error(errorMessage);
      this.notifyError(new Error(errorMessage));
    }
  }

  /**
   * Transform actor event format to internal TwitterEvent format
   */
  private transformActorEvent(actorEvent: any): TwitterEvent {
    // Log raw actor event for debugging
    if (process.env.DEBUG === 'true') {
      console.debug('[SSEClient] Raw actor event:', JSON.stringify(actorEvent, null, 2));
    }

    // Actor format: { data: {...}, event_type: "..." }
    // Internal format: { type, timestamp, primaryId, user, data }

    const eventData = actorEvent.data || {};
    const eventType = actorEvent.event_type || 'unknown';

    // Extract username from different possible locations (priority order)
    const username = eventData.username ||           // Primary location
      eventData.user?.handle ||       // Profile events
      eventData.tweet?.author?.handle || // Tweet events
      'unknown';

    // Extract display name
    const displayName = eventData.user?.profile?.name ||
      eventData.tweet?.author?.profile?.name ||
      username;

    // Extract user ID
    const userId = eventData.user?.id ||
      eventData.tweet?.author?.id ||
      'unknown';

    // Extract primary ID based on event type
    let primaryId: string;
    if (eventType.includes('follow') && eventData.user?.id && eventData.following?.id) {
      // For follow events, create unique ID from both follower and followed
      primaryId = `${eventData.user.id}-${eventData.following.id}`;
    } else if ((eventType === 'user_updated' || eventType === 'profile_updated' || eventType === 'profile_pinned') && eventData.user?.id) {
      // For user/profile update events, create unique ID with timestamp to show each update separately
      primaryId = `${eventData.user.id}-${Date.now()}`;
    } else {
      // For other events, use existing logic
      primaryId = eventData.tweetId ||
        eventData.user?.id ||
        eventData.following?.id ||
        `${username}-${Date.now()}`;
    }

    const transformedEvent: TwitterEvent = {
      type: eventType,
      timestamp: new Date().toISOString(),
      primaryId: primaryId,
      user: {
        username: username,
        displayName: displayName,
        userId: userId
      },
      // CRITICAL: Deep copy the entire data object to avoid reference issues
      data: JSON.parse(JSON.stringify(eventData))
    };

    // Log transformed event for debugging
    if (process.env.DEBUG === 'true') {
      console.debug('[SSEClient] Transformed event:', JSON.stringify(transformedEvent, null, 2));
    }

    return transformedEvent;
  }

  /**
   * Validate TwitterEvent structure
   */
  private isValidTwitterEvent(event: any): event is TwitterEvent {
    return (
      typeof event === 'object' &&
      event !== null &&
      typeof event.type === 'string' &&
      typeof event.timestamp === 'string' &&
      typeof event.primaryId === 'string' &&
      typeof event.user === 'object' &&
      typeof event.user !== 'undefined' &&
      event.user !== null &&
      typeof event.user.username === 'string' &&
      event.user.username !== 'unknown' && // Reject if username resolution failed
      typeof event.user.displayName === 'string' &&
      typeof event.user.userId === 'string' &&
      typeof event.data === 'object' &&
      event.type !== 'unknown' // Reject unknown event types
    );
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    // Check if we've exceeded max attempts
    if (this.config.maxReconnectAttempts > 0 &&
      this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.notifyError(new Error(`Max reconnection attempts (${this.config.maxReconnectAttempts}) reached`));
      this.shouldReconnect = false;
      return;
    }

    // Calculate delay with exponential backoff
    const delay = this.calculateReconnectDelay();

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.notifyReconnect();
      this.connect().catch(error => {
        this.notifyError(error as Error);
      });
    }, delay);
  }

  /**
   * Calculate reconnection delay using exponential backoff
   */
  private calculateReconnectDelay(): number {
    const delay = this.config.reconnectDelay *
      Math.pow(this.config.reconnectBackoffMultiplier, this.reconnectAttempts);
    return Math.min(delay, this.config.maxReconnectDelay);
  }

  /**
   * Notify all error callbacks
   */
  private notifyError(error: Error): void {
    this.errorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        // Prevent callback errors from breaking the client
        console.error('Error in error callback:', err);
      }
    });
  }

  /**
   * Notify all reconnect callbacks
   */
  private notifyReconnect(): void {
    this.reconnectCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        // Prevent callback errors from breaking the client
        console.error('Error in reconnect callback:', error);
      }
    });
  }
}
