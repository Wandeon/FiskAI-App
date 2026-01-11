import { Suspense } from "react"
import { ContentAutomationDashboard } from "./content-automation-dashboard"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import {
  collectArticleAgentMetrics,
  collectContentSyncMetrics,
  getRecentArticleJobs,
  getRecentContentSyncEvents,
  getContentPipelineHealth,
  getPendingContentSyncPRs,
} from "@/lib/regulatory-truth/monitoring/metrics"
import { hasRegulatoryTruthTables } from "@/lib/admin/runtime-capabilities"
import { NotConfigured } from "@/components/admin/not-configured"

export const dynamic = "force-dynamic"

export default async function ContentAutomationPage() {
  // Check capability before querying - prevents crash if tables don't exist
  const capability = await hasRegulatoryTruthTables()

  if (!capability.available) {
    return (
      <NotConfigured
        feature="Content Automation"
        missingTables={capability.missingTables}
        actionHint={`Run migrations for Content Automation tables: ${capability.requiredTables.join(", ")}`}
      />
    )
  }

  const [articleMetrics, syncMetrics, recentJobs, recentEvents, health, pendingPRs] =
    await Promise.all([
      collectArticleAgentMetrics(),
      collectContentSyncMetrics(),
      getRecentArticleJobs(10),
      getRecentContentSyncEvents(10),
      getContentPipelineHealth(),
      getPendingContentSyncPRs(50),
    ])

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <ContentAutomationDashboard
        articleMetrics={articleMetrics}
        syncMetrics={syncMetrics}
        recentJobs={recentJobs}
        recentEvents={recentEvents}
        health={health}
        pendingPRs={pendingPRs}
      />
    </Suspense>
  )
}
