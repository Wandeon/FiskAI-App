// src/components/ui/command-palette/CommandItem.tsx

"use client"

import { forwardRef } from "react"
import { motion } from "framer-motion"
import {
  Calculator,
  TrendingUp,
  Scale,
  Coins,
  FileText,
  BarChart3,
  CreditCard,
  Calendar,
  Shield,
  BookOpen,
  HelpCircle,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Settings,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SearchEntry } from "@/lib/search"

const ICON_MAP: Record<string, LucideIcon> = {
  Calculator,
  TrendingUp,
  Scale,
  Coins,
  FileText,
  BarChart3,
  CreditCard,
  Calendar,
  Shield,
  BookOpen,
  HelpCircle,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Settings,
}

interface CommandItemProps {
  entry: SearchEntry
  isSelected: boolean
  index: number
  onSelect: () => void
  onHover: () => void
}

export const CommandItem = forwardRef<HTMLButtonElement, CommandItemProps>(
  ({ entry, isSelected, index, onSelect, onHover }, ref) => {
    const Icon = entry.icon ? ICON_MAP[entry.icon] : FileText

    return (
      <motion.button
        ref={ref}
        role="option"
        aria-selected={isSelected}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.02, duration: 0.15 }}
        onClick={onSelect}
        onMouseEnter={onHover}
        className={cn(
          "group relative w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2",
          isSelected ? "bg-surface/10" : "hover:bg-surface/5"
        )}
      >
        {/* Selection indicator */}
        <motion.div
          initial={false}
          animate={{
            opacity: isSelected ? 1 : 0,
            scaleY: isSelected ? 1 : 0.5,
          }}
          transition={{ duration: 0.15 }}
          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-accent"
        />

        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-colors",
              entry.type === "action"
                ? "bg-accent/20 text-accent-light"
                : entry.type === "tool"
                  ? "bg-success-bg0/20 text-success"
                  : entry.type === "guide"
                    ? "bg-violet-500/20 text-violet-400"
                    : entry.type === "comparison"
                      ? "bg-warning-bg0/20 text-warning"
                      : "bg-surface/10 text-white/60"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-white">{entry.title}</span>
              {entry.shortcut && (
                <kbd className="hidden rounded bg-surface/10 px-1.5 py-0.5 text-[10px] font-medium text-white/50 sm:inline-block">
                  {entry.shortcut}
                </kbd>
              )}
            </div>
            {entry.description && (
              <p className="truncate text-sm text-white/50">{entry.description}</p>
            )}
          </div>

          {/* Enter indicator */}
          <motion.div
            initial={false}
            animate={{ opacity: isSelected ? 1 : 0 }}
            className="flex-shrink-0"
          >
            <CornerDownLeft className="h-4 w-4 text-white/40" />
          </motion.div>
        </div>
      </motion.button>
    )
  }
)

CommandItem.displayName = "CommandItem"
