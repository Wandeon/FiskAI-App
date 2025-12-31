import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { setTenantContext } from "@/lib/prisma-extensions"
import { db } from "@/lib/db"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ResponsiveTable, type Column } from "@/components/ui/responsive-table"
import { CategoryCards } from "@/components/documents/category-cards"
import { NewDocumentDropdown } from "@/components/documents/new-document-dropdown"
import { DocumentsClient } from "@/components/documents/documents-client"
import {
  queryUnifiedDocuments,
  CATEGORY_META,
  type UnifiedDocument,
  type DocumentCategory,
} from "@/lib/documents/unified-query"
import { cn } from "@/lib/utils"
import { FolderOpen, Search } from "lucide-react"

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency,
  }).format(value)
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

const STATUS_COLORS: Record<string, string> = {
  gray: "bg-surface-2 text-foreground",
  blue: "bg-info-bg text-link",
  green: "bg-success-bg text-success-text",
  amber: "bg-warning-bg text-warning-text",
  red: "bg-danger-bg text-danger-text",
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  // Fetch bank accounts for the import dropzone
  const bankAccounts = await db.bankAccount.findMany({
    where: { companyId: company.id },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      iban: true,
    },
  })

  // Get any pending/in-progress jobs to restore queue state
  const pendingJobs = await db.importJob.findMany({
    where: {
      companyId: company.id,
      status: { in: ["PENDING", "PROCESSING", "READY_FOR_REVIEW"] },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      originalName: true,
      status: true,
      documentType: true,
      extractedData: true,
      failureReason: true,
      pagesProcessed: true,
    },
  })

  const initialJobs = pendingJobs.map((j) => ({
    id: j.id,
    fileName: j.originalName,
    status: j.status as
      | "PENDING"
      | "PROCESSING"
      | "READY_FOR_REVIEW"
      | "CONFIRMED"
      | "REJECTED"
      | "FAILED",
    documentType: j.documentType,
    progress: j.status === "READY_FOR_REVIEW" ? 100 : j.status === "PROCESSING" ? 50 : 0,
    error: j.failureReason,
    extractedData: j.extractedData as any,
  }))

  const params = await searchParams
  const categoryParam = Array.isArray(params.category) ? params.category[0] : params.category
  const searchTerm = Array.isArray(params.search) ? params.search[0] : params.search
  const pageParam = Array.isArray(params.page) ? params.page[0] : params.page
  const page = parseInt(pageParam || "1")

  const category = categoryParam as DocumentCategory | undefined

  const { documents, total, counts } = await queryUnifiedDocuments({
    companyId: company.id,
    category,
    search: searchTerm,
    page,
    pageSize: 20,
  })

  const totalPages = Math.ceil(total / 20)

  const columns: Column<UnifiedDocument>[] = [
    {
      key: "date",
      label: "Datum",
      render: (doc) => <span className="text-sm text-[var(--muted)]">{formatDate(doc.date)}</span>,
    },
    {
      key: "category",
      label: "Vrsta",
      render: (doc) => (
        <span
          className={cn(
            "px-2 py-1 rounded-full text-xs font-medium",
            CATEGORY_META[doc.category].color
          )}
        >
          {CATEGORY_META[doc.category].label}
        </span>
      ),
    },
    {
      key: "number",
      label: "Broj/Naziv",
      render: (doc) => (
        <Link href={doc.detailUrl} className="font-medium text-brand-600 hover:text-brand-700">
          {doc.number.length > 30 ? doc.number.slice(0, 27) + "..." : doc.number}
        </Link>
      ),
    },
    {
      key: "counterparty",
      label: "Strana",
      render: (doc) => (
        <span className="text-sm text-[var(--foreground)]">{doc.counterparty || "—"}</span>
      ),
    },
    {
      key: "amount",
      label: "Iznos",
      render: (doc) => (
        <span className="text-sm font-medium text-[var(--foreground)]">
          {typeof doc.amount === "number" && doc.currency
            ? formatCurrency(doc.amount, doc.currency)
            : doc.amount}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (doc) => (
        <span
          className={cn(
            "px-2 py-1 rounded-full text-xs font-medium",
            STATUS_COLORS[doc.statusColor]
          )}
        >
          {doc.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (doc) => (
        <Link href={doc.detailUrl} className="text-sm text-brand-600 hover:text-brand-700">
          Pregledaj
        </Link>
      ),
    },
  ]

  function buildPaginationLink(newPage: number) {
    const params = new URLSearchParams()
    params.set("page", String(newPage))
    if (category) params.set("category", category)
    if (searchTerm) params.set("search", searchTerm)
    return `/documents?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dokumenti</h1>
          <p className="text-[var(--muted)]">Svi dokumenti na jednom mjestu</p>
        </div>
        <NewDocumentDropdown />
      </div>

      {/* Main content with import dropzone and sidebar */}
      <DocumentsClient bankAccounts={bankAccounts} initialJobs={initialJobs}>
        {/* Category filter cards */}
        <CategoryCards counts={counts} activeCategory={category} compact />

        {/* Search */}
        <form method="GET" action="/documents" className="flex gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          <input
            type="text"
            name="search"
            defaultValue={searchTerm}
            placeholder="Pretraži dokumente..."
            className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Traži
          </button>
        </form>

        {/* Table */}
        {documents.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              {searchTerm ? (
                <EmptyState
                  icon={<Search className="h-8 w-8" />}
                  title="Nema rezultata za pretragu"
                  description={`Nismo pronašli dokumente za "${searchTerm}". Pokušajte s drugim pojmom ili uklonite filtre.`}
                />
              ) : (
                <EmptyState
                  icon={<FolderOpen className="h-8 w-8" />}
                  title="Nema dokumenata"
                  description="Svi vaši dokumenti bit će prikazani ovdje. Uvezite račune, ugovore i druge dokumente povlačenjem u polje iznad ili koristeći gumb 'Novi dokument'."
                />
              )}
            </CardContent>
          </Card>
        ) : (
          <ResponsiveTable
            columns={columns}
            data={documents}
            className="bg-[var(--surface)] rounded-2xl border border-[var(--border)]"
            getRowKey={(doc) => `${doc.category}-${doc.id}`}
            renderCard={(doc) => (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase text-[var(--muted)] tracking-wide">
                      {formatDate(doc.date)}
                    </p>
                    <p className="font-semibold text-[var(--foreground)]">
                      {doc.number.length > 25 ? doc.number.slice(0, 22) + "..." : doc.number}
                    </p>
                    <p className="text-sm text-[var(--muted)]">{doc.counterparty || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-[var(--foreground)]">
                      {typeof doc.amount === "number" && doc.currency
                        ? formatCurrency(doc.amount, doc.currency)
                        : doc.amount}
                    </p>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        CATEGORY_META[doc.category].color
                      )}
                    >
                      {CATEGORY_META[doc.category].label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span
                    className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      STATUS_COLORS[doc.statusColor]
                    )}
                  >
                    {doc.status}
                  </span>
                  <Link
                    href={doc.detailUrl}
                    className="text-sm font-semibold text-brand-600 hover:text-brand-700"
                  >
                    Detalji →
                  </Link>
                </div>
              </div>
            )}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
            {page > 1 && (
              <Link
                href={buildPaginationLink(page - 1)}
                className="px-3 py-1 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-secondary)]"
              >
                ← Prethodna
              </Link>
            )}
            <span className="px-3 py-1 text-[var(--muted)]">
              Stranica {page} od {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={buildPaginationLink(page + 1)}
                className="px-3 py-1 border border-[var(--border)] rounded-lg hover:bg-[var(--surface-secondary)]"
              >
                Sljedeća →
              </Link>
            )}
          </div>
        )}
      </DocumentsClient>
    </div>
  )
}
