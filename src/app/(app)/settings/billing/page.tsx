// src/app/(dashboard)/settings/billing/page.tsx
// Billing and subscription management page

import { Metadata } from "next"
import { auth } from "@/lib/auth"
import { requireCompany } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { getUsageStats, PLANS, PlanId } from "@/lib/billing/stripe"
import { BillingPageClient } from "./billing-page-client"

export const metadata: Metadata = {
  title: "Naplata | FiskAI",
  description: "Upravljanje pretplatom i planom",
}

export default async function BillingPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth")
  }

  const company = await requireCompany(session.user.id)
  const usage = await getUsageStats(company.id)

  const plans = Object.entries(PLANS).map(([id, plan]) => ({
    id: id as PlanId,
    name: plan.name,
    priceEur: plan.priceEur,
    invoiceLimit: plan.invoiceLimit,
    userLimit: plan.userLimit,
    current: company.subscriptionPlan === id,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Naplata</h1>
        <p className="text-[var(--muted)]">Upravljajte pretplatom i pratite potrošnju</p>
      </div>

      <BillingPageClient
        plans={plans}
        usage={usage}
        hasStripeCustomer={!!company.stripeCustomerId}
        currentPlan={company.subscriptionPlan || "pausalni"}
        subscriptionStatus={company.subscriptionStatus || "trialing"}
        trialEndsAt={company.trialEndsAt?.toISOString()}
      />
    </div>
  )
}
