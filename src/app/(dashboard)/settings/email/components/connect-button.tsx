'use client'

// src/app/(dashboard)/settings/email/components/connect-button.tsx

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Mail, Plus } from 'lucide-react'

export function ConnectEmailButton() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleConnect(provider: 'GMAIL' | 'MICROSOFT') {
    setLoading(provider)
    try {
      const response = await fetch('/api/email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Connection failed')
      }

      // Redirect to OAuth
      window.location.href = data.authUrl
    } catch (error) {
      console.error('Connect error:', error)
      alert(error instanceof Error ? error.message : 'Connection failed')
      setLoading(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Connect Email
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleConnect('GMAIL')}
          disabled={loading === 'GMAIL'}
        >
          <Mail className="mr-2 h-4 w-4" />
          {loading === 'GMAIL' ? 'Connecting...' : 'Connect Gmail'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleConnect('MICROSOFT')}
          disabled={loading === 'MICROSOFT'}
        >
          <Mail className="mr-2 h-4 w-4" />
          {loading === 'MICROSOFT' ? 'Connecting...' : 'Connect Outlook'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
