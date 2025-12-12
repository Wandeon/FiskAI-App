import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateWebAuthnAuthenticationOptions } from '@/lib/webauthn';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body as { email: string };

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        webAuthnCredentials: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.webAuthnCredentials.length === 0) {
      return NextResponse.json(
        { error: 'No passkeys registered' },
        { status: 404 }
      );
    }

    const options = await generateWebAuthnAuthenticationOptions(
      user.id,
      user.webAuthnCredentials.map((cred) => ({
        credentialId: cred.credentialId,
        publicKey: cred.publicKey,
        counter: cred.counter,
        transports: cred.transports ?? null,
      }))
    );

    return NextResponse.json({ ...options, userId: user.id });
  } catch (error) {
    console.error('WebAuthn login start error:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication options' },
      { status: 500 }
    );
  }
}
