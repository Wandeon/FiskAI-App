import Link from "next/link"
import { redirect } from "next/navigation"
import { AuditAction } from "@prisma/client"

import { requireAuth } from "@/lib/auth-utils"
import { getEntitlementsList, isGlobalAdmin, MODULE_LABELS } from "@/lib/admin"
import { db } from "@/lib/db"
import { Button } from "@/components/ui/button"

type PageProps = {
  params: Promise<{ companyId: string }>
  searchParams?: Promise<{ action?: string; entity?: string; limit?: string }>
}

export default async function AdminCompanyPage({ params, searchParams }: PageProps) {
  const user = await requireAuth()
  if (!isGlobalAdmin(user.email)) {
    redirect("/dashboard")
  }

  const { companyId } = await params
  const resolvedSearchParams = (await searchParams) ?? {}

  const company = await db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      oib: true,
      vatNumber: true,
      address: true,
      city: true,
      postalCode: true,
      country: true,
      isVatPayer: true,
      legalForm: true,
      entitlements: true,
      featureFlags: true,
      createdAt: true,
    },
  })

  if (!company) {
    redirect("/admin")
  }

  const entitlements = getEntitlementsList(company.entitlements)
  const actionFilter = resolvedSearchParams.action?.toUpperCase() as AuditAction | undefined
  const entityFilter = resolvedSearchParams.entity
  const take = Math.min(Number(resolvedSearchParams.limit || 30) || 30, 200)

  const [companyUsers, auditLogs, stats] = await Promise.all([
    db.companyUser.findMany({
      where: { companyId: company.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.auditLog.findMany({
      where: {
        companyId: company.id,
        ...(actionFilter ? { action: actionFilter } : {}),
        ...(entityFilter ? { entity: entityFilter } : {}),
      },
      orderBy: { timestamp: "desc" },
      take,
    }),
    fetchStats(company.id),
  ])

  const featureFlags =
    company.featureFlags && !Array.isArray(company.featureFlags) && typeof company.featureFlags === "object"
      ? Object.entries(company.featureFlags as Record<string, string | number | boolean>)
      : []

  const userLookup = new Map(companyUsers.map((cu) => [cu.userId, cu.user]))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Link href="/admin" className="hover:text-[var(--foreground)]">
            Admin
          </Link>
          <span>/</span>
          <span>{company.name}</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">{company.name}</h1>
            <p className="text-sm text-[var(--muted)]">OIB {company.oib}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1 font-semibold text-[var(--muted)]">
              {company.legalForm || "Pravna forma nije unesena"}
            </span>
            <span className="rounded-full border border-[var(--border)] px-3 py-1 font-semibold text-[var(--muted)]">
              {company.isVatPayer ? "PDV obveznik" : "Bez PDV-a"}
            </span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dashboard`}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
              >
                Idi na dashboard (trenutna tvrtka)
              </Link>
              <Link
                href={`/admin`}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
              >
                Natrag na popis
              </Link>
              <a
                href={`/api/admin/companies/${company.id}/audit?limit=500`}
                className="rounded-full border border-[var(--border)] px-3 py-1 text-[10px] font-semibold text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
              >
                Preuzmi logove (CSV)
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Identitet</p>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Tvrtka</h2>
            </div>
            <span className="rounded-full bg-[var(--surface-secondary)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
              Kreirano {new Date(company.createdAt).toLocaleDateString("hr-HR")}
            </span>
          </div>
          <dl className="space-y-2 text-sm text-[var(--foreground)]">
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted)]">VAT broj</dt>
              <dd className="font-mono text-xs">{company.vatNumber || "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted)]">Adresa</dt>
              <dd className="text-right">
                {company.address ? (
                  <>
                    {company.address}
                    <br />
                    {company.postalCode} {company.city}
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted)]">Država</dt>
              <dd>{company.country}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Plan</p>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Moduli</h2>
            </div>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
              {entitlements.length ? `${entitlements.length} aktivno` : "Nije odabrano"}
            </span>
          </div>
          <div className="space-y-2">
            {entitlements.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs text-[var(--muted)]">
                Nema dodijeljenih modula. Dodajte ih preko postavki plana (korisnički tenant).
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {entitlements.map((mod) => (
                  <span
                    key={mod}
                    className="rounded-full bg-[var(--surface-secondary)] px-3 py-1 text-xs font-semibold text-[var(--foreground)]"
                  >
                    {MODULE_LABELS[mod] || mod}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <Link
                href={`/settings?tab=plan`}
                className="rounded-full border border-[var(--border)] px-3 py-1 font-semibold text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
              >
                Otvori plan (tenant)
              </Link>
              <Link
                href={`/dashboard`}
                className="rounded-full border border-[var(--border)] px-3 py-1 font-semibold text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
              >
                Idi na dashboard
              </Link>
            </div>
          </div>
          {featureFlags.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Feature flags</p>
              <div className="space-y-1 text-xs text-[var(--foreground)]">
                {featureFlags.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-2 py-1">
                    <span className="font-semibold">{key}</span>
                    <span className="text-[var(--muted)]">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Pregled</p>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Aktivnost</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Stat label="Korisnici" value={stats.users} />
            <Stat label="Kontakti" value={stats.contacts} />
            <Stat label="Proizvodi" value={stats.products} />
            <Stat label="E-računi" value={stats.invoices} />
            <Stat label="Troškovi" value={stats.expenses} />
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Korisnici</h2>
          <span className="text-xs text-[var(--muted)]">{companyUsers.length} članova</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full border-collapse">
            <thead className="bg-[var(--surface-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2">Korisnik</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Uloga</th>
                <th className="px-3 py-2">Dodano</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-sm">
              {companyUsers.map((member) => (
                <tr key={member.id}>
                  <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{member.user?.name || "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">{member.user?.email}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-[var(--surface-secondary)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[var(--muted)]">
                    {new Date(member.createdAt).toLocaleDateString("hr-HR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Nedavni logovi</h2>
            <p className="text-xs text-[var(--muted)]">
              Filtriraj po akciji ili entitetu za brži pregled
            </p>
          </div>
          <form className="flex flex-wrap items-center gap-2 text-xs" action="" method="get">
            <select
              name="action"
              defaultValue={actionFilter || ""}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-2"
            >
              <option value="">Sve akcije</option>
              {Object.values(AuditAction).map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
            <input
              type="text"
              name="entity"
              defaultValue={entityFilter || ""}
              placeholder="Entitet (npr. EInvoice)"
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-2"
            />
            <input
              type="number"
              name="limit"
              min={10}
              max={200}
              defaultValue={take}
              className="h-9 w-20 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-2"
            />
            <Button size="sm" type="submit" variant="outline">
              Primijeni
            </Button>
            {(actionFilter || entityFilter) && (
              <Link
                href={`/admin/${company.id}`}
                className="text-[var(--muted)] underline underline-offset-2"
              >
                Očisti
              </Link>
            )}
          </form>
        </div>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Još nema zabilježenih radnji.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full border-collapse">
              <thead className="bg-[var(--surface-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">Radnja</th>
                  <th className="px-3 py-2">Entitet</th>
                  <th className="px-3 py-2">Korisnik</th>
                  <th className="px-3 py-2">Vrijeme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] text-sm">
                {auditLogs.map((log) => {
                  const author = log.userId ? userLookup.get(log.userId) : null
                  return (
                    <tr key={log.id}>
                      <td className="px-3 py-2 font-semibold text-[var(--foreground)]">{log.action}</td>
                      <td className="px-3 py-2 text-[var(--muted)]">
                        {log.entity} {log.entityId ? `#${log.entityId.slice(0, 8)}` : ""}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">
                        {author ? `${author.name || author.email}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-[var(--muted)]">
                        {new Date(log.timestamp).toLocaleString("hr-HR")}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

async function fetchStats(companyId: string) {
  const [contacts, products, invoices, expenses, users] = await Promise.all([
    db.contact.count({ where: { companyId } }),
    db.product.count({ where: { companyId } }),
    db.eInvoice.count({ where: { companyId } }),
    db.expense.count({ where: { companyId } }),
    db.companyUser.count({ where: { companyId } }),
  ])

  return { contacts, products, invoices, expenses, users }
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  )
}
