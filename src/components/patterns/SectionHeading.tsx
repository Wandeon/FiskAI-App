import { cn } from "@/lib/utils"
import { Reveal } from "@/components/motion/Reveal"

interface SectionHeadingProps {
  /** Optional small label above the title */
  label?: string
  /** Main heading text */
  title: string
  /** Optional description below the title */
  description?: string
  /** Text alignment */
  align?: "left" | "center"
  /** Additional classes */
  className?: string
}

/**
 * SectionHeading: Consistent typography pattern for section headers.
 *
 * Uses semantic tokens only:
 * - text-accent for labels (maps to --accent CSS variable)
 * - text-foreground for titles (maps to --text-primary)
 * - text-secondary for descriptions (maps to --text-secondary)
 */
export function SectionHeading({
  label,
  title,
  description,
  align = "left",
  className,
}: SectionHeadingProps) {
  return (
    <Reveal>
      <div
        className={cn("mb-12 max-w-2xl", align === "center" && "mx-auto text-center", className)}
      >
        {label && (
          <span className="text-label-sm text-accent uppercase tracking-wider block mb-3">
            {label}
          </span>
        )}
        <h2 className="text-display-md text-foreground">{title}</h2>
        {description && <p className="text-body-lg text-secondary mt-4">{description}</p>}
      </div>
    </Reveal>
  )
}
