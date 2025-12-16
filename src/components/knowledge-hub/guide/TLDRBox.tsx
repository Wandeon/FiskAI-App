import { Zap } from "lucide-react"
import { cn } from "@/lib/utils"

interface TLDRBoxProps {
  children: React.ReactNode
  title?: string
  variant?: "default" | "success" | "warning"
}

const variantStyles = {
  default: {
    container: "border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50",
    icon: "bg-purple-100 text-purple-600",
    title: "text-purple-900",
  },
  success: {
    container: "border-green-200 bg-gradient-to-br from-green-50 to-emerald-50",
    icon: "bg-green-100 text-green-600",
    title: "text-green-900",
  },
  warning: {
    container: "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50",
    icon: "bg-amber-100 text-amber-600",
    title: "text-amber-900",
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
          <div className="text-sm text-gray-700 [&>p]:mb-2 [&>ul]:mb-0 [&>ul]:ml-4 [&>ul]:list-disc [&>ul>li]:mb-1">
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
    <div className="my-4 rounded-lg border-l-4 border-purple-500 bg-purple-50 p-4">
      <p className="text-sm font-medium text-purple-900">
        <span className="mr-2">⚡</span>
        {children}
      </p>
    </div>
  )
}
