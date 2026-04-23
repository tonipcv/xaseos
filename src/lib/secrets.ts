import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ENCRYPTED_PREFIX = 'enc:v1';
const JWT_SECRET = process.env.JWT_SECRET;

function requireJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set');
  }
  return JWT_SECRET;
}

function deriveKey(): Buffer {
  return createHash('sha256').update(requireJwtSecret()).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(`${ENCRYPTED_PREFIX}:`)) {
    return value;
  }

  const [, ivB64, authTagB64, ciphertextB64] = value.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted secret format');
  }

  const decipher = createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(requireJwtSecret());
}
