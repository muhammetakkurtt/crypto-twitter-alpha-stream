/**
 * RateLimiter - Sliding window rate limiter for alert channels
 * 
 * Limits requests to a maximum of 10 per minute using a sliding window approach.
 */

export class RateLimiter {
  private requests: number[] = []; // Timestamps of requests
  private readonly maxRequests: number;
  private readonly windowMs: number;

  /**
   * Create a new RateLimiter
   * @param maxRequests - Maximum number of requests allowed in the window (default: 10)
   * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
   */
  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a request is allowed under the rate limit
   * @returns true if the request is allowed, false if rate limited
   */
  allowRequest(): boolean {
    const now = Date.now();
    this.cleanupOldRequests(now);
    
    return this.requests.length < this.maxRequests;
  }

  /**
   * Record a request in the rate limiter
   * Should be called after allowRequest() returns true
   */
  recordRequest(): void {
    const now = Date.now();
    this.cleanupOldRequests(now);
    this.requests.push(now);
  }

  /**
   * Remove requests that are outside the sliding window
   * @param now - Current timestamp
   */
  private cleanupOldRequests(now: number): void {
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter(timestamp => timestamp > cutoff);
  }

  /**
   * Get the number of requests in the current window
   * @returns Number of requests
   */
  getRequestCount(): number {
    this.cleanupOldRequests(Date.now());
    return this.requests.length;
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
  }
}
