import Link from "next/link"
import { getEntitlementsList, MODULE_LABELS } from "@/lib/admin"
import { db } from "@/lib/db"

export default async function AdminPage() {
  const companies = await db.company.findMany({
    select: {
      id: true,
      name: true,
      oib: true,
      legalForm: true,
      isVatPayer: true,
      entitlements: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Klijenti</h2>
          <p className="text-sm text-[var(--muted)]">Pregled registriranih kompanija i modula</p>
        </div>
        <span className="rounded-full bg-[var(--surface-secondary)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
          Ukupno: {companies.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-card">
        <table className="w-full border-collapse">
          <thead className="bg-[var(--surface-secondary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3">Naziv</th>
              <th className="px-4 py-3">OIB</th>
              <th className="px-4 py-3">Pravna forma</th>
              <th className="px-4 py-3">PDV</th>
              <th className="px-4 py-3">Moduli</th>
              <th className="px-4 py-3">Registriran</th>
              <th className="px-4 py-3 text-right">Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] text-sm">
            {companies.map((company) => {
              const entitlements = getEntitlementsList(company.entitlements)
              return (
                <tr key={company.id} className="hover:bg-[var(--surface-secondary)]/50">
                  <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{company.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)] font-mono text-xs">{company.oib}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{company.legalForm || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[var(--surface-secondary)] px-2 py-0.5 text-xs font-semibold text-[var(--muted)]">
                      {company.isVatPayer ? "PDV obveznik" : "Bez PDV-a"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {entitlements.length === 0 ? (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      ) : (
                        entitlements.map((mod) => (
                          <span
                            key={mod}
                            className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700"
                          >
                            {MODULE_LABELS[mod] || mod}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(company.createdAt).toLocaleDateString("hr-HR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/${company.id}`}
                      className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-secondary)]"
                    >
                      Otvori
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
