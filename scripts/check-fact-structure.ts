import { config } from "dotenv"
config({ path: ".env.local" })
config({ path: ".env" })

async function main() {
  const { db } = await import("../src/lib/db")

  const fact = await db.candidateFact.findFirst({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: {
      id: true,
      suggestedConceptSlug: true,
      extractedValue: true,
      suggestedValueType: true,
      groundingQuotes: true,
      extractorNotes: true,
    },
  })

  console.log("CandidateFact structure:")
  console.log(JSON.stringify(fact, null, 2))

  await db.$disconnect()
}
main().catch(console.error)
