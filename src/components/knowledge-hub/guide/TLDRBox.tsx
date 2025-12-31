import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface TLDRBoxProps {
  children: React.ReactNode
  title?: string
  variant?: "default" | "success" | "warning"
}

const variantStyles = {
  default: {
    container: "border-chart-2/20 bg-gradient-to-br from-chart-2/10 to-chart-1/10",
    icon: "bg-chart-2/20 text-chart-2",
    title: "text-purple-300",
  },
  success: {
    container: "border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-green-500/10",
    icon: "bg-chart-4/20 text-success",
    title: "text-success-text",
  },
  warning: {
    container: "border-warning/20 bg-gradient-to-br from-amber-500/10 to-orange-500/10",
    icon: "bg-warning/20 text-warning",
    title: "text-warning-text",
  },
}

export function TLDRBox({
  children,
  title = "TL;DR — Brzi odgovor",
  variant = "default",
}: TLDRBoxProps) {
  const styles = variantStyles[variant]

  return (
    <div className={cn("my-6 rounded-xl border p-5 shadow-sm", styles.container)}>
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
            styles.icon
          )}
        >
          <Zap className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className={cn("mb-2 text-base font-semibold", styles.title)}>{title}</h3>
          <div className="text-sm text-white/90 [&>p]:mb-2 [&>ul]:mb-0 [&>ul]:ml-4 [&>ul]:list-disc [&>ul>li]:mb-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// Simpler inline version for use within content
export function QuickAnswer({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-lg border-l-4 border-chart-2 bg-chart-2/10 p-4">
      <p className="text-sm font-medium text-white">
        <span className="mr-2">⚡</span>
        {children}
      </p>
    </div>
  )
}
