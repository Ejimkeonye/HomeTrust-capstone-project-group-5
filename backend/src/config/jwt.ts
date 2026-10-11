import dotenv from 'dotenv';

dotenv.config();

/** JWTs must use a provisioned secret; there is no insecure default. */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error('JWT_SECRET must be configured in the runtime environment');
  }
  return secret;
}
