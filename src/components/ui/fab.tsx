'use client'

import { ReactNode } from 'react'
import { useIsMobile } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

interface FABProps {
  icon: ReactNode
  onClick: () => void
  label?: string
  className?: string
}

export function FAB({ icon, onClick, label, className }: FABProps) {
  const isMobile = useIsMobile()

  if (!isMobile) {
    return null
  }

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        'fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:scale-95',
        className
      )}
    >
      {icon}
    </button>
  )
}
