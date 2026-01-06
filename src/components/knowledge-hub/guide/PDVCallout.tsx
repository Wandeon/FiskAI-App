import { cn } from "@/lib/utils"
import { getValueByPath } from "@/lib/fiscal-data"
import type { LucideIcon } from "lucide-react"
import { AlertTriangle, Lightbulb, PiggyBank } from "lucide-react"

type CalloutType = "warning" | "info" | "tip"

interface PDVCalloutProps {
  type: CalloutType
  threshold?: number
  thresholdPath?: string
  context?: "eu-services" | "voluntary" | "general"
  children: React.ReactNode
}

const calloutStyles: Record<
  CalloutType,
  { bg: string; border: string; iconBg: string; iconColor: string; icon: LucideIcon }
> = {
  warning: {
    bg: "bg-warning/10",
    border: "border-warning/20",
    iconBg: "bg-warning/20",
    iconColor: "text-warning",
    icon: AlertTriangle,
  },
  info: {
    bg: "bg-interactive/10",
    border: "border-focus/20",
    iconBg: "bg-interactive/20",
    iconColor: "text-link",
    icon: Lightbulb,
  },
  tip: {
    bg: "bg-chart-4/10",
    border: "border-success/20",
    iconBg: "bg-chart-4/20",
    iconColor: "text-success",
    icon: PiggyBank,
  },
}

export function PDVCallout({ type, threshold, thresholdPath, children }: PDVCalloutProps) {
  const styles = calloutStyles[type]
  const Icon = styles.icon
  const resolvedThreshold = thresholdPath ? getValueByPath(thresholdPath) : threshold
  const thresholdValue = typeof resolvedThreshold === "number" ? resolvedThreshold : threshold

  return (
    <aside className={cn("my-4 p-4 border rounded-lg", styles.bg, styles.border)} role="note">
      <div className="flex gap-3">
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl",
            styles.iconBg,
            styles.iconColor
          )}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-sm text-white/90">
          {thresholdValue && (
            <strong className="block mb-1 text-white">
              PDV prag: {thresholdValue.toLocaleString("hr-HR")} EUR
            </strong>
          )}
          {children}
        </div>
      </div>
    </aside>
  )
}
