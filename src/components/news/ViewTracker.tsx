"use client"

import { useEffect, useRef } from "react"

interface ViewTrackerProps {
  slug: string
}

/**
 * Privacy-friendly view tracker component.
 * Tracks a single view per page load (no cookies, no user identification).
 */
export function ViewTracker({ slug }: ViewTrackerProps) {
  const tracked = useRef(false)

  useEffect(() => {
    // Only track once per page load
    if (tracked.current) return
    tracked.current = true

    // Fire and forget - don't block rendering
    fetch(`/api/news/posts/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      keepalive: true, // Ensure request completes even if page is closed
    }).catch(() => {
      // Silently fail - analytics should not affect user experience
    })
  }, [slug])

  return null
}
