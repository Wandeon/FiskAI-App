import Link from "next/link"
import { Mail, Phone, MapPin, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { DeleteContactButton } from "@/components/contacts/delete-contact-button"

// Local type for contact type enum (containment: removed @prisma/client import)
type ContactType = "CUSTOMER" | "SUPPLIER" | "BOTH"

interface ContactCardProps {
  contact: {
    id: string
    name: string
    type: ContactType
    oib: string | null
    email?: string | null
    phone?: string | null
    city?: string | null
    _count: {
      eInvoicesAsBuyer: number
      eInvoicesAsSeller: number
    }
  }
}

const typeConfig: Record<ContactType, { label: string; className: string }> = {
  CUSTOMER: { label: "Kupac", className: "bg-brand-100 text-brand-700" },
  SUPPLIER: { label: "Dobavljač", className: "bg-chart-2/10 text-chart-2" },
  BOTH: { label: "Kupac/Dobavljač", className: "bg-success-100 text-success-700" },
}

export function ContactCard({ contact }: ContactCardProps) {
  const type = typeConfig[contact.type]
  const invoiceCount = contact._count.eInvoicesAsBuyer + contact._count.eInvoicesAsSeller

  // Generate initials from name
  const initials = contact.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="card card-hover group relative overflow-hidden">
      {/* Header with Avatar */}
      <div className="flex items-start gap-4 p-4">
        {/* Avatar */}
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-[var(--foreground)] truncate">
                <Link
                  href={`/contacts/${contact.id}`}
                  className="hover:text-brand-600 transition-colors"
                >
                  {contact.name}
                </Link>
              </h3>
              {contact.oib && (
                <p className="text-sm text-[var(--muted)] font-mono">{contact.oib}</p>
              )}
            </div>
            <span
              className={cn(
                "flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                type.className
              )}
            >
              {type.label}
            </span>
          </div>
        </div>
      </div>

      {/* Contact Details */}
      <div className="border-t border-[var(--border)] px-4 py-3 space-y-2">
        {contact.email && (
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-[var(--muted)]" />
            <a
              href={`mailto:${contact.email}`}
              className="text-[var(--foreground)] hover:text-brand-600 transition-colors truncate"
            >
              {contact.email}
            </a>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-[var(--muted)]" />
            <a
              href={`tel:${contact.phone}`}
              className="text-[var(--foreground)] hover:text-brand-600 transition-colors"
            >
              {contact.phone}
            </a>
          </div>
        )}
        {contact.city && (
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-[var(--muted)]" />
            <span className="text-[var(--muted)]">{contact.city}</span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="space-y-3 border-t border-[var(--border)] px-4 py-3 bg-[var(--surface-secondary)]">
        <div className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
          <FileText className="h-4 w-4" />
          <span>
            {invoiceCount} {invoiceCount === 1 ? "račun" : invoiceCount < 5 ? "računa" : "računa"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="rounded-full bg-surface/70 p-2 text-[var(--muted)] hover:text-brand-600 transition-colors"
                title="Pošalji email"
              >
                <Mail className="h-4 w-4" />
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="rounded-full bg-surface/70 p-2 text-[var(--muted)] hover:text-brand-600 transition-colors"
                title="Nazovi"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            <Link
              href={`/e-invoices/new?contactId=${contact.id}`}
              className="rounded-full bg-surface/70 p-2 text-[var(--muted)] hover:text-brand-600 transition-colors"
              title="Novi račun"
            >
              <FileText className="h-4 w-4" />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/contacts/${contact.id}/edit`}
              className="rounded-button px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
            >
              Uredi
            </Link>
            <DeleteContactButton contactId={contact.id} contactName={contact.name} />
          </div>
        </div>
      </div>
    </div>
  )
}
