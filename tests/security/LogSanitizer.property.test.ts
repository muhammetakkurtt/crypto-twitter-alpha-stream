/**
 * Property-based tests for LogSanitizer
 */

import * as fc from 'fast-check';
import { LogSanitizer } from '../../src/utils/LogSanitizer';

describe('LogSanitizer - Property Tests', () => {
  beforeEach(() => {
    // Clear any previously registered sensitive data
    LogSanitizer.clear();
  });

  describe('Property 32: Token Secrecy in Logs', () => {
    /**
     * For any log output (console, file, or monitoring), the Apify token 
     * should not appear in plain text.
     * 
     * This property verifies that:
     * 1. Any registered sensitive value is replaced with [REDACTED]
     * 2. The sanitization works for tokens embedded in various contexts
     * 3. Multiple occurrences of the same token are all sanitized
     */
    it('should sanitize any registered token from log messages', () => {
      fc.assert(
        fc.property(
          // Generate arbitrary tokens (alphanumeric strings of reasonable length)
          fc.string({ minLength: 10, maxLength: 50 })
            .filter(s => s.trim().length >= 10),
          // Generate arbitrary log message contexts
          fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
          (token: string, messageParts: string[]) => {
            // Register the token as sensitive
            LogSanitizer.registerSensitiveValue(token);

            // Create various log messages containing the token
            const messages = [
              `Token: ${token}`,
              `Using token ${token} for authentication`,
              `${token}`,
              `Error with token: ${token}`,
              `${messageParts.join(' ')} ${token} ${messageParts.join(' ')}`,
              `Multiple occurrences: ${token} and ${token} again`,
            ];

            // Verify all messages are sanitized
            for (const message of messages) {
              const sanitized = LogSanitizer.sanitize(message);
              
              // The token should not appear in the sanitized message
              expect(sanitized).not.toContain(token);
              
              // The sanitized message should contain [REDACTED]
              if (message.includes(token)) {
                expect(sanitized).toContain('[REDACTED]');
              }
            }

            // Clear for next iteration
            LogSanitizer.clear();
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should sanitize tokens matching registered patterns', () => {
      fc.assert(
        fc.property(
          // Generate Apify-style tokens
          fc.tuple(
            fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
            fc.string()
          ),
          ([tokenSuffix, context]: [string, string]) => {
            const apifyToken = `apify_${tokenSuffix}`;
            
            // Register pattern for Apify tokens
            LogSanitizer.registerPattern(/apify_[a-zA-Z0-9_-]+/gi);

            const message = `${context} Using token ${apifyToken} for API calls`;
            const sanitized = LogSanitizer.sanitize(message);

            // The Apify token should not appear in the sanitized message
            expect(sanitized).not.toContain(apifyToken);
            expect(sanitized).toContain('[REDACTED]');

            // Clear for next iteration
            LogSanitizer.clear();
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should sanitize Telegram bot tokens matching pattern', () => {
      fc.assert(
        fc.property(
          // Generate Telegram-style bot tokens (bot<digits>:<alphanumeric>)
          fc.tuple(
            fc.integer({ min: 100000000, max: 9999999999 }),
            fc.string({ minLength: 20, maxLength: 40 })
              .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
            fc.string()
          ),
          ([botId, tokenPart, context]: [number, string, string]) => {
            const telegramToken = `bot${botId}:${tokenPart}`;
            
            // Register pattern for Telegram bot tokens
            LogSanitizer.registerPattern(/bot[0-9]+:[a-zA-Z0-9_-]+/gi);

            const message = `${context} Telegram bot token: ${telegramToken}`;
            const sanitized = LogSanitizer.sanitize(message);

            // The Telegram token should not appear in the sanitized message
            expect(sanitized).not.toContain(telegramToken);
            expect(sanitized).toContain('[REDACTED]');

            // Clear for next iteration
            LogSanitizer.clear();
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should handle multiple different tokens in the same message', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => s.trim().length >= 10),
            { minLength: 2, maxLength: 5 }
          ),
          (tokens: string[]) => {
            // Register all tokens as sensitive
            tokens.forEach(token => LogSanitizer.registerSensitiveValue(token));

            // Create a message with all tokens
            const message = `Tokens: ${tokens.join(', ')}`;
            const sanitized = LogSanitizer.sanitize(message);

            // None of the tokens should appear in the sanitized message
            for (const token of tokens) {
              expect(sanitized).not.toContain(token);
            }

            // Should contain [REDACTED] for each token
            const redactedCount = (sanitized.match(/\[REDACTED\]/g) || []).length;
            expect(redactedCount).toBeGreaterThanOrEqual(tokens.length);

            // Clear for next iteration
            LogSanitizer.clear();
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should preserve non-sensitive parts of the message', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.string({ minLength: 5 }),
            fc.string({ minLength: 10, maxLength: 30 })
              .filter(s => s.trim().length >= 10),
            fc.string({ minLength: 5 })
          ),
          ([prefix, token, suffix]: [string, string, string]) => {
            // Ensure prefix and suffix don't contain the token
            fc.pre(!prefix.includes(token) && !suffix.includes(token));

            LogSanitizer.registerSensitiveValue(token);

            const message = `${prefix} ${token} ${suffix}`;
            const sanitized = LogSanitizer.sanitize(message);

            // Non-sensitive parts should be preserved
            expect(sanitized).toContain(prefix);
            expect(sanitized).toContain(suffix);
            
            // Token should be redacted
            expect(sanitized).not.toContain(token);
            expect(sanitized).toContain('[REDACTED]');

            // Clear for next iteration
            LogSanitizer.clear();
          }
        ),
        { numRuns: 1000 }
      );
    });
  });
});
