/**
 * LogSanitizer - Utility for sanitizing sensitive information from logs
 */

export class LogSanitizer {
  private static sensitivePatterns: RegExp[] = [];
  private static sensitiveValues: Set<string> = new Set();

  /**
   * Register a sensitive value to be sanitized from logs
   */
  static registerSensitiveValue(value: string): void {
    if (value && value.trim().length > 0) {
      this.sensitiveValues.add(value);
    }
  }

  /**
   * Register a regex pattern to match sensitive data
   */
  static registerPattern(pattern: RegExp): void {
    this.sensitivePatterns.push(pattern);
  }

  /**
   * Sanitize a message by replacing sensitive values with [REDACTED]
   */
  static sanitize(message: string): string {
    if (!message) {
      return message;
    }

    let sanitized = message;

    // Replace registered sensitive values
    for (const value of this.sensitiveValues) {
      if (value.length > 0) {
        // Escape special regex characters in the value
        const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedValue, 'g');
        sanitized = sanitized.replace(regex, '[REDACTED]');
      }
    }

    // Apply registered patterns
    for (const pattern of this.sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    return sanitized;
  }

  /**
   * Clear all registered sensitive values and patterns
   */
  static clear(): void {
    this.sensitiveValues.clear();
    this.sensitivePatterns = [];
  }

  /**
   * Wrap console methods to automatically sanitize output
   */
  static wrapConsole(): void {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    console.log = (...args: any[]) => {
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'string' ? this.sanitize(arg) : arg
      );
      originalLog.apply(console, sanitizedArgs);
    };

    console.warn = (...args: any[]) => {
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'string' ? this.sanitize(arg) : arg
      );
      originalWarn.apply(console, sanitizedArgs);
    };

    console.error = (...args: any[]) => {
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'string' ? this.sanitize(arg) : arg
      );
      originalError.apply(console, sanitizedArgs);
    };

    console.info = (...args: any[]) => {
      const sanitizedArgs = args.map(arg => 
        typeof arg === 'string' ? this.sanitize(arg) : arg
      );
      originalInfo.apply(console, sanitizedArgs);
    };
  }
}
