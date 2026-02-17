/**
 * Backend Integration Tests
 * Tests the integration between backend and Svelte frontend
 * Updated for WebSocket (WSS) protocol
 */

import { DashboardOutput } from '../../src/outputs/DashboardOutput';
import { EventBus } from '../../src/eventbus/EventBus';
import io from 'socket.io-client';
import * as http from 'http';
import * as path from 'path';

describe('Backend Integration with Svelte Frontend', () => {
  let dashboardOutput: DashboardOutput;
  let eventBus: EventBus;
  let socket: ReturnType<typeof io>;
  const TEST_PORT = 3099; // Use different port for testing

  beforeAll(async () => {
    // Initialize EventBus and DashboardOutput
    eventBus = new EventBus();
    dashboardOutput = new DashboardOutput(eventBus, {
      port: TEST_PORT,
      staticPath: path.join(__dirname, '../../frontend/build')
    });

    // Start the dashboard
    await dashboardOutput.start();
    
    // Wait a bit for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
    if (dashboardOutput) {
      await dashboardOutput.stop();
    }
  });

  afterEach(() => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
  });

  describe('Static File Serving', () => {
    it('should serve index.html from frontend/build', (done) => {
      http.get(`http://localhost:${TEST_PORT}/`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('text/html');
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          expect(data).toContain('<!doctype html>');
          expect(data).toContain('sveltekit');
          done();
        });
      }).on('error', done);
    }, 10000);

    it('should serve static assets', (done) => {
      http.get(`http://localhost:${TEST_PORT}/_app/version.json`, (res) => {
        expect(res.statusCode).toBe(200);
        done();
      }).on('error', done);
    }, 10000);

    it('should implement SPA fallback for client-side routes', (done) => {
      http.get(`http://localhost:${TEST_PORT}/some-client-route`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('text/html');
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          expect(data).toContain('<!doctype html>');
          done();
        });
      }).on('error', done);
    }, 10000);
  });

  describe('Socket.IO Connection', () => {
    it('should establish WebSocket connection', (done) => {
      socket = io(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 5000
      });

      socket.on('connect', () => {
        expect(socket.connected).toBe(true);
        expect(socket.id).toBeDefined();
        done();
      });

      socket.on('connect_error', (error: Error) => {
        done(error);
      });
    }, 10000);

    it('should receive initial state on connection', (done) => {
      socket = io(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 5000
      });

      socket.on('state', (state: any) => {
        expect(state).toBeDefined();
        expect(state.events).toBeInstanceOf(Array);
        expect(state.activeUsers).toBeInstanceOf(Array);
        expect(state.connectionStatus).toBeDefined();
        expect(state.stats).toBeDefined();
        expect(state.filters).toBeDefined();
        done();
      });

      socket.on('connect_error', (error: Error) => {
        done(error);
      });
    }, 10000);

    it('should broadcast events to connected clients', (done) => {
      socket = io(`http://localhost:${TEST_PORT}`, {
        transports: ['websocket'],
        reconnection: false,
        timeout: 5000
      });

      socket.on('connect', () => {
        // Publish a test event to the dashboard channel
        const testEvent: any = {
          primaryId: 'test-123',
          type: 'post_created',
          user: {
            id: 'user-1',
            username: 'testuser',
            profile: {
              name: 'Test User',
              avatar: 'https://example.com/avatar.jpg'
            }
          },
          data: {
            tweet: {
              id: 'tweet-123',
              body: { text: 'Test tweet' },
              author: {
                handle: 'testuser',
                profile: {
                  name: 'Test User',
                  avatar: 'https://example.com/avatar.jpg'
                }
              }
            }
          },
          timestamp: new Date()
        };

        socket.on('event', (event: any) => {
          expect(event).toBeDefined();
          expect(event.type).toBe('post_created');
          expect(event.user.username).toBe('testuser');
          done();
        });

        // Publish event after a short delay
        setTimeout(() => {
          eventBus.publish('dashboard', testEvent);
        }, 100);
      });

      socket.on('connect_error', (error: Error) => {
        done(error);
      });
    }, 10000);
  });

  describe('API Endpoints', () => {
    it('should serve /status endpoint', (done) => {
      http.get(`http://localhost:${TEST_PORT}/status`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const status = JSON.parse(data);
          expect(status.connection).toBeDefined();
          expect(status.events).toBeDefined();
          done();
        });
      }).on('error', done);
    }, 10000);

    it('should serve /api/state endpoint', (done) => {
      http.get(`http://localhost:${TEST_PORT}/api/state`, (res) => {
        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toContain('application/json');
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          const state = JSON.parse(data);
          expect(state.events).toBeInstanceOf(Array);
          expect(state.activeUsers).toBeInstanceOf(Array);
          expect(state.connectionStatus).toBeDefined();
          expect(state.stats).toBeDefined();
          expect(state.filters).toBeDefined();
          done();
        });
      }).on('error', done);
    }, 10000);
  });
});
