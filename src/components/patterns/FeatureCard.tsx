import { cn } from "@/lib/utils"
import { type LucideIcon } from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { IconBadge } from "./IconBadge"
import { HoverScale } from "@/components/ui/motion/HoverScale"

export interface FeatureCardProps {
  /** Lucide icon component */
  icon: LucideIcon
  /** Card title */
  title: string
  /** Card description */
  description: string
  /** Optional link - makes entire card clickable */
  href?: string
  /** Icon variant */
  iconVariant?: "accent" | "success" | "warning" | "danger" | "info"
  /** Additional classes */
  className?: string
}

/**
 * FeatureCard: Glass card with icon badge, title, and description.
 *
 * Composes: Card (primitive) + IconBadge (pattern) + HoverScale (motion)
 */
export function FeatureCard({
  icon,
  title,
  description,
  href,
  iconVariant = "accent",
  className,
}: FeatureCardProps) {
  const content = (
    <Card variant="glass" className={cn("h-full", className)}>
      <IconBadge icon={icon} variant={iconVariant} className="mb-4" />
      <h3 className="text-heading-md text-foreground">{title}</h3>
      <p className="text-body-sm text-secondary mt-2">{description}</p>
    </Card>
  )

  if (href) {
    return (
      <HoverScale>
        <Link href={href} className="block h-full">
          {content}
        </Link>
      </HoverScale>
    )
  }

  return content
}
