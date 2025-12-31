"use client"

import Link from "next/link"
import { forwardRef, type ComponentPropsWithoutRef } from "react"
import { routes, type RouteId, type Locale } from "@/config/routes"
import { cn } from "@/lib/utils"

// =============================================================================
// SmartLink - Type-safe route linking
// =============================================================================

interface SmartLinkProps extends Omit<ComponentPropsWithoutRef<typeof Link>, "href"> {
  /** Type-safe route identifier from the registry */
  to: RouteId
  /** Locale for the link (defaults to Croatian) */
  locale?: Locale
  /** Additional path segments (for dynamic routes) */
  params?: Record<string, string>
}

/**
 * Type-safe link component that enforces route registry usage.
 *
 * Benefits:
 * - TypeScript prevents typos in route names
 * - Automatic locale handling
 * - Single source of truth for all routes
 * - Compile-time validation
 *
 * @example
 * // Basic usage
 * <SmartLink to="features">Mogućnosti</SmartLink>
 *
 * // With locale
 * <SmartLink to="features" locale="en">Features</SmartLink>
 *
 * // With dynamic params (for future use)
 * <SmartLink to="vodic" params={{ slug: "pausalni-obrt" }}>
 *   Vodič za paušalni obrt
 * </SmartLink>
 *
 * // TypeScript will error on invalid routes:
 * <SmartLink to="featurez">...</SmartLink> // ❌ Error!
 */
export const SmartLink = forwardRef<HTMLAnchorElement, SmartLinkProps>(function SmartLink(
  { to, locale = "hr", params, children, ...props },
  ref
) {
  const routeDef = routes[to]

  if (!routeDef) {
    console.error(`SmartLink: Unknown route "${to}"`)
    return <span>{children}</span>
  }

  let href = routeDef.path[locale]

  // Handle dynamic params (for routes like /vodic/[slug])
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      href = href.replace(`[${key}]`, value)
    })
  }

  return (
    <Link
      ref={ref}
      href={href}
      className={cn(
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 rounded-sm",
        props.className
      )}
      {...props}
    >
      {children}
    </Link>
  )
})

// =============================================================================
// useRoute hook - For programmatic navigation
// =============================================================================

/**
 * Hook to get route information for programmatic use
 *
 * @example
 * const { path, title } = useRoute("features");
 * router.push(path);
 */
export function useRoute(routeId: RouteId, locale: Locale = "hr") {
  const routeDef = routes[routeId]

  return {
    path: routeDef.path[locale],
    title: routeDef.title,
    priority: routeDef.priority,
    category: routeDef.category,
  }
}

/**
 * Get route path without hook (for server components)
 */
export function getRoute(routeId: RouteId, locale: Locale = "hr"): string {
  return routes[routeId].path[locale]
}

// =============================================================================
// Route validation utilities
// =============================================================================

/**
 * Validates that a route exists at compile time.
 * Use in tests or build scripts to catch missing routes.
 */
export function assertValidRoute(routeId: string): asserts routeId is RouteId {
  if (!(routeId in routes)) {
    throw new Error(`Invalid route: "${routeId}" is not in the route registry`)
  }
}

/**
 * Type guard for runtime route validation
 */
export function isRouteId(value: string): value is RouteId {
  return value in routes
}
