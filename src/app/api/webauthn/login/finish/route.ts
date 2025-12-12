import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWebAuthnAuthentication } from '@/lib/webauthn';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, response } = body as {
      userId: string;
      response: AuthenticationResponseJSON;
    };

    if (!userId || !response) {
      return NextResponse.json(
        { error: 'UserId and response are required' },
        { status: 400 }
      );
    }

    // Normalize the credential ID (rawId is base64url from the browser)
    const rawIdBase64url =
      typeof response.rawId === 'string'
        ? response.rawId
        : Buffer.from(response.rawId).toString('base64url');

    let rawIdBase64: string | null = null;
    try {
      rawIdBase64 = Buffer.from(rawIdBase64url, 'base64url').toString('base64');
    } catch (e) {
      void e;
    }

    const credential = await db.webAuthnCredential.findFirst({
      where: {
        OR: [
          { credentialId: rawIdBase64url },
          ...(rawIdBase64 ? [{ credentialId: rawIdBase64 }] : []),
        ],
      },
      include: { user: true },
    });

    if (!credential || credential.userId !== userId) {
      return NextResponse.json(
        { error: 'Credential not found' },
        { status: 404 }
      );
    }

    const verification = await verifyWebAuthnAuthentication(
      userId,
      response,
      {
        credentialId: credential.credentialId,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports ?? null,
      }
    );

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Update credential counter and last used timestamp
    await db.webAuthnCredential.update({
      where: { id: credential.id },
      data: {
        counter: verification.newCounter,
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: credential.user.id,
        email: credential.user.email,
        name: credential.user.name,
      },
    });
  } catch (error) {
    console.error('WebAuthn login finish error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to verify authentication',
      },
      { status: 500 }
    );
  }
}
