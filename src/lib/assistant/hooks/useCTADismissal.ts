import { useState, useCallback, useEffect } from "react"
import type { Surface } from "../types"

interface UseCTADismissalProps {
  surface: Surface
}

interface DismissalData {
  expiry: number
  queriesAtDismissal: number
}

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getStorageKey(surface: Surface): string {
  return `assistant_cta_dismissed_${surface.toLowerCase()}`
}

export function useCTADismissal({ surface }: UseCTADismissalProps) {
  const [isDismissed, setIsDismissed] = useState(false)
  const [queriesSinceDismissal, setQueriesSinceDismissal] = useState(0)
  const [expiryTime, setExpiryTime] = useState<number | null>(null)

  // Check localStorage on mount
  useEffect(() => {
    const key = getStorageKey(surface)
    const stored = localStorage.getItem(key)

    if (stored) {
      try {
        const data: DismissalData = JSON.parse(stored)
        if (Date.now() < data.expiry) {
          setIsDismissed(true)
          setExpiryTime(data.expiry)
        } else {
          // Expired, remove it
          localStorage.removeItem(key)
          setIsDismissed(false)
          setExpiryTime(null)
        }
      } catch {
        localStorage.removeItem(key)
        setIsDismissed(false)
        setExpiryTime(null)
      }
    }
  }, [surface])

  // Check if dismissal has expired whenever component renders
  useEffect(() => {
    if (isDismissed && expiryTime !== null && Date.now() >= expiryTime) {
      setIsDismissed(false)
      setExpiryTime(null)
      localStorage.removeItem(getStorageKey(surface))
    }
  })

  const dismiss = useCallback(
    (queriesAtDismissal = 0) => {
      const expiry = Date.now() + COOLDOWN_MS
      setIsDismissed(true)
      setQueriesSinceDismissal(0)
      setExpiryTime(expiry)

      const data: DismissalData = {
        expiry,
        queriesAtDismissal,
      }

      localStorage.setItem(getStorageKey(surface), JSON.stringify(data))
    },
    [surface]
  )

  const recordSuccessfulQuery = useCallback(() => {
    if (isDismissed) {
      setQueriesSinceDismissal((prev) => prev + 1)
    }
  }, [isDismissed])

  const reset = useCallback(() => {
    setIsDismissed(false)
    setQueriesSinceDismissal(0)
    setExpiryTime(null)
    localStorage.removeItem(getStorageKey(surface))
  }, [surface])

  return {
    isDismissed,
    queriesSinceDismissal,
    dismiss,
    recordSuccessfulQuery,
    reset,
  }
}
