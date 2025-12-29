// src/app/(dashboard)/banking/components/connect-button.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, Link2, Unlink, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface ConnectButtonProps {
  bankAccountId: string
  connectionStatus: "MANUAL" | "CONNECTED" | "EXPIRED"
  bankName: string
}

export function ConnectButton({ bankAccountId, connectionStatus, bankName }: ConnectButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    setLoading(true)
    try {
      const res = await fetch("/api/bank/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Povezivanje nije uspjelo")
        return
      }

      // Redirect to bank auth
      window.location.href = data.redirectUrl
    } catch (error) {
      toast.error("Povezivanje nije uspjelo")
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setLoading(true)
    try {
      const res = await fetch("/api/bank/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (data.stillValid) {
          toast.info("Veza je još uvijek aktivna")
        } else {
          toast.error(data.error || "Osvježavanje nije uspjelo")
        }
        return
      }

      // Redirect to bank auth
      window.location.href = data.redirectUrl
    } catch (error) {
      toast.error("Osvježavanje nije uspjelo")
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm("Jeste li sigurni da želite prekinuti automatsku sinkronizaciju?")) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/bank/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankAccountId }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Prekid veze nije uspio")
        return
      }

      toast.success("Veza prekinuta")
      window.location.reload()
    } catch (error) {
      toast.error("Prekid veze nije uspio")
    } finally {
      setLoading(false)
    }
  }

  if (connectionStatus === "CONNECTED") {
    return (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Osvježi
            </>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Unlink className="h-4 w-4 mr-2" />
              Prekini
            </>
          )}
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant={connectionStatus === "EXPIRED" ? "default" : "outline"}
      size="sm"
      onClick={handleConnect}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Link2 className="h-4 w-4 mr-2" />
          {connectionStatus === "EXPIRED" ? "Obnovi vezu" : "Poveži banku"}
        </>
      )}
    </Button>
  )
}
