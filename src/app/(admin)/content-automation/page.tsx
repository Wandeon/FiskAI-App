import { Suspense } from "react"
import { ContentAutomationDashboard } from "./content-automation-dashboard"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import {
  collectArticleAgentMetrics,
  collectContentSyncMetrics,
  getRecentArticleJobs,
  getRecentContentSyncEvents,
  getContentPipelineHealth,
} from "@/lib/regulatory-truth/monitoring/metrics"

export const dynamic = "force-dynamic"

export default async function ContentAutomationPage() {
  const [articleMetrics, syncMetrics, recentJobs, recentEvents, health] = await Promise.all([
    collectArticleAgentMetrics(),
    collectContentSyncMetrics(),
    getRecentArticleJobs(10),
    getRecentContentSyncEvents(10),
    getContentPipelineHealth(),
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
      />
    </Suspense>
  )
}
