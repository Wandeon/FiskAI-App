"use client"

import { forwardRef, HTMLAttributes } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Card, cardVariants } from "@/components/ui/card"
import { HoverScale } from "@/components/ui/motion/HoverScale"

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  hover?: boolean // Enable hover animation (default true)
  glow?: boolean // Add subtle glow on hover
  href?: string // If provided, render as Link
  padding?: "none" | "sm" | "default" | "lg"
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    { children, hover = true, glow = false, href, padding = "default", className, ...props },
    ref
  ) => {
    // Base card styles with glass variant
    const cardClasses = cn(
      cardVariants({ variant: "glass", padding }),
      glow && "hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]",
      className
    )

    // If there's an href, wrap content in Link
    const content = href ? (
      <Link href={href} className="block h-full">
        {children}
      </Link>
    ) : (
      children
    )

    // If hover is enabled, wrap in HoverScale
    if (hover) {
      // Extract only the props that HoverScale accepts
      const { onClick, onMouseEnter, onMouseLeave, ...restProps } = props
      return (
        <HoverScale
          ref={ref}
          className={cardClasses}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {content}
        </HoverScale>
      )
    }

    // Otherwise, render as regular Card
    return (
      <Card
        ref={ref}
        variant="glass"
        padding={padding}
        className={cn(glow && "hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]", className)}
        {...props}
      >
        {content}
      </Card>
    )
  }
)

GlassCard.displayName = "GlassCard"
