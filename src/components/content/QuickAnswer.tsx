import { Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"

interface QuickAnswerProps {
  children: React.ReactNode
  className?: string
}

export function QuickAnswer({ children, className }: QuickAnswerProps) {
  return (
    <div className={cn("my-6 rounded-xl border-l-4 border-focus bg-info-bg p-5", className)}>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-link">
        <Lightbulb className="h-4 w-4" />
        Brzi odgovor
      </div>
      <div className="text-foreground [&>p]:m-0">{children}</div>
    </div>
  )
}
