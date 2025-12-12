import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

// Environment configuration
const RP_ID = process.env.WEBAUTHN_RP_ID || 'erp.metrica.hr';
const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'FiskAI';
const ORIGIN = process.env.NEXTAUTH_URL || 'https://erp.metrica.hr';

// Challenge storage with TTL (5 minutes)
interface ChallengeData {
  challenge: string;
  expiresAt: number;
}

const challengeStore = new Map<string, ChallengeData>();

// Clean up expired challenges every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of challengeStore.entries()) {
      if (value.expiresAt < now) {
        challengeStore.delete(key);
      }
    }
  }, 60000);
}

export function storeChallenge(userId: string, challenge: string): void {
  challengeStore.set(userId, {
    challenge,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  });
}

export function getChallenge(userId: string): string | null {
  const data = challengeStore.get(userId);
  if (!data) return null;
  if (data.expiresAt < Date.now()) {
    challengeStore.delete(userId);
    return null;
  }
  return data.challenge;
}

export function deleteChallenge(userId: string): void {
  challengeStore.delete(userId);
}

// Types for registered credentials
export interface RegisteredCredential {
  credentialId: string;
  publicKey: string;
  counter: bigint;
  transports: string | null;
}

function toBufferFromId(id: string): Buffer {
  try {
    return Buffer.from(id, 'base64url');
  } catch {
    // Fall back to base64 (older stored values) or raw string.
    try {
      return Buffer.from(id, 'base64');
    } catch {
      return Buffer.from(id);
    }
  }
}

function toBase64UrlId(id: string | Buffer): string {
  const buf = Buffer.isBuffer(id) ? id : toBufferFromId(id);
  return buf.toString('base64url');
}

// Generate registration options for new passkey
export async function generateWebAuthnRegistrationOptions(
  userId: string,
  userName: string,
  userDisplayName: string,
  existingCredentials: RegisteredCredential[] = []
) {
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName,
    userDisplayName,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((cred) => ({
      id: toBase64UrlId(cred.credentialId),
      transports: cred.transports 
        ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[])
        : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  });

  storeChallenge(userId, options.challenge);
  return options;
}

// Verify registration response
export async function verifyWebAuthnRegistration(
  userId: string,
  response: RegistrationResponseJSON
) {
  const expectedChallenge = getChallenge(userId);
  if (!expectedChallenge) {
    throw new Error('Challenge not found or expired');
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });

  deleteChallenge(userId);

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed');
  }

  return {
    verified: true,
    credentialId: toBase64UrlId(verification.registrationInfo.credential.id),
    publicKey: Buffer.from(verification.registrationInfo.credential.publicKey).toString('base64'),
    counter: BigInt(verification.registrationInfo.credential.counter),
    transports: response.response.transports,
  };
}

// Generate authentication options for login
export async function generateWebAuthnAuthenticationOptions(
  userId: string,
  credentials: RegisteredCredential[]
) {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: credentials.map((cred) => ({
      id: toBase64UrlId(cred.credentialId),
      transports: cred.transports
        ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[])
        : undefined,
    })),
    userVerification: 'preferred',
  });

  storeChallenge(userId, options.challenge);
  return options;
}

// Verify authentication response
export async function verifyWebAuthnAuthentication(
  userId: string,
  response: AuthenticationResponseJSON,
  credential: RegisteredCredential
) {
  const expectedChallenge = getChallenge(userId);
  if (!expectedChallenge) {
    throw new Error('Challenge not found or expired');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: toBase64UrlId(credential.credentialId),
      publicKey: Buffer.from(credential.publicKey, 'base64'),
      counter: Number(credential.counter),
    },
    requireUserVerification: false,
  });

  deleteChallenge(userId);

  if (!verification.verified) {
    throw new Error('Authentication verification failed');
  }

  return {
    verified: true,
    newCounter: BigInt(verification.authenticationInfo.newCounter),
  };
}
