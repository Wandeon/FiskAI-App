import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { getStatusAriaLabel } from "@/lib/a11y";

const badgeVariants = cva(
  // Base styles
  "inline-flex items-center rounded-md px-2.5 py-0.5 text-body-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-interactive text-inverse",
        secondary:
          "bg-surface-1 text-secondary border border-border",
        success:
          "bg-success-bg text-success-text border border-success-border",
        warning:
          "bg-warning-bg text-warning-text border border-warning-border",
        danger:
          "bg-danger-bg text-danger-text border border-danger-border",
        // Backward compatibility alias for danger
        destructive:
          "bg-danger-bg text-danger-text border border-danger-border",
        info:
          "bg-info-bg text-info-text border border-info-border",
        outline:
          "border border-border text-foreground bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  /** Status text for screen reader - generates aria-label via getStatusAriaLabel */
  status?: string
  /** Optional description for screen reader context */
  statusDescription?: string
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, status, statusDescription, ...props }, ref) => {
    // Generate aria-label from status if provided and no explicit aria-label exists
    const ariaLabel = props["aria-label"] ?? (status ? getStatusAriaLabel(status, statusDescription) : undefined)

    return (
      <div
        ref={ref}
        role="status"
        className={cn(badgeVariants({ variant, className }))}
        aria-label={ariaLabel}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
