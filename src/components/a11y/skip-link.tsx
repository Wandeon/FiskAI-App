/**
 * Skip Link Component
 * Provides keyboard users a way to skip navigation and jump to main content
 * WCAG 2.1 Success Criterion 2.4.1 (Bypass Blocks)
 */

import { cn } from "@/lib/utils"

interface SkipLinkProps {
  href: string
  children: React.ReactNode
  className?: string
}

/**
 * Single skip link - use when you only need one skip target
 */
export function SkipLink({ href, children, className }: SkipLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        // Visually hidden by default
        "sr-only",
        // Visible when focused
        "focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50",
        "focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white",
        "focus:rounded-md focus:shadow-lg",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        "transition-all duration-150",
        className
      )}
    >
      {children}
    </a>
  )
}

/**
 * Skip links container - use when you have multiple skip targets
 */
export function SkipLinks({ children }: { children: React.ReactNode }) {
  return (
    <div className="skip-links" role="navigation" aria-label="Skip links">
      {children}
    </div>
  )
}

/**
 * Croatian skip links for admin dashboard
 */
export function AdminSkipLinks() {
  return (
    <SkipLinks>
      <SkipLink href="#main-content">Preskoči navigaciju</SkipLink>
      <SkipLink href="#sidebar-nav">Preskoči na glavnu navigaciju</SkipLink>
    </SkipLinks>
  )
}

/**
 * Croatian skip links for client dashboard
 */
export function DashboardSkipLinks() {
  return (
    <SkipLinks>
      <SkipLink href="#main-content">Preskoči na glavni sadržaj</SkipLink>
      <SkipLink href="#primary-nav">Preskoči na navigaciju</SkipLink>
    </SkipLinks>
  )
}

/**
 * English skip links (for international use)
 */
export function DefaultSkipLinks() {
  return (
    <SkipLinks>
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <SkipLink href="#primary-nav">Skip to navigation</SkipLink>
    </SkipLinks>
  )
}
