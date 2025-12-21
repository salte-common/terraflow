/**
 * Custom error classes for Terraflow
 */

/**
 * Base error class for Terraflow errors
 */
export class TerraflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error - thrown when validation fails
 */
export class ValidationError extends TerraflowError {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Configuration error - thrown when configuration is invalid
 */
export class ConfigError extends TerraflowError {
  constructor(message: string) {
    super(message);
  }
}
