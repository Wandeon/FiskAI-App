// src/lib/tutorials/utils.ts
// Client-safe utility functions for tutorials

import type { TutorialTrack } from "./types"

export function calculateTrackProgress(
  track: TutorialTrack,
  completedTasks: string[]
): { completed: number; total: number; percentage: number } {
  const allTasks = track.days.flatMap((d) => d.tasks.filter((t) => !t.isOptional))
  const completed = allTasks.filter((t) => completedTasks.includes(t.id)).length
  const total = allTasks.length
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return { completed, total, percentage }
}
