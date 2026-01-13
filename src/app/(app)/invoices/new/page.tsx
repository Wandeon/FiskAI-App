import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { resolveCapabilityForUser } from "@/lib/capabilities/server"
import { BlockerDisplay } from "@/components/capability"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { InvoiceForm } from "./invoice-form"
import { redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

const TYPE_LABELS: Record<string, string> = {
  INVOICE: "Račun",
  E_INVOICE: "E-Račun",
  QUOTE: "Ponuda",
  PROFORMA: "Predračun",
  CREDIT_NOTE: "Odobrenje",
  DEBIT_NOTE: "Terećenje",
}

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const params = await searchParams

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  // Check capability before allowing access
  const capability = await resolveCapabilityForUser("INV-001", {
    entityType: "EInvoice",
  })

  if (capability.state === "UNAUTHORIZED") {
    redirect("/cc")
  }

  if (capability.state === "BLOCKED") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Nije moguće kreirati račun</h1>
        <BlockerDisplay blockers={capability.blockers} />
        <Link href="/cc">
          <Button>Povratak na Kontrolni centar</Button>
        </Link>
      </div>
    )
  }

  // Get contacts for buyer dropdown
  const contacts = await db.contact.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true, oib: true },
    orderBy: { name: "asc" },
  })

  // Get products for quick add
  const products = await db.product.findMany({
    where: { companyId: company.id, isActive: true },
    select: { id: true, name: true, price: true, vatRate: true, unit: true },
    orderBy: { name: "asc" },
  })

  const type = params.type || "INVOICE"
  const title = TYPE_LABELS[type] || "Dokument"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Novi {title.toLowerCase()}</h1>
          <p className="text-muted-foreground">
            Spremi nacrt, zatim koristi Kontrolni centar za daljnje akcije.
          </p>
        </div>
        <Link href="/cc">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kontrolni centar
          </Button>
        </Link>
      </div>

      <InvoiceForm
        type={type}
        contacts={contacts}
        products={products}
        isPausalni={company.legalForm === "OBRT_PAUSAL"}
      />
    </div>
  )
}
