"use client"

import { cn } from "@/lib/utils"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { GradientButton } from "@/components/ui/patterns/GradientButton"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/Reveal"
import Link from "next/link"

export interface HeroAction {
  label: string
  href: string
  variant?: "primary" | "secondary"
}

export interface HeroSectionProps {
  /** Optional small label above the title */
  label?: string
  /** Main headline */
  title: string
  /** Supporting description */
  description?: string
  /** Call-to-action buttons (max 2 recommended) */
  actions?: HeroAction[]
  /** Background variant */
  backgroundVariant?: "hero" | "gradient" | "dark"
  /** Show animated background elements */
  showOrbs?: boolean
  /** Show grid overlay */
  showGrid?: boolean
  /** Additional content (right panel, illustration, etc.) */
  aside?: React.ReactNode
  /** Additional classes for the container */
  className?: string
}

/**
 * HeroSection: Full-width hero with background effects.
 *
 * Composes: SectionBackground + GradientButton + Button + Reveal
 */
export function HeroSection({
  label,
  title,
  description,
  actions = [],
  backgroundVariant = "hero",
  showOrbs = true,
  showGrid = true,
  aside,
  className,
}: HeroSectionProps) {
  return (
    <SectionBackground variant={backgroundVariant} showOrbs={showOrbs} showGrid={showGrid}>
      <div className={cn("mx-auto max-w-7xl px-4 py-24 md:py-32", className)}>
        <div className={cn("grid gap-12", aside && "lg:grid-cols-2 lg:items-center")}>
          <Reveal>
            <div className="max-w-2xl">
              {label && (
                <span className="text-label-sm text-accent uppercase tracking-wider block mb-4">
                  {label}
                </span>
              )}
              <h1 className="text-display-lg text-foreground md:text-display-xl">{title}</h1>
              {description && (
                <p className="text-body-lg text-secondary mt-6 max-w-xl">{description}</p>
              )}
              {actions.length > 0 && (
                <div className="flex flex-wrap gap-4 mt-8">
                  {actions.map((action, i) =>
                    action.variant === "secondary" ? (
                      <Button key={i} variant="secondary" asChild>
                        <Link href={action.href}>{action.label}</Link>
                      </Button>
                    ) : (
                      <GradientButton key={i} href={action.href}>
                        {action.label}
                      </GradientButton>
                    )
                  )}
                </div>
              )}
            </div>
          </Reveal>

          {aside && (
            <Reveal delay={0.2}>
              <div className="lg:pl-8">{aside}</div>
            </Reveal>
          )}
        </div>
      </div>
    </SectionBackground>
  )
}
