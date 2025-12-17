"use client"

import type { ComponentPropsWithoutRef } from "react"
import { cn } from "@/lib/utils"
import { GlowOrb } from "@/components/ui/motion/GlowOrb"

const variantStyles = {
  hero: "bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900",
  dark: "bg-slate-950",
  subtle: "bg-slate-900/50",
  gradient: "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900",
  mesh: "bg-slate-950",
} as const

type SectionBackgroundVariant = keyof typeof variantStyles

interface SectionBackgroundProps extends ComponentPropsWithoutRef<"section"> {
  variant?: SectionBackgroundVariant
  showGrid?: boolean
  showOrbs?: boolean
}

function resolveVariant(variant: SectionBackgroundProps["variant"]) {
  if (!variant) return "hero"
  return variant in variantStyles ? variant : "hero"
}

export function SectionBackground({
  variant = "hero",
  showGrid = true,
  showOrbs = true,
  children,
  className,
  ...props
}: SectionBackgroundProps) {
  const resolvedVariant = resolveVariant(variant)

  return (
    <section
      {...props}
      className={cn(
        "dark relative overflow-hidden text-[var(--foreground)]",
        variantStyles[resolvedVariant],
        className
      )}
    >
      {resolvedVariant === "mesh" && (
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 28%, rgba(56,189,248,0.22), transparent 55%), radial-gradient(circle at 82% 18%, rgba(129,140,248,0.18), transparent 52%), radial-gradient(circle at 55% 82%, rgba(34,211,238,0.14), transparent 58%)",
          }}
        />
      )}

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
