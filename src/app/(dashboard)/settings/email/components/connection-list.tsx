'use client'

// src/app/(dashboard)/settings/email/components/connection-list.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Trash2, RefreshCw } from 'lucide-react'
import type { EmailConnection, EmailImportRule } from '@prisma/client'
import { ImportRulesSection } from './import-rules'

type ConnectionWithRules = EmailConnection & {
  importRules: EmailImportRule[]
  _count: { attachments: number }
}

interface EmailConnectionListProps {
  connections: ConnectionWithRules[]
}

export function EmailConnectionList({ connections }: EmailConnectionListProps) {
  const router = useRouter()
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  async function handleDisconnect(connectionId: string) {
    if (!confirm('Are you sure you want to disconnect this email account?')) {
      return
    }

    setDisconnecting(connectionId)
    try {
      const response = await fetch(`/api/email/${connectionId}/disconnect`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Disconnect failed')
      }

      router.refresh()
    } catch (error) {
      console.error('Disconnect error:', error)
      alert(error instanceof Error ? error.message : 'Disconnect failed')
    } finally {
      setDisconnecting(null)
    }
  }

  if (connections.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No email accounts connected</p>
          <p className="text-sm text-muted-foreground">
            Connect Gmail or Outlook to automatically import bank statements
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {connections.map((connection) => (
        <Card key={connection.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{connection.emailAddress}</CardTitle>
                <CardDescription>
                  {connection.provider} - {connection._count.attachments} attachments
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={connection.status === 'CONNECTED' ? 'default' : 'destructive'}
              >
                {connection.status}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDisconnect(connection.id)}
                disabled={disconnecting === connection.id}
                className="h-8 w-8 p-0"
              >
                {disconnecting === connection.id ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              Last synced:{' '}
              {connection.lastSyncAt
                ? new Date(connection.lastSyncAt).toLocaleString()
                : 'Never'}
            </div>
            <ImportRulesSection
              connectionId={connection.id}
              rules={connection.importRules}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
