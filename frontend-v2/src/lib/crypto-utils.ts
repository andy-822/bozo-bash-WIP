import { randomBytes } from 'crypto';

export function generateSecureInviteCode(): string {
  // Generate 16 random bytes and convert to base64url
  const buffer = randomBytes(16);
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function generateSecureToken(length: number = 32): string {
  // Generate cryptographically secure random token
  const buffer = randomBytes(length);
  return buffer.toString('hex');
}