import Link from "next/link"
import { Suspense } from "react"
import { Plus, Users, LayoutGrid, Rows } from "lucide-react"
import { getContactList } from "@/app/actions/contact-list"
import { ContactCard } from "@/components/contacts/contact-card"
import { ContactCsvImport } from "@/components/contacts/contact-csv-import"
import { ContactFilters } from "@/components/contacts/contact-filters"
import { ContactListSkeleton } from "@/components/contacts/contact-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { ContactType } from "@prisma/client"
import { CommandPalette } from "@/components/ui/command-palette"
import { VisibleButton } from "@/lib/visibility"

interface PageProps {
  searchParams: Promise<{
    search?: string
    type?: string
    page?: string
    segment?: string | string[]
    view?: string
  }>
}

const SEGMENTS = ["VAT_PAYER", "MISSING_EMAIL", "NO_DOCUMENTS"] as const

async function ContactList({
  search,
  type,
  page,
  segments,
}: {
  search: string
  type: string
  page: number
  segments: string[]
}) {
  const validSegments = segments.filter((segment) =>
    SEGMENTS.includes(segment as (typeof SEGMENTS)[number])
  )
  const { contacts, pagination } = await getContactList({
    search,
    type: type as ContactType | "ALL",
    segments: validSegments as (typeof SEGMENTS)[number][],
    page,
    limit: 12,
  })

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title={search || type !== "ALL" ? "Nema rezultata" : "Nemate kontakata"}
        description={
          search || type !== "ALL"
            ? "Pokušajte s drugim filterima"
            : "Dodajte svoj prvi kontakt za početak fakturiranja"
        }
        action={
          !search && type === "ALL" ? (
            <VisibleButton id="action:create-contact" asChild>
              <Button asChild>
                <Link href="/contacts/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Dodaj kontakt
                </Link>
              </Button>
            </VisibleButton>
          ) : undefined
        }
      />
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contacts.map((contact) => (
          <ContactCard key={contact.id} contact={contact} />
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-6">
          {page > 1 && (
            <Link href={buildPageLink(page - 1, search, type, segments)}>
              <Button variant="outline">Prethodna</Button>
            </Link>
          )}

          <span className="text-sm text-[var(--muted)]">
            Stranica {page} od {pagination.totalPages}
          </span>

          {pagination.hasMore && (
            <Link href={buildPageLink(page + 1, search, type, segments)}>
              <Button variant="outline">Sljedeća</Button>
            </Link>
          )}
        </div>
      )}
    </>
  )
}

export default async function ContactsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.search || ""
  const type = params.type || "ALL"
  const page = parseInt(params.page || "1", 10)
  const view = params.view === "board" ? "board" : "list"
  const segmentsParam = params.segment
  const segments = Array.isArray(segmentsParam)
    ? segmentsParam
    : segmentsParam
      ? [segmentsParam]
      : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Kontakti</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Upravljajte kupcima i dobavljačima</p>
        </div>
        <VisibleButton id="action:create-contact" asChild>
          <Button asChild>
            <Link href="/contacts/new">
              <Plus className="h-4 w-4 mr-2" />
              Novi kontakt
            </Link>
          </Button>
        </VisibleButton>
      </div>

      {/* Quick actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2">
          <QuickFilterButton value="ALL" current={type} view={view} />
          <QuickFilterButton value="CUSTOMER" current={type} view={view} />
          <QuickFilterButton value="SUPPLIER" current={type} view={view} />
          <QuickFilterButton value="BOTH" current={type} view={view} />
        </div>
        <div className="flex gap-2 items-center">
          <ViewToggle view={view} />
          <CommandPalette className="lg:hidden" />
        </div>
      </div>

      {/* Filters */}
      <ContactFilters
        initialSearch={search}
        initialType={type}
        initialSegments={segments}
        view={view}
      />

      {/* CSV Import */}
      <ContactCsvImport />

      {/* Contact List */}
      {view === "board" ? (
        <Suspense fallback={<ContactListSkeleton />}>
          <ContactBoard search={search} type={type} segments={segments} />
        </Suspense>
      ) : (
        <Suspense fallback={<ContactListSkeleton />}>
          <ContactList search={search} type={type} page={page} segments={segments} />
        </Suspense>
      )}
    </div>
  )
}
function QuickFilterButton({
  value,
  current,
  view,
}: {
  value: string
  current: string
  view: string
}) {
  const isActive = current === value
  let label = "Svi"
  if (value === "CUSTOMER") label = "Kupci"
  else if (value === "SUPPLIER") label = "Dobavljači"
  else if (value === "BOTH") label = "Kupci/Dobavljači"

  return (
    <Link href={`/contacts?type=${value}&view=${view}`} className="text-sm">
      <Button variant={isActive ? "default" : "outline"} size="sm">
        {label}
      </Button>
    </Link>
  )
}

async function ContactBoard({
  search,
  type,
  segments,
}: {
  search: string
  type: string
  segments: string[]
}) {
  const validSegments = segments.filter((segment) =>
    SEGMENTS.includes(segment as (typeof SEGMENTS)[number])
  )
  const { contacts } = await getContactList({
    search,
    type: type as ContactType | "ALL",
    segments: validSegments as (typeof SEGMENTS)[number][],
    page: 1,
    limit: 50,
  })

  const columns = [
    { key: "CUSTOMER", label: "Kupci" },
    { key: "SUPPLIER", label: "Dobavljači" },
    { key: "BOTH", label: "Kupci/Dobavljači" },
    { key: "OTHER", label: "Ostalo" },
  ] as const

  const grouped = columns.map((col) => ({
    ...col,
    items: contacts.filter((contact) => {
      if (col.key === "OTHER") {
        return !["CUSTOMER", "SUPPLIER", "BOTH"].includes(contact.type || "OTHER")
      }
      return contact.type === col.key
    }),
  }))

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {grouped.map((column) => (
        <div
          key={column.key}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-secondary)]/60 p-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--foreground)]">{column.label}</p>
            <span className="text-xs text-[var(--muted)]">{column.items.length}</span>
          </div>
          <div className="mt-3 space-y-3">
            {column.items.length === 0 ? (
              <p className="text-xs text-[var(--muted)]">Nema kontakata</p>
            ) : (
              column.items.map((contact) => <ContactCard key={contact.id} contact={contact} />)
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function ViewToggle({ view }: { view: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] p-1">
      <Link
        href="/contacts?view=list"
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
          view === "list"
            ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
            : "text-[var(--muted)]"
        }`}
      >
        <Rows className="h-4 w-4" />
        Lista
      </Link>
      <Link
        href="/contacts?view=board"
        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
          view === "board"
            ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
            : "text-[var(--muted)]"
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
        Board
      </Link>
    </div>
  )
}

function buildPageLink(page: number, search: string, type: string, segments: string[]) {
  const params = new URLSearchParams()
  params.set("page", String(page))
  if (search) params.set("search", search)
  if (type) params.set("type", type)
  segments.forEach((segment) => params.append("segment", segment))
  return `/contacts?${params.toString()}`
}
