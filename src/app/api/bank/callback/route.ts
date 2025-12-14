// src/app/api/bank/callback/route.ts

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getProvider } from '@/lib/bank-sync/providers'
import { processTransactionsWithDedup } from '@/lib/bank-sync/dedup'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ref = searchParams.get('ref')

  if (!ref) {
    redirect('/banking?error=missing_ref')
  }

  try {
    // Find connection by bankAccountId (we used it as reference)
    const connection = await db.bankConnection.findFirst({
      where: { bankAccountId: ref },
      include: { bankAccount: true },
    })

    if (!connection) {
      redirect('/banking?error=unknown_connection')
    }

    const provider = getProvider(connection.provider)

    // Handle callback - get accounts
    const result = await provider.handleCallback(connection.providerConnectionId)

    // Find matching account by IBAN
    const matchedAccount = result.accounts.find(
      (acc) => acc.iban === connection.bankAccount.iban
    )

    if (!matchedAccount) {
      await db.bankConnection.update({
        where: { id: connection.id },
        data: {
          lastError: `No account found with IBAN ${connection.bankAccount.iban}`,
        },
      })
      redirect('/banking?error=iban_not_found')
    }

    // Derive provider enum from connection
    const providerEnum = connection.provider

    // Update connection and bank account
    await db.$transaction([
      db.bankConnection.update({
        where: { id: connection.id },
        data: {
          status: 'CONNECTED',
          authorizedAt: new Date(),
          expiresAt: result.expiresAt,
          lastError: null,
        },
      }),
      db.bankAccount.update({
        where: { id: connection.bankAccountId },
        data: {
          syncProvider: providerEnum,
          syncProviderAccountId: matchedAccount.id,
          connectionStatus: 'CONNECTED',
          connectionExpiresAt: result.expiresAt,
        },
      }),
    ])

    // Trigger initial sync (last 90 days)
    const since = new Date()
    since.setDate(since.getDate() - 90)

    try {
      const transactions = await provider.fetchTransactions(matchedAccount.id, since)

      await processTransactionsWithDedup(
        connection.bankAccountId,
        connection.companyId,
        transactions
      )

      // Update balance
      const balance = await provider.fetchBalance(matchedAccount.id)
      if (balance) {
        await db.bankAccount.update({
          where: { id: connection.bankAccountId },
          data: {
            currentBalance: balance.amount,
            lastSyncAt: new Date(),
          },
        })
      }
    } catch (syncError) {
      console.error('[bank/callback] initial sync error:', syncError)
      // Don't fail the connection, just log
    }

    redirect('/banking?success=connected')
  } catch (error) {
    console.error('[bank/callback] error:', error)
    redirect('/banking?error=callback_failed')
  }
}
