/**
 * Test helper utilities
 * Shared mock configurations and utilities for tests
 */

import { AppConfig } from '../src/config/types';

/**
 * Create a valid mock configuration for tests
 * Provides sensible defaults and allows overriding specific fields
 */
export function createMockConfig(overrides: any = {}): AppConfig {
  return {
    apify: {
      token: 'test-token-12345',
      actorUrl: 'https://test-actor.apify.com',
      endpoint: 'all' as const,
      ...overrides.apify
    },
    filters: {
      users: [],
      keywords: [],
      ...overrides.filters
    },
    outputs: {
      cli: { enabled: true },
      dashboard: { enabled: false, port: 3000 },
      alerts: {
        telegram: { enabled: false },
        discord: { enabled: false },
        webhook: { enabled: false }
      },
      ...overrides.outputs
    },
    dedup: { ttl: 60, ...overrides.dedup },
    reconnect: {
      initialDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2.0,
      maxAttempts: 10,
      ...overrides.reconnect
    },
    logging: { fileLogging: false, ...overrides.logging },
    health: { port: 8080, ...overrides.health },
    activeUsers: { refreshInterval: 300000, ...overrides.activeUsers }
  };
}
