/**
 * Centralized Error Handling Utilities
 *
 * Provides consistent error handling patterns across the application
 * with graceful fallbacks and detailed logging for debugging.
 */

import { PostgrestError } from '@supabase/supabase-js';

export interface ErrorContext {
  operation: string;
  data?: unknown;
  userId?: string;
  additionalInfo?: Record<string, unknown>;
}

export interface SafeOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  fallbackUsed?: boolean;
}

/**
 * Enhanced error with context information
 */
export class ContextualError extends Error {
  public readonly context: ErrorContext;
  public readonly originalError?: Error;

  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message);
    this.name = 'ContextualError';
    this.context = context;
    this.originalError = originalError;
  }
}

/**
 * Safely execute a database operation with comprehensive error handling
 */
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  fallback?: () => Promise<T>
): Promise<SafeOperationResult<T>> {
  try {
    const result = await operation();

    // Validate result is not null/undefined
    if (result === null || result === undefined) {
      console.warn(`Operation ${context.operation} returned null/undefined`, context);

      if (fallback) {
        console.log(`Attempting fallback for ${context.operation}`);
        const fallbackResult = await fallback();
        return {
          success: true,
          data: fallbackResult,
          fallbackUsed: true
        };
      }

      return {
        success: false,
        error: `Operation returned no data`,
        details: `${context.operation} completed but returned null/undefined`
      };
    }

    return {
      success: true,
      data: result
    };

  } catch (error) {
    console.error(`Operation ${context.operation} failed:`, error, context);

    // Try fallback if available
    if (fallback) {
      try {
        console.log(`Attempting fallback for failed operation: ${context.operation}`);
        const fallbackResult = await fallback();
        return {
          success: true,
          data: fallbackResult,
          fallbackUsed: true
        };
      } catch (fallbackError) {
        console.error(`Fallback also failed for ${context.operation}:`, fallbackError);
        // Continue to main error handling below
      }
    }

    const errorMessage = extractErrorMessage(error);
    const errorDetails = extractErrorDetails(error);

    return {
      success: false,
      error: errorMessage,
      details: errorDetails
    };
  }
}

/**
 * Validate that a database result has required fields
 */
export function validateDbResult<T extends Record<string, unknown>>(
  data: T | null,
  requiredFields: (keyof T)[],
  context: ErrorContext
): SafeOperationResult<T> {
  if (!data) {
    return {
      success: false,
      error: 'No data returned',
      details: `${context.operation} returned null/undefined`
    };
  }

  const missingFields = requiredFields.filter(field =>
    data[field] === null || data[field] === undefined
  );

  if (missingFields.length > 0) {
    return {
      success: false,
      error: 'Invalid data structure',
      details: `Missing required fields: ${missingFields.join(', ')} in ${context.operation}`
    };
  }

  return {
    success: true,
    data
  };
}

/**
 * Extract meaningful error message from various error types
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof ContextualError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    // Handle Supabase PostgrestError
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }

    // Handle other structured errors
    if ('error' in error && typeof error.error === 'string') {
      return error.error;
    }
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
}

/**
 * Extract detailed error information for logging/debugging
 */
export function extractErrorDetails(error: unknown): string {
  if (error instanceof ContextualError) {
    return `Context: ${JSON.stringify(error.context)}, Original: ${error.originalError?.stack || 'none'}`;
  }

  if (error instanceof Error) {
    return error.stack || error.message;
  }

  if (typeof error === 'object' && error !== null) {
    // Handle Supabase PostgrestError with detailed info
    const postgrestError = error as PostgrestError;
    if (postgrestError.code && postgrestError.details) {
      return `Code: ${postgrestError.code}, Details: ${postgrestError.details}, Hint: ${postgrestError.hint || 'none'}`;
    }

    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return 'Non-serializable error object';
    }
  }

  return typeof error === 'string' ? error : String(error);
}

/**
 * Create a safe wrapper for database records that might be malformed
 */
export function createSafeDbRecord<T extends Record<string, unknown>>(
  data: unknown,
  requiredFields: (keyof T)[],
  defaults: Partial<T> = {}
): T | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const record = { ...defaults, ...data } as T;

  // Check if all required fields are present and valid
  for (const field of requiredFields) {
    if (record[field] === null || record[field] === undefined) {
      console.warn(`Missing required field ${String(field)} in database record:`, data);
      return null;
    }
  }

  return record;
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
  context?: ErrorContext
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break; // Don't delay on the final attempt
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.warn(
        `Operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`,
        extractErrorMessage(error),
        context
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new ContextualError(
    `Operation failed after ${maxRetries} attempts`,
    context || { operation: 'unknown' },
    lastError instanceof Error ? lastError : undefined
  );
}