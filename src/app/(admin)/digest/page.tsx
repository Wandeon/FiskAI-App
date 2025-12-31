import dynamic from "next/dynamic"
import { requireAdmin } from "@/lib/auth-utils"
import { generateWeeklyDigest } from "@/lib/admin/weekly-digest"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

// Dynamic import for heavy DigestPage component
const DigestPage = dynamic(
  () => import("./digest-page").then((mod) => ({ default: mod.DigestPage })),
  {
    loading: () => <LoadingSpinner />,
    ssr: true,
  }
)

export const metadata = {
  title: "Weekly Digest Preview | Admin | FiskAI",
  description: "Preview and send weekly digest email",
}

export default async function AdminDigestPage() {
  await requireAdmin()

  const digestData = await generateWeeklyDigest()

  return <DigestPage digestData={digestData} />
}
