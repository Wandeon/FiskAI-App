import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { verifyWebAuthnRegistration } from '@/lib/webauthn';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { response, name } = body as {
      response: RegistrationResponseJSON;
      name?: string;
    };

    if (!response) {
      return NextResponse.json(
        { error: 'Response is required' },
        { status: 400 }
      );
    }

    const verification = await verifyWebAuthnRegistration(
      session.user.id,
      response
    );

    // Extract transports from response
    const transports = response.response.transports
      ? JSON.stringify(response.response.transports)
      : null;

    // Save credential to database
    const credential = await db.webAuthnCredential.create({
      data: {
        userId: session.user.id,
        credentialId: verification.credentialId,
        publicKey: verification.publicKey,
        counter: verification.counter,
        transports,
        name: name || 'Passkey',
      },
    });

    return NextResponse.json({
      success: true,
      credential: {
        id: credential.id,
        name: credential.name,
        createdAt: credential.createdAt,
      },
    });
  } catch (error) {
    console.error('WebAuthn registration finish error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to verify registration',
      },
      { status: 500 }
    );
  }
}
