// src/lib/deadlines/seed-data.ts
import type { NewComplianceDeadline } from "@/lib/db/schema"

/**
 * Croatian compliance deadlines for businesses
 * These are recurring deadlines that apply to different business types
 */
export const croatianDeadlines: Omit<NewComplianceDeadline, "id" | "createdAt" | "updatedAt">[] = [
  // PDV (VAT) Monthly Deadlines
  {
    title: "PDV prijava za prethodni mjesec",
    description:
      "Obveznici PDV-a dužni su podnijeti mjesečnu PDV prijavu do kraja mjeseca za prethodni mjesec.",
    deadlineDate: "2025-01-31",
    deadlineType: "tax",
    appliesTo: ["vat_payer"],
    recurrence: "monthly",
    recurrenceDay: 31, // Last day of month
    sourceUrl: "https://www.porezna-uprava.hr/HR_porezni_obveznici/Stranice/PDV.aspx",
    sourceName: "Porezna uprava RH",
    severity: "critical",
  },
  {
    title: "PDV prijava za prethodni kvartal",
    description:
      "Obveznici PDV-a koji podnose kvartalne prijave dužni su to učiniti u roku od 30 dana nakon isteka tromjesečja.",
    deadlineDate: "2025-04-30",
    deadlineType: "tax",
    appliesTo: ["vat_payer_quarterly"],
    recurrence: "quarterly",
    sourceUrl: "https://www.porezna-uprava.hr/HR_porezni_obveznici/Stranice/PDV.aspx",
    sourceName: "Porezna uprava RH",
    severity: "critical",
  },

  // Porez na dohodak (Income Tax)
  {
    title: "Predujam poreza na dohodak",
    description:
      "Obveznici poreza na dohodak dužni su uplatiti predujam poreza za prethodni mjesec do 15. u mjesecu.",
    deadlineDate: "2025-01-15",
    deadlineType: "tax",
    appliesTo: ["self_employed", "company"],
    recurrence: "monthly",
    recurrenceDay: 15,
    sourceUrl: "https://www.porezna-uprava.hr/HR_porezni_obveznici/Stranice/Porez-na-dohodak.aspx",
    sourceName: "Porezna uprava RH",
    severity: "high",
  },

  // Godišnja porezna prijava
  {
    title: "Godišnja porezna prijava (PO-PD obrazac)",
    description:
      "Obveznici poreza na dohodak od samostalne djelatnosti dužni su podnijeti godišnju prijavu do 28. veljače.",
    deadlineDate: "2025-02-28",
    deadlineType: "tax",
    appliesTo: ["self_employed"],
    recurrence: "yearly",
    sourceUrl: "https://www.porezna-uprava.hr/HR_porezni_obveznici/Stranice/Porez-na-dohodak.aspx",
    sourceName: "Porezna uprava RH",
    severity: "critical",
  },

  // Porez na dobit
  {
    title: "Godišnja prijava poreza na dobit (PD obrazac)",
    description:
      "Trgovačka društva dužna su podnijeti godišnju prijavu poreza na dobit najkasnije do kraja četvrtog mjeseca za prethodnu godinu.",
    deadlineDate: "2025-04-30",
    deadlineType: "tax",
    appliesTo: ["company"],
    recurrence: "yearly",
    sourceUrl: "https://www.porezna-uprava.hr/HR_porezni_obveznici/Stranice/Porez-na-dobit.aspx",
    sourceName: "Porezna uprava RH",
    severity: "critical",
  },

  // Doprinosi
  {
    title: "Prijava plaća i doprinosa (JOPPD)",
    description:
      "Poslodavci moraju do 15. u mjesecu prijaviti plaće i doprinose za prethodni mjesec putem JOPPD obrasca.",
    deadlineDate: "2025-01-15",
    deadlineType: "payroll",
    appliesTo: ["company", "self_employed"],
    recurrence: "monthly",
    recurrenceDay: 15,
    sourceUrl: "https://www.porezna-uprava.hr/HR_porezni_obveznici/Stranice/JOPPD.aspx",
    sourceName: "Porezna uprava RH",
    severity: "critical",
  },

  // Godišnja financijska izvješća
  {
    title: "Predaja godišnjeg financijskog izvješća (GFI)",
    description:
      "Svi poslovni subjekti dužni su FINA-i predati godišnje financijsko izvješće do kraja veljače za prethodnu godinu.",
    deadlineDate: "2025-02-28",
    deadlineType: "reporting",
    appliesTo: ["company"],
    recurrence: "yearly",
    sourceUrl: "https://www.fina.hr/",
    sourceName: "FINA",
    severity: "critical",
  },

  // Statistička izvješća
  {
    title: "Mjesečno statističko izvješće (MES-1)",
    description:
      "Obveznici izvješćivanja DZS-u predaju mjesečno izvješće MES-1 do 15. u mjesecu za prethodni mjesec.",
    deadlineDate: "2025-01-15",
    deadlineType: "reporting",
    appliesTo: ["company"],
    recurrence: "monthly",
    recurrenceDay: 15,
    sourceUrl: "https://www.dzs.hr/",
    sourceName: "DZS",
    severity: "normal",
  },

  // Intrastat
  {
    title: "Intrastat prijava",
    description:
      "Obveznici Intrastat izvješćivanja predaju prijavu do 15. u mjesecu za prethodni mjesec.",
    deadlineDate: "2025-01-15",
    deadlineType: "reporting",
    appliesTo: ["company", "vat_payer"],
    recurrence: "monthly",
    recurrenceDay: 15,
    sourceUrl: "https://www.dzs.hr/",
    sourceName: "DZS",
    severity: "high",
  },

  // Paušalni obrt
  {
    title: "Uplata paušalnog poreza za prethodni mjesec",
    description:
      "Obveznici paušalnog oporezivanja dužni su uplatiti paušalni porez do 15. u mjesecu za prethodni mjesec.",
    deadlineDate: "2025-01-15",
    deadlineType: "tax",
    appliesTo: ["pausalni"],
    recurrence: "monthly",
    recurrenceDay: 15,
    sourceUrl:
      "https://www.porezna-uprava.hr/HR_porezni_obveznici/Stranice/Pausalno-oporezivanje.aspx",
    sourceName: "Porezna uprava RH",
    severity: "high",
  },

  // ROL obrazac (Izvješće o radnicima)
  {
    title: "ROL obrazac - Izvješće o zaposlenim radnicima",
    description:
      "Poslodavci su dužni podnijeti ROL obrazac do 15. siječnja tekuće godine za stanje na dan 31. prosinca prethodne godine.",
    deadlineDate: "2025-01-15",
    deadlineType: "reporting",
    appliesTo: ["company"],
    recurrence: "yearly",
    sourceUrl: "https://www.hzz.hr/",
    sourceName: "HZZ",
    severity: "high",
  },

  // Godišnja skupština
  {
    title: "Skupština dioničkog društva (d.o.o.)",
    description:
      "Skupština društva s ograničenom odgovornošću mora se održati najkasnije do 30. lipnja za prethodnu poslovnu godinu radi usvajanja GFI.",
    deadlineDate: "2025-06-30",
    deadlineType: "regulatory",
    appliesTo: ["company"],
    recurrence: "yearly",
    sourceUrl: "https://www.zakon.hr/",
    sourceName: "Zakon o trgovačkim društvima",
    severity: "high",
  },

  // Izmjena podataka u sudskom registru
  {
    title: "Prijava promjena u sudski registar",
    description:
      "Sve promjene podataka o društvu (adresa, djelatnost, zastupnici) moraju se prijaviti u sudski registar u roku od 15 dana.",
    deadlineDate: "2025-12-31",
    deadlineType: "registration",
    appliesTo: ["company"],
    recurrence: null,
    sourceUrl: "https://sudreg.pravosudje.hr/",
    sourceName: "Sudski registar",
    severity: "normal",
  },

  // OPZ/DOZ obrazac
  {
    title: "OPZ/DOZ obrazac (promjene PDV obveznika)",
    description:
      "Promjene podataka o PDV obvezniku moraju se prijaviti Poreznoj upravi u roku od 8 dana.",
    deadlineDate: "2025-12-31",
    deadlineType: "registration",
    appliesTo: ["vat_payer"],
    recurrence: null,
    sourceUrl: "https://www.porezna-uprava.hr/",
    sourceName: "Porezna uprava RH",
    severity: "high",
  },

  // Godišnji odmor - evidencija
  {
    title: "Ažuriranje evidencije o korištenju godišnjih odmora",
    description:
      "Poslodavci moraju voditi ažurnu evidenciju o korištenju godišnjih odmora radnika.",
    deadlineDate: "2025-12-31",
    deadlineType: "regulatory",
    appliesTo: ["company"],
    recurrence: "yearly",
    sourceUrl: "https://www.zakon.hr/",
    sourceName: "Zakon o radu",
    severity: "low",
  },

  // Procjena rizika
  {
    title: "Ažuriranje procjene rizika za zaštitu na radu",
    description:
      "Poslodavci moraju imati ažurnu procjenu rizika i preispitati je svake godine ili po potrebi.",
    deadlineDate: "2025-12-31",
    deadlineType: "regulatory",
    appliesTo: ["company"],
    recurrence: "yearly",
    sourceUrl: "https://www.zakon.hr/",
    sourceName: "Zakon o zaštiti na radu",
    severity: "normal",
  },
]
