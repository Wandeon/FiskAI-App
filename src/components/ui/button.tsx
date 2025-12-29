import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-interactive text-inverse hover:bg-interactive-hover",
        // Backward compatibility alias for primary
        default:
          "bg-interactive text-inverse hover:bg-interactive-hover",
        secondary:
          "bg-surface border border-border text-foreground hover:bg-surface-1",
        danger:
          "bg-danger text-inverse hover:bg-danger/90",
        // Backward compatibility alias for danger
        destructive:
          "bg-danger text-inverse hover:bg-danger/90",
        ghost:
          "text-foreground hover:bg-surface-1",
        link:
          "text-link underline-offset-4 hover:underline",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-surface-1",
      },
      size: {
        sm: "h-8 px-3 text-body-sm",
        md: "h-10 px-4 text-body-base",
        lg: "h-12 px-6 text-body-lg",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /**
   * Accessible label for icon-only buttons (size="icon").
   * Screen readers will announce this text instead of the button content.
   * Required for icon-only buttons to meet WCAG accessibility standards.
   */
  "aria-label"?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
