"use client"

import { cn } from "@/lib/utils"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"
import { GradientButton } from "@/components/ui/patterns/GradientButton"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/motion/Reveal"
import Link from "next/link"

export interface CTAAction {
  label: string
  href: string
  variant?: "primary" | "secondary"
}

export interface CTASectionProps {
  /** Main headline */
  title: string
  /** Supporting description */
  description?: string
  /** Call-to-action buttons */
  actions: CTAAction[]
  /** Optional content for right side (testimonial, image, etc.) */
  aside?: React.ReactNode
  /** Background variant */
  backgroundVariant?: "gradient" | "hero" | "dark"
  /** Additional classes */
  className?: string
}

/**
 * CTASection: Full-width call-to-action section.
 *
 * Composes: SectionBackground + GradientButton + Button + Reveal
 */
export function CTASection({
  title,
  description,
  actions,
  aside,
  backgroundVariant = "gradient",
  className,
}: CTASectionProps) {
  return (
    <SectionBackground variant={backgroundVariant}>
      <div className={cn("mx-auto max-w-7xl px-4 py-24", className)}>
        <div className={cn("grid gap-12", aside && "lg:grid-cols-2 lg:items-center")}>
          <Reveal>
            <div>
              <h2 className="text-display-md text-foreground">{title}</h2>
              {description && (
                <p className="text-body-lg text-secondary mt-4 max-w-xl">{description}</p>
              )}
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
            </div>
          </Reveal>

          {aside && (
            <Reveal delay={0.2}>
              <div>{aside}</div>
            </Reveal>
          )}
        </div>
      </div>
    </SectionBackground>
  )
}
