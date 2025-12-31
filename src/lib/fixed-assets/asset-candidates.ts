import type { Expense, ExpenseLine } from "@prisma/client"
import type { TransactionClient } from "@/lib/db"
import { shouldCapitalizeAsset, THRESHOLDS } from "@/lib/fiscal-data/data/thresholds"

type AssetCandidateInput = {
  expense: Expense
  lines: ExpenseLine[]
}

export async function emitAssetCandidates(
  tx: TransactionClient,
  { expense, lines }: AssetCandidateInput
) {
  const thresholdValue = THRESHOLDS.assetCapitalization.value
  const candidates = lines.filter((line) => shouldCapitalizeAsset(Number(line.totalAmount)))

  if (candidates.length === 0) return

  await tx.fixedAssetCandidate.createMany({
    data: candidates.map((line) => ({
      companyId: expense.companyId,
      expenseId: expense.id,
      expenseLineId: line.id,
      description: line.description,
      amount: line.totalAmount,
      currency: expense.currency,
      thresholdValue,
    })),
    skipDuplicates: true,
  })
}
