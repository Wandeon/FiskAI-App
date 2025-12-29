import { ReactNode } from "react"
import { redirect, notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { StaffClientContextHeader } from "@/components/staff/client-context-header"

interface ClientContextLayoutProps {
  children: ReactNode
  params: Promise<{ clientId: string }>
}

async function verifyStaffAccess(userId: string, companyId: string, systemRole: string) {
  // ADMINs can access any client
  if (systemRole === "ADMIN") {
    return true
  }

  // STAFF must be assigned to the client
  const assignment = await db.staffAssignment.findUnique({
    where: {
      staffId_companyId: {
        staffId: userId,
        companyId: companyId,
      },
    },
  })

  return !!assignment
}

async function getClientCompany(companyId: string) {
  return db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      oib: true,
      entitlements: true,
      legalForm: true,
      isVatPayer: true,
      eInvoiceProvider: true,
    },
  })
}

export default async function ClientContextLayout({ children, params }: ClientContextLayoutProps) {
  const session = await auth()
  const { clientId } = await params

  if (!session?.user) {
    redirect("/login")
  }

  // Check for STAFF or ADMIN role
  if (session.user.systemRole !== "STAFF" && session.user.systemRole !== "ADMIN") {
    redirect("/dashboard")
  }

  // Verify staff has access to this client
  const hasAccess = await verifyStaffAccess(session.user.id, clientId, session.user.systemRole)
  if (!hasAccess) {
    redirect("/clients")
  }

  // Get client company details
  const company = await getClientCompany(clientId)
  if (!company) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <StaffClientContextHeader
        clientId={company.id}
        clientName={company.name}
        clientOib={company.oib}
        legalForm={company.legalForm}
      />
      {children}
    </div>
  )
}
