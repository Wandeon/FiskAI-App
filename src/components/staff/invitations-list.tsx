import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Mail, Clock, CheckCircle, XCircle, Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

async function getInvitations(staffId: string) {
  const invitations = await db.clientInvitation.findMany({
    where: { staffId },
    include: {
      company: {
        select: { id: true, name: true, oib: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return invitations
}

function getStatusBadge(status: string, expiresAt: Date) {
  const isExpired = new Date() > expiresAt && status === 'PENDING'

  if (isExpired) {
    return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Expired</Badge>
  }

  switch (status) {
    case 'PENDING':
      return <Badge variant="outline" className="gap-1"><Mail className="h-3 w-3" />Pending</Badge>
    case 'ACCEPTED':
      return <Badge variant="default" className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" />Accepted</Badge>
    case 'CANCELLED':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Cancelled</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

export async function InvitationsList() {
  const user = await getCurrentUser()
  if (!user) return null

  const invitations = await getInvitations(user.id)

  const pendingCount = invitations.filter(
    i => i.status === 'PENDING' && new Date() <= i.expiresAt
  ).length
  const acceptedCount = invitations.filter(i => i.status === 'ACCEPTED').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Client Invitations</h1>
          <p className="text-muted-foreground">
            {pendingCount} pending, {acceptedCount} accepted
          </p>
        </div>
        <Link href="/invitations/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Invitation
          </Button>
        </Link>
      </div>

      {invitations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No invitations sent yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Invite potential clients to join FiskAI
            </p>
            <Link href="/invitations/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Send First Invitation
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invitations.map((invitation) => (
            <Card key={invitation.id} className="hover:bg-accent/50 transition-colors">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate">{invitation.email}</h3>
                    {getStatusBadge(invitation.status, invitation.expiresAt)}
                  </div>
                  {invitation.companyName && (
                    <p className="text-sm text-muted-foreground">
                      Company: {invitation.companyName}
                    </p>
                  )}
                  {invitation.company && (
                    <p className="text-sm text-green-600">
                      Registered as: {invitation.company.name} (OIB: {invitation.company.oib})
                    </p>
                  )}
                  {invitation.message && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {invitation.message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="text-right">
                    <div className="text-xs">Sent</div>
                    <div className="font-medium text-foreground">
                      {formatDistanceToNow(invitation.createdAt, { addSuffix: true })}
                    </div>
                  </div>
                  {invitation.status === 'PENDING' && new Date() <= invitation.expiresAt && (
                    <div className="text-right">
                      <div className="text-xs">Expires</div>
                      <div className="font-medium text-foreground">
                        {formatDistanceToNow(invitation.expiresAt, { addSuffix: true })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
