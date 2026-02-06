/**
 * Unit tests for UserFilterValidator
 */

import { UserFilterValidator, ValidationResult } from '../../src/validation/UserFilterValidator';
import { ActiveUsersFetcher } from '../../src/activeusers/ActiveUsersFetcher';

// Mock ActiveUsersFetcher
jest.mock('../../src/activeusers/ActiveUsersFetcher');

describe('UserFilterValidator - Unit Tests', () => {
  let mockActiveUsersFetcher: jest.Mocked<ActiveUsersFetcher>;
  let validator: UserFilterValidator;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create mock ActiveUsersFetcher
    mockActiveUsersFetcher = {
      fetch: jest.fn(),
    } as any;

    validator = new UserFilterValidator(mockActiveUsersFetcher);

    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  describe('validate()', () => {
    it('should return valid result with empty user list', async () => {
      const result = await validator.validate([]);

      expect(result).toEqual({
        valid: true,
        invalidUsers: [],
        validUsers: []
      });
      expect(mockActiveUsersFetcher.fetch).not.toHaveBeenCalled();
    });

    it('should return valid result with all valid users', async () => {
      const activeUsers = ['elonmusk', 'vitalikbuterin', 'cz_binance'];
      mockActiveUsersFetcher.fetch.mockResolvedValue(activeUsers);

      const configuredUsers = ['elonmusk', 'vitalikbuterin'];
      const result = await validator.validate(configuredUsers);

      expect(result.valid).toBe(true);
      expect(result.invalidUsers).toEqual([]);
      expect(result.validUsers).toEqual(['elonmusk', 'vitalikbuterin']);
      expect(result.sampleActiveUsers).toEqual(activeUsers.slice(0, 10));
      expect(mockActiveUsersFetcher.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return invalid result with some invalid users', async () => {
      const activeUsers = ['elonmusk', 'vitalikbuterin', 'cz_binance'];
      mockActiveUsersFetcher.fetch.mockResolvedValue(activeUsers);

      const configuredUsers = ['elonmusk', 'invaliduser', 'vitalikbuterin'];
      const result = await validator.validate(configuredUsers);

      expect(result.valid).toBe(false);
      expect(result.invalidUsers).toEqual(['invaliduser']);
      expect(result.validUsers).toEqual(['elonmusk', 'vitalikbuterin']);
      expect(result.sampleActiveUsers).toEqual(activeUsers.slice(0, 10));
    });

    it('should return invalid result with all invalid users', async () => {
      const activeUsers = ['elonmusk', 'vitalikbuterin', 'cz_binance'];
      mockActiveUsersFetcher.fetch.mockResolvedValue(activeUsers);

      const configuredUsers = ['invaliduser1', 'invaliduser2'];
      const result = await validator.validate(configuredUsers);

      expect(result.valid).toBe(false);
      expect(result.invalidUsers).toEqual(['invaliduser1', 'invaliduser2']);
      expect(result.validUsers).toEqual([]);
      expect(result.sampleActiveUsers).toEqual(activeUsers.slice(0, 10));
    });

    it('should handle case-insensitive username comparison', async () => {
      const activeUsers = ['elonmusk', 'vitalikbuterin'];
      mockActiveUsersFetcher.fetch.mockResolvedValue(activeUsers);

      const configuredUsers = ['ElonMusk', 'VITALIKBUTERIN'];
      const result = await validator.validate(configuredUsers);

      expect(result.valid).toBe(true);
      expect(result.invalidUsers).toEqual([]);
      expect(result.validUsers).toEqual(['ElonMusk', 'VITALIKBUTERIN']);
    });

    it('should return only first 10 active users as sample', async () => {
      const activeUsers = Array.from({ length: 20 }, (_, i) => `user${i}`);
      mockActiveUsersFetcher.fetch.mockResolvedValue(activeUsers);

      const configuredUsers = ['user0'];
      const result = await validator.validate(configuredUsers);

      expect(result.sampleActiveUsers).toHaveLength(10);
      expect(result.sampleActiveUsers).toEqual(activeUsers.slice(0, 10));
    });

    it('should handle fetch failure gracefully', async () => {
      mockActiveUsersFetcher.fetch.mockRejectedValue(new Error('Network error'));

      const configuredUsers = ['elonmusk', 'vitalikbuterin'];
      const result = await validator.validate(configuredUsers);

      expect(result.valid).toBe(true);
      expect(result.invalidUsers).toEqual([]);
      expect(result.validUsers).toEqual(['elonmusk', 'vitalikbuterin']);
      expect(result.fetchError).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to fetch monitored users list for validation:',
        expect.any(Error)
      );
    });

    it('should handle undefined configured users', async () => {
      const result = await validator.validate(undefined as any);

      expect(result).toEqual({
        valid: true,
        invalidUsers: [],
        validUsers: []
      });
      expect(mockActiveUsersFetcher.fetch).not.toHaveBeenCalled();
    });

    it('should handle null configured users', async () => {
      const result = await validator.validate(null as any);

      expect(result).toEqual({
        valid: true,
        invalidUsers: [],
        validUsers: []
      });
      expect(mockActiveUsersFetcher.fetch).not.toHaveBeenCalled();
    });
  });

  describe('logValidationWarnings()', () => {
    it('should not log warnings for valid result', () => {
      const result: ValidationResult = {
        valid: true,
        invalidUsers: [],
        validUsers: ['elonmusk', 'vitalikbuterin'],
        sampleActiveUsers: ['elonmusk', 'vitalikbuterin', 'cz_binance']
      };

      validator.logValidationWarnings(result);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should log warnings for invalid users', () => {
      const result: ValidationResult = {
        valid: false,
        invalidUsers: ['invaliduser1', 'invaliduser2'],
        validUsers: ['elonmusk'],
        sampleActiveUsers: ['elonmusk', 'vitalikbuterin', 'cz_binance']
      };

      validator.logValidationWarnings(result);

      expect(consoleWarnSpy).toHaveBeenCalledWith('⚠️  WARNING: User filter validation notice!');
      expect(consoleWarnSpy).toHaveBeenCalledWith('');
      expect(consoleWarnSpy).toHaveBeenCalledWith('The following usernames are NOT in the returned monitored users list:');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  invaliduser1, invaliduser2');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Note: The actor may monitor additional users beyond this list.');
      expect(consoleWarnSpy).toHaveBeenCalledWith('If these users are monitored by the actor, you WILL receive their events.');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Valid configured users (confirmed in list):');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  elonmusk');
      expect(consoleWarnSpy).toHaveBeenCalledWith('Sample of returned monitored users:');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  elonmusk, vitalikbuterin, cz_binance');
      expect(consoleWarnSpy).toHaveBeenCalledWith('To see the full list of monitored users, visit:');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  /active-users endpoint');
    });

    it('should log "None" when no valid users configured', () => {
      const result: ValidationResult = {
        valid: false,
        invalidUsers: ['invaliduser1', 'invaliduser2'],
        validUsers: [],
        sampleActiveUsers: ['elonmusk', 'vitalikbuterin']
      };

      validator.logValidationWarnings(result);

      expect(consoleWarnSpy).toHaveBeenCalledWith('  None');
    });

    it('should log fetch error warning', () => {
      const result: ValidationResult = {
        valid: true,
        invalidUsers: [],
        validUsers: ['elonmusk'],
        fetchError: true
      };

      validator.logValidationWarnings(result);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  WARNING: Could not validate user filters (monitored users list unavailable)'
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith('Proceeding with configured filters...');
    });

    it('should not log invalid user warnings when valid is true', () => {
      const result: ValidationResult = {
        valid: true,
        invalidUsers: [],
        validUsers: ['elonmusk'],
        sampleActiveUsers: ['elonmusk', 'vitalikbuterin']
      };

      validator.logValidationWarnings(result);

      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Invalid user filters detected')
      );
    });

    it('should handle missing sampleActiveUsers gracefully', () => {
      const result: ValidationResult = {
        valid: false,
        invalidUsers: ['invaliduser'],
        validUsers: ['elonmusk'],
        sampleActiveUsers: undefined
      };

      validator.logValidationWarnings(result);

      expect(consoleWarnSpy).toHaveBeenCalledWith('Sample of returned monitored users:');
      expect(consoleWarnSpy).toHaveBeenCalledWith('  undefined');
    });
  });
});
