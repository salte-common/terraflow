/**
 * Logging utilities
 * Provides structured logging for Terraflow CLI
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// TODO: Implement logger

export class Logger {
  /**
   * Log an error message
   */
  static error(message: string, ...args: unknown[]): void {
    // Placeholder
    console.error(message, ...args);
  }

  /**
   * Log a warning message
   */
  static warn(message: string, ...args: unknown[]): void {
    // Placeholder
    console.warn(message, ...args);
  }

  /**
   * Log an info message
   */
  static info(message: string, ...args: unknown[]): void {
    // Placeholder
    console.info(message, ...args);
  }

  /**
   * Log a debug message
   */
  static debug(message: string, ...args: unknown[]): void {
    // Placeholder
    console.debug(message, ...args);
  }
}
