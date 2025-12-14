// src/app/(dashboard)/banking/components/connect-button.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'

interface ConnectButtonProps {
  bankAccountId: string
  connectionStatus: 'MANUAL' | 'CONNECTED' | 'EXPIRED'
  bankName: string
}

export function ConnectButton({
  bankAccountId,
  connectionStatus,
  bankName,
}: ConnectButtonProps) {
  const [loading, setLoading] = useState(false)

  async function handleConnect() {
    setLoading(true)
    try {
      const res = await fetch('/api/bank/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Povezivanje nije uspjelo')
        return
      }

      // Redirect to bank auth
      window.location.href = data.redirectUrl
    } catch (error) {
      toast.error('Povezivanje nije uspjelo')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisconnect() {
    if (!confirm('Jeste li sigurni da želite prekinuti automatsku sinkronizaciju?')) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/bank/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId }),
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Prekid veze nije uspio')
        return
      }

      toast.success('Veza prekinuta')
      window.location.reload()
    } catch (error) {
      toast.error('Prekid veze nije uspio')
    } finally {
      setLoading(false)
    }
  }

  if (connectionStatus === 'CONNECTED') {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleDisconnect}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Unlink className="h-4 w-4 mr-2" />
            Prekini vezu
          </>
        )}
      </Button>
    )
  }

  return (
    <Button
      variant={connectionStatus === 'EXPIRED' ? 'default' : 'outline'}
      size="sm"
      onClick={handleConnect}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Link2 className="h-4 w-4 mr-2" />
          {connectionStatus === 'EXPIRED' ? 'Obnovi vezu' : 'Poveži banku'}
        </>
      )}
    </Button>
  )
}
