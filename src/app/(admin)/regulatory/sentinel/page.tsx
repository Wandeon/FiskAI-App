import { requireAdmin } from "@/lib/auth-utils"
import { SentinelHealthDashboard } from "./sentinel-health-dashboard"

export const metadata = {
  title: "Sentinel Health | Regulatory | Admin | FiskAI",
  description: "Monitor Sentinel discovery health and domain status",
}

export const revalidate = 30 // 30 second cache

async function getSentinelHealth() {
  const apiUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  const res = await fetch(`${apiUrl}/api/admin/sentinel/health`, {
    cache: "no-store",
  })

  if (!res.ok) {
    throw new Error("Failed to fetch Sentinel health")
  }

  return res.json()
}

export default async function SentinelHealthPage() {
  await requireAdmin()

  const healthData = await getSentinelHealth()

  return <SentinelHealthDashboard initialData={healthData} />
}
