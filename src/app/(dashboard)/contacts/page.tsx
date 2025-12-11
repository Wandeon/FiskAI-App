import Link from "next/link"
import { Suspense } from "react"
import { Plus, Users } from "lucide-react"
import { getContactList } from "@/app/actions/contact-list"
import { ContactCard } from "@/components/contacts/contact-card"
import { ContactFilters } from "@/components/contacts/contact-filters"
import { ContactListSkeleton } from "@/components/contacts/contact-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { ContactType } from "@prisma/client"

interface PageProps {
  searchParams: Promise<{ search?: string; type?: string; page?: string }>
}

async function ContactList({ search, type, page }: { search: string; type: string; page: number }) {
  const { contacts, pagination } = await getContactList({
    search,
    type: type as ContactType | "ALL",
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
            <Link href="/contacts/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Dodaj kontakt
              </Button>
            </Link>
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
            <Link
              href={`/contacts?page=${page - 1}${search ? `&search=${search}` : ""}${type !== "ALL" ? `&type=${type}` : ""}`}
            >
              <Button variant="outline">Prethodna</Button>
            </Link>
          )}

          <span className="text-sm text-[var(--muted)]">
            Stranica {page} od {pagination.totalPages}
          </span>

          {pagination.hasMore && (
            <Link
              href={`/contacts?page=${page + 1}${search ? `&search=${search}` : ""}${type !== "ALL" ? `&type=${type}` : ""}`}
            >
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Kontakti</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Upravljajte kupcima i dobavljačima
          </p>
        </div>
        <Link href="/contacts/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novi kontakt
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <ContactFilters initialSearch={search} initialType={type} />

      {/* Contact List */}
      <Suspense fallback={<ContactListSkeleton />}>
        <ContactList search={search} type={type} page={page} />
      </Suspense>
    </div>
  )
}
