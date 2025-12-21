import { requireAdmin } from "@/lib/auth-utils"
import { generateWeeklyDigest } from "@/lib/admin/weekly-digest"
import { DigestPage } from "./digest-page"

export const metadata = {
  title: "Weekly Digest Preview | Admin | FiskAI",
  description: "Preview and send weekly digest email",
}

export default async function AdminDigestPage() {
  await requireAdmin()

  const digestData = await generateWeeklyDigest()

  return <DigestPage digestData={digestData} />
}
