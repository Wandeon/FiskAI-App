"use client"

import { useEffect, useRef, useCallback } from "react"
import Script from "next/script"

declare global {
  interface Window {
    turnstile: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          "error-callback"?: () => void
          "expired-callback"?: () => void
          theme?: "light" | "dark" | "auto"
          size?: "normal" | "compact" | "invisible"
        }
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

interface TurnstileWidgetProps {
  /** Callback when verification succeeds with the token */
  onVerify: (token: string) => void
  /** Callback when verification fails */
  onError?: () => void
  /** Callback when the token expires */
  onExpire?: () => void
  /** Widget theme - defaults to 'auto' */
  theme?: "light" | "dark" | "auto"
  /** Widget size - defaults to 'invisible' for seamless UX */
  size?: "normal" | "compact" | "invisible"
  /** Additional CSS class for the container */
  className?: string
}

/**
 * Cloudflare Turnstile Widget Component
 *
 * Provides invisible bot protection for forms.
 * Requires NEXT_PUBLIC_TURNSTILE_SITE_KEY environment variable.
 *
 * @example
 * ```tsx
 * const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
 *
 * <form onSubmit={handleSubmit}>
 *   <TurnstileWidget onVerify={setTurnstileToken} />
 *   <button type="submit" disabled={!turnstileToken}>
 *     Submit
 *   </button>
 * </form>
 * ```
 */
export function TurnstileWidget({
  onVerify,
  onError,
  onExpire,
  theme = "auto",
  size = "invisible",
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !siteKey || widgetIdRef.current) return

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onVerify,
      "error-callback": onError,
      "expired-callback": onExpire,
      theme,
      size,
    })
  }, [siteKey, onVerify, onError, onExpire, theme, size])

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (widgetIdRef.current) {
        window.turnstile?.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [])

  // Don't render in development without key
  if (!siteKey) {
    return null
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
        onLoad={renderWidget}
      />
      <div ref={containerRef} className={className} />
    </>
  )
}
