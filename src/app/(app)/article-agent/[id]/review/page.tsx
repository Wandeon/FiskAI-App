// src/app/(dashboard)/article-agent/[id]/review/page.tsx

import { requireAuth } from "@/lib/auth-utils"
import { getJobWithVerification } from "@/app/actions/article-agent"
import { notFound } from "next/navigation"
import { ReviewClient } from "./review-client"

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth()
  const { id } = await params

  try {
    const { job, draft, factSheet } = await getJobWithVerification(id)

    if (!draft) {
      return (
        <div className="p-6">
          <p className="text-muted-foreground">Nema nacrta za pregled.</p>
        </div>
      )
    }

    return <ReviewClient job={job} draft={draft} factSheet={factSheet} />
  } catch {
    notFound()
  }
}
