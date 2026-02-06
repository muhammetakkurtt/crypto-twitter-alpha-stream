import { ActiveUsersFetcher } from '../activeusers/ActiveUsersFetcher';

/**
 * Result of user filter validation
 */
export interface ValidationResult {
  valid: boolean;
  invalidUsers: string[];
  validUsers: string[];
  sampleActiveUsers?: string[];
  fetchError?: boolean;
}

/**
 * Validates user filters against the monitored users list
 */
export class UserFilterValidator {
  private activeUsersFetcher: ActiveUsersFetcher;

  constructor(activeUsersFetcher: ActiveUsersFetcher) {
    this.activeUsersFetcher = activeUsersFetcher;
  }

  /**
   * Validate configured user filters against monitored users list
   * Returns validation result with invalid usernames
   */
  async validate(configuredUsers: string[]): Promise<ValidationResult> {
    if (!configuredUsers || configuredUsers.length === 0) {
      return { valid: true, invalidUsers: [], validUsers: [] };
    }

    try {
      // Fetch monitored users list
      const activeUsers = await this.activeUsersFetcher.fetch();
      
      // Normalize active users to lowercase for case-insensitive comparison
      const activeUsersLower = activeUsers.map(user => user.toLowerCase());
      
      // Find invalid users
      const invalidUsers = configuredUsers.filter(
        user => !activeUsersLower.includes(user.toLowerCase())
      );
      
      // Find valid users
      const validUsers = configuredUsers.filter(
        user => activeUsersLower.includes(user.toLowerCase())
      );
      
      return {
        valid: invalidUsers.length === 0,
        invalidUsers,
        validUsers,
        sampleActiveUsers: activeUsers.slice(0, 10)  // First 10 for display
      };
    } catch (error) {
      // If fetch fails, return warning but allow connection
      console.warn('Failed to fetch monitored users list for validation:', error);
      return {
        valid: true,  // Assume valid if we can't validate
        invalidUsers: [],
        validUsers: configuredUsers,
        fetchError: true
      };
    }
  }

  /**
   * Log validation warnings
   */
  logValidationWarnings(result: ValidationResult): void {
    if (!result.valid && result.invalidUsers.length > 0) {
      console.warn('⚠️  WARNING: User filter validation notice!');
      console.warn('');
      console.warn('The following usernames are NOT in the returned monitored users list:');
      console.warn(`  ${result.invalidUsers.join(', ')}`);
      console.warn('');
      console.warn('Note: The actor may monitor additional users beyond this list.');
      console.warn('If these users are monitored by the actor, you WILL receive their events.');
      console.warn('');
      console.warn('Valid configured users (confirmed in list):');
      console.warn(`  ${result.validUsers.join(', ') || 'None'}`);
      console.warn('');
      console.warn('Sample of returned monitored users:');
      console.warn(`  ${result.sampleActiveUsers?.join(', ')}`);
      console.warn('');
      console.warn('To see the full list of monitored users, visit:');
      console.warn('  /active-users endpoint');
    }

    if (result.fetchError) {
      console.warn('⚠️  WARNING: Could not validate user filters (monitored users list unavailable)');
      console.warn('Proceeding with configured filters...');
    }
  }
}
