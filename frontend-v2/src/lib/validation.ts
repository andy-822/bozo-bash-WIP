/**
 * Security utilities for input validation
 */

/**
 * Validates that an ID is a positive integer and safe to use in database queries
 * Prevents SQL injection through parameter validation
 */
export function validateId(id: string | null | undefined, fieldName = 'ID'): { isValid: boolean; errorMessage?: string } {
  if (!id) {
    return { isValid: false, errorMessage: `${fieldName} is required` };
  }

  // Check if it's a valid positive integer
  if (!/^\d+$/.test(id)) {
    return { isValid: false, errorMessage: `Invalid ${fieldName} format` };
  }

  const numericId = parseInt(id, 10);

  // Ensure it's a positive number and within safe integer range
  if (numericId <= 0 || numericId > Number.MAX_SAFE_INTEGER) {
    return { isValid: false, errorMessage: `Invalid ${fieldName} value` };
  }

  return { isValid: true };
}

/**
 * Validates email format
 */
export function validateEmail(email: string): { isValid: boolean; errorMessage?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    return { isValid: false, errorMessage: 'Email is required' };
  }

  if (!emailRegex.test(email)) {
    return { isValid: false, errorMessage: 'Invalid email format' };
  }

  // Additional length check to prevent extremely long emails
  if (email.length > 254) {
    return { isValid: false, errorMessage: 'Email address too long' };
  }

  return { isValid: true };
}

/**
 * Validates that a string contains only safe characters (alphanumeric, spaces, basic punctuation)
 * Useful for names, descriptions, etc.
 */
export function validateSafeString(str: string, fieldName = 'field', maxLength = 255): { isValid: boolean; errorMessage?: string } {
  if (!str) {
    return { isValid: false, errorMessage: `${fieldName} is required` };
  }

  if (str.length > maxLength) {
    return { isValid: false, errorMessage: `${fieldName} must be ${maxLength} characters or less` };
  }

  // Allow alphanumeric, spaces, and common punctuation
  const safeCharPattern = /^[a-zA-Z0-9\s\-_.,!?()]+$/;

  if (!safeCharPattern.test(str)) {
    return { isValid: false, errorMessage: `${fieldName} contains invalid characters` };
  }

  return { isValid: true };
}

/**
 * Safely decode base64 and validate the structure
 */
export function decodeInviteCode(inviteCode: string): { isValid: boolean; leagueId?: string; errorMessage?: string } {
  try {
    const decoded = atob(inviteCode);
    const [leagueId] = decoded.split(':');

    const validation = validateId(leagueId, 'League ID');
    if (!validation.isValid) {
      return { isValid: false, errorMessage: 'Invalid invite link' };
    }

    return { isValid: true, leagueId };
  } catch {
    return { isValid: false, errorMessage: 'Invalid invite link format' };
  }
}

/**
 * Validates a week number (1-53)
 */
export function validateWeek(week: string | null | undefined): { isValid: boolean; errorMessage?: string } {
  if (!week) {
    return { isValid: false, errorMessage: 'Week is required' };
  }

  if (!/^\d+$/.test(week)) {
    return { isValid: false, errorMessage: 'Invalid week format' };
  }

  const weekNum = parseInt(week, 10);
  if (weekNum < 1 || weekNum > 53) {
    return { isValid: false, errorMessage: 'Week must be between 1 and 53' };
  }

  return { isValid: true };
}

/**
 * Validates multiple IDs from request body
 */
export function validateRequestBody(body: Record<string, unknown>, requiredFields: { [key: string]: 'id' | 'string' | 'email' }): { isValid: boolean; errorMessage?: string } {
  for (const [field, type] of Object.entries(requiredFields)) {
    const value = body[field];

    if (type === 'id') {
      const validation = validateId(value as string, field);
      if (!validation.isValid) {
        return validation;
      }
    } else if (type === 'email') {
      const validation = validateEmail(value as string);
      if (!validation.isValid) {
        return validation;
      }
    } else if (type === 'string') {
      const validation = validateSafeString(value as string, field);
      if (!validation.isValid) {
        return validation;
      }
    }
  }

  return { isValid: true };
}