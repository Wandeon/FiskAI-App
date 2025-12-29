// src/lib/tutorials/triggers.ts

import { THRESHOLDS } from "@/lib/fiscal-data"

export interface ContextualTrigger {
  id: string
  type: "success" | "warning" | "info"
  title: string
  description: string
  href?: string
  dismissible: boolean
}

export interface TriggerContext {
  companyId: string
  invoiceCount: number
  yearlyRevenue: number
  hasFiscalCert: boolean
  lastBankImport?: Date
  legalForm?: string | null
  expenseCount?: number
  contactCount?: number
}

export async function getActiveTriggersForContext(
  ctx: TriggerContext
): Promise<ContextualTrigger[]> {
  const triggers: ContextualTrigger[] = []

  // =========================================================================
  // PAUŠALNI OBRT TRIGGERS
  // =========================================================================
  if (ctx.legalForm === "OBRT_PAUSAL") {
    const limit = THRESHOLDS.pausalni.value

    // First invoice created
    if (ctx.invoiceCount === 1) {
      triggers.push({
        id: "first-invoice",
        type: "success",
        title: "Prvi račun kreiran!",
        description: "Vaš račun je automatski upisan u Knjigu primitaka (KPR)",
        href: "/pausalni",
        dismissible: true,
      })
    }

    // Approaching 60k limit (85%)
    if (ctx.yearlyRevenue >= limit * 0.85 && ctx.yearlyRevenue < limit * 0.95) {
      triggers.push({
        id: "approaching-60k",
        type: "warning",
        title: `Na ${Math.round((ctx.yearlyRevenue / limit) * 100)}% ste limita`,
        description: "Približavate se limitu od 60.000 EUR za paušalni obrt",
        href: "/vodici/pausalni-limit",
        dismissible: false,
      })
    }

    // Critical 60k limit (95%)
    if (ctx.yearlyRevenue >= limit * 0.95) {
      triggers.push({
        id: "critical-60k",
        type: "warning",
        title: "HITNO: Na 95% ste limita!",
        description: "Trebate razmotriti prijelaz na d.o.o. ili realni obrt",
        href: "/vodici/prelazak-doo",
        dismissible: false,
      })
    }
  }

  // =========================================================================
  // DOO/JDOO TRIGGERS
  // =========================================================================
  if (ctx.legalForm === "DOO" || ctx.legalForm === "JDOO") {
    const vatThreshold = THRESHOLDS.pdv.value // 60,000 EUR

    // First invoice created
    if (ctx.invoiceCount === 1) {
      triggers.push({
        id: "first-invoice-doo",
        type: "success",
        title: "Prvi račun kreiran!",
        description:
          "Vodite evidenciju prihoda za obračun poreza na dobit i PDV-a (ako ste u sustavu)",
        href: "/corporate-tax",
        dismissible: true,
      })
    }

    // Approaching VAT threshold (85%)
    if (ctx.yearlyRevenue >= vatThreshold * 0.85 && ctx.yearlyRevenue < vatThreshold * 0.95) {
      triggers.push({
        id: "approaching-vat-threshold",
        type: "warning",
        title: `Na ${Math.round((ctx.yearlyRevenue / vatThreshold) * 100)}% ste PDV praga`,
        description: "Približavate se granici od 60.000 EUR za obvezan ulazak u sustav PDV-a",
        href: "/vodici/pdv-registracija",
        dismissible: false,
      })
    }

    // Critical VAT threshold (95%)
    if (ctx.yearlyRevenue >= vatThreshold * 0.95) {
      triggers.push({
        id: "critical-vat-threshold",
        type: "warning",
        title: "HITNO: Prijavite se u sustav PDV-a!",
        description:
          "Prelazite prag od 60.000 EUR i morate se registrirati za PDV u sljedećem razdoblju",
        href: "/vodici/pdv-registracija",
        dismissible: false,
      })
    }

    // Quarterly PDV-O reminder (only if revenue suggests VAT registration)
    if (ctx.yearlyRevenue > vatThreshold) {
      const now = new Date()
      const currentMonth = now.getMonth()
      // Trigger in the first week of Jan, Apr, Jul, Oct (quarterly filing months)
      if ([0, 3, 6, 9].includes(currentMonth) && now.getDate() <= 7) {
        triggers.push({
          id: "quarterly-pdv-reminder",
          type: "info",
          title: "Kvartalnu PDV-O prijavu podnijeti do kraja mjeseca",
          description: "Ne zaboravite podnijeti PDV-O obrazac za prethodno tromjesečje",
          href: "/vat",
          dismissible: true,
        })
      }
    }

    // Corporate tax payment deadline reminder
    const now = new Date()
    if (now.getMonth() === 2 && now.getDate() <= 7) {
      // March 1-7
      triggers.push({
        id: "corporate-tax-deadline",
        type: "warning",
        title: "Porez na dobit dospijeva 30. ožujka",
        description: "Podnesite godišnju prijavu poreza na dobit i izvršite uplatu",
        href: "/corporate-tax",
        dismissible: true,
      })
    }
  }

  // =========================================================================
  // OBRT_VAT TRIGGERS
  // =========================================================================
  if (ctx.legalForm === "OBRT_VAT") {
    // First invoice created
    if (ctx.invoiceCount === 1) {
      triggers.push({
        id: "first-invoice-vat",
        type: "success",
        title: "Prvi račun kreiran!",
        description: "Vodite evidenciju za PDV i porez na dohodak od samostalne djelatnosti",
        href: "/vat",
        dismissible: true,
      })
    }

    // Monthly/Quarterly VAT filing reminder
    const now = new Date()
    const currentMonth = now.getMonth()
    // Trigger in the first week of each month for monthly filers
    if (now.getDate() <= 7) {
      triggers.push({
        id: "monthly-vat-reminder",
        type: "info",
        title: "PDV-O prijava dospijeva do kraja mjeseca",
        description: "Pripremite i podnesite PDV-O obrazac za prethodno razdoblje",
        href: "/vat",
        dismissible: true,
      })
    }

    // EU transaction monitoring
    if (ctx.yearlyRevenue > 40000) {
      triggers.push({
        id: "eu-transactions-monitoring",
        type: "info",
        title: "Pazite na EU transakcije",
        description:
          "Vodite posebnu evidenciju transakcija s EU poreznim obveznicima (IntrastatPDV)",
        href: "/vodici/eu-transakcije",
        dismissible: true,
      })
    }
  }

  // =========================================================================
  // UNIVERSAL ENGAGEMENT TRIGGERS (All business types)
  // =========================================================================

  // First expense added
  if (ctx.expenseCount === 1) {
    triggers.push({
      id: "first-expense",
      type: "success",
      title: "Prvi trošak dodan!",
      description: "Redovito evidentirajte troškove kako bi smanjili poreznu osnovicu",
      href: "/expenses",
      dismissible: true,
    })
  }

  // First bank import
  if (ctx.lastBankImport) {
    const hoursSinceImport = (Date.now() - ctx.lastBankImport.getTime()) / (1000 * 60 * 60)
    if (hoursSinceImport < 1) {
      triggers.push({
        id: "first-bank-import",
        type: "info",
        title: "Bankovni podaci uvezeni!",
        description: "Povežite uplate s računima za automatsko označavanje plaćenih",
        href: "/banking/reconcile",
        dismissible: true,
      })
    }
  }

  // Contact milestones
  if (ctx.contactCount === 10) {
    triggers.push({
      id: "contacts-milestone-10",
      type: "success",
      title: "10 kontakata dodano!",
      description: "Vaša baza kontakata raste. Razmislite o segmentaciji kupaca",
      href: "/contacts",
      dismissible: true,
    })
  }

  if (ctx.contactCount === 50) {
    triggers.push({
      id: "contacts-milestone-50",
      type: "success",
      title: "50 kontakata dodano!",
      description: "Razmislite o CRM sustavu za učinkovitije upravljanje odnosima",
      href: "/contacts",
      dismissible: true,
    })
  }

  if (ctx.contactCount === 100) {
    triggers.push({
      id: "contacts-milestone-100",
      type: "success",
      title: "100 kontakata dodano!",
      description: "Vaša poslovna mreža se širi. Razmislite o automatizaciji komunikacije",
      href: "/contacts",
      dismissible: true,
    })
  }

  return triggers
}
