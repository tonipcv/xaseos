const LEGACY_ENCRYPTED_PREFIX = 'enc:v1:';
const JWT_SECRET = process.env.JWT_SECRET;

function requireJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be set');
  }
  return JWT_SECRET;
}

export function encryptSecret(value: string): string {
  return value.trim();
}

export function isLegacyEncryptedSecret(value: string): boolean {
  return value.trim().startsWith(LEGACY_ENCRYPTED_PREFIX);
}

export function decryptSecret(value: string): string {
  const trimmed = value.trim();

  if (isLegacyEncryptedSecret(trimmed)) {
    throw new Error(
      'Legacy encrypted API key found. Re-save the key in Settings to migrate it to plaintext storage.'
    );
  }

  return trimmed;
}

export function getJwtSecretKey(): Uint8Array {
  return new TextEncoder().encode(requireJwtSecret());
}
