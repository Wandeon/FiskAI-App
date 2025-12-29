import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  {
    variants: {
      variant: {
        default: "bg-surface text-foreground border-border",
        success: "bg-success-bg text-success-text border-success-border [&>svg]:text-success-icon",
        warning: "bg-warning-bg text-warning-text border-warning-border [&>svg]:text-warning-icon",
        danger: "bg-danger-bg text-danger-text border-danger-border [&>svg]:text-danger-icon",
        info: "bg-info-bg text-info-text border-info-border [&>svg]:text-info-icon",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  /**
   * Controls how screen readers announce the alert.
   * - "polite" (default): Waits for user to finish current activity
   * - "assertive": Interrupts immediately for critical messages
   * - "off": No announcement (for static alerts present on page load)
   */
  "aria-live"?: "polite" | "assertive" | "off";
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, "aria-live": ariaLive = "polite", ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      aria-live={ariaLive}
      aria-atomic="true"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-body-sm [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
