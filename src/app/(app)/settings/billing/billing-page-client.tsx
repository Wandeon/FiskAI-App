"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { Check, AlertTriangle, ExternalLink } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { useEffect } from "react"

interface Plan {
  id: string
  name: string
  priceEur: number
  invoiceLimit: number
  userLimit: number
  current: boolean
}

interface Usage {
  plan: string
  status: string
  trialEndsAt: Date | null
  invoices: {
    used: number
    limit: number
    unlimited: boolean
  }
  users: {
    used: number
    limit: number
    unlimited: boolean
  }
}

interface BillingPageClientProps {
  plans: Plan[]
  usage: Usage
  hasStripeCustomer: boolean
  currentPlan: string
  subscriptionStatus: string
  trialEndsAt?: string
}

export function BillingPageClient({
  plans,
  usage,
  hasStripeCustomer,
  currentPlan,
  subscriptionStatus,
  trialEndsAt,
}: BillingPageClientProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Pretplata aktivirana!")
    }
    if (searchParams.get("canceled") === "true") {
      toast.error("Naplata otkazana")
    }
  }, [searchParams])

  const handleSubscribe = async (planId: string) => {
    setLoadingPlan(planId)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create checkout")
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška pri kreiranju naplate")
    } finally {
      setLoadingPlan(null)
    }
  }

  const handleManageSubscription = async () => {
    setLoadingPortal(true)
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to create portal session")
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Greška")
    } finally {
      setLoadingPortal(false)
    }
  }

  const isTrialing = subscriptionStatus === "trialing"
  const isActive = subscriptionStatus === "active"
  const trialEnd = trialEndsAt ? new Date(trialEndsAt) : null
  const daysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div className="space-y-8">
      {/* Trial Banner */}
      {isTrialing && trialEnd && (
        <div className="rounded-xl border border-warning-border bg-warning-bg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning-icon flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning-text">
                Probno razdoblje - {daysLeft}{" "}
                {daysLeft === 1 ? "dan" : daysLeft < 5 ? "dana" : "dana"} preostalo
              </p>
              <p className="text-sm text-warning-text mt-1">
                Istječe {trialEnd.toLocaleDateString("hr-HR")}. Odaberite plan za nastavak
                korištenja.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Usage */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Trenutna potrošnja</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm text-[var(--muted)]">Računi ovaj mjesec</span>
              <span className="text-sm font-medium text-[var(--foreground)]">
                {usage.invoices.unlimited
                  ? "Neograničeno"
                  : `${usage.invoices.used} / ${usage.invoices.limit}`}
              </span>
            </div>
            {!usage.invoices.unlimited && (
              <div className="h-2 rounded-full bg-[var(--surface-secondary)]">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{
                    width: `${Math.min(100, (usage.invoices.used / usage.invoices.limit) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-sm text-[var(--muted)]">Korisnici</span>
              <span className="text-sm font-medium text-[var(--foreground)]">
                {usage.users.unlimited
                  ? "Neograničeno"
                  : `${usage.users.used} / ${usage.users.limit}`}
              </span>
            </div>
            {!usage.users.unlimited && (
              <div className="h-2 rounded-full bg-[var(--surface-secondary)]">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{
                    width: `${Math.min(100, (usage.users.used / usage.users.limit) * 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Plans */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Planovi</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan
            const isUpgrade =
              plans.findIndex((p) => p.id === currentPlan) <
              plans.findIndex((p) => p.id === plan.id)

            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-6 ${
                  isCurrent
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-950"
                    : "border-[var(--border)] bg-[var(--surface)]"
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-4 rounded-full bg-brand-500 px-3 py-0.5 text-xs font-medium text-white">
                    Trenutni plan
                  </div>
                )}
                <h3 className="text-lg font-semibold text-[var(--foreground)]">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-[var(--foreground)]">
                    {plan.priceEur}
                  </span>
                  <span className="text-[var(--muted)]">EUR/mj</span>
                </div>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <Check className="h-4 w-4 text-success-icon" />
                    {plan.invoiceLimit === -1
                      ? "Neograničeno računa"
                      : `${plan.invoiceLimit} računa/mj`}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <Check className="h-4 w-4 text-success-icon" />
                    {plan.userLimit === -1
                      ? "Neograničeno korisnika"
                      : `${plan.userLimit} ${plan.userLimit === 1 ? "korisnik" : "korisnika"}`}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <Check className="h-4 w-4 text-success-icon" />
                    Fiskalizacija
                  </li>
                  <li className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                    <Check className="h-4 w-4 text-success-icon" />
                    E-Računi (B2G/B2B)
                  </li>
                </ul>
                <div className="mt-6">
                  {isCurrent && isActive ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleManageSubscription}
                      disabled={loadingPortal || !hasStripeCustomer}
                    >
                      {loadingPortal ? "Učitavanje..." : "Upravljaj pretplatom"}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={loadingPlan !== null}
                      variant={isUpgrade ? "default" : "outline"}
                    >
                      {loadingPlan === plan.id
                        ? "Učitavanje..."
                        : isCurrent
                          ? "Aktiviraj"
                          : isUpgrade
                            ? "Nadogradi"
                            : "Odaberi"}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Manage Subscription */}
      {hasStripeCustomer && isActive && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Upravljanje pretplatom
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Ažurirajte način plaćanja, preuzmite račune ili otkažite pretplatu.
          </p>
          <Button variant="outline" onClick={handleManageSubscription} disabled={loadingPortal}>
            {loadingPortal ? "Učitavanje..." : "Otvori portal za naplatu"}
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
