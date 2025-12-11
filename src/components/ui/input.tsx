import { forwardRef, InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, id, ...props }, ref) => {
    const errorId = error && id ? `${id}-error` : undefined

    return (
      <input
        type={type}
        id={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        className={cn(
          "flex h-10 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-base md:text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] md:min-h-0",
          error && "border-red-500 focus-visible:ring-red-500",
          className
        )}
        ref={ref}
        autoCapitalize={type === "email" ? "none" : undefined}
        autoCorrect={type === "email" ? "off" : undefined}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
