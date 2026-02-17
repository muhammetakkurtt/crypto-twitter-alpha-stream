/**
 * WebSocket Client with automatic reconnection and exponential backoff
 */

import WebSocket from 'ws';
import { TwitterEvent } from '../models/types';

export type Channel = 'all' | 'tweets' | 'following' | 'profile';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface ConnectionConfig {
  baseUrl: string;               // Base URL (http/https/ws/wss - auto-converted)
  token: string;                 // Authentication token
  channels: Channel[];           // Subscription channels (can be multiple)
  users?: string[];              // Optional user filters for actor-side filtering
  reconnectDelay: number;        // Initial reconnection delay (ms)
  maxReconnectDelay: number;     // Maximum reconnection delay (ms)
  reconnectBackoffMultiplier: number;  // Backoff multiplier (e.g., 2.0)
  maxReconnectAttempts: number;  // Max attempts (0 = infinite)
  connectionTimeout?: number;    // Connection timeout in ms (default: 30000)
}

export type EventCallback = (event: TwitterEvent) => void;
export type ErrorCallback = (error: Error) => void;
export type StateChangeCallback = (state: ConnectionState) => void;

export class WSSClient {
  private ws: WebSocket | null = null;
  private config: ConnectionConfig;
  private connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts: number = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private shutdownTimeout: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private shouldReconnect: boolean = true;
  private isExpectedShutdown: boolean = false;

  // Promise lifecycle management
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;

  private eventCallbacks: EventCallback[] = [];
  private errorCallbacks: ErrorCallback[] = [];
  private stateChangeCallbacks: StateChangeCallback[] = [];

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  /**
   * Convert HTTP/HTTPS URLs to WS/WSS format
   */
  private toWebSocketUrl(url: string): string {
    if (url.startsWith('http://')) {
      return url.replace('http://', 'ws://');
    }
    if (url.startsWith('https://')) {
      return url.replace('https://', 'wss://');
    }
    // Already ws:// or wss://, return as-is
    return url;
  }

  /**
   * Convert WS/WSS URLs to HTTP/HTTPS format
   * Used for REST endpoint access (e.g., /active-users, /health)
   */
  static toHttpUrl(url: string): string {
    if (url.startsWith('ws://')) {
      return url.replace('ws://', 'http://');
    }
    if (url.startsWith('wss://')) {
      return url.replace('wss://', 'https://');
    }
    // Already http:// or https://, return as-is
    return url;
  }

  /**
   * Connect to the WebSocket endpoint
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Reset reconnect flag to allow automatic reconnection
        // This ensures that calling connect() after disconnect() re-enables reconnection
        this.shouldReconnect = true;

        // Validate token before connecting
        if (!this.config.token || this.config.token.trim() === '') {
          const error = new Error('Authentication token is required');
          reject(error);
          return;
        }

        // Close existing connection if any
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }

        // Store promise callbacks for lifecycle management
        this.connectResolve = resolve;
        this.connectReject = reject;

        // Convert baseUrl to WebSocket format
        const wsUrl = this.toWebSocketUrl(this.config.baseUrl);
        
        // Build connection URL with token as query parameter
        const url = new URL(wsUrl);
        url.searchParams.append('token', this.config.token);

        // Update state
        this.setState('connecting');

        // Create WebSocket connection
        if (process.env.DEBUG === 'true') {
          console.log(`[WSSClient] Connecting to ${wsUrl}...`);
        }
        this.ws = new WebSocket(url.toString());

        // Set connection timeout (default 30 seconds)
        const timeoutMs = this.config.connectionTimeout ?? 30000;
        this.connectionTimeout = setTimeout(() => {
          if (this.connectReject) {
            const error = new Error(`Connection timeout: No subscription confirmation received within ${timeoutMs}ms`);
            this.rejectConnectPromise(error);
            this.disconnect();
          }
        }, timeoutMs);

        // Handle connection open
        this.ws.on('open', () => {
          if (process.env.DEBUG === 'true') {
            console.log('[WSSClient] WebSocket connected');
          }
          this.setState('connected');
          this.reconnectAttempts = 0;
          this.isExpectedShutdown = false;

          // Send subscribe message
          this.sendSubscribe();
        });

        // Handle incoming messages
        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            this.handleMessage(data.toString());
          } catch (error) {
            this.notifyError(error as Error);
          }
        });

        // Handle errors
        this.ws.on('error', (error: Error) => {
          // Check if this is an authentication error
          const errorMessage = error.message || '';
          if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
            const authError = new Error('Authentication failed: Invalid token');
            this.shouldReconnect = false;
            this.notifyError(authError);
            this.rejectConnectPromise(authError);
            this.disconnect();
            return;
          }

          // For other errors, reject promise if pending and trigger reconnection
          this.rejectConnectPromise(new Error(`WebSocket error: ${errorMessage}`));
          this.notifyError(new Error(`WebSocket error: ${errorMessage}`));
        });

        // Handle connection close
        this.ws.on('close', (code: number) => {
          this.setState('disconnected');

          // Check if this is a manual disconnect (shouldReconnect = false)
          if (!this.shouldReconnect) {
            // Manual disconnect - reject promise if pending
            this.rejectConnectPromise(new Error('Connection closed due to manual disconnect'));
            return;
          }

          // Check if this is an expected shutdown
          if (this.isExpectedShutdown) {
            // Don't log error, already handling reconnection
            return;
          }

          // Check if this is a normal closure (1000) - don't reconnect
          if (code === 1000) {
            this.rejectConnectPromise(new Error('Connection closed normally'));
            return;
          }

          // Check if this is an authentication error (401)
          if (code === 1008 || code === 4401) {
            const authError = new Error('Authentication failed: Invalid token');
            this.shouldReconnect = false;
            this.notifyError(authError);
            this.rejectConnectPromise(authError);
            return;
          }

          // For other closures, reject promise if pending and attempt reconnection
          this.rejectConnectPromise(new Error(`Connection closed with code ${code}`));
          
          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        });

      } catch (error) {
        this.setState('disconnected');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket endpoint
   */
  disconnect(): void {
    this.shouldReconnect = false;

    // Clear all timers
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.shutdownTimeout) {
      clearTimeout(this.shutdownTimeout);
      this.shutdownTimeout = null;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get current reconnect attempt count
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  /**
   * Get buffered amount (bytes waiting to be sent)
   * Returns 0 if WebSocket is not connected
   */
  getBufferedAmount(): number {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return this.ws.bufferedAmount;
    }
    return 0;
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
   * Register a callback for state changes
   */
  onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Handle incoming WebSocket message
   * 
   * WebSocket Protocol:
   * - All messages are JSON with event_type and data fields
   * - Control events: connected, subscribed, shutdown, error
   * - Data events: post_created, follow_created, user_updated, etc.
   * - Protocol-level ping/pong is handled automatically by ws library
   */
  private handleMessage(data: string): void {
    try {
      // Parse JSON message
      const message = JSON.parse(data);
      const eventType = message.event_type;

      // Handle control events
      if (eventType === 'connected') {
        // Connection established
        return;
      }

      if (eventType === 'subscribed') {
        // Subscription confirmed - resolve connect promise
        if (process.env.DEBUG === 'true') {
          console.log(`[WSSClient] Subscribed successfully: ${JSON.stringify(message.data)}`);
        }
        this.resolveConnectPromise();
        return;
      }

      if (eventType === 'shutdown') {
        // Server shutdown - enter graceful shutdown mode
        this.handleShutdown();
        return;
      }

      if (eventType === 'error') {
        // Server error
        const errorMessage = message.data?.message || 'Unknown error';
        const errorCode = message.data?.code || 'UNKNOWN';
        this.notifyError(new Error(`Server error [${errorCode}]: ${errorMessage}`));
        return;
      }

      // Transform and emit data events
      if (process.env.DEBUG === 'true') {
        console.log(`[WSSClient] Raw actor event: ${JSON.stringify(message, null, 2)}`);
      }
      
      const twitterEvent = this.transformEvent(message);
      
      // Validate event before emitting
      if (!this.isValidTwitterEvent(twitterEvent)) {
        if (process.env.DEBUG === 'true') {
          console.error('[WSSClient] Invalid event structure, skipping event');
        }
        return;
      }

      if (process.env.DEBUG === 'true') {
        console.log(`[WSSClient] Transformed event: ${JSON.stringify(twitterEvent, null, 2)}`);
      }

      // Notify all event callbacks
      for (const callback of this.eventCallbacks) {
        try {
          callback(twitterEvent);
        } catch (error) {
          // Isolate callback errors
          this.notifyError(error as Error);
        }
      }

    } catch (error) {
      // Log parsing error and notify error callbacks
      const errorMessage = `Failed to parse message: ${(error as Error).message}`;
      if (process.env.DEBUG === 'true') {
        console.error(`[WSSClient] ${errorMessage}`);
      }
      this.notifyError(new Error(errorMessage));
    }
  }

  /**
   * Validate channel names against allowed values
   */
  private validateChannels(channels: Channel[]): void {
    const allowedChannels: Channel[] = ['all', 'tweets', 'following', 'profile'];
    
    for (const channel of channels) {
      if (!allowedChannels.includes(channel)) {
        throw new Error(`Invalid channel: ${channel}. Allowed channels: ${allowedChannels.join(', ')}`);
      }
    }
  }

  /**
   * Send subscribe message
   * 
   * Subscribe Protocol:
   * - Must be sent within 30 seconds of connection
   * - Format: {"op":"subscribe","channels":[...],"users":[...]}
   * - users field is optional (omitted if no filters)
   * - Server responds with "subscribed" confirmation event
   */
  private sendSubscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Validate channels before sending
    this.validateChannels(this.config.channels);

    const subscribeMessage: any = {
      op: 'subscribe',
      channels: this.config.channels
    };

    // Only include users field if filters are configured
    if (this.config.users && this.config.users.length > 0) {
      subscribeMessage.users = this.config.users;
    }

    if (process.env.DEBUG === 'true') {
      console.log(`[WSSClient] Sending subscribe message: ${JSON.stringify(subscribeMessage)}`);
    }

    this.ws.send(JSON.stringify(subscribeMessage));
  }

  /**
   * Transform actor event format to internal TwitterEvent format
   * 
   * Transformation Rules:
   * - Username extraction priority: data.username → data.user.handle → data.tweet.author.handle
   * - UserId extraction: data.user.id or data.tweet.author.id
   * - DisplayName extraction: data.user.profile.name or data.tweet.author.profile.name
   * - PrimaryId generation: Based on event type (tweetId for tweets, userId for follows/updates)
   * - Data preservation: Complete deep copy of actor data field
   */
  private transformEvent(actorEvent: any): TwitterEvent {
    const eventData = actorEvent.data || {};
    let eventType = actorEvent.event_type || 'unknown';

    // Normalize event_type based on data.action field
    // This prevents misclassification of follow/post update events
    if (eventData.action === 'follow_update') {
      eventType = 'follow_updated';
    } else if (eventData.action === 'post_update') {
      eventType = 'post_updated';
    }

    // Extract username from different possible locations (priority order)
    const username = eventData.username ||
      eventData.user?.handle ||
      eventData.tweet?.author?.handle ||
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
    // Use stable identifiers to enable proper deduplication
    let primaryId: string;
    if (eventType.includes('follow') && eventData.user?.id && eventData.following?.id) {
      // For follow events, create unique ID from both follower and followed
      primaryId = `${eventData.user.id}-${eventData.following.id}`;
    } else if (eventType.includes('post') || eventType.includes('tweet')) {
      // For tweet/post events, use stable tweet ID
      primaryId = eventData.tweetId || eventData.tweet?.id || `unknown-${Date.now()}`;
    } else if (eventData.user?.id) {
      // For user/profile events, use user ID (stable across updates)
      primaryId = eventData.user.id;
    } else if (eventData.following?.id) {
      // For following-related events, use following user ID
      primaryId = eventData.following.id;
    } else {
      // Fallback: use timestamp only when no stable ID is available
      primaryId = `${username}-${Date.now()}`;
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
      event.user !== null &&
      typeof event.user.username === 'string' &&
      event.user.username !== 'unknown' &&
      typeof event.user.displayName === 'string' &&
      typeof event.user.userId === 'string' &&
      typeof event.data === 'object' &&
      event.type !== 'unknown'
    );
  }

  /**
   * Handle graceful shutdown
   * 
   * Shutdown Protocol:
   * - Server sends "shutdown" event before closing
   * - Client waits 5 seconds before reconnecting
   * - No error logging during expected shutdown
   * - Reconnection counter is reset after shutdown
   */
  private handleShutdown(): void {
    if (process.env.DEBUG === 'true') {
      console.log('[WSSClient] Server shutdown detected, will reconnect in 5 seconds');
    }
    this.isExpectedShutdown = true;
    this.setState('disconnected');

    // Clear any existing shutdown timeout
    if (this.shutdownTimeout) {
      clearTimeout(this.shutdownTimeout);
    }

    // Wait 5 seconds before reconnecting
    this.shutdownTimeout = setTimeout(() => {
      if (process.env.DEBUG === 'true') {
        console.log('[WSSClient] Reconnecting after server shutdown...');
      }
      this.isExpectedShutdown = false;
      this.reconnectAttempts = 0;
      this.connect().catch(error => {
        this.notifyError(error as Error);
      });
    }, 5000);
  }

  /**
   * Schedule reconnection with exponential backoff
   * 
   * Reconnection Algorithm:
   * - Formula: delay = min(initialDelay × multiplier^attempts, maxDelay)
   * - Default: 1000ms initial, 30000ms max, 2.0 multiplier
   * - Max attempts: 0 = infinite, >0 = limited
   * - Counter resets on successful connection
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

    if (process.env.DEBUG === 'true') {
      console.log(`[WSSClient] Scheduling reconnection attempt ${this.reconnectAttempts + 1} in ${delay}ms`);
    }

    this.setState('reconnecting');

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
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
   * Update connection state and notify callbacks
   */
  private setState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      if (process.env.DEBUG === 'true') {
        console.log(`[WSSClient] State change: ${this.connectionState} -> ${state}`);
      }
      this.connectionState = state;
      this.notifyStateChange(state);
    }
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
        if (process.env.DEBUG === 'true') {
          console.error('[WSSClient] Error in error callback:', err);
        }
      }
    });
  }

  /**
   * Notify all state change callbacks
   */
  private notifyStateChange(state: ConnectionState): void {
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        // Prevent callback errors from breaking the client
        if (process.env.DEBUG === 'true') {
          console.error('[WSSClient] Error in state change callback:', error);
        }
      }
    });
  }

  /**
   * Resolve the connect promise if it's still pending
   */
  private resolveConnectPromise(): void {
    if (this.connectResolve) {
      // Clear connection timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      const resolve = this.connectResolve;
      this.connectResolve = null;
      this.connectReject = null;
      resolve();
    }
  }

  /**
   * Reject the connect promise if it's still pending
   */
  private rejectConnectPromise(error: Error): void {
    if (this.connectReject) {
      // Clear connection timeout
      if (this.connectionTimeout) {
        clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
      }

      const reject = this.connectReject;
      this.connectResolve = null;
      this.connectReject = null;
      reject(error);
    }
  }
}
