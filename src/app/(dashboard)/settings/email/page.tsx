// src/app/(dashboard)/settings/email/page.tsx

import { redirect } from 'next/navigation'
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import { EmailConnectionList } from './components/connection-list'
import { ConnectEmailButton } from './components/connect-button'

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const user = await requireAuth()
  if (!user.id) redirect('/login')

  const company = await requireCompany(user.id)
  setTenantContext({ companyId: company.id, userId: user.id })

  const connections = await db.emailConnection.findMany({
    where: { companyId: company.id },
    include: {
      importRules: true,
      _count: { select: { attachments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const params = await searchParams

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email Connections</h1>
          <p className="text-sm text-muted-foreground">
            Connect your email to automatically import bank statements
          </p>
        </div>
        <ConnectEmailButton />
      </div>

      {params.success === 'connected' && (
        <div className="rounded-md bg-green-50 p-4 text-green-800">
          Email connected successfully! Set up import rules below.
        </div>
      )}

      {params.error && (
        <div className="rounded-md bg-red-50 p-4 text-red-800">
          Connection failed: {params.error.replace(/_/g, ' ')}
        </div>
      )}

      <EmailConnectionList connections={connections} />
    </div>
  )
}
