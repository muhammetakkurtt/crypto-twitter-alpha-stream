/**
 * Configuration type definitions
 */

import { Channel } from '../models/types';

// Re-export Channel for backward compatibility
export { Channel };

export interface ApifyConfig {
  token: string;
  actorUrl: string;
  channels: Channel[]; // Multiple subscription channels for WebSocket
}

export interface FilterConfig {
  users: string[];
  keywords: string[];
}

export interface CLIOutputConfig {
  enabled: boolean;
  statsInterval?: number;
}

export interface DashboardOutputConfig {
  enabled: boolean;
  port: number;
}

export interface TelegramAlertConfig {
  enabled: boolean;
  botToken?: string;
  chatId?: string;
}

export interface DiscordAlertConfig {
  enabled: boolean;
  webhookUrl?: string;
}

export interface WebhookAlertConfig {
  enabled: boolean;
  url?: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
}

export interface AlertsConfig {
  telegram: TelegramAlertConfig;
  discord: DiscordAlertConfig;
  webhook: WebhookAlertConfig;
  rateLimit?: number;
}

export interface OutputsConfig {
  cli: CLIOutputConfig;
  dashboard: DashboardOutputConfig;
  alerts: AlertsConfig;
}

export interface DedupConfig {
  ttl: number;
}

export interface ReconnectConfig {
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  maxAttempts: number;
}

export interface LoggingConfig {
  fileLogging: boolean;
  debug?: boolean;
}

export interface HealthConfig {
  port: number;
}

export interface ActiveUsersConfig {
  refreshInterval: number;
}

export interface AppConfig {
  apify: ApifyConfig;
  filters: FilterConfig;
  outputs: OutputsConfig;
  dedup: DedupConfig;
  reconnect: ReconnectConfig;
  logging: LoggingConfig;
  health: HealthConfig;
  activeUsers: ActiveUsersConfig;
}
