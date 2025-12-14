import { redirect, notFound } from 'next/navigation'
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailRouter({ params }: PageProps) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const { id } = await params

  // Try to find the document in each table and redirect to appropriate detail page
  // Check invoices first (most common)
  const invoice = await db.eInvoice.findUnique({
    where: { id },
    select: { id: true, type: true, companyId: true },
  })

  if (invoice && invoice.companyId === company.id) {
    if (invoice.type === 'E_INVOICE') {
      redirect(`/e-invoices/${id}`)
    } else {
      redirect(`/invoices/${id}`)
    }
  }

  // Check bank statements (ImportJob)
  const importJob = await db.importJob.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  })

  if (importJob && importJob.companyId === company.id) {
    redirect(`/banking/documents/${id}`)
  }

  // Check expenses
  const expense = await db.expense.findUnique({
    where: { id },
    select: { id: true, companyId: true },
  })

  if (expense && expense.companyId === company.id) {
    redirect(`/expenses/${id}`)
  }

  // Document not found
  notFound()
}
