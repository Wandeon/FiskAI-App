// src/lib/tutorials/tracks.ts

import type { TutorialTrack } from "./types"

export const PAUSALNI_FIRST_WEEK: TutorialTrack = {
  id: "pausalni-first-week",
  name: "Paušalni First Week",
  description: "Naučite koristiti FiskAI u 5 dana",
  targetLegalForm: ["OBRT_PAUSAL"],
  days: [
    {
      day: 1,
      title: "Kontakti",
      tasks: [
        {
          id: "add-first-customer",
          title: "Dodaj prvog kupca",
          href: "/contacts/new",
          completionCheck: (ctx) => ctx.contactsCount >= 1,
        },
        {
          id: "understand-oib",
          title: "Razumij OIB validaciju",
          description: "OIB je 11-znamenkasti identifikacijski broj",
          href: "/vodici/oib-validacija",
        },
        {
          id: "import-csv",
          title: "Uvezi kontakte iz CSV",
          isOptional: true,
          href: "/contacts/import",
        },
      ],
    },
    {
      day: 2,
      title: "Proizvodi/Usluge",
      tasks: [
        {
          id: "add-first-product",
          title: "Dodaj svoju glavnu uslugu",
          href: "/products/new",
          completionCheck: (ctx) => ctx.productsCount >= 1,
        },
        {
          id: "set-price-vat",
          title: "Postavi cijenu i PDV status",
          description: "Paušalci ne naplaćuju PDV",
          href: "/products",
        },
        {
          id: "understand-no-vat",
          title: "Razumij 'bez PDV-a' za paušalce",
          href: "/vodici/pausalni-pdv",
        },
      ],
    },
    {
      day: 3,
      title: "Prvi račun",
      tasks: [
        {
          id: "create-first-invoice",
          title: "Kreiraj račun za kupca",
          href: "/invoices/new",
          completionCheck: (ctx) => ctx.invoicesCount >= 1,
        },
        {
          id: "preview-pdf",
          title: "Pregledaj PDF preview",
          href: "/invoices",
        },
        {
          id: "send-or-download",
          title: "Pošalji e-mailom ili preuzmi",
          href: "/invoices",
        },
        {
          id: "understand-kpr",
          title: "Razumij KPR unos",
          description: "Račun se automatski upisuje u Knjigu primitaka",
          href: "/vodici/kpr",
        },
      ],
    },
    {
      day: 4,
      title: "KPR i PO-SD",
      tasks: [
        {
          id: "open-kpr",
          title: "Otvori Knjiga primitaka",
          href: "/pausalni",
          completionCheck: (ctx) => ctx.hasKprEntry,
        },
        {
          id: "understand-60k",
          title: "Razumij running total vs 60k",
          description: "Limit za paušalni obrt je 60.000 EUR godišnje",
          href: "/vodici/pausalni-limit",
        },
        {
          id: "preview-posd",
          title: "Pregledaj PO-SD wizard",
          href: "/pausalni/po-sd",
        },
        {
          id: "set-reminder",
          title: "Postavi podsjetnik za 31.1.",
          description: "Rok za PO-SD je 31. siječnja",
          href: "/settings/reminders",
        },
      ],
    },
    {
      day: 5,
      title: "Doprinosi i rokovi",
      tasks: [
        {
          id: "view-calendar",
          title: "Pregledaj kalendar obveza",
          href: "/rokovi",
        },
        {
          id: "understand-contributions",
          title: "Razumij MIO/HZZO/HOK",
          href: "/vodici/doprinosi",
        },
        {
          id: "generate-payment",
          title: "Generiraj uplatnicu (Hub3)",
          href: "/pausalni/forms",
        },
        {
          id: "connect-google",
          title: "Poveži s Google kalendarom",
          isOptional: true,
          href: "/settings/integrations",
          completionCheck: (ctx) => ctx.hasCalendarReminder,
        },
      ],
    },
  ],
}

export const DOO_FIRST_WEEK: TutorialTrack = {
  id: "doo-first-week",
  name: "D.O.O. First Week",
  description: "Naučite koristiti FiskAI za vaše društvo u 5 dana",
  targetLegalForm: ["DOO"],
  days: [
    {
      day: 1,
      title: "Kontakti i Postavke",
      tasks: [
        {
          id: "add-first-customer",
          title: "Dodaj prvog kupca",
          href: "/contacts/new",
          completionCheck: (ctx) => ctx.contactsCount >= 1,
        },
        {
          id: "understand-oib",
          title: "Razumij OIB validaciju",
          description: "OIB je 11-znamenkasti identifikacijski broj",
          href: "/vodici/oib-validacija",
        },
        {
          id: "setup-vat",
          title: "Postavi PDV postavke",
          description: "Konfiguriraj stope PDV-a za svoje poslovanje",
          href: "/settings/vat",
          completionCheck: (ctx) => ctx.hasVatSetup ?? false,
        },
      ],
    },
    {
      day: 2,
      title: "Proizvodi/Usluge",
      tasks: [
        {
          id: "add-first-product",
          title: "Dodaj svoju glavnu uslugu ili proizvod",
          href: "/products/new",
          completionCheck: (ctx) => ctx.productsCount >= 1,
        },
        {
          id: "set-price-vat",
          title: "Postavi cijenu i PDV stopu",
          description: "D.O.O. obračunava PDV na svoje usluge",
          href: "/products",
        },
        {
          id: "understand-vat-rates",
          title: "Razumij stope PDV-a (25%, 13%, 5%)",
          href: "/vodici/pdv-stope",
        },
      ],
    },
    {
      day: 3,
      title: "Računi i PDV",
      tasks: [
        {
          id: "create-first-invoice",
          title: "Kreiraj prvi račun s PDV-om",
          href: "/invoices/new",
          completionCheck: (ctx) => ctx.invoicesCount >= 1,
        },
        {
          id: "preview-pdf",
          title: "Pregledaj PDF preview",
          href: "/invoices",
        },
        {
          id: "understand-pdv-obrazac",
          title: "Razumij PDV obrazac",
          description: "Mjesečna ili kvartalna prijava PDV-a",
          href: "/vodici/pdv-obrazac",
        },
      ],
    },
    {
      day: 4,
      title: "Troškovi i Rashodi",
      tasks: [
        {
          id: "add-first-expense",
          title: "Dodaj prvi trošak",
          href: "/expenses/new",
          completionCheck: (ctx) => ctx.hasExpenseEntry ?? false,
        },
        {
          id: "understand-pretporez",
          title: "Razumij pretporez",
          description: "PDV na ulazne račune koji se može odbiti",
          href: "/vodici/pretporez",
        },
        {
          id: "connect-bank",
          title: "Poveži bankovni račun",
          isOptional: true,
          href: "/banking/connect",
          completionCheck: (ctx) => ctx.hasBankConnection ?? false,
        },
      ],
    },
    {
      day: 5,
      title: "Izvještaji i Rokovi",
      tasks: [
        {
          id: "view-calendar",
          title: "Pregledaj kalendar obveza",
          href: "/rokovi",
        },
        {
          id: "understand-deadlines",
          title: "Razumij rokove za PDV i porez na dobit",
          href: "/vodici/rokovi-doo",
        },
        {
          id: "preview-reports",
          title: "Pregledaj financijske izvještaje",
          href: "/reports",
        },
        {
          id: "connect-google",
          title: "Poveži s Google kalendarom",
          isOptional: true,
          href: "/settings/integrations",
          completionCheck: (ctx) => ctx.hasCalendarReminder,
        },
      ],
    },
  ],
}

export const JDOO_FIRST_WEEK: TutorialTrack = {
  id: "jdoo-first-week",
  name: "J.D.O.O. First Week",
  description: "Naučite koristiti FiskAI za jednostavno društvo u 5 dana",
  targetLegalForm: ["JDOO"],
  days: [
    {
      day: 1,
      title: "Kontakti i Postavke",
      tasks: [
        {
          id: "add-first-customer",
          title: "Dodaj prvog kupca",
          href: "/contacts/new",
          completionCheck: (ctx) => ctx.contactsCount >= 1,
        },
        {
          id: "understand-oib",
          title: "Razumij OIB validaciju",
          description: "OIB je 11-znamenkasti identifikacijski broj",
          href: "/vodici/oib-validacija",
        },
        {
          id: "understand-jdoo-limits",
          title: "Razumij ograničenja j.d.o.o.",
          description: "Temeljni kapital do 2.500 EUR",
          href: "/vodici/jdoo-osnove",
        },
      ],
    },
    {
      day: 2,
      title: "Proizvodi/Usluge",
      tasks: [
        {
          id: "add-first-product",
          title: "Dodaj svoju glavnu uslugu",
          href: "/products/new",
          completionCheck: (ctx) => ctx.productsCount >= 1,
        },
        {
          id: "set-price-vat",
          title: "Postavi cijenu i PDV status",
          description: "PDV ovisi o pragu od 40.000 EUR",
          href: "/products",
        },
        {
          id: "understand-vat-threshold",
          title: "Razumij prag za ulazak u PDV",
          href: "/vodici/pdv-prag",
        },
      ],
    },
    {
      day: 3,
      title: "Prvi Račun",
      tasks: [
        {
          id: "create-first-invoice",
          title: "Kreiraj račun za kupca",
          href: "/invoices/new",
          completionCheck: (ctx) => ctx.invoicesCount >= 1,
        },
        {
          id: "preview-pdf",
          title: "Pregledaj PDF preview",
          href: "/invoices",
        },
        {
          id: "send-or-download",
          title: "Pošalji e-mailom ili preuzmi",
          href: "/invoices",
        },
      ],
    },
    {
      day: 4,
      title: "Troškovi i Obveze",
      tasks: [
        {
          id: "add-first-expense",
          title: "Dodaj prvi trošak",
          href: "/expenses/new",
          completionCheck: (ctx) => ctx.hasExpenseEntry ?? false,
        },
        {
          id: "understand-rezerve",
          title: "Razumij zakonske rezerve",
          description: "J.D.O.O. mora izdvajati 25% dobiti dok kapital ne dostigne 2.500 EUR",
          href: "/vodici/jdoo-rezerve",
        },
        {
          id: "connect-bank",
          title: "Poveži bankovni račun",
          isOptional: true,
          href: "/banking/connect",
          completionCheck: (ctx) => ctx.hasBankConnection ?? false,
        },
      ],
    },
    {
      day: 5,
      title: "Izvještaji i Rokovi",
      tasks: [
        {
          id: "view-calendar",
          title: "Pregledaj kalendar obveza",
          href: "/rokovi",
        },
        {
          id: "understand-gfi",
          title: "Razumij GFI obrazac",
          description: "Godišnji financijski izvještaj",
          href: "/vodici/gfi",
        },
        {
          id: "preview-reports",
          title: "Pregledaj financijske izvještaje",
          href: "/reports",
        },
        {
          id: "connect-google",
          title: "Poveži s Google kalendarom",
          isOptional: true,
          href: "/settings/integrations",
          completionCheck: (ctx) => ctx.hasCalendarReminder,
        },
      ],
    },
  ],
}

export const OBRT_REAL_FIRST_WEEK: TutorialTrack = {
  id: "obrt-real-first-week",
  name: "Obrt (Stvarni dohodak) First Week",
  description: "Naučite koristiti FiskAI za obrt sa stvarnim dohotkom u 5 dana",
  targetLegalForm: ["OBRT_REAL"],
  days: [
    {
      day: 1,
      title: "Kontakti",
      tasks: [
        {
          id: "add-first-customer",
          title: "Dodaj prvog kupca",
          href: "/contacts/new",
          completionCheck: (ctx) => ctx.contactsCount >= 1,
        },
        {
          id: "understand-oib",
          title: "Razumij OIB validaciju",
          description: "OIB je 11-znamenkasti identifikacijski broj",
          href: "/vodici/oib-validacija",
        },
        {
          id: "import-csv",
          title: "Uvezi kontakte iz CSV",
          isOptional: true,
          href: "/contacts/import",
        },
      ],
    },
    {
      day: 2,
      title: "Proizvodi/Usluge",
      tasks: [
        {
          id: "add-first-product",
          title: "Dodaj svoju glavnu uslugu",
          href: "/products/new",
          completionCheck: (ctx) => ctx.productsCount >= 1,
        },
        {
          id: "set-price",
          title: "Postavi cijenu",
          description: "Obrt sa stvarnim dohotkom ne naplaćuje PDV ispod praga",
          href: "/products",
        },
        {
          id: "understand-income-calculation",
          title: "Razumij izračun dohotka",
          description: "Dohodak = Prihodi - Rashodi",
          href: "/vodici/stvarni-dohodak",
        },
      ],
    },
    {
      day: 3,
      title: "Prvi račun",
      tasks: [
        {
          id: "create-first-invoice",
          title: "Kreiraj račun za kupca",
          href: "/invoices/new",
          completionCheck: (ctx) => ctx.invoicesCount >= 1,
        },
        {
          id: "preview-pdf",
          title: "Pregledaj PDF preview",
          href: "/invoices",
        },
        {
          id: "send-or-download",
          title: "Pošalji e-mailom ili preuzmi",
          href: "/invoices",
        },
        {
          id: "understand-kpr",
          title: "Razumij KPR unos",
          description: "Račun se automatski upisuje u Knjigu primitaka i izdataka",
          href: "/vodici/kpr",
        },
      ],
    },
    {
      day: 4,
      title: "Troškovi i Rashodi",
      tasks: [
        {
          id: "add-first-expense",
          title: "Dodaj prvi trošak",
          href: "/expenses/new",
          completionCheck: (ctx) => ctx.hasExpenseEntry ?? false,
        },
        {
          id: "understand-deductible-expenses",
          title: "Razumij priznate rashode",
          description: "Koje troškove možete odbiti od prihoda",
          href: "/vodici/priznati-rashodi",
        },
        {
          id: "connect-bank",
          title: "Poveži bankovni račun",
          isOptional: true,
          href: "/banking/connect",
          completionCheck: (ctx) => ctx.hasBankConnection ?? false,
        },
      ],
    },
    {
      day: 5,
      title: "KPR i Rokovi",
      tasks: [
        {
          id: "open-kpr",
          title: "Otvori Knjigu primitaka i izdataka",
          href: "/kpr",
          completionCheck: (ctx) => ctx.hasKprEntry,
        },
        {
          id: "view-calendar",
          title: "Pregledaj kalendar obveza",
          href: "/rokovi",
        },
        {
          id: "understand-contributions",
          title: "Razumij MIO/HZZO doprinose",
          href: "/vodici/doprinosi",
        },
        {
          id: "connect-google",
          title: "Poveži s Google kalendarom",
          isOptional: true,
          href: "/settings/integrations",
          completionCheck: (ctx) => ctx.hasCalendarReminder,
        },
      ],
    },
  ],
}

export const VAT_BUSINESS_FIRST_WEEK: TutorialTrack = {
  id: "vat-business-first-week",
  name: "PDV Obveznik First Week",
  description: "Naučite koristiti FiskAI kao PDV obveznik u 5 dana",
  targetLegalForm: ["OBRT", "OBRT_VAT", "OBRT_PAUSAL_VAT"],
  days: [
    {
      day: 1,
      title: "Kontakti i PDV Postavke",
      tasks: [
        {
          id: "add-first-customer",
          title: "Dodaj prvog kupca",
          href: "/contacts/new",
          completionCheck: (ctx) => ctx.contactsCount >= 1,
        },
        {
          id: "setup-vat",
          title: "Postavi PDV postavke",
          description: "Konfiguriraj stope PDV-a za svoje poslovanje",
          href: "/settings/vat",
          completionCheck: (ctx) => ctx.hasVatSetup ?? false,
        },
        {
          id: "understand-eu-vat",
          title: "Razumij EU PDV pravila",
          description: "Isporuke unutar EU i reverse charge",
          href: "/vodici/eu-pdv",
        },
      ],
    },
    {
      day: 2,
      title: "Proizvodi s PDV-om",
      tasks: [
        {
          id: "add-first-product",
          title: "Dodaj proizvod/uslugu s PDV-om",
          href: "/products/new",
          completionCheck: (ctx) => ctx.productsCount >= 1,
        },
        {
          id: "set-price-vat",
          title: "Postavi ispravnu stopu PDV-a",
          description: "25%, 13% ili 5% ovisno o vrsti",
          href: "/products",
        },
        {
          id: "understand-vat-rates",
          title: "Razumij stope PDV-a",
          href: "/vodici/pdv-stope",
        },
      ],
    },
    {
      day: 3,
      title: "Izlazni Računi",
      tasks: [
        {
          id: "create-first-invoice",
          title: "Kreiraj račun s PDV-om",
          href: "/invoices/new",
          completionCheck: (ctx) => ctx.invoicesCount >= 1,
        },
        {
          id: "preview-pdf",
          title: "Pregledaj PDF s iskazanim PDV-om",
          href: "/invoices",
        },
        {
          id: "understand-r1-r2",
          title: "Razumij R-1 i R-2 račune",
          href: "/vodici/r1-r2-racuni",
        },
      ],
    },
    {
      day: 4,
      title: "Ulazni Računi i Pretporez",
      tasks: [
        {
          id: "add-first-expense",
          title: "Dodaj ulazni račun",
          href: "/expenses/new",
          completionCheck: (ctx) => ctx.hasExpenseEntry ?? false,
        },
        {
          id: "understand-pretporez",
          title: "Razumij pravo na pretporez",
          description: "Uvjeti za odbijanje PDV-a",
          href: "/vodici/pretporez",
        },
        {
          id: "connect-bank",
          title: "Poveži bankovni račun",
          isOptional: true,
          href: "/banking/connect",
          completionCheck: (ctx) => ctx.hasBankConnection ?? false,
        },
      ],
    },
    {
      day: 5,
      title: "PDV Prijava",
      tasks: [
        {
          id: "view-calendar",
          title: "Pregledaj rokove za PDV prijavu",
          href: "/rokovi",
        },
        {
          id: "understand-pdv-obrazac",
          title: "Razumij PDV obrazac",
          description: "Prijava do 20. u mjesecu",
          href: "/vodici/pdv-obrazac",
        },
        {
          id: "preview-pdv-report",
          title: "Pregledaj PDV izvještaj",
          href: "/vat/report",
        },
        {
          id: "connect-google",
          title: "Poveži s Google kalendarom",
          isOptional: true,
          href: "/settings/integrations",
          completionCheck: (ctx) => ctx.hasCalendarReminder,
        },
      ],
    },
  ],
}

export const ALL_TRACKS = [
  PAUSALNI_FIRST_WEEK,
  OBRT_REAL_FIRST_WEEK,
  VAT_BUSINESS_FIRST_WEEK,
  DOO_FIRST_WEEK,
  JDOO_FIRST_WEEK,
]

export function getTrackForLegalForm(legalForm: string): TutorialTrack | null {
  return ALL_TRACKS.find((track) => track.targetLegalForm.includes(legalForm)) || null
}
