"use client"

// src/lib/visibility/components.tsx
// Helper components for visibility-controlled UI elements

import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from "react"
import Link from "next/link"
import { Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "@/components/ui/button"
import { useVisibility, useVisibilityOptional } from "./context"
import type { ElementId } from "./elements"

// ============================================================================
// Visible Component
// Wrapper that handles both hidden and locked states
// ============================================================================

export interface VisibleProps {
  /** The element ID to check visibility for */
  id: ElementId
  /** Content to render when visible and unlocked */
  children: ReactNode
  /** Custom content to render when locked (optional) */
  lockedFallback?: ReactNode
  /** Whether to show lock overlay (default: true) */
  showLockOverlay?: boolean
  /** Additional class name for the wrapper */
  className?: string
}

export function Visible({
  id,
  children,
  lockedFallback,
  showLockOverlay = true,
  className,
}: VisibleProps) {
  const visibility = useVisibilityOptional()

  // If no provider, render children (graceful degradation)
  if (!visibility) {
    return <>{children}</>
  }

  const { visible, locked, hint } = visibility.getStatus(id)

  // Hidden by business type or competence - render nothing
  if (!visible) return null

  // Locked by progression - show disabled state with hint
  if (locked) {
    if (lockedFallback) return <>{lockedFallback}</>

    if (!showLockOverlay) {
      return (
        <div className={cn("opacity-40 pointer-events-none select-none", className)}>
          {children}
        </div>
      )
    }

    return (
      <div className={cn("relative", className)}>
        <div className="opacity-40 pointer-events-none select-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface)]/80 rounded-xl backdrop-blur-sm">
          <div className="text-center p-4">
            <Lock className="h-6 w-6 mx-auto mb-2 text-[var(--muted)]" />
            <p className="text-sm text-[var(--muted)] max-w-[200px]">{hint}</p>
          </div>
        </div>
      </div>
    )
  }

  // Visible and unlocked
  return <>{children}</>
}

// ============================================================================
// VisibleNavItem Component
// Navigation item with visibility and lock support
// ============================================================================

export interface VisibleNavItemProps {
  /** The element ID to check visibility for */
  id: ElementId
  /** Navigation destination */
  href: string
  /** Icon to display */
  icon: ReactNode
  /** Label text */
  label: string
  /** Whether this item is currently active */
  isActive?: boolean
  /** Whether this is a legacy route (shows visual indicator) */
  legacy?: boolean
  /** Additional class name */
  className?: string
}

export function VisibleNavItem({
  id,
  href,
  icon,
  label,
  isActive = false,
  legacy = false,
  className,
}: VisibleNavItemProps) {
  const visibility = useVisibilityOptional()

  // If no provider, render normal link (graceful degradation)
  if (!visibility) {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
          isActive
            ? "bg-[var(--surface-secondary)] text-[var(--foreground)]"
            : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]",
          legacy && "opacity-60 italic",
          className
        )}
      >
        {icon}
        <span className="flex-1">{label}</span>
        {legacy && <span className="ml-auto text-xs text-[var(--muted)]">(legacy)</span>}
      </Link>
    )
  }

  const { visible, locked, hint } = visibility.getStatus(id)

  // Hidden - don't render
  if (!visible) return null

  // Locked - show disabled state
  if (locked) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg cursor-not-allowed",
          "text-[var(--muted)] opacity-50",
          legacy && "italic",
          className
        )}
        title={hint || undefined}
      >
        <span className="opacity-60">{icon}</span>
        <span className="flex-1 opacity-60">{label}</span>
        {legacy && <span className="text-xs text-[var(--muted)] mr-1">(legacy)</span>}
        <Lock className="h-3 w-3" />
      </div>
    )
  }

  // Unlocked - render normal link
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
        isActive
          ? "bg-[var(--surface-secondary)] text-[var(--foreground)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]",
        legacy && "opacity-60 italic",
        className
      )}
    >
      {icon}
      <span className="flex-1">{label}</span>
      {legacy && <span className="ml-auto text-xs text-[var(--muted)]">(legacy)</span>}
    </Link>
  )
}

// ============================================================================
// VisibleButton Component
// Button with visibility and lock support
// ============================================================================

export interface VisibleButtonProps extends ButtonProps {
  /** The element ID to check visibility for */
  id: ElementId
  /** Render as child component using Radix Slot */
  asChild?: boolean
}

export const VisibleButton = forwardRef<HTMLButtonElement, VisibleButtonProps>(
  ({ id, children, className, disabled, title, asChild, ...props }, ref) => {
    const visibility = useVisibilityOptional()

    // If no provider, render normal button (graceful degradation)
    if (!visibility) {
      return (
        <Button
          ref={ref}
          className={className}
          disabled={disabled}
          title={title}
          asChild={asChild}
          {...props}
        >
          {children}
        </Button>
      )
    }

    const { visible, locked, hint } = visibility.getStatus(id)

    // Hidden - don't render
    if (!visible) return null

    // When asChild is true, we need to render children directly with merged props
    // because Button with asChild uses Slot which requires exactly ONE child
    // (we can't have {children} AND {locked && <Lock />} as siblings)
    if (asChild) {
      return (
        <Button
          ref={ref}
          className={cn(className, locked && "opacity-60")}
          disabled={locked || disabled}
          title={locked ? hint || undefined : title}
          asChild
          {...props}
        >
          {children}
        </Button>
      )
    }

    // Regular button mode - can safely add Lock icon as sibling
    return (
      <Button
        ref={ref}
        className={cn(className, locked && "opacity-60")}
        disabled={locked || disabled}
        title={locked ? hint || undefined : title}
        {...props}
      >
        {children}
        {locked && <Lock className="h-3 w-3 ml-2" />}
      </Button>
    )
  }
)
VisibleButton.displayName = "VisibleButton"

// ============================================================================
// VisibleLink Component
// Link with visibility and lock support
// ============================================================================

export interface VisibleLinkProps {
  /** The element ID to check visibility for */
  id: ElementId
  /** Link destination */
  href: string
  /** Content to render */
  children: ReactNode
  /** Additional class name */
  className?: string
}

export function VisibleLink({ id, href, children, className }: VisibleLinkProps) {
  const visibility = useVisibilityOptional()

  // If no provider, render normal link (graceful degradation)
  if (!visibility) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }

  const { visible, locked, hint } = visibility.getStatus(id)

  // Hidden - don't render
  if (!visible) return null

  // Locked - show disabled state
  if (locked) {
    return (
      <span
        className={cn(className, "opacity-50 cursor-not-allowed inline-flex items-center gap-1")}
        title={hint || undefined}
      >
        {children}
        <Lock className="h-3 w-3" />
      </span>
    )
  }

  // Unlocked - render normal link
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

// ============================================================================
// useElementStatus Hook
// Direct access to element status without component wrapper
// ============================================================================

export function useElementStatus(id: ElementId) {
  const visibility = useVisibilityOptional()

  if (!visibility) {
    return { visible: true, locked: false, hint: null }
  }

  return visibility.getStatus(id)
}
