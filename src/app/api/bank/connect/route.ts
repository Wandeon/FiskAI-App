// src/app/api/bank/connect/route.ts

import { NextResponse } from 'next/server'
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import { getProvider, isProviderConfigured } from '@/lib/bank-sync/providers'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    setTenantContext({ companyId: company.id, userId: user.id! })

    if (!isProviderConfigured()) {
      return NextResponse.json(
        { error: 'Bank sync provider not configured' },
        { status: 503 }
      )
    }

    const { bankAccountId } = await request.json()

    if (!bankAccountId) {
      return NextResponse.json(
        { error: 'bankAccountId is required' },
        { status: 400 }
      )
    }

    // Find the bank account
    const bankAccount = await db.bankAccount.findFirst({
      where: { id: bankAccountId, companyId: company.id },
    })

    if (!bankAccount) {
      return NextResponse.json(
        { error: 'Bank account not found' },
        { status: 404 }
      )
    }

    if (bankAccount.connectionStatus === 'CONNECTED') {
      return NextResponse.json(
        { error: 'Bank account already connected' },
        { status: 400 }
      )
    }

    // Get provider and institution ID
    const provider = getProvider()
    const institutionId = await provider.getInstitutionId(bankAccount.bankName)

    if (!institutionId) {
      return NextResponse.json(
        { error: `Bank "${bankAccount.bankName}" is not supported for automatic sync` },
        { status: 400 }
      )
    }

    // Create connection
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.fiskai.hr'
    const redirectUrl = `${baseUrl}/api/bank/callback`

    const result = await provider.createConnection(
      institutionId,
      redirectUrl,
      bankAccountId // Use bankAccountId as reference
    )

    // Derive provider enum from provider name
    const providerEnum = provider.name.toUpperCase() as 'GOCARDLESS' | 'PLAID' | 'SALTEDGE'

    // Store connection record
    await db.bankConnection.upsert({
      where: { bankAccountId },
      create: {
        companyId: company.id,
        bankAccountId,
        provider: providerEnum,
        providerConnectionId: result.connectionId,
        institutionId,
        institutionName: bankAccount.bankName,
        status: 'MANUAL', // Will be updated on callback
      },
      update: {
        providerConnectionId: result.connectionId,
        institutionId,
        status: 'MANUAL',
        lastError: null,
      },
    })

    return NextResponse.json({ redirectUrl: result.redirectUrl })
  } catch (error) {
    console.error('[bank/connect] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection failed' },
      { status: 500 }
    )
  }
}
