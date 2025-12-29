"use client"

import { forwardRef, ButtonHTMLAttributes } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { HoverScale } from "@/components/ui/motion/HoverScale"

interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  href?: string // If provided, render as Link
  icon?: React.ReactNode // Custom icon
  showArrow?: boolean // Show animated arrow (default false)
  size?: "sm" | "default" | "lg"
}

const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ children, href, icon, showArrow = false, size = "default", className, ...props }, ref) => {
    const content = (
      <>
        {children}
        {showArrow && (
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        )}
        {icon && !showArrow && icon}
      </>
    )

    if (href) {
      return (
        <HoverScale>
          <Button
            asChild
            variant="primary"
            size={size}
            className={cn("group gap-2", className)}
            ref={ref}
          >
            <Link href={href}>{content}</Link>
          </Button>
        </HoverScale>
      )
    }

    return (
      <HoverScale>
        <Button
          variant="primary"
          size={size}
          className={cn("group gap-2", className)}
          ref={ref}
          {...props}
        >
          {content}
        </Button>
      </HoverScale>
    )
  }
)

GradientButton.displayName = "GradientButton"

export { GradientButton }
