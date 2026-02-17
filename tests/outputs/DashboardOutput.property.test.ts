/**
 * Property-based tests for DashboardOutput
 */

import * as fc from 'fast-check';
import { DashboardOutput } from '../../src/outputs/DashboardOutput';
import { EventBus } from '../../src/eventbus/EventBus';
import { FilterConfig, EventType } from '../../src/models/types';

describe('DashboardOutput Property Tests', () => {
  
  /**
   * For any filter change (user, keyword, or event type), the dashboard event feed 
   * should update to reflect the new filter within one second.
   */
  describe('Property 16: Dashboard Filter Reactivity', () => {
    it('should update filters reactively when filter changes occur', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary filter configurations
          fc.record({
            users: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
            keywords: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
            eventTypes: fc.array(
              fc.constantFrom<EventType>('post_created', 'post_updated', 'follow_created', 'follow_updated', 'user_updated', 'profile_updated', 'profile_pinned'),
              { maxLength: 7 }
            )
          }),
          async (filterConfig: FilterConfig) => {
            const eventBus = new EventBus();
            const dashboard = new DashboardOutput(eventBus, { port: 0 });

            // Record the time before filter update
            const startTime = Date.now();

            // Update filters
            dashboard.updateFilters(filterConfig);

            // Get the state
            const state = dashboard.getState();

            // Calculate elapsed time
            const elapsedTime = Date.now() - startTime;

            // Verify filter update happened within 1 second (1000ms)
            expect(elapsedTime).toBeLessThan(1000);

            // Verify filters match the input
            expect(state.filters.users).toEqual(filterConfig.users);
            expect(state.filters.keywords).toEqual(filterConfig.keywords);
            expect(state.filters.eventTypes).toEqual(filterConfig.eventTypes);
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});

  /**
   * For any dashboard stats display, it should show events per minute, 
   * delivered count, and deduped count.
   */
  describe('Property 17: Dashboard Stats Display Completeness', () => {
    it('should display complete stats including events per minute, delivered, and deduped counts', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary number of events to process
          fc.array(
            fc.record({
              type: fc.constantFrom<EventType>('post_created', 'post_updated', 'follow_created', 'follow_updated', 'user_updated', 'profile_updated', 'profile_pinned'),
              timestamp: fc.integer({ min: Date.now() - 365 * 24 * 60 * 60 * 1000, max: Date.now() }).map(ms => new Date(ms).toISOString()),
              primaryId: fc.uuid(),
              user: fc.record({
                username: fc.string({ minLength: 1, maxLength: 20 }),
                displayName: fc.string({ minLength: 1, maxLength: 30 }),
                userId: fc.uuid()
              }),
              data: fc.record({
                username: fc.string({ minLength: 1, maxLength: 20 }),
                action: fc.string({ minLength: 1, maxLength: 20 }),
                tweetId: fc.uuid()
              })
            }),
            { minLength: 0, maxLength: 50 }
          ),
          fc.nat({ max: 20 }), // Number of deduped events
          async (events: any[], dedupedCount: number) => {
            const eventBus = new EventBus();
            const dashboard = new DashboardOutput(eventBus, { port: 0 });

            // Process events
            for (const event of events) {
              dashboard.handleEvent(event);
            }

            // Simulate deduped events
            for (let i = 0; i < dedupedCount; i++) {
              dashboard.incrementDeduped();
            }

            // Get the state
            const state = dashboard.getState();

            // Verify stats completeness
            // 1. Events per minute can be calculated from total and time
            expect(typeof state.stats.total).toBe('number');
            expect(state.stats.total).toBe(events.length);

            // 2. Delivered count should be present
            expect(typeof state.stats.delivered).toBe('number');
            expect(state.stats.delivered).toBe(events.length);

            // 3. Deduped count should be present
            expect(typeof state.stats.deduped).toBe('number');
            expect(state.stats.deduped).toBe(dedupedCount);

            // 4. Start time should be present for calculating rate
            expect(state.stats.startTime).toBeInstanceOf(Date);

            // All required fields for displaying stats are present
            expect(state.stats).toHaveProperty('total');
            expect(state.stats).toHaveProperty('delivered');
            expect(state.stats).toHaveProperty('deduped');
            expect(state.stats).toHaveProperty('startTime');
          }
        ),
        { numRuns: 1000 }
      );
    });
});

  /**
   * For any query to the /status endpoint, the response should contain 
   * connection status, total events processed, alerts sent per channel, 
   * and current active filters.
   */
  describe('Property 30: Status Endpoint Completeness', () => {
    it('should return complete status information from /status endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary state data
          fc.record({
            connectionStatus: fc.constantFrom('connected', 'disconnected', 'reconnecting'),
            eventCount: fc.nat({ max: 1000 }),
            dedupedCount: fc.nat({ max: 100 }),
            users: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
            keywords: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 })
          }),
          async (stateData: any) => {
            const eventBus = new EventBus();
            const dashboard = new DashboardOutput(eventBus, { port: 0 });

            // Set up state
            dashboard.updateConnectionStatus(stateData.connectionStatus);
            dashboard.updateFilters({
              users: stateData.users,
              keywords: stateData.keywords,
              eventTypes: []
            });

            // Simulate events
            for (let i = 0; i < stateData.eventCount; i++) {
              const mockEvent: any = {
                type: 'post_created',
                timestamp: new Date().toISOString(),
                primaryId: `id_${i}`,
                user: {
                  username: 'testuser',
                  displayName: 'Test User',
                  userId: 'user123'
                },
                data: {
                  username: 'testuser',
                  action: 'post_created',
                  tweetId: `tweet_${i}`
                }
              };
              dashboard.handleEvent(mockEvent);
            }

            for (let i = 0; i < stateData.dedupedCount; i++) {
              dashboard.incrementDeduped();
            }

            // Get status (simulating /status endpoint)
            const state = dashboard.getState();

            // Verify completeness of status information
            // 1. Connection status
            expect(state.connectionStatus).toBeDefined();
            expect(['connected', 'disconnected', 'reconnecting']).toContain(state.connectionStatus);

            // 2. Total events processed
            expect(state.stats.total).toBeDefined();
            expect(typeof state.stats.total).toBe('number');
            expect(state.stats.total).toBe(stateData.eventCount);

            // 3. Delivered and deduped counts (part of event stats)
            expect(state.stats.delivered).toBeDefined();
            expect(state.stats.deduped).toBeDefined();
            expect(state.stats.deduped).toBe(stateData.dedupedCount);

            // 4. Current active filters
            expect(state.filters).toBeDefined();
            expect(state.filters.users).toEqual(stateData.users);
            expect(state.filters.keywords).toEqual(stateData.keywords);

            // All required fields are present
            expect(state).toHaveProperty('connectionStatus');
            expect(state).toHaveProperty('stats');
            expect(state.stats).toHaveProperty('total');
            expect(state.stats).toHaveProperty('delivered');
            expect(state.stats).toHaveProperty('deduped');
            expect(state).toHaveProperty('filters');
            expect(state.filters).toHaveProperty('users');
            expect(state.filters).toHaveProperty('keywords');
          }
        ),
        { numRuns: 1000 }
      );
    });
  });

  /**
   * For any query to the /status endpoint, the response should be valid JSON 
   * that can be parsed without errors.
   */
  describe('Property 31: Status Endpoint JSON Format', () => {
    it('should return valid JSON from /status endpoint', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary state data
          fc.record({
            eventCount: fc.nat({ max: 100 }),
            dedupedCount: fc.nat({ max: 50 })
          }),
          async (stateData: any) => {
            const eventBus = new EventBus();
            const dashboard = new DashboardOutput(eventBus, { port: 0 });

            // Simulate events
            for (let i = 0; i < stateData.eventCount; i++) {
              const mockEvent: any = {
                type: 'post_created',
                timestamp: new Date().toISOString(),
                primaryId: `id_${i}`,
                user: {
                  username: 'testuser',
                  displayName: 'Test User',
                  userId: 'user123'
                },
                data: {
                  username: 'testuser',
                  action: 'post_created',
                  tweetId: `tweet_${i}`
                }
              };
              dashboard.handleEvent(mockEvent);
            }

            for (let i = 0; i < stateData.dedupedCount; i++) {
              dashboard.incrementDeduped();
            }

            // Get state and serialize to JSON (simulating /status endpoint response)
            const state = dashboard.getState();
            const jsonString = JSON.stringify(state);

            // Verify it's valid JSON by parsing it
            let parsed: any;
            expect(() => {
              parsed = JSON.parse(jsonString);
            }).not.toThrow();

            // Verify parsed object matches original
            expect(parsed).toBeDefined();
            expect(parsed!.stats.total).toBe(stateData.eventCount);
            expect(parsed!.stats.deduped).toBe(stateData.dedupedCount);

            // Verify JSON contains expected structure
            expect(typeof jsonString).toBe('string');
            expect(jsonString.length).toBeGreaterThan(0);
            expect(jsonString.startsWith('{')).toBe(true);
            expect(jsonString.endsWith('}')).toBe(true);
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
