"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"
import { useRouter } from "next/navigation"

const STORAGE_KEY = "staffCurrentClient"

interface StaffClient {
  id: string
  name: string
  oib: string
  entitlements: string[]
}

interface StaffClientContextType {
  currentClient: StaffClient | null
  setCurrentClient: (client: StaffClient | null) => void
  switchClient: (clientId: string) => Promise<void>
  clearClient: () => void
  isWorkingOnClient: boolean
}

const StaffClientContext = createContext<StaffClientContextType | undefined>(undefined)

function getStoredClient(): StaffClient | null {
  if (typeof window === "undefined") return null
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

function persistClient(client: StaffClient | null): void {
  if (typeof window === "undefined") return
  try {
    if (client) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(client))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Ignore storage errors
  }
}

export function StaffClientProvider({ children }: { children: ReactNode }) {
  const [currentClient, setCurrentClientState] = useState<StaffClient | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)
  const router = useRouter()

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    const stored = getStoredClient()
    if (stored) {
      setCurrentClientState(stored)
    }
    setIsHydrated(true)
  }, [])

  const setCurrentClient = useCallback((client: StaffClient | null) => {
    setCurrentClientState(client)
    persistClient(client)
  }, [])

  const switchClient = useCallback(
    async (clientId: string) => {
      const response = await fetch(`/api/staff/clients/${clientId}`)
      if (response.ok) {
        const client = await response.json()
        setCurrentClient(client)
        // Navigate to the client context overview page within the staff portal
        router.push(`/clients/${clientId}`)
      }
    },
    [router, setCurrentClient]
  )

  const clearClient = useCallback(() => {
    setCurrentClient(null)
    router.push("/staff-dashboard")
  }, [router, setCurrentClient])

  return (
    <StaffClientContext.Provider
      value={{
        currentClient,
        setCurrentClient,
        switchClient,
        clearClient,
        isWorkingOnClient: isHydrated && currentClient !== null,
      }}
    >
      {children}
    </StaffClientContext.Provider>
  )
}

export function useStaffClient() {
  const context = useContext(StaffClientContext)
  if (context === undefined) {
    throw new Error("useStaffClient must be used within a StaffClientProvider")
  }
  return context
}
