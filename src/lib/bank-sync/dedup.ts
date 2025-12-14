// src/lib/bank-sync/dedup.ts

import { db } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { ProviderTransaction } from './types'

const Decimal = Prisma.Decimal

interface DedupResult {
  inserted: number
  skippedDuplicates: number
  flaggedForReview: number
}

/**
 * Calculate similarity between two strings (0-1)
 */
function stringSimilarity(a: string, b: string): number {
  const aNorm = a.toLowerCase().replace(/[^a-z0-9]/g, '')
  const bNorm = b.toLowerCase().replace(/[^a-z0-9]/g, '')

  if (aNorm === bNorm) return 1
  if (!aNorm || !bNorm) return 0

  // Simple Jaccard similarity on character bigrams
  const getBigrams = (s: string) => {
    const bigrams = new Set<string>()
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.slice(i, i + 2))
    }
    return bigrams
  }

  const aBigrams = getBigrams(aNorm)
  const bBigrams = getBigrams(bNorm)

  let intersection = 0
  for (const bg of aBigrams) {
    if (bBigrams.has(bg)) intersection++
  }

  const union = aBigrams.size + bBigrams.size - intersection
  return union > 0 ? intersection / union : 0
}

/**
 * Check for strict duplicate (exact match)
 */
async function isStrictDuplicate(
  bankAccountId: string,
  txn: ProviderTransaction
): Promise<boolean> {
  const existing = await db.bankTransaction.findFirst({
    where: {
      bankAccountId,
      OR: [
        // Match by external ID
        { externalId: txn.externalId },
        // Match by date + amount + reference
        {
          date: txn.date,
          amount: new Decimal(Math.abs(txn.amount)),
          reference: txn.reference || undefined,
        },
      ],
    },
  })

  return !!existing
}

/**
 * Find fuzzy duplicates (potential matches needing review)
 */
async function findFuzzyDuplicates(
  bankAccountId: string,
  companyId: string,
  txn: ProviderTransaction,
  newTransactionId: string
): Promise<void> {
  const dateFrom = new Date(txn.date)
  dateFrom.setDate(dateFrom.getDate() - 2)
  const dateTo = new Date(txn.date)
  dateTo.setDate(dateTo.getDate() + 2)

  const candidates = await db.bankTransaction.findMany({
    where: {
      bankAccountId,
      id: { not: newTransactionId },
      date: { gte: dateFrom, lte: dateTo },
      amount: {
        gte: new Decimal(Math.abs(txn.amount) - 0.01),
        lte: new Decimal(Math.abs(txn.amount) + 0.01),
      },
    },
  })

  for (const candidate of candidates) {
    const similarity = stringSimilarity(txn.description, candidate.description)

    if (similarity > 0.7) {
      // Check if already flagged
      const existing = await db.potentialDuplicate.findFirst({
        where: {
          OR: [
            { transactionAId: newTransactionId, transactionBId: candidate.id },
            { transactionAId: candidate.id, transactionBId: newTransactionId },
          ],
        },
      })

      if (!existing) {
        await db.potentialDuplicate.create({
          data: {
            companyId,
            transactionAId: newTransactionId,
            transactionBId: candidate.id,
            similarityScore: similarity,
            reason: `Sličan datum (±2 dana), isti iznos, opis ${Math.round(similarity * 100)}% sličan`,
            status: 'PENDING',
          },
        })
      }
    }
  }
}

/**
 * Process transactions with deduplication
 */
export async function processTransactionsWithDedup(
  bankAccountId: string,
  companyId: string,
  transactions: ProviderTransaction[]
): Promise<DedupResult> {
  const result: DedupResult = {
    inserted: 0,
    skippedDuplicates: 0,
    flaggedForReview: 0,
  }

  for (const txn of transactions) {
    // Tier 1: Strict duplicate check
    if (await isStrictDuplicate(bankAccountId, txn)) {
      result.skippedDuplicates++
      continue
    }

    // Insert new transaction
    const newTxn = await db.bankTransaction.create({
      data: {
        companyId,
        bankAccountId,
        date: txn.date,
        description: txn.description,
        amount: new Decimal(Math.abs(txn.amount)),
        balance: new Decimal(0), // GoCardless doesn't provide running balance
        reference: txn.reference,
        counterpartyName: txn.counterpartyName,
        counterpartyIban: txn.counterpartyIban,
        externalId: txn.externalId,
        source: 'AIS_SYNC',
        matchStatus: 'UNMATCHED',
      },
    })

    result.inserted++

    // Tier 2: Fuzzy duplicate detection
    const beforeCount = await db.potentialDuplicate.count({
      where: { companyId, status: 'PENDING' },
    })

    await findFuzzyDuplicates(bankAccountId, companyId, txn, newTxn.id)

    const afterCount = await db.potentialDuplicate.count({
      where: { companyId, status: 'PENDING' },
    })

    result.flaggedForReview += afterCount - beforeCount
  }

  return result
}

/**
 * Resolve a potential duplicate
 */
export async function resolveDuplicate(
  duplicateId: string,
  resolution: 'KEEP_BOTH' | 'MERGE' | 'DELETE_NEW',
  userId: string
): Promise<void> {
  const duplicate = await db.potentialDuplicate.findUnique({
    where: { id: duplicateId },
  })

  if (!duplicate) {
    throw new Error('Duplicate not found')
  }

  if (resolution === 'DELETE_NEW') {
    // Delete the newer transaction (transactionA is always the new one)
    await db.bankTransaction.delete({
      where: { id: duplicate.transactionAId },
    })
  } else if (resolution === 'MERGE') {
    // Keep transactionB (the original), delete transactionA
    await db.bankTransaction.delete({
      where: { id: duplicate.transactionAId },
    })
  }
  // KEEP_BOTH: just mark resolved, don't delete anything

  await db.potentialDuplicate.update({
    where: { id: duplicateId },
    data: {
      status: 'RESOLVED',
      resolution,
      resolvedAt: new Date(),
      resolvedBy: userId,
    },
  })
}
