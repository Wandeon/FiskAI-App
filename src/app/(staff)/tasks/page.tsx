import { Suspense } from "react"
import { TasksList } from "@/components/staff/tasks-list"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: Promise<{ status?: string; priority?: string; category?: string }>
}

export default async function TasksPage({ searchParams }: PageProps) {
  const params = await searchParams

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <TasksList
        statusFilter={params.status}
        priorityFilter={params.priority}
        categoryFilter={params.category}
      />
    </Suspense>
  )
}
