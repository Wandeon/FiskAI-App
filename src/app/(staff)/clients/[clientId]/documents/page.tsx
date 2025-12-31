import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { logStaffAccess, getRequestMetadata } from "@/lib/staff-audit"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { DataTable, Column } from "@/components/ui/data-table"
import { FolderOpen, Download, Eye, FileText, Receipt, File } from "lucide-react"
import Link from "next/link"
import type { DocumentStatus, Prisma } from "@prisma/client"

interface PageProps {
  params: Promise<{ clientId: string }>
}

const categoryLabels: Record<string, string> = {
  expense: "Expense",
  invoice: "Invoice",
  contract: "Contract",
  other: "Other",
}

const categoryIcons: Record<string, typeof FileText> = {
  expense: Receipt,
  invoice: FileText,
  contract: File,
  other: FolderOpen,
}

type DocumentItem = {
  id: string
  name: string
  category: string
  status: DocumentStatus
  totalAmount: Prisma.Decimal | null
  currency: string | null
  uploadedAt: Date
  mimeType: string | null
}

async function getClientDocuments(companyId: string) {
  return db.document.findMany({
    where: { companyId },
    orderBy: { uploadedAt: "desc" },
    select: {
      id: true,
      name: true,
      category: true,
      status: true,
      totalAmount: true,
      currency: true,
      uploadedAt: true,
      mimeType: true,
    },
  })
}

export default async function ClientDocumentsPage({ params }: PageProps) {
  const { clientId } = await params
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  const documents = await getClientDocuments(clientId)

  // Log staff access to documents (GDPR compliance)
  const reqHeaders = await headers()
  const { ipAddress, userAgent } = getRequestMetadata(reqHeaders)
  await logStaffAccess({
    staffUserId: session.user.id,
    clientCompanyId: clientId,
    action: "STAFF_VIEW_DOCUMENTS",
    resourceType: "Document",
    metadata: { documentCount: documents.length },
    ipAddress,
    userAgent,
  })

  // Calculate stats
  const stats = {
    total: documents.length,
    expenses: documents.filter((d) => d.category === "expense").length,
    invoices: documents.filter((d) => d.category === "invoice").length,
    pending: documents.filter((d) => d.status === "PENDING").length,
  }

  const columns: Column<DocumentItem>[] = [
    {
      key: "name",
      header: "Document",
      cell: (doc) => {
        const Icon = categoryIcons[doc.category] || FolderOpen
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{doc.name}</p>
              <p className="text-xs text-muted-foreground">{doc.mimeType || "Unknown type"}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: "category",
      header: "Category",
      cell: (doc) => (
        <Badge variant="outline">{categoryLabels[doc.category] || doc.category}</Badge>
      ),
    },
    {
      key: "totalAmount",
      header: "Amount",
      className: "text-right",
      cell: (doc) =>
        doc.totalAmount ? (
          <span className="font-mono">
            {Number(doc.totalAmount).toFixed(2)} {doc.currency || "EUR"}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      className: "text-center",
      cell: (doc) => (
        <Badge
          variant={
            doc.status === "PROCESSED"
              ? "default"
              : doc.status === "PENDING"
                ? "secondary"
                : "outline"
          }
        >
          {doc.status}
        </Badge>
      ),
    },
    {
      key: "uploadedAt",
      header: "Uploaded",
      cell: (doc) => new Date(doc.uploadedAt).toLocaleDateString("hr-HR"),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      cell: (doc) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/clients/${clientId}/documents/${doc.id}`}>
              <Eye className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Documents</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className="text-2xl font-bold">{stats.expenses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Invoices</p>
            <p className="text-2xl font-bold">{stats.invoices}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pending Review</p>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </CardContent>
        </Card>
      </div>

      {/* Document List */}
      <Card>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<FolderOpen className="h-8 w-8" />}
                title="No documents yet"
                description="This client has not uploaded any documents yet."
              />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={documents}
              caption="Client documents"
              emptyMessage="No documents found."
              getRowKey={(doc) => doc.id}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
