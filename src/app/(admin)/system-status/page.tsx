import { requireAdmin } from "@/lib/auth-utils"
import { getCurrentSnapshot, getRecentEvents, getCurrentLock } from "@/lib/system-status/store"
import { SystemStatusPage } from "./system-status-page"

export const metadata = {
  title: "System Status | Admin | FiskAI",
  description: "Monitor system registry status and integrations",
}

export default async function Page() {
  await requireAdmin()

  const [snapshot, events, lock] = await Promise.all([
    getCurrentSnapshot(),
    getRecentEvents(20),
    getCurrentLock(),
  ])

  return <SystemStatusPage initialSnapshot={snapshot} initialEvents={events} initialLock={lock} />
}
