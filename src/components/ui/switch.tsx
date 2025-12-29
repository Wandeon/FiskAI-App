"use client"

import { forwardRef, InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "type"
> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /**
   * Accessible label for the switch.
   * Required for standalone switches without a visible label.
   */
  "aria-label"?: string
  /**
   * ID of the element that labels this switch.
   * Use when the switch has a visible label element.
   */
  "aria-labelledby"?: string
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked, onCheckedChange, disabled, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onCheckedChange) {
        onCheckedChange(event.target.checked)
      }
    }

    return (
      <label
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer",
          "focus-within:ring-2 focus-within:ring-border-focus focus-within:ring-offset-2",
          checked ? "bg-blue-600" : "bg-gray-200",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <input
          type="checkbox"
          role="switch"
          className="sr-only focus:outline-none"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          aria-checked={checked}
          {...props}
        />
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
          aria-hidden="true"
        />
      </label>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
