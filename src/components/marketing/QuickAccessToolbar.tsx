"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import {
  FileText,
  TrendingUp,
  Calendar,
  Calculator,
  ArrowRight,
  Zap,
  FileSpreadsheet,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ToolCard {
  id: string
  icon: typeof FileText
  title: string
  subtitle: string
  description: string
  href: string
  color: string
  bgGlow: string
}

const tools: ToolCard[] = [
  {
    id: "e-racun",
    icon: FileText,
    title: "E-Račun",
    subtitle: "Generator",
    description: "UBL 2.1 XML • Instant preview",
    href: "/alati/e-racun",
    color: "text-link",
    bgGlow: "group-hover:shadow-blue-500/20",
  },
  {
    id: "pdv-prag",
    icon: TrendingUp,
    title: "PDV Prag",
    subtitle: "Kalkulator",
    description: "Provjeri 60.000€ limit",
    href: "/alati/pdv-kalkulator",
    color: "text-warning",
    bgGlow: "group-hover:shadow-amber-500/20",
  },
  {
    id: "rokovi",
    icon: Calendar,
    title: "Rokovi",
    subtitle: "Kalendar 2025",
    description: "Svi porezni datumi",
    href: "/alati/kalendar",
    color: "text-success-text",
    bgGlow: "group-hover:shadow-green-500/20",
  },
  {
    id: "porez",
    icon: Calculator,
    title: "Porez",
    subtitle: "Kalkulator",
    description: "Paušal & obrt izračun",
    href: "/alati/kalkulator-poreza",
    color: "text-chart-2",
    bgGlow: "group-hover:shadow-purple-500/20",
  },
  {
    id: "posd",
    icon: FileSpreadsheet,
    title: "PO-SD",
    subtitle: "Iz izvoda",
    description: "Učitaj XML iz banke",
    href: "/alati/posd-kalkulator",
    color: "text-danger-text",
    bgGlow: "group-hover:shadow-danger/20",
  },
]

interface QuickAccessToolbarProps {
  className?: string
  variant?: "horizontal" | "grid"
}

export function QuickAccessToolbar({ className, variant = "horizontal" }: QuickAccessToolbarProps) {
  if (variant === "grid") {
    return (
      <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5", className)}>
        {tools.map((tool, index) => (
          <ToolCardItem key={tool.id} tool={tool} index={index} />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-surface/5 p-4 backdrop-blur-sm",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-warning-text" />
        <span className="text-xs font-semibold uppercase tracking-wider text-white/60">
          Brzi pristup
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
        {tools.map((tool, index) => (
          <ToolCardItem key={tool.id} tool={tool} index={index} />
        ))}
      </div>
    </div>
  )
}

function ToolCardItem({ tool, index }: { tool: ToolCard; index: number }) {
  const Icon = tool.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        href={tool.href}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-surface/5 p-3 transition-all",
          "hover:border-white/20 hover:bg-surface/10 hover:shadow-lg",
          tool.bgGlow
        )}
      >
        {/* Glow effect */}
        <div
          className={cn(
            "absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-30",
            tool.color.replace("text-", "bg-")
          )}
        />

        <div className="relative">
          <div className="mb-2 flex items-center justify-between">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg bg-surface/10",
                "group-hover:bg-surface/15"
              )}
            >
              <Icon className={cn("h-4 w-4", tool.color)} />
            </div>
            <ArrowRight className="h-3 w-3 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
          </div>

          <div className="mb-0.5 flex items-baseline gap-1">
            <span className="text-sm font-semibold text-white">{tool.title}</span>
            <span className="text-xs text-white/50">{tool.subtitle}</span>
          </div>

          <p className="text-xs text-white/40 line-clamp-1">{tool.description}</p>
        </div>
      </Link>
    </motion.div>
  )
}

// Standalone version for /alati page
export function ToolsGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {tools.map((tool) => {
        const Icon = tool.icon
        return (
          <Link
            key={tool.id}
            href={tool.href}
            className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:border-blue-300 hover:shadow-lg"
          >
            <div
              className={cn(
                "mb-3 flex h-12 w-12 items-center justify-center rounded-xl",
                "bg-gradient-to-br from-interactive to-chart-2"
              )}
            >
              <Icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="mb-1 font-semibold">{tool.title}</h3>
            <p className="text-sm text-[var(--muted)]">{tool.description}</p>
          </Link>
        )
      })}
    </div>
  )
}
