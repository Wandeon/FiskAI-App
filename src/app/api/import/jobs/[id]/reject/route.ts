import { NextResponse } from 'next/server'
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const job = await db.importJob.findUnique({ where: { id } })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  await db.importJob.update({
    where: { id },
    data: { status: 'REJECTED' },
  })

  return NextResponse.json({ success: true })
}
