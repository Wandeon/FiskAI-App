import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string | boolean;
  /**
   * ID of the element that describes this textarea (typically an error message).
   * When provided with error text, screen readers will announce the description.
   */
  "aria-describedby"?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        aria-invalid={!!error}
        aria-describedby={props["aria-describedby"]}
        className={cn(
          // Base styles
          "flex min-h-[80px] w-full rounded-md border px-3 py-2 text-body-base",
          "bg-surface text-foreground placeholder:text-muted",
          "transition-colors resize-none",
          // Focus styles
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2",
          // Disabled styles
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Default border
          !error && "border-border",
          // Error state
          error && "border-danger focus-visible:ring-danger",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
