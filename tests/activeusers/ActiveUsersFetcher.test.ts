/**
 * Unit tests for ActiveUsersFetcher
 */

import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';
import { ActiveUsersFetcher } from '../../src/activeusers/ActiveUsersFetcher';

// Mock http and https modules
jest.mock('http');
jest.mock('https');

describe('ActiveUsersFetcher - Unit Tests', () => {
  let mockHttpGet: jest.Mock;
  let mockHttpsGet: jest.Mock;
  let fetcher: ActiveUsersFetcher | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockHttpGet = http.get as jest.Mock;
    mockHttpsGet = https.get as jest.Mock;
    fetcher = undefined;
  });

  afterEach(() => {
    if (fetcher) {
      fetcher.stopPeriodicRefresh();
    }
    jest.useRealTimers();
  });

  /**
   * Helper to create a mock HTTP response
   */
  function createMockResponse(statusCode: number, data: any): EventEmitter {
    const response = new EventEmitter() as any;
    response.statusCode = statusCode;
    response.statusMessage = statusCode === 200 ? 'OK' : 'Error';
    response.resume = jest.fn();

    // Emit events synchronously after a microtask
    Promise.resolve().then(() => {
      if (statusCode === 200) {
        response.emit('data', JSON.stringify(data));
      }
      response.emit('end');
    });

    return response;
  }

  describe('URL Conversion', () => {
    it('should convert ws:// URL to http:// for REST endpoint', async () => {
      const mockUsers = ['user1', 'user2'];

      mockHttpGet.mockImplementation((url: string, _options: any, callback: Function) => {
        // Verify the URL was converted from ws:// to http://
        expect(url).toBe('http://api.example.com/active-users');
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'ws://api.example.com',
        token: 'test-token',
      });

      const users = await fetcher.fetch();
      expect(users).toEqual(mockUsers);
      expect(mockHttpGet).toHaveBeenCalled();
      expect(mockHttpsGet).not.toHaveBeenCalled();
    });

    it('should convert wss:// URL to https:// for REST endpoint', async () => {
      const mockUsers = ['user1', 'user2'];

      mockHttpsGet.mockImplementation((url: string, _options: any, callback: Function) => {
        // Verify the URL was converted from wss:// to https://
        expect(url).toBe('https://api.example.com/active-users');
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'wss://api.example.com',
        token: 'test-token',
      });

      const users = await fetcher.fetch();
      expect(users).toEqual(mockUsers);
      expect(mockHttpsGet).toHaveBeenCalled();
      expect(mockHttpGet).not.toHaveBeenCalled();
    });

    it('should leave http:// URL unchanged', async () => {
      const mockUsers = ['user1', 'user2'];

      mockHttpGet.mockImplementation((url: string, _options: any, callback: Function) => {
        // Verify the URL remains http://
        expect(url).toBe('http://api.example.com/active-users');
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'http://api.example.com',
        token: 'test-token',
      });

      const users = await fetcher.fetch();
      expect(users).toEqual(mockUsers);
      expect(mockHttpGet).toHaveBeenCalled();
      expect(mockHttpsGet).not.toHaveBeenCalled();
    });

    it('should leave https:// URL unchanged', async () => {
      const mockUsers = ['user1', 'user2'];

      mockHttpsGet.mockImplementation((url: string, _options: any, callback: Function) => {
        // Verify the URL remains https://
        expect(url).toBe('https://api.example.com/active-users');
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      const users = await fetcher.fetch();
      expect(users).toEqual(mockUsers);
      expect(mockHttpsGet).toHaveBeenCalled();
      expect(mockHttpGet).not.toHaveBeenCalled();
    });
  });

  describe('Fetch and Cache', () => {
    it('should fetch users from /active-users endpoint', async () => {
      const mockUsers = ['user1', 'user2', 'user3'];

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      const users = await fetcher.fetch();

      expect(users).toEqual(mockUsers);
      expect(mockHttpsGet).toHaveBeenCalledWith(
        'https://api.example.com/active-users',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Accept': 'application/json',
          }),
        }),
        expect.any(Function)
      );
    });

    it('should cache fetched users', async () => {
      const mockUsers = ['user1', 'user2'];

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      await fetcher.fetch();
      const cached = fetcher.getCached();

      expect(cached).toEqual(mockUsers);
    });

    it('should handle response with users wrapped in object', async () => {
      const mockResponse = {
        users: ['user1', 'user2', 'user3']
      };

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        const response = createMockResponse(200, mockResponse);
        callback(response);
        return new EventEmitter();
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      const users = await fetcher.fetch();

      expect(users).toEqual(['user1', 'user2', 'user3']);
    });

    it('should handle response with usernames field (actor format)', async () => {
      const mockResponse = {
        status: 'success',
        timestamp: '2025-01-21T10:30:45.000Z',
        last_update: '2025-01-21T10:29:12.000Z',
        total_users: 3,
        usernames: ['user1', 'user2', 'user3']
      };

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        const response = createMockResponse(200, mockResponse);
        callback(response);
        return new EventEmitter();
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      const users = await fetcher.fetch();

      expect(users).toEqual(['user1', 'user2', 'user3']);
    });

    it('should handle response with user objects containing username field', async () => {
      const mockResponse = [
        { username: 'user1', id: '123' },
        { username: 'user2', id: '456' },
      ];

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        const response = createMockResponse(200, mockResponse);
        callback(response);
        return new EventEmitter();
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      const users = await fetcher.fetch();

      expect(users).toEqual(['user1', 'user2']);
    });

    it('should return empty array for getCached when no fetch has been made', () => {
      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      const cached = fetcher.getCached();

      expect(cached).toEqual([]);
    });

    it('should return a copy of cached users, not the original array', async () => {
      const mockUsers = ['user1', 'user2'];

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      await fetcher.fetch();
      const cached1 = fetcher.getCached();
      const cached2 = fetcher.getCached();

      expect(cached1).toEqual(cached2);
      expect(cached1).not.toBe(cached2); // Different array instances
    });
  });

  describe('Periodic Refresh', () => {
    it('should fetch immediately when starting periodic refresh', async () => {
      const mockUsers = ['user1', 'user2'];

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      fetcher.startPeriodicRefresh();

      // Wait for initial fetch (using microtask queue)
      await Promise.resolve();
      await Promise.resolve();

      expect(mockHttpsGet).toHaveBeenCalled();
      expect(fetcher.getCached()).toEqual(mockUsers);

      fetcher.stopPeriodicRefresh();
    });

    it('should refresh users at configured interval', async () => {
      let callCount = 0;
      const mockUsers = ['user1', 'user2'];

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        callCount++;
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
        refreshInterval: 10000, // 10 seconds
      });

      fetcher.startPeriodicRefresh();

      // Initial fetch
      await Promise.resolve();
      await Promise.resolve();
      expect(callCount).toBe(1);

      // Wait for startPeriodicRefresh to finish awaiting the initial fetch
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Advance time by 10 seconds and run timers + buffer
      jest.advanceTimersByTime(11000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(callCount).toBe(2);

      // Advance time by 10 seconds (explicitly) + buffer
      jest.advanceTimersByTime(11000);
      await Promise.resolve();
      await Promise.resolve();
      expect(callCount).toBe(3);

      fetcher.stopPeriodicRefresh();
    });

    it('should use custom interval when provided to startPeriodicRefresh', async () => {
      let callCount = 0;
      const mockUsers = ['user1'];

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        callCount++;
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
        refreshInterval: 60000, // Default 60 seconds
      });

      fetcher.startPeriodicRefresh(5000); // Override with 5 seconds

      // Initial fetch
      await Promise.resolve();
      await Promise.resolve();
      expect(callCount).toBe(1);

      // Wait for startPeriodicRefresh to finish awaiting the initial fetch
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Advance time by 5 seconds + buffer
      jest.advanceTimersByTime(5100);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve(); // Extra wait
      expect(callCount).toBe(2);

      fetcher.stopPeriodicRefresh();
    });

    it('should stop periodic refresh when stopPeriodicRefresh is called', async () => {
      let callCount = 0;
      const mockUsers = ['user1'];

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        callCount++;
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
        refreshInterval: 10000,
      });

      fetcher.startPeriodicRefresh();

      // Initial fetch
      await Promise.resolve();
      await Promise.resolve();
      expect(callCount).toBe(1);

      // Stop refresh
      fetcher.stopPeriodicRefresh();

      // Advance time - should not trigger more fetches
      jest.advanceTimersByTime(20000);
      await Promise.resolve();
      await Promise.resolve();
      expect(callCount).toBe(1);
    });

    it('should clear existing timer when starting periodic refresh again', async () => {
      const mockUsers = ['user1'];

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        const response = createMockResponse(200, mockUsers);
        callback(response);
        return new EventEmitter();
      });

      fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
        refreshInterval: 10000,
      });

      fetcher.startPeriodicRefresh();
      await Promise.resolve();
      await Promise.resolve();

      // Start again - should clear previous timer
      fetcher.startPeriodicRefresh();
      await Promise.resolve();
      await Promise.resolve();

      // Should not cause issues
      expect(fetcher.getCached()).toEqual(mockUsers);

      fetcher.stopPeriodicRefresh();
    });
  });

  describe('Error Fallback to Cache', () => {
    it('should return cached list when fetch fails', async () => {
      const mockUsers = ['user1', 'user2'];
      let shouldFail = false;

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        if (shouldFail) {
          const request = new EventEmitter();
          Promise.resolve().then(() => {
            request.emit('error', new Error('Network error'));
          });
          return request;
        } else {
          const response = createMockResponse(200, mockUsers);
          callback(response);
          return new EventEmitter();
        }
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      // First fetch succeeds
      const users1 = await fetcher.fetch();
      expect(users1).toEqual(mockUsers);

      // Second fetch fails
      shouldFail = true;
      const users2 = await fetcher.fetch();

      // Should return cached list
      expect(users2).toEqual(mockUsers);
    });

    it('should return empty array when fetch fails and no cache exists', async () => {
      mockHttpsGet.mockImplementation((_url: string, _options: any, _callback: Function) => {
        const request = new EventEmitter();
        Promise.resolve().then(() => {
          request.emit('error', new Error('Network error'));
        });
        return request;
      });

      const fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      const users = await fetcher.fetch();

      expect(users).toEqual([]);
    });

    it('should handle HTTP error status codes', async () => {
      const mockUsers = ['user1'];
      let shouldFail = false;

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        if (shouldFail) {
          const response = createMockResponse(404, null);
          callback(response);
          return new EventEmitter();
        } else {
          const response = createMockResponse(200, mockUsers);
          callback(response);
          return new EventEmitter();
        }
      });

      fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      // First fetch succeeds
      await fetcher.fetch();

      // Second fetch fails with 404
      shouldFail = true;
      const users = await fetcher.fetch();

      // Should return cached list
      expect(users).toEqual(mockUsers);
    });

    it('should handle invalid JSON response', async () => {
      const mockUsers = ['user1'];
      let shouldFail = false;

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        if (shouldFail) {
          const response = new EventEmitter() as any;
          response.statusCode = 200;
          response.statusMessage = 'OK';
          response.resume = jest.fn();

          Promise.resolve().then(() => {
            response.emit('data', 'invalid json {');
            response.emit('end');
          });

          callback(response);
          return new EventEmitter();
        } else {
          const response = createMockResponse(200, mockUsers);
          callback(response);
          return new EventEmitter();
        }
      });

      fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      // First fetch succeeds
      await fetcher.fetch();

      // Second fetch fails with invalid JSON
      shouldFail = true;
      const users = await fetcher.fetch();

      // Should return cached list
      expect(users).toEqual(mockUsers);
    });

    it('should handle invalid response format', async () => {
      const mockUsers = ['user1'];
      let shouldFail = false;

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        if (shouldFail) {
          const response = createMockResponse(200, { invalid: 'format' });
          callback(response);
          return new EventEmitter();
        } else {
          const response = createMockResponse(200, mockUsers);
          callback(response);
          return new EventEmitter();
        }
      });

      fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
      });

      // First fetch succeeds
      await fetcher.fetch();

      // Second fetch fails with invalid format
      shouldFail = true;
      const users = await fetcher.fetch();

      // Should return cached list
      expect(users).toEqual(mockUsers);
    });

    it('should continue periodic refresh even when fetch fails', async () => {
      let callCount = 0;
      const mockUsers = ['user1'];

      mockHttpsGet.mockImplementation((_url: string, _options: any, callback: Function) => {
        callCount++;
        if (callCount === 2) {
          // Second call fails
          const request = new EventEmitter();
          Promise.resolve().then(() => {
            request.emit('error', new Error('Network error'));
          });
          return request;
        } else {
          const response = createMockResponse(200, mockUsers);
          callback(response);
          return new EventEmitter();
        }
      });

      fetcher = new ActiveUsersFetcher({
        baseUrl: 'https://api.example.com',
        token: 'test-token',
        refreshInterval: 10000,
      });

      fetcher.startPeriodicRefresh();

      // Initial fetch
      await Promise.resolve();
      await Promise.resolve();
      expect(callCount).toBe(1);

      // Wait for startPeriodicRefresh to finish awaiting the initial fetch
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Second fetch (fails)
      jest.advanceTimersByTime(11000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve(); // Extra wait
      expect(callCount).toBe(2);

      // Third fetch (succeeds)
      jest.advanceTimersByTime(11000);
      await Promise.resolve();
      await Promise.resolve();
      expect(callCount).toBe(3);

      fetcher.stopPeriodicRefresh();
    });
  });
});
