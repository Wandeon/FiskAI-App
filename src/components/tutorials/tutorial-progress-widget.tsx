"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/ui/progress-bar"
import { CheckCircle, Circle, ArrowRight } from "lucide-react"
import Link from "next/link"
import type { TutorialTrack, TutorialProgress } from "@/lib/tutorials/types"
import { calculateTrackProgress } from "@/lib/tutorials/progress"
import { getProgressAriaLabel } from "@/lib/a11y"

interface TutorialProgressWidgetProps {
  track: TutorialTrack
  progress: TutorialProgress | null
}

export function TutorialProgressWidget({ track, progress }: TutorialProgressWidgetProps) {
  const completedTasks = progress?.completedTasks || []
  const stats = calculateTrackProgress(track, completedTasks)
  const currentDay = progress?.currentDay || 1
  const currentDayData = track.days.find((d) => d.day === currentDay) || track.days[0]

  // Find next incomplete task
  const nextTask = currentDayData?.tasks.find((t) => !completedTasks.includes(t.id))

  const progressAriaLabel = getProgressAriaLabel(stats.completed, stats.total, "hr")

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{track.name}</CardTitle>
          <span
            className="text-sm text-muted-foreground"
            aria-label={`Dan ${currentDay} od ${track.days.length}`}
          >
            Dan {currentDay}/{track.days.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2" role="region" aria-label="Napredak tutoriala">
          <div className="flex items-center justify-between text-sm">
            <span>
              {stats.completed}/{stats.total} zadataka
            </span>
            <span className="font-medium">{stats.percentage}%</span>
          </div>
          <ProgressBar value={stats.percentage} className="h-2" aria-label={progressAriaLabel} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{currentDayData?.title}</p>
          <ul className="space-y-1" role="list" aria-label="Zadaci za današnji dan">
            {currentDayData?.tasks.slice(0, 4).map((task) => {
              const isCompleted = completedTasks.includes(task.id)
              const taskStatus = isCompleted ? "završeno" : "nezavršeno"
              return (
                <li
                  key={task.id}
                  className="flex items-center gap-2 text-sm"
                  aria-label={`${task.title}, ${taskStatus}${task.isOptional ? ", opcionalno" : ""}`}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className={isCompleted ? "line-through text-muted-foreground" : ""}>
                    {task.title}
                  </span>
                  {task.isOptional && (
                    <span className="text-xs text-muted-foreground">(opcionalno)</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        {nextTask && (
          <Button asChild className="w-full">
            <Link
              href={nextTask.href}
              aria-label={`Nastavi na sljedeći zadatak: ${nextTask.title}`}
            >
              Nastavi: {nextTask.title}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
