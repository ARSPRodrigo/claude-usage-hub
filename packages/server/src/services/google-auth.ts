/**
 * Google ID token verification — zero external dependencies.
 * Uses Node.js built-in crypto + fetch to verify Google's JWT tokens.
 */

import { createPublicKey, createVerify } from 'node:crypto';

interface GoogleJwk {
  kid: string;
  n: string;
  e: string;
  alg: string;
  kty: string;
  use: string;
}

export interface GoogleTokenPayload {
  sub: string;       // Google user ID
  email: string;
  name: string;
  hd?: string;       // hosted domain (only present for Workspace accounts)
  email_verified: boolean;
}

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const JWKS_TTL_MS = 60 * 60 * 1000; // 1 hour

let jwksCache: { keys: GoogleJwk[]; fetchedAt: number } | null = null;

async function fetchJwks(): Promise<GoogleJwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(JWKS_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error('Failed to fetch Google public keys');
  const data = (await res.json()) as { keys: GoogleJwk[] };
  jwksCache = { keys: data.keys, fetchedAt: Date.now() };
  return data.keys;
}

function b64urlDecode(str: string): Buffer {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function decodeJwtPart(part: string): Record<string, unknown> {
  return JSON.parse(b64urlDecode(part).toString('utf-8')) as Record<string, unknown>;
}

/**
 * Verify a Google ID token and return the payload.
 *
 * @param idToken  - Raw Google ID token from frontend
 * @param clientId - Your Google OAuth client ID (must match token audience)
 * @param allowedDomain - Restrict to this Google Workspace domain (e.g. "codegen.net")
 */
export async function verifyGoogleToken(
  idToken: string,
  clientId: string,
  allowedDomain: string,
): Promise<GoogleTokenPayload> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid ID token format');
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string];

  const header = decodeJwtPart(headerB64) as { kid: string; alg: string };
  const payload = decodeJwtPart(payloadB64) as {
    aud: string;
    iss: string;
    exp: number;
    sub: string;
    email: string;
    name: string;
    hd?: string;
    email_verified: boolean;
  };

  // Validate audience
  if (payload.aud !== clientId) {
    throw new Error('Token audience does not match client ID');
  }

  // Validate issuer
  const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
  if (!validIssuers.includes(payload.iss)) {
    throw new Error('Invalid token issuer');
  }

  // Validate expiry
  if (Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error('Token has expired');
  }

  // Validate hosted domain
  if (payload.hd !== allowedDomain) {
    throw new Error(`Access restricted to @${allowedDomain} Google Workspace accounts`);
  }

  // Double-check email domain
  if (!payload.email?.endsWith(`@${allowedDomain}`)) {
    throw new Error(`Access restricted to @${allowedDomain} accounts`);
  }

  if (!payload.email_verified) {
    throw new Error('Google email address is not verified');
  }

  // Fetch Google's public keys and find the one matching this token
  const keys = await fetchJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('No matching Google public key found for this token');

  // Verify RSA-SHA256 signature using Node.js built-in crypto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publicKey = createPublicKey({ key: jwk as any, format: 'jwk' });
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);

  if (!verifier.verify(publicKey, b64urlDecode(signatureB64))) {
    throw new Error('Token signature verification failed');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    hd: payload.hd,
    email_verified: payload.email_verified,
  };
}
