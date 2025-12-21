/**
 * Logging utilities
 * Provides structured logging for Terraflow CLI
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * ANSI color codes for terminal output
 */
const Colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
};

/**
 * Logger class for Terraflow CLI
 * Supports different log levels and colored output
 */
export class Logger {
  private static level: LogLevel = 'info';
  private static colorEnabled = true;

  /**
   * Set the log level
   * @param level - Log level to use
   */
  static setLevel(level: LogLevel): void {
    Logger.level = level;
  }

  /**
   * Enable or disable colored output
   * @param enabled - Whether to enable colors
   */
  static setColor(enabled: boolean): void {
    Logger.colorEnabled = enabled;
  }

  /**
   * Check if a message should be logged at the current level
   * @param messageLevel - Level of the message
   * @returns Whether the message should be logged
   */
  private static shouldLog(messageLevel: LogLevel): boolean {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug'];
    const currentIndex = levels.indexOf(Logger.level);
    const messageIndex = levels.indexOf(messageLevel);
    return messageIndex <= currentIndex;
  }

  /**
   * Format a message with color if enabled
   * @param message - Message to format
   * @param colorName - Color name (red, yellow, blue, green, gray)
   * @returns Formatted message
   */
  private static format(message: string, colorName: 'red' | 'yellow' | 'blue' | 'green' | 'gray'): string {
    if (!Logger.colorEnabled) {
      return message;
    }
    const color = Colors[colorName];
    return `${color}${message}${Colors.reset}`;
  }

  /**
   * Log an error message
   * @param message - Error message
   * @param args - Additional arguments
   */
  static error(message: string, ...args: unknown[]): void {
    if (Logger.shouldLog('error')) {
      const formatted = Logger.format(message, 'red');
      console.error(formatted, ...args);
    }
  }

  /**
   * Log a warning message
   * @param message - Warning message
   * @param args - Additional arguments
   */
  static warn(message: string, ...args: unknown[]): void {
    if (Logger.shouldLog('warn')) {
      const formatted = Logger.format(message, 'yellow');
      console.warn(formatted, ...args);
    }
  }

  /**
   * Log an info message
   * @param message - Info message
   * @param args - Additional arguments
   */
  static info(message: string, ...args: unknown[]): void {
    if (Logger.shouldLog('info')) {
      const formatted = Logger.format(message, 'blue');
      console.info(formatted, ...args);
    }
  }

  /**
   * Log a debug message
   * @param message - Debug message
   * @param args - Additional arguments
   */
  static debug(message: string, ...args: unknown[]): void {
    if (Logger.shouldLog('debug')) {
      const formatted = Logger.format(message, 'gray');
      console.debug(formatted, ...args);
    }
  }

  /**
   * Log a success message (info level with green color)
   * @param message - Success message
   * @param args - Additional arguments
   */
  static success(message: string, ...args: unknown[]): void {
    if (Logger.shouldLog('info')) {
      const formatted = Logger.format(message, 'green');
      console.info(formatted, ...args);
    }
  }
}
