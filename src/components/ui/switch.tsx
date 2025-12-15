'use client'

import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
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
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer',
          checked ? 'bg-blue-600' : 'bg-gray-200',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          ref={ref}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          {...props}
        />
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </label>
    )
  }
)
Switch.displayName = 'Switch'

export { Switch }
