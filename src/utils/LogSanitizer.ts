/**
 * LogSanitizer - Utility for sanitizing sensitive information from logs
 */

export class LogSanitizer {
  private static sensitivePatterns: RegExp[] = [];
  private static sensitiveValues: Set<string> = new Set();
  private static isConsoleWrapped: boolean = false;

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
   * Sanitize any value (string, object, array, error, etc.)
   * Handles circular references safely
   */
  static sanitizeAny(value: any, seen: WeakSet<object> = new WeakSet()): any {
    // Handle primitives and null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return this.sanitize(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'function') {
      return '[Function]';
    }

    if (typeof value === 'symbol') {
      return value.toString();
    }

    // Handle circular references
    if (typeof value === 'object') {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }

    // Handle Error objects
    if (value instanceof Error) {
      const sanitizedError: any = {
        name: value.name,
        message: this.sanitize(value.message),
      };

      if (value.stack) {
        sanitizedError.stack = this.sanitize(value.stack);
      }

      // Sanitize any additional properties on the error
      for (const key of Object.keys(value)) {
        if (key !== 'name' && key !== 'message' && key !== 'stack') {
          sanitizedError[key] = this.sanitizeAny((value as any)[key], seen);
        }
      }

      return sanitizedError;
    }

    // Handle Arrays
    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeAny(item, seen));
    }

    // Handle plain objects
    if (typeof value === 'object') {
      const sanitizedObj: any = {};
      
      for (const key of Object.keys(value)) {
        sanitizedObj[key] = this.sanitizeAny(value[key], seen);
      }

      return sanitizedObj;
    }

    return value;
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
   * This method is idempotent - calling it multiple times has no additional effect
   */
  static wrapConsole(): void {
    // Check if already wrapped, return early if so
    if (this.isConsoleWrapped) {
      return;
    }

    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    console.log = (...args: any[]) => {
      const sanitizedArgs = args.map(arg => this.sanitizeAny(arg));
      originalLog.apply(console, sanitizedArgs);
    };

    console.warn = (...args: any[]) => {
      const sanitizedArgs = args.map(arg => this.sanitizeAny(arg));
      originalWarn.apply(console, sanitizedArgs);
    };

    console.error = (...args: any[]) => {
      const sanitizedArgs = args.map(arg => this.sanitizeAny(arg));
      originalError.apply(console, sanitizedArgs);
    };

    console.info = (...args: any[]) => {
      const sanitizedArgs = args.map(arg => this.sanitizeAny(arg));
      originalInfo.apply(console, sanitizedArgs);
    };

    // Mark as wrapped
    this.isConsoleWrapped = true;
  }
}
