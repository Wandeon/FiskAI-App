// src/lib/visibility/elements.ts
// Registry of all controllable UI elements

export const VISIBILITY_ELEMENTS = {
  // Dashboard cards
  "card:pausalni-status": { type: "card", label: "Paušalni status" },
  "card:vat-overview": { type: "card", label: "PDV pregled" },
  "card:doprinosi": { type: "card", label: "Doprinosi" },
  "card:corporate-tax": { type: "card", label: "Porez na dobit" },
  "card:invoice-funnel": { type: "card", label: "Status faktura" },
  "card:revenue-trend": { type: "card", label: "Trend prihoda" },
  "card:cash-flow": { type: "card", label: "Novčani tok" },
  "card:insights": { type: "card", label: "Uvidi" },
  "card:posd-reminder": { type: "card", label: "PO-SD podsjetnik" },
  "card:advanced-insights": { type: "card", label: "Napredni uvidi" },
  "card:deadline-countdown": { type: "card", label: "Rokovi" },
  "card:recent-activity": { type: "card", label: "Nedavna aktivnost" },
  "card:fiscalization-status": { type: "card", label: "Status fiskalizacije" },
  "card:compliance-status": { type: "card", label: "Status usklađenosti" },
  "card:today-actions": { type: "card", label: "Današnje akcije" },
  "card:hero-banner": { type: "card", label: "Dobrodošlica" },
  "card:checklist-widget": { type: "card", label: "Checklist" },
  "card:insights-widget": { type: "card", label: "Uvidi widget" },

  // Navigation items
  "nav:dashboard": { type: "nav", label: "Nadzorna ploča", path: "/dashboard" },
  "nav:invoices": { type: "nav", label: "Računi", path: "/invoices" },
  "nav:e-invoices": { type: "nav", label: "E-fakture", path: "/e-invoices" },
  "nav:contacts": { type: "nav", label: "Kontakti", path: "/contacts" },
  "nav:customers": { type: "nav", label: "Kupci", path: "/customers" },
  "nav:products": { type: "nav", label: "Proizvodi", path: "/products" },
  "nav:expenses": { type: "nav", label: "Rashodi", path: "/expenses" },
  "nav:documents": { type: "nav", label: "Dokumenti", path: "/documents" },
  "nav:import": { type: "nav", label: "Uvoz izvoda", path: "/import" },
  "nav:vat": { type: "nav", label: "PDV", path: "/vat" },
  "nav:pausalni": { type: "nav", label: "Paušalni obrt", path: "/pausalni" },
  "nav:reports": { type: "nav", label: "Izvještaji", path: "/reports" },
  "nav:doprinosi": { type: "nav", label: "Doprinosi", path: "/doprinosi" },
  "nav:corporate-tax": { type: "nav", label: "Porez na dobit", path: "/corporate-tax" },
  "nav:bank": { type: "nav", label: "Banka", path: "/banking" },
  "nav:pos": { type: "nav", label: "POS", path: "/pos" },
  "nav:compliance": { type: "nav", label: "Usklađenost", path: "/compliance" },
  "nav:settings": { type: "nav", label: "Postavke", path: "/settings" },
  "nav:api-settings": { type: "nav", label: "API postavke", path: "/settings/api" },
  "nav:checklist": { type: "nav", label: "Checklist", path: "/checklist" },

  // Actions
  "action:create-invoice": { type: "action", label: "Nova faktura" },
  "action:create-contact": { type: "action", label: "Novi kontakt" },
  "action:create-product": { type: "action", label: "Novi proizvod" },
  "action:create-expense": { type: "action", label: "Novi trošak" },
  "action:import-statements": { type: "action", label: "Uvezi izvode" },
  "action:export-data": { type: "action", label: "Izvoz podataka" },

  // Pages (for route protection)
  "page:vat": { type: "page", path: "/vat" },
  "page:reports": { type: "page", path: "/reports" },
  "page:pos": { type: "page", path: "/pos" },
  "page:doprinosi": { type: "page", path: "/doprinosi" },
  "page:corporate-tax": { type: "page", path: "/corporate-tax" },
  "page:bank": { type: "page", path: "/bank" },
} as const

export type ElementId = keyof typeof VISIBILITY_ELEMENTS
export type ElementType = "card" | "nav" | "action" | "page"

export function getElement(id: ElementId) {
  return VISIBILITY_ELEMENTS[id]
}

export function getElementsByType(type: ElementType): ElementId[] {
  return (Object.keys(VISIBILITY_ELEMENTS) as ElementId[]).filter(
    (id) => VISIBILITY_ELEMENTS[id].type === type
  )
}
