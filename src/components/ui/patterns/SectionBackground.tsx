"use client"

import { cn } from "@/lib/utils"
import { GlowOrb } from "@/components/ui/motion/GlowOrb"

interface SectionBackgroundProps {
  variant?: "hero" | "dark" | "subtle"
  showGrid?: boolean
  showOrbs?: boolean
  children: React.ReactNode
  className?: string
}

const variantStyles = {
  hero: "bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900",
  dark: "bg-slate-950",
  subtle: "bg-slate-900/50",
}

export function SectionBackground({
  variant = "hero",
  showGrid = true,
  showOrbs = true,
  children,
  className,
}: SectionBackgroundProps) {
  return (
    <section className={cn("relative overflow-hidden", variantStyles[variant], className)}>
      {/* Animated glow orbs */}
      {showOrbs && (
        <div className="pointer-events-none absolute inset-0">
          <GlowOrb
            color="blue"
            size="lg"
            animation="pulse"
            className="absolute left-[10%] top-[20%]"
          />
          <GlowOrb
            color="indigo"
            size="md"
            animation="float"
            className="absolute right-[5%] top-[10%]"
          />
          <GlowOrb
            color="cyan"
            size="sm"
            animation="drift"
            className="absolute bottom-[10%] left-[30%]"
          />
        </div>
      )}

      {/* Grid overlay for tech feel */}
      {showGrid && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      )}

      {/* Content layer */}
      <div className="relative z-10">{children}</div>
    </section>
  )
}
