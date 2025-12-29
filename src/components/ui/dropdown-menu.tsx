"use client"

import {
  forwardRef,
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  ReactNode,
  useId,
} from "react"
import { cn } from "@/lib/utils"

interface DropdownMenuContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  triggerId: string
  contentId: string
}

const DropdownMenuContext = createContext<DropdownMenuContextValue | undefined>(undefined)

function useDropdownMenu() {
  const context = useContext(DropdownMenuContext)
  if (!context) {
    throw new Error("useDropdownMenu must be used within a DropdownMenu")
  }
  return context
}

export function DropdownMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const triggerId = useId()
  const contentId = useId()

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerId, contentId }}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuContext.Provider>
  )
}

export const DropdownMenuTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
>(({ children, asChild, ...props }, ref) => {
  const { setOpen, open, triggerId, contentId } = useDropdownMenu()

  const handleClick = () => setOpen(!open)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
      e.preventDefault()
      setOpen(true)
    }
  }

  if (asChild && children) {
    // Clone the child element and add onClick handler
    const child = children as React.ReactElement
    return (
      <div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        ref={ref as any}
        id={triggerId}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={contentId}
      >
        {child}
      </div>
    )
  }

  return (
    <button
      ref={ref}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      id={triggerId}
      aria-haspopup="true"
      aria-expanded={open}
      aria-controls={contentId}
      {...props}
    >
      {children}
    </button>
  )
})
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

export function DropdownMenuContent({
  children,
  align = "start",
  className,
}: {
  children: ReactNode
  align?: "start" | "end"
  className?: string
}) {
  const { open, setOpen, contentId, triggerId } = useDropdownMenu()
  const contentRef = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!open) return

      const items = contentRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])')
      if (!items) return

      switch (event.key) {
        case "Escape":
          event.preventDefault()
          setOpen(false)
          document.getElementById(triggerId)?.focus()
          break
        case "ArrowDown":
          event.preventDefault()
          setFocusedIndex((prev) => (prev + 1) % items.length)
          break
        case "ArrowUp":
          event.preventDefault()
          setFocusedIndex((prev) => (prev - 1 + items.length) % items.length)
          break
        case "Home":
          event.preventDefault()
          setFocusedIndex(0)
          break
        case "End":
          event.preventDefault()
          setFocusedIndex(items.length - 1)
          break
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleKeyDown)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
        document.removeEventListener("keydown", handleKeyDown)
      }
    }
  }, [open, setOpen, triggerId])

  useEffect(() => {
    if (open && focusedIndex >= 0) {
      const items = contentRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])')
      if (items && items[focusedIndex]) {
        ;(items[focusedIndex] as HTMLElement).focus()
      }
    }
  }, [focusedIndex, open])

  if (!open) return null

  return (
    <div
      ref={contentRef}
      id={contentId}
      role="menu"
      aria-labelledby={triggerId}
      className={cn(
        "absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border border-border bg-surface p-1 shadow-md",
        align === "end" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  )
}

export function DropdownMenuItem({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  const { setOpen } = useDropdownMenu()

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick()
      setOpen(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <button
      role="menuitem"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-surface-1 focus:bg-surface-1 text-foreground",
        disabled && "pointer-events-none opacity-50 text-muted",
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      tabIndex={disabled ? -1 : 0}
    >
      {children}
    </button>
  )
}
