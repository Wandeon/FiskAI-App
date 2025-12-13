import { useEffect, useState } from "react"

type TicketSummary = {
  openCount: number
  assignedToMe: number
  unassigned: number
  unread: number
}

export function useTicketSummary() {
  const [data, setData] = useState<TicketSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch("/api/support/tickets/summary", { cache: "no-store" })
        if (!res.ok) throw new Error("Failed to fetch")
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setData(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const id = setInterval(load, 60000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { summary: data, loading }
}
