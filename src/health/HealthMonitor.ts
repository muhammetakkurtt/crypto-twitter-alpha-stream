/**
 * HealthMonitor - Exposes application health and statistics via HTTP endpoint
 * 
 * Provides a /status endpoint that returns current metrics including:
 * - Connection status and uptime
 * - Event processing statistics
 * - Alert channel statistics
 * - Active filter configuration
 */

import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { HealthStatus } from '../models/types';
import { StreamCore } from '../streamcore/StreamCore';
import { CLIOutput } from '../outputs/CLIOutput';
import { AlertOutput } from '../outputs/AlertOutput';
import { FilterPipeline } from '../filters/FilterPipeline';

export interface HealthMonitorConfig {
  port: number;
  streamCore: StreamCore;
  cliOutput?: CLIOutput;
  alertOutput?: AlertOutput;
  filterPipeline: FilterPipeline;
}

export class HealthMonitor {
  private app: Express;
  private server: Server | null = null;
  private config: HealthMonitorConfig;
  private startTime: Date;

  constructor(config: HealthMonitorConfig) {
    this.config = config;
    this.app = express();
    this.startTime = new Date();
    this.setupRoutes();
  }

  /**
   * Set up Express routes
   */
  private setupRoutes(): void {
    // Health status endpoint
    this.app.get('/status', (_req: Request, res: Response) => {
      try {
        const status = this.getStatus();
        res.json(status);
      } catch (error) {
        console.error('[HealthMonitor] Error getting status:', error);
        res.status(500).json({ error: 'Failed to get status' });
      }
    });

    // Root endpoint for basic health check
    this.app.get('/', (_req: Request, res: Response) => {
      res.json({ status: 'ok', message: 'Crypto Twitter Alpha Stream Health Monitor' });
    });
  }

  /**
   * Start the health monitor server
   */
  async start(port?: number): Promise<void> {
    const listenPort = port ?? this.config.port;

    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(listenPort, () => {
          console.log(`[HealthMonitor] Server started on port ${listenPort}`);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('[HealthMonitor] Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the health monitor server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error) => {
        if (error) {
          console.error('[HealthMonitor] Error stopping server:', error);
          reject(error);
        } else {
          console.log('[HealthMonitor] Server stopped');
          this.server = null;
          resolve();
        }
      });
    });
  }

  /**
   * Get current health status
   * Collects metrics from StreamCore, outputs, and filters
   */
  getStatus(): HealthStatus {
    // Get StreamCore stats
    const streamStats = this.config.streamCore.getStats();
    
    // Calculate uptime
    const now = new Date();
    const uptimeSeconds = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);
    
    // Calculate event rate
    const rate = uptimeSeconds > 0 ? streamStats.totalEvents / uptimeSeconds : 0;

    // Get alert stats if available
    const alertStats = this.config.alertOutput?.getStats() ?? {
      telegram: { sent: 0, failed: 0 },
      discord: { sent: 0, failed: 0 },
      webhook: { sent: 0, failed: 0 }
    };

    // Get filter configuration
    const filterConfig = this.config.filterPipeline.getConfig();

    // Build health status
    const status: HealthStatus = {
      connection: {
        status: streamStats.connectionStatus,
        endpoint: streamStats.currentEndpoint,
        uptime: uptimeSeconds
      },
      events: {
        total: streamStats.totalEvents,
        delivered: streamStats.deliveredEvents,
        deduped: streamStats.dedupedEvents,
        rate: parseFloat(rate.toFixed(2))
      },
      alerts: alertStats,
      filters: {
        users: filterConfig.users,
        keywords: filterConfig.keywords
      }
    };

    return status;
  }
}
