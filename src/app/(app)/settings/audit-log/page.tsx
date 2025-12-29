import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { DataTable } from "@/components/ui/data-table"
import Link from "next/link"
import { AuditAction } from "@prisma/client"

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Kreiranje",
  UPDATE: "Izmjena",
  DELETE: "Brisanje",
  VIEW: "Pregled",
  EXPORT: "Izvoz",
  LOGIN: "Prijava",
  LOGOUT: "Odjava",
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-success-bg text-success-text border border-success-border",
  UPDATE: "bg-info-bg text-info-text border border-info-border",
  DELETE: "bg-danger-bg text-danger-text border border-danger-border",
  VIEW: "bg-surface-1 text-secondary border border-default",
  EXPORT: "bg-chart-2 text-white",
  LOGIN: "bg-warning-bg text-warning-text border border-warning-border",
  LOGOUT: "bg-chart-5 text-white",
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; entity?: string }>
}) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const params = await searchParams
  const page = parseInt(params.page || "1")
  const pageSize = 50
  const skip = (page - 1) * pageSize

  // Build filter conditions
  const where: {
    companyId: string
    action?: AuditAction
    entity?: string
  } = {
    companyId: company.id,
  }

  if (params.action && params.action in AuditAction) {
    where.action = params.action as AuditAction
  }
  if (params.entity) {
    where.entity = params.entity
  }

  // Fetch audit logs with user info
  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: pageSize,
      skip,
      include: {
        company: {
          select: { name: true },
        },
      },
    }),
    db.auditLog.count({ where }),
  ])

  // Get unique entities for filter dropdown
  const entities = await db.auditLog.groupBy({
    by: ["entity"],
    where: { companyId: company.id },
  })

  const totalPages = Math.ceil(total / pageSize)

  const columns = [
    {
      key: "timestamp",
      header: "Datum/Vrijeme",
      cell: (log: (typeof logs)[0]) => new Date(log.timestamp).toLocaleString("hr-HR"),
    },
    {
      key: "action",
      header: "Akcija",
      cell: (log: (typeof logs)[0]) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || "bg-surface-1 border border-default"}`}
        >
          {ACTION_LABELS[log.action] || log.action}
        </span>
      ),
    },
    {
      key: "entity",
      header: "Entitet",
      cell: (log: (typeof logs)[0]) => log.entity,
    },
    {
      key: "entityId",
      header: "ID",
      cell: (log: (typeof logs)[0]) => (
        <code className="text-xs bg-surface-1 px-1 py-0.5 rounded border border-default">
          {log.entityId.slice(0, 8)}...
        </code>
      ),
    },
    {
      key: "changes",
      header: "Promjene",
      cell: (log: (typeof logs)[0]) =>
        log.changes ? (
          <details className="cursor-pointer">
            <summary className="text-xs text-link cursor-pointer">Prikaži</summary>
            <pre className="text-xs mt-1 p-2 bg-surface-1 rounded max-w-xs overflow-auto">
              {JSON.stringify(log.changes, null, 2)}
            </pre>
          </details>
        ) : (
          <span className="text-muted">-</span>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Revizijski dnevnik</h1>
          <p className="text-secondary">Pregled svih akcija u sustavu</p>
        </div>
        <Link href="/settings" className="text-sm text-secondary hover:text-foreground">
          ← Natrag na postavke
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 p-4 bg-surface-1 rounded-lg border border-default">
        <form className="flex gap-4" method="GET">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Akcija</label>
            <select
              name="action"
              defaultValue={params.action || ""}
              className="block w-40 rounded-md border-default shadow-sm focus:border-focus focus:ring-border-focus text-sm"
            >
              <option value="">Sve akcije</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Entitet</label>
            <select
              name="entity"
              defaultValue={params.entity || ""}
              className="block w-40 rounded-md border-default shadow-sm focus:border-focus focus:ring-border-focus text-sm"
            >
              <option value="">Svi entiteti</option>
              {entities.map(({ entity }) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="px-4 py-2 bg-interactive text-white rounded-md text-sm hover:bg-interactive-hover"
            >
              Filtriraj
            </button>
          </div>
        </form>
      </div>

      {/* Stats */}
      <div className="text-sm text-secondary">
        Prikazano {logs.length} od {total} zapisa
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={logs}
        caption="Revizijski dnevnik"
        getRowKey={(log) => log.id}
        emptyMessage="Nema revizijskih zapisa"
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link
              href={`?page=${page - 1}${params.action ? `&action=${params.action}` : ""}${params.entity ? `&entity=${params.entity}` : ""}`}
              className="px-3 py-1 border border-default rounded hover:bg-surface-1"
            >
              ← Prethodna
            </Link>
          )}
          <span className="px-3 py-1">
            Stranica {page} od {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`?page=${page + 1}${params.action ? `&action=${params.action}` : ""}${params.entity ? `&entity=${params.entity}` : ""}`}
              className="px-3 py-1 border border-default rounded hover:bg-surface-1"
            >
              Sljedeća →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
