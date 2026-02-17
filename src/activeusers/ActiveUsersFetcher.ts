import http from 'http';
import https from 'https';
import { WSSClient } from '../ws/WSSClient';

/**
 * Configuration for ActiveUsersFetcher
 */
export interface ActiveUsersFetcherConfig {
  baseUrl: string;
  token: string;
  refreshInterval?: number; // milliseconds, default 4 minutes
}

/**
 * Fetches and caches the list of active Twitter users from the Apify actor
 */
export class ActiveUsersFetcher {
  private cachedUsers: string[] = [];
  private refreshTimer?: NodeJS.Timeout;
  private config: ActiveUsersFetcherConfig;

  constructor(config: ActiveUsersFetcherConfig) {
    this.config = {
      ...config,
      refreshInterval: config.refreshInterval ?? 4 * 60 * 1000, // Default 4 minutes
    };
  }

  /**
   * Fetch active users from the /active-users endpoint
   */
  async fetch(): Promise<string[]> {
    try {
      // Convert baseUrl to HTTP format (in case it's ws/wss)
      const httpUrl = WSSClient.toHttpUrl(this.config.baseUrl);
      const url = new URL('/active-users', httpUrl);
      
      const users = await this.makeHttpRequest(url.toString());
      
      // Update cache with fresh data
      this.cachedUsers = users;
      
      return users;
    } catch (error) {
      // On error, fall back to cached list
      console.error('Failed to fetch active users, using cached list:', error);
      return this.cachedUsers;
    }
  }

  /**
   * Get cached users list without making a network request
   */
  getCached(): string[] {
    return [...this.cachedUsers];
  }

  /**
   * Start periodic refresh of active users list
   * Returns a promise that resolves after the initial fetch completes
   */
  async startPeriodicRefresh(interval?: number): Promise<void> {
    const refreshInterval = interval ?? this.config.refreshInterval!;
    
    // Clear any existing timer
    this.stopPeriodicRefresh();
    
    // Fetch immediately and wait for it to complete
    try {
      await this.fetch();
    } catch (err) {
      console.error('Initial fetch failed:', err);
    }
    
    // Set up periodic refresh
    this.refreshTimer = setInterval(() => {
      this.fetch().catch(err => {
        console.error('Periodic fetch failed:', err);
      });
    }, refreshInterval);
  }

  /**
   * Stop periodic refresh
   */
  stopPeriodicRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  /**
   * Make HTTP GET request to fetch active users
   * Dynamically selects http or https based on the URL protocol
   */
  private makeHttpRequest(url: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'Authorization': `Bearer ${this.config.token}`,
          'Accept': 'application/json',
        },
      };

      // Detect protocol from URL and use appropriate module
      const isHttps = url.startsWith('https://');
      const httpModule = isHttps ? https : http;

      httpModule.get(url, options, (res) => {
        let data = '';

        // Check status code
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          res.resume(); // Consume response to free up memory
          return;
        }

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            
            // Expect array of strings or array of objects with username field
            if (Array.isArray(parsed)) {
              const users = parsed.map(item => 
                typeof item === 'string' ? item : item.username
              ).filter(Boolean);
              resolve(users);
            } else if (parsed.usernames && Array.isArray(parsed.usernames)) {
              // Handle response format: { usernames: ["user1", "user2", ...] }
              const users = parsed.usernames.map((item: any) => 
                typeof item === 'string' ? item : item.username
              ).filter(Boolean);
              resolve(users);
            } else if (parsed.users && Array.isArray(parsed.users)) {
              const users = parsed.users.map((item: any) => 
                typeof item === 'string' ? item : item.username
              ).filter(Boolean);
              resolve(users);
            } else {
              reject(new Error('Invalid response format: expected array of users'));
            }
          } catch (error) {
            reject(new Error(`Failed to parse JSON response: ${error}`));
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }
}
