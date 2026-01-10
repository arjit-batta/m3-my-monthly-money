/**
 * Database utility functions for handling network failures gracefully
 */

// Result type for database operations
export type DbResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; isNetworkError: boolean };

// Check if an error is a network-related error
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('offline') ||
      message.includes('failed to fetch') ||
      message.includes('networkerror')
    );
  }
  return false;
}

// Get user-friendly error message
export function getErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.';
  }
  if (error instanceof Error) {
    // Handle specific Supabase errors
    if (error.message.includes('duplicate key')) {
      return 'This record already exists.';
    }
    if (error.message.includes('violates foreign key')) {
      return 'This record references data that no longer exists.';
    }
    if (error.message.includes('violates row-level security')) {
      return 'You do not have permission to perform this action.';
    }
    if (error.message.includes('Not authenticated')) {
      return 'Please sign in to continue.';
    }
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

// Wrap a database operation with error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>
): Promise<DbResult<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    console.error('Database operation failed:', error);
    return {
      success: false,
      error: getErrorMessage(error),
      isNetworkError: isNetworkError(error),
    };
  }
}

// Idempotency key storage (in-memory for session)
const pendingOperations = new Map<string, Promise<unknown>>();
const completedOperations = new Map<string, { result: unknown; timestamp: number }>();
const COMPLETED_CACHE_TTL = 60000; // 1 minute

// Generate idempotency key from operation parameters
export function generateIdempotencyKey(operation: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(k => `${k}:${JSON.stringify(params[k])}`)
    .join('|');
  return `${operation}:${sortedParams}`;
}

// Execute an operation with idempotency protection
export async function withIdempotency<T>(
  idempotencyKey: string,
  operation: () => Promise<T>
): Promise<T> {
  // Check if operation was recently completed
  const completed = completedOperations.get(idempotencyKey);
  if (completed && Date.now() - completed.timestamp < COMPLETED_CACHE_TTL) {
    return completed.result as T;
  }

  // Check if operation is already in progress
  const pending = pendingOperations.get(idempotencyKey);
  if (pending) {
    return pending as Promise<T>;
  }

  // Execute the operation
  const promise = operation();
  pendingOperations.set(idempotencyKey, promise);

  try {
    const result = await promise;
    completedOperations.set(idempotencyKey, { result, timestamp: Date.now() });
    return result;
  } finally {
    pendingOperations.delete(idempotencyKey);
  }
}

// Clear completed operations cache (useful for testing or manual refresh)
export function clearIdempotencyCache(): void {
  completedOperations.clear();
}

// Retry configuration
interface RetryConfig {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

// Retry an operation with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 10000 } = config;
  
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry on non-network errors (they likely won't succeed)
      if (!isNetworkError(error)) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
