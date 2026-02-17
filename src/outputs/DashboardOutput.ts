/**
 * DashboardOutput - Web-based dashboard with real-time event streaming
 * 
 * Provides Express server with static file serving and WebSocket support.
 * Broadcasts events to connected clients and exposes /status endpoint.
 * Subscribes to the EventBus 'dashboard' channel.
 */

import express, { Express, Request, Response } from 'express';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { TwitterEvent, EventStats, HealthStatus, FilterConfig, isValidEventType } from '../models/types';
import { EventBus } from '../eventbus/EventBus';

export interface DashboardConfig {
  port: number;
  staticPath?: string;
}

export interface DashboardState {
  events: TwitterEvent[];
  activeUsers: string[];
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  stats: EventStats;
  filters: FilterConfig;
  unknownEventTypes: Record<string, number>;  // Track unknown event types
}

export class DashboardOutput {
  private eventBus: EventBus;
  private config: DashboardConfig;
  private app: Express;
  private httpServer: HTTPServer | null = null;
  private io: SocketIOServer | null = null;
  private subscriptionId: string | null = null;
  private state: DashboardState;
  private connectedClients: Set<string> = new Set();
  private healthStatusProvider: (() => HealthStatus) | null = null;

  constructor(eventBus: EventBus, config: DashboardConfig) {
    this.eventBus = eventBus;
    this.config = config;
    this.app = express();
    
    this.state = {
      events: [],
      activeUsers: [],
      connectionStatus: 'disconnected',
      stats: {
        total: 0,
        delivered: 0,
        deduped: 0,
        byType: {
          post_created: 0,
          post_updated: 0,
          follow_created: 0,
          follow_updated: 0,
          user_updated: 0,
          profile_updated: 0,
          profile_pinned: 0
        },
        startTime: new Date(),
        lastEventTime: new Date()
      },
      filters: {
        users: [],
        keywords: [],
        eventTypes: []
      },
      unknownEventTypes: {}  // Initialize empty object for unknown types
    };

    this.setupRoutes();
  }

  /**
   * Set up Express routes
   */
  private setupRoutes(): void {
    // Enable JSON parsing for API requests
    this.app.use(express.json());
    
    // Status endpoint for health monitoring (before static files)
    this.app.get('/status', (req: Request, res: Response) => {
      this.handleStatusRequest(req, res);
    });

    // API endpoint to get current state (before static files)
    this.app.get('/api/state', (_req: Request, res: Response) => {
      res.json(this.state);
    });

    // Serve static files from the Svelte build directory
    if (this.config.staticPath) {
      // Configure static file serving with proper options
      this.app.use(express.static(this.config.staticPath, {
        maxAge: '1d', // Cache static assets for 1 day
        etag: true,
        lastModified: true,
        setHeaders: (res, path) => {
          // Set proper MIME types and caching headers
          if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
          }
        }
      }));
      
      // SPA fallback - serve index.html for all non-API routes
      // This ensures client-side routing works correctly
      // Use middleware instead of route handler for catch-all
      this.app.use((req: Request, res: Response, next) => {
        // Don't serve index.html for API routes or Socket.IO
        if (req.path.startsWith('/api/') || 
            req.path.startsWith('/socket.io/') || 
            req.path === '/status') {
          next();
          return;
        }
        
        // Serve index.html for all other routes (SPA fallback)
        res.sendFile('index.html', { root: this.config.staticPath });
      });
    }
  }

  /**
   * Handle /status endpoint request
   */
  private handleStatusRequest(_req: Request, res: Response): void {
    if (this.healthStatusProvider) {
      const status = this.healthStatusProvider();
      res.json(status);
    } else {
      // Fallback status if no provider is set
      const status: HealthStatus = {
        connection: {
          status: this.state.connectionStatus,
          channels: ['unknown'],
          uptime: Math.floor((Date.now() - this.state.stats.startTime.getTime()) / 1000)
        },
        events: {
          total: this.state.stats.total,
          delivered: this.state.stats.delivered,
          deduped: this.state.stats.deduped,
          rate: this.calculateEventRate()
        },
        alerts: {
          telegram: { sent: 0, failed: 0 },
          discord: { sent: 0, failed: 0 },
          webhook: { sent: 0, failed: 0 }
        },
        filters: {
          users: this.state.filters.users,
          keywords: this.state.filters.keywords
        }
      };
      res.json(status);
    }
  }

  /**
   * Calculate event rate (events per second)
   */
  private calculateEventRate(): number {
    const elapsedSeconds = (Date.now() - this.state.stats.startTime.getTime()) / 1000;
    return elapsedSeconds > 0 ? this.state.stats.total / elapsedSeconds : 0;
  }

  /**
   * Set health status provider function
   */
  setHealthStatusProvider(provider: () => HealthStatus): void {
    this.healthStatusProvider = provider;
  }

  /**
   * Start the dashboard server
   */
  async start(): Promise<void> {
    if (this.httpServer) {
      return;  // Already started
    }

    return new Promise((resolve, reject) => {
      try {
        // Create HTTP server
        this.httpServer = this.app.listen(this.config.port, () => {
          console.log(`Dashboard server started on port ${this.config.port}`);
          
          // Initialize Socket.IO with real-time optimizations
          this.io = new SocketIOServer(this.httpServer!, {
            cors: {
              origin: '*',
              methods: ['GET', 'POST']
            },
            // Real-time optimizations - disable buffering
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000,
            perMessageDeflate: false,  // Disable compression for lower latency
            httpCompression: false,     // Disable HTTP compression
            maxHttpBufferSize: 1e6      // 1MB buffer limit
          });

          this.setupWebSocket();
          
          // Subscribe to the 'dashboard' channel
          this.subscriptionId = this.eventBus.subscribe('dashboard', (event) => {
            this.handleEvent(event);
          });

          resolve();
        });

        this.httpServer.on('error', (error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocket(): void {
    if (!this.io) {
      console.log('[DashboardOutput] setupWebSocket called but io is null!');
      return;
    }

    if (process.env.DEBUG === 'true') {
      console.log('[DashboardOutput] Setting up WebSocket connection handler');
    }

    this.io.on('connection', (socket: Socket) => {
      const clientId = socket.id;
      this.connectedClients.add(clientId);
      console.log(`[DashboardOutput] ✓ Client connected: ${clientId} (total: ${this.connectedClients.size})`);

      // Send current state to newly connected client
      if (process.env.DEBUG === 'true') {
        console.log(`[DashboardOutput] Sending initial state to ${clientId}, events: ${this.state.events.length}`);
      }
      socket.emit('state', this.state);

      // Handle disconnection
      socket.on('disconnect', () => {
        this.connectedClients.delete(clientId);
        console.log(`[DashboardOutput] Client disconnected: ${clientId} (total: ${this.connectedClients.size})`);
      });

      // Handle filter updates from client
      socket.on('updateFilters', (filters: FilterConfig) => {
        this.updateFilters(filters);
      });

      // Handle active users request
      socket.on('requestActiveUsers', () => {
        socket.emit('activeUsers', this.state.activeUsers);
      });
    });

    if (process.env.DEBUG === 'true') {
      console.log('[DashboardOutput] WebSocket connection handler registered');
    }
  }

  /**
   * Stop the dashboard server
   */
  async stop(): Promise<void> {
    // Unsubscribe from event bus
    if (this.subscriptionId) {
      this.eventBus.unsubscribe(this.subscriptionId);
      this.subscriptionId = null;
    }

    // Close WebSocket connections
    if (this.io) {
      this.io.close();
      this.io = null;
    }

    // Close HTTP server
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer!.close(() => {
          console.log('Dashboard server stopped');
          this.httpServer = null;
          resolve();
        });
      });
    }
  }

  /**
   * Handle an incoming event
   * Updates state and broadcasts to connected clients
   */
  handleEvent(event: TwitterEvent): void {
    if (process.env.DEBUG === 'true') {
      console.log(`[DashboardOutput] Received event: ${event.type} from @${event.user.username}`);
    }
    
    // Update stats
    this.state.stats.total++;
    this.state.stats.delivered++;
    this.state.stats.lastEventTime = new Date();
    
    // Check if event type is valid before updating byType stats
    if (isValidEventType(event.type)) {
      this.state.stats.byType[event.type]++;
    } else {
      // Track unknown event types separately
      if (!this.state.unknownEventTypes[event.type]) {
        this.state.unknownEventTypes[event.type] = 0;
        console.warn(`[DashboardOutput] Unknown event type received: ${event.type}`);
      }
      this.state.unknownEventTypes[event.type]++;
    }

    // Add to events buffer (keep last 100 events)
    this.state.events.push(event);
    if (this.state.events.length > 100) {
      this.state.events.shift();
    }

    // Broadcast to all connected clients
    if (process.env.DEBUG === 'true') {
      console.log(`[DashboardOutput] Broadcasting to ${this.connectedClients.size} clients`);
    }
    this.broadcastToClients(event);
  }

  /**
   * Broadcast event to all connected WebSocket clients
   */
  broadcastToClients(event: TwitterEvent): void {
    if (!this.io) {
      if (process.env.DEBUG === 'true') {
        console.log('[DashboardOutput] Cannot broadcast - io is null');
      }
      return;
    }
    
    // Check actual Socket.IO sockets
    const socketCount = this.io.sockets.sockets.size;
    if (process.env.DEBUG === 'true') {
      console.log(`[DashboardOutput] Broadcasting event: connectedClients.size=${this.connectedClients.size}, io.sockets.sockets.size=${socketCount}`);
    }
    
    if (socketCount === 0 && process.env.DEBUG === 'true') {
      console.log('[DashboardOutput] WARNING: No sockets connected in Socket.IO server!');
    }
    
    // Emit immediately without buffering
    // Use volatile flag to skip buffering for disconnected clients
    this.io.volatile.emit('event', event);
  }

  /**
   * Update connection status
   */
  updateConnectionStatus(status: 'connected' | 'disconnected' | 'reconnecting'): void {
    this.state.connectionStatus = status;
    if (this.io) {
      this.io.emit('connectionStatus', status);
    }
  }

  /**
   * Update active users list
   */
  updateActiveUsers(users: string[]): void {
    this.state.activeUsers = users;
    if (this.io) {
      this.io.emit('activeUsers', users);
    }
  }

  /**
   * Update filters
   */
  updateFilters(filters: FilterConfig): void {
    this.state.filters = filters;
    if (this.io) {
      this.io.emit('filters', filters);
    }
  }

  /**
   * Increment deduped counter
   */
  incrementDeduped(): void {
    this.state.stats.deduped++;
  }

  /**
   * Get current state
   */
  getState(): DashboardState {
    return { ...this.state };
  }

  /**
   * Get number of connected clients
   */
  getConnectedClientCount(): number {
    return this.connectedClients.size;
  }
}
