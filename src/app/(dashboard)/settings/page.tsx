import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { CompanySettingsForm } from "./company-settings-form"
import { EInvoiceSettingsForm } from "./einvoice-settings-form"
import Link from "next/link"
import { Building2, ReceiptText, ShieldCheck, ChevronRight, ArrowUpRight, ListChecks } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  {
    id: "company",
    label: "Tvrtka",
    description: "Naziv, adrese i IBAN",
    icon: Building2,
  },
  {
    id: "einvoice",
    label: "E-računi",
    description: "Informacijski posrednik i API ključevi",
    icon: ReceiptText,
  },
  {
    id: "compliance",
    label: "Usklađenost",
    description: "Status fiskalizacije i obveza e-računa",
    icon: ShieldCheck,
  },
] as const

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const params = await searchParams
  const requestedTab = params.tab ?? "company"
  const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : "company"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-brand-600">Kontrolni centar</p>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Postavke</h1>
        <p className="text-sm text-[var(--muted)]">
          Upravljajte podacima o tvrtki, integracijama i fiskalizacijom
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px,1fr]">
        <nav className="space-y-4">
          <div className="flex flex-col gap-2">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTab
              const Icon = tab.icon
              return (
                <Link
                  key={tab.id}
                  href={`/settings?tab=${tab.id}`}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border border-[var(--border)] p-3 transition-all",
                    isActive
                      ? "bg-[var(--surface)] shadow-card border-brand-200"
                      : "hover:bg-[var(--surface-secondary)]/60"
                  )}
                >
                  <div className={cn(
                    "rounded-xl bg-[var(--surface-secondary)] p-2 text-[var(--muted)]",
                    isActive && "bg-brand-50 text-brand-600"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{tab.label}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">{tab.description}</p>
                  </div>
                  <ChevronRight className={cn("ml-auto h-4 w-4 text-[var(--muted)]", isActive && "text-brand-600")} />
                </Link>
              )
            })}
          </div>

          <div className="rounded-2xl border border-dashed border-[var(--border)] p-4">
            <p className="text-xs font-semibold uppercase text-[var(--muted)] tracking-wide">
              Napredne sekcije
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <Link
                href="/settings/premises"
                className="flex items-center justify-between rounded-xl px-3 py-2 text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)]/70"
              >
                <span>Poslovni prostori</span>
                <ArrowUpRight className="h-4 w-4 text-[var(--muted)]" />
              </Link>
              <Link
                href="/settings/audit-log"
                className="flex items-center justify-between rounded-xl px-3 py-2 text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)]/70"
              >
                <span>Revizijski dnevnik</span>
                <ArrowUpRight className="h-4 w-4 text-[var(--muted)]" />
              </Link>
            </div>
          </div>
        </nav>

        <section className="space-y-6">
          {activeTab === "company" && (
            <Card>
              <CardHeader>
                <CardTitle>Podaci o tvrtki</CardTitle>
                <CardDescription>
                  Naziv, adrese i IBAN koriste se na svim računima i PDF šablonama
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CompanySettingsForm company={company} />
              </CardContent>
            </Card>
          )}

          {activeTab === "einvoice" && (
            <Card>
              <CardHeader>
                <CardTitle>Informacijski posrednik</CardTitle>
                <CardDescription>
                  Konfigurirajte pružatelja e-računa, API ključ i napredne opcije slanja
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EInvoiceSettingsForm company={company} />
              </CardContent>
            </Card>
          )}

          {activeTab === "compliance" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Fiskalizacija 2.0 status</CardTitle>
                  <CardDescription>
                    Pregled usklađenosti i obveznih koraka za nadolazeće rokove
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <StatusCard
                      label="PDV obveznik"
                      description="Status u sustavu PDV-a"
                      status={company.isVatPayer ? "Aktivno" : "Nije obveznik"}
                      variant={company.isVatPayer ? "success" : "warning"}
                    />
                    <StatusCard
                      label="Posrednik"
                      description="Povezan s e-račun posrednikom"
                      status={company.eInvoiceProvider ? "Povezano" : "Nije povezano"}
                      variant={company.eInvoiceProvider ? "success" : "danger"}
                    />
                    <StatusCard
                      label="IBAN"
                      description="Bankovni račun za uplate"
                      status={company.iban ? "Uneseno" : "Nedostaje"}
                      variant={company.iban ? "success" : "warning"}
                    />
                  </div>

                  <div className="rounded-xl bg-blue-50 p-4">
                    <div className="flex items-center gap-2 text-blue-800">
                      <ListChecks className="h-4 w-4" />
                      <p className="font-semibold">Rokovi za usklađenost</p>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-blue-800">
                      <li>• <strong>1. siječnja 2026.</strong> – Obveza primanja e-računa (B2B)</li>
                      <li>• <strong>1. siječnja 2026.</strong> – Obveza slanja e-računa (B2B)</li>
                      <li>• <strong>1. srpnja 2026.</strong> – Obveza slanja e-računa (B2G)</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <Link href="/settings/premises">
                  <Card className="cursor-pointer transition-all hover:border-brand-200 hover:shadow-card">
                    <CardHeader>
                      <CardTitle>Poslovni prostori</CardTitle>
                      <CardDescription>Upravljanje oznakama prostora i uređajima</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
                <Link href="/settings/audit-log">
                  <Card className="cursor-pointer transition-all hover:border-brand-200 hover:shadow-card">
                    <CardHeader>
                      <CardTitle>Revizijski dnevnik</CardTitle>
                      <CardDescription>Pregledajte aktivnosti korisnika i AI asistenta</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

function StatusCard({
  label,
  description,
  status,
  variant,
}: {
  label: string
  description: string
  status: string
  variant: "success" | "warning" | "danger"
}) {
  const colors = {
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  } as const

  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
      <p className="text-xs text-[var(--muted)]">{description}</p>
      <span className={cn("mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold", colors[variant])}>
        {status}
      </span>
    </div>
  )
}
