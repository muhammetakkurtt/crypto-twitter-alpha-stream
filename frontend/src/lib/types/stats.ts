/**
 * Statistics type definitions for the Svelte 5 Dashboard
 */

import type { EventType } from './events';

export interface Stats {
  total: number;
  delivered: number;
  deduped: number;
  startTime: number;
}

export interface DetailedStats extends Stats {
  byType: Record<EventType, number>;
  lastEventTime: number;
  eventsPerMinute: number;
}

export interface ConnectionStats {
  status: 'connected' | 'disconnected' | 'reconnecting';
  endpoint: string;
  uptime: number;
}

export interface DashboardState {
  stats: Stats;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  activeUsers: string[];
}
