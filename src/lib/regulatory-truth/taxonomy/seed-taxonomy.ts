// src/lib/regulatory-truth/taxonomy/seed-taxonomy.ts
import { db } from "@/lib/db"

interface TaxonomySeed {
  slug: string
  nameHr: string
  nameEn?: string
  parentSlug?: string
  synonyms?: string[]
  hyponyms?: string[]
  legalCategory?: string
  vatCategory?: string
  searchTerms?: string[]
}

const INITIAL_TAXONOMY: TaxonomySeed[] = [
  // ============================================================================
  // PDV (VAT) - COMPREHENSIVE COVERAGE
  // ============================================================================

  // === VAT DOMAIN ROOT ===
  {
    slug: "pdv-domena",
    nameHr: "PDV",
    nameEn: "VAT",
    synonyms: ["vat", "value added tax", "porez na dodanu vrijednost"],
    searchTerms: ["pdv", "vat", "ddv", "porez na dodanu vrijednost"],
  },

  // === VAT RATES HIERARCHY ===
  {
    slug: "pdv-stopa",
    nameHr: "PDV stopa",
    nameEn: "VAT rate",
    parentSlug: "pdv-domena",
    searchTerms: ["vat rate", "pdv stopa", "stopa poreza"],
  },
  {
    slug: "pdv-stopa-25",
    nameHr: "Standardna stopa PDV-a 25%",
    nameEn: "Standard VAT rate 25%",
    parentSlug: "pdv-stopa",
    legalCategory: "standardna-stopa",
    vatCategory: "25%",
    synonyms: ["puna stopa", "redovna stopa", "opća stopa"],
    searchTerms: ["25%", "dvadeset pet posto", "standardna stopa"],
  },
  {
    slug: "pdv-stopa-13",
    nameHr: "Snižena stopa PDV-a 13%",
    nameEn: "Reduced VAT rate 13%",
    parentSlug: "pdv-stopa",
    legalCategory: "snižena-stopa",
    vatCategory: "13%",
    synonyms: ["srednja stopa", "snižena stopa"],
    searchTerms: ["13%", "trinaest posto"],
  },
  {
    slug: "pdv-stopa-5",
    nameHr: "Snižena stopa PDV-a 5%",
    nameEn: "Reduced VAT rate 5%",
    parentSlug: "pdv-stopa",
    legalCategory: "snižena-stopa-5",
    vatCategory: "5%",
    synonyms: ["najniža stopa"],
    searchTerms: ["5%", "pet posto"],
  },
  {
    slug: "pdv-oslobodeno",
    nameHr: "Oslobođeno PDV-a",
    nameEn: "VAT exempt",
    parentSlug: "pdv-stopa",
    legalCategory: "oslobodeno",
    vatCategory: "0%",
    synonyms: ["bez pdv", "nulta stopa", "oslobođenje"],
    searchTerms: ["0%", "oslobođenje", "exempt"],
  },

  // === VAT REGISTRATION ===
  {
    slug: "pdv-registracija",
    nameHr: "Registracija u sustav PDV-a",
    nameEn: "VAT registration",
    parentSlug: "pdv-domena",
    synonyms: ["upis u pdv", "pdv obveznik"],
    searchTerms: ["registracija", "upis", "pdv obveznik"],
  },
  {
    slug: "pdv-prag",
    nameHr: "Prag za ulazak u sustav PDV-a",
    nameEn: "VAT registration threshold",
    parentSlug: "pdv-registracija",
    legalCategory: "prag-pdv",
    synonyms: ["limit za pdv", "granica za pdv"],
    searchTerms: ["prag", "40000", "limit", "granica", "threshold"],
  },
  {
    slug: "pdv-dobrovoljni-ulazak",
    nameHr: "Dobrovoljni ulazak u sustav PDV-a",
    nameEn: "Voluntary VAT registration",
    parentSlug: "pdv-registracija",
    legalCategory: "dobrovoljni-pdv",
    synonyms: ["opcijski pdv"],
    searchTerms: ["dobrovoljni", "opcijski", "voluntary"],
  },
  {
    slug: "pdv-izlazak",
    nameHr: "Izlazak iz sustava PDV-a",
    nameEn: "VAT deregistration",
    parentSlug: "pdv-registracija",
    legalCategory: "izlazak-pdv",
    synonyms: ["odjava pdv", "prestanak pdv"],
    searchTerms: ["izlazak", "odjava", "prestanak", "deregistration"],
  },

  // === VAT EXEMPTIONS ===
  {
    slug: "pdv-oslobodjenja",
    nameHr: "PDV oslobođenja",
    nameEn: "VAT exemptions",
    parentSlug: "pdv-domena",
    synonyms: ["izuzeća", "oslobođenja od pdv"],
    searchTerms: ["oslobođenja", "izuzeća", "exemptions"],
  },
  {
    slug: "pdv-oslobodjenje-izvoz",
    nameHr: "Oslobođenje za izvoz",
    nameEn: "Export VAT exemption",
    parentSlug: "pdv-oslobodjenja",
    legalCategory: "izvoz-oslobođenje",
    synonyms: ["izvozno oslobođenje"],
    searchTerms: ["izvoz", "export", "treće zemlje"],
  },
  {
    slug: "pdv-oslobodjenje-zdravstvo",
    nameHr: "Oslobođenje za zdravstvene usluge",
    nameEn: "Healthcare VAT exemption",
    parentSlug: "pdv-oslobodjenja",
    legalCategory: "zdravstvo-oslobođenje",
    synonyms: ["medicinske usluge"],
    searchTerms: ["zdravstvo", "medicina", "healthcare", "bolnica"],
  },
  {
    slug: "pdv-oslobodjenje-obrazovanje",
    nameHr: "Oslobođenje za obrazovne usluge",
    nameEn: "Education VAT exemption",
    parentSlug: "pdv-oslobodjenja",
    legalCategory: "obrazovanje-oslobođenje",
    synonyms: ["edukacija", "škola"],
    searchTerms: ["obrazovanje", "edukacija", "škola", "education"],
  },
  {
    slug: "pdv-oslobodjenje-financije",
    nameHr: "Oslobođenje za financijske usluge",
    nameEn: "Financial services VAT exemption",
    parentSlug: "pdv-oslobodjenja",
    legalCategory: "financije-oslobođenje",
    synonyms: ["bankarske usluge", "osiguranje"],
    searchTerms: ["financije", "banka", "osiguranje", "financial"],
  },

  // === EU VAT TRANSACTIONS ===
  {
    slug: "pdv-eu-transakcije",
    nameHr: "PDV za EU transakcije",
    nameEn: "EU VAT transactions",
    parentSlug: "pdv-domena",
    synonyms: ["intrakomunitarne isporuke", "eu promet"],
    searchTerms: ["eu", "intrakomunitarno", "eu transakcije"],
  },
  {
    slug: "pdv-eu-stjecanje",
    nameHr: "Stjecanje dobara iz EU",
    nameEn: "Acquisition of goods from EU",
    parentSlug: "pdv-eu-transakcije",
    legalCategory: "stjecanje-eu",
    synonyms: ["uvoz iz eu", "nabava iz eu"],
    searchTerms: ["stjecanje", "acquisition", "uvoz eu"],
  },
  {
    slug: "pdv-eu-isporuka",
    nameHr: "Isporuka dobara u EU",
    nameEn: "Supply of goods to EU",
    parentSlug: "pdv-eu-transakcije",
    legalCategory: "isporuka-eu",
    synonyms: ["izvoz u eu", "prodaja u eu"],
    searchTerms: ["isporuka", "supply", "izvoz eu"],
  },
  {
    slug: "pdv-eu-usluge",
    nameHr: "Usluge unutar EU",
    nameEn: "Services within EU",
    parentSlug: "pdv-eu-transakcije",
    legalCategory: "usluge-eu",
    synonyms: ["prekogranične usluge"],
    searchTerms: ["usluge eu", "b2b usluge", "services eu"],
  },
  {
    slug: "pdv-reverse-charge",
    nameHr: "Prijenos porezne obveze",
    nameEn: "Reverse charge mechanism",
    parentSlug: "pdv-eu-transakcije",
    legalCategory: "reverse-charge",
    synonyms: ["obrnuta naplata", "prijenos obveze"],
    searchTerms: ["reverse charge", "prijenos obveze", "obrnuta naplata"],
  },

  // === VAT INVOICING ===
  {
    slug: "pdv-racuni",
    nameHr: "PDV računi",
    nameEn: "VAT invoices",
    parentSlug: "pdv-domena",
    synonyms: ["fakture", "računi s pdv"],
    searchTerms: ["račun", "faktura", "invoice"],
  },
  {
    slug: "pdv-racun-obvezni-elementi",
    nameHr: "Obvezni elementi PDV računa",
    nameEn: "Mandatory VAT invoice elements",
    parentSlug: "pdv-racuni",
    legalCategory: "elementi-računa",
    synonyms: ["sadržaj računa"],
    searchTerms: ["elementi", "sadržaj", "obvezni podaci"],
  },
  {
    slug: "pdv-eracun",
    nameHr: "Elektronički račun",
    nameEn: "Electronic invoice",
    parentSlug: "pdv-racuni",
    legalCategory: "e-račun",
    synonyms: ["e-račun", "digitalni račun"],
    searchTerms: ["e-račun", "elektronički", "eracun"],
  },

  // === VAT FILING ===
  {
    slug: "pdv-prijave",
    nameHr: "PDV prijave",
    nameEn: "VAT returns",
    parentSlug: "pdv-domena",
    synonyms: ["pdv obrasci", "pdv izvješća"],
    searchTerms: ["prijava", "obrazac", "return"],
  },
  {
    slug: "pdv-obrazac-pdv",
    nameHr: "Obrazac PDV",
    nameEn: "VAT return form",
    parentSlug: "pdv-prijave",
    legalCategory: "obrazac-pdv",
    synonyms: ["pdv prijava"],
    searchTerms: ["obrazac pdv", "pdv obrazac"],
  },
  {
    slug: "pdv-obrazac-pdv-s",
    nameHr: "Obrazac PDV-S",
    nameEn: "VAT summary return",
    parentSlug: "pdv-prijave",
    legalCategory: "obrazac-pdv-s",
    synonyms: ["zbirna prijava"],
    searchTerms: ["pdv-s", "zbirna prijava"],
  },
  {
    slug: "pdv-obrazac-zppdv",
    nameHr: "Obrazac ZP-PDV",
    nameEn: "VAT recapitulative statement",
    parentSlug: "pdv-prijave",
    legalCategory: "obrazac-zp-pdv",
    synonyms: ["rekapitulacija"],
    searchTerms: ["zp-pdv", "rekapitulacija"],
  },

  // ============================================================================
  // PAUSALNI OBRT - COMPREHENSIVE COVERAGE
  // ============================================================================

  // === PAUSALNI ROOT ===
  {
    slug: "pausalni-domena",
    nameHr: "Paušalno oporezivanje",
    nameEn: "Lump-sum taxation",
    synonyms: ["pausalni sustav", "paušalni obrt"],
    searchTerms: ["pausalni", "paušalni", "lump sum", "flat rate"],
  },

  // === INCOME LIMITS ===
  {
    slug: "pausalni-limiti",
    nameHr: "Paušalni limiti prihoda",
    nameEn: "Lump-sum income limits",
    parentSlug: "pausalni-domena",
    synonyms: ["granice prihoda", "pragovi"],
    searchTerms: ["limit", "prag", "granica", "threshold"],
  },
  {
    slug: "pausalni-limit-prihoda",
    nameHr: "Godišnji limit primitaka",
    nameEn: "Annual income limit",
    parentSlug: "pausalni-limiti",
    legalCategory: "limit-primitaka",
    synonyms: ["maksimalni prihod", "gornja granica"],
    searchTerms: ["limit", "39816", "primitak", "annual limit"],
  },
  {
    slug: "pausalni-limit-eu-usluge",
    nameHr: "Limit za EU usluge",
    nameEn: "EU services limit",
    parentSlug: "pausalni-limiti",
    legalCategory: "limit-eu-usluge",
    synonyms: ["eu granica"],
    searchTerms: ["eu limit", "10000", "usluge eu"],
  },

  // === TAX RATES ===
  {
    slug: "pausalni-porez",
    nameHr: "Paušalni porez na dohodak",
    nameEn: "Lump-sum income tax",
    parentSlug: "pausalni-domena",
    synonyms: ["porez na dohodak"],
    searchTerms: ["porez", "tax rate", "stopa poreza"],
  },
  {
    slug: "pausalni-stopa-10",
    nameHr: "Paušalna stopa 10%",
    nameEn: "10% lump-sum rate",
    parentSlug: "pausalni-porez",
    legalCategory: "stopa-10",
    synonyms: ["osnovna stopa"],
    searchTerms: ["10%", "deset posto"],
  },
  {
    slug: "pausalni-prirez",
    nameHr: "Prirez na paušalni porez",
    nameEn: "Surtax on lump-sum",
    parentSlug: "pausalni-porez",
    legalCategory: "prirez",
    synonyms: ["gradski prirez"],
    searchTerms: ["prirez", "surtax"],
  },

  // === CONTRIBUTION BASES ===
  {
    slug: "pausalni-doprinosi",
    nameHr: "Paušalni doprinosi",
    nameEn: "Lump-sum contributions",
    parentSlug: "pausalni-domena",
    synonyms: ["doprinosi obrtnika"],
    searchTerms: ["doprinosi", "contributions"],
  },
  {
    slug: "pausalni-osnovica-doprinosa",
    nameHr: "Osnovica za doprinose paušalista",
    nameEn: "Contribution base for lump-sum",
    parentSlug: "pausalni-doprinosi",
    legalCategory: "osnovica-doprinosi",
    synonyms: ["baza za doprinose"],
    searchTerms: ["osnovica", "base", "baza"],
  },
  {
    slug: "pausalni-mio-doprinos",
    nameHr: "MIO doprinos paušalista",
    nameEn: "Pension contribution for lump-sum",
    parentSlug: "pausalni-doprinosi",
    legalCategory: "mio-pausalni",
    synonyms: ["mirovinsko osiguranje"],
    searchTerms: ["mio", "mirovina", "pension"],
  },
  {
    slug: "pausalni-zdr-doprinos",
    nameHr: "Zdravstveni doprinos paušalista",
    nameEn: "Health contribution for lump-sum",
    parentSlug: "pausalni-doprinosi",
    legalCategory: "zdravstveni-pausalni",
    synonyms: ["zdravstveno osiguranje"],
    searchTerms: ["zdravstveni", "zdravlje", "health"],
  },

  // === ELIGIBLE ACTIVITIES ===
  {
    slug: "pausalni-djelatnosti",
    nameHr: "Djelatnosti za paušalno oporezivanje",
    nameEn: "Activities eligible for lump-sum",
    parentSlug: "pausalni-domena",
    synonyms: ["dopuštene djelatnosti"],
    searchTerms: ["djelatnosti", "aktivnosti", "activities"],
  },
  {
    slug: "pausalni-dopustene",
    nameHr: "Dopuštene djelatnosti",
    nameEn: "Permitted activities",
    parentSlug: "pausalni-djelatnosti",
    legalCategory: "dopustene-djelatnosti",
    synonyms: ["dozvoljene djelatnosti"],
    searchTerms: ["dopuštene", "dozvoljene", "permitted"],
  },
  {
    slug: "pausalni-zabranjene",
    nameHr: "Zabranjene djelatnosti za paušal",
    nameEn: "Activities not eligible for lump-sum",
    parentSlug: "pausalni-djelatnosti",
    legalCategory: "zabranjene-djelatnosti",
    synonyms: ["isključene djelatnosti"],
    searchTerms: ["zabranjene", "isključene", "prohibited"],
  },
  {
    slug: "pausalni-slobodna-zanimanja",
    nameHr: "Slobodna zanimanja",
    nameEn: "Liberal professions",
    parentSlug: "pausalni-zabranjene",
    legalCategory: "slobodna-zanimanja",
    synonyms: ["profesije"],
    searchTerms: ["slobodna zanimanja", "odvjetnik", "liječnik", "liberal"],
  },

  // === REGISTRATION & FORMS ===
  {
    slug: "pausalni-registracija",
    nameHr: "Registracija paušalnog obrta",
    nameEn: "Lump-sum business registration",
    parentSlug: "pausalni-domena",
    synonyms: ["upis paušalnog obrta"],
    searchTerms: ["registracija", "upis", "otvaranje"],
  },
  {
    slug: "pausalni-obrazac-po-sd",
    nameHr: "Obrazac PO-SD",
    nameEn: "Annual lump-sum declaration",
    parentSlug: "pausalni-registracija",
    legalCategory: "obrazac-po-sd",
    synonyms: ["godišnja prijava"],
    searchTerms: ["po-sd", "posd", "godišnja prijava"],
  },
  {
    slug: "pausalni-po-sd-rok",
    nameHr: "Rok za predaju PO-SD",
    nameEn: "PO-SD filing deadline",
    parentSlug: "pausalni-obrazac-po-sd",
    legalCategory: "rok-po-sd",
    synonyms: ["rok prijave"],
    searchTerms: ["rok", "deadline", "15. siječnja"],
  },

  // === PAUSALNI SPECIAL RULES ===
  {
    slug: "pausalni-posebna-pravila",
    nameHr: "Posebna pravila za paušaliste",
    nameEn: "Special rules for lump-sum",
    parentSlug: "pausalni-domena",
    synonyms: ["specifična pravila"],
    searchTerms: ["posebna pravila", "special rules"],
  },
  {
    slug: "pausalni-bez-pdv",
    nameHr: "Paušalist nije u sustavu PDV-a",
    nameEn: "Lump-sum not in VAT system",
    parentSlug: "pausalni-posebna-pravila",
    legalCategory: "pausalni-bez-pdv",
    synonyms: ["izvan pdv sustava"],
    searchTerms: ["bez pdv", "nije pdv obveznik"],
  },
  {
    slug: "pausalni-racun-elementi",
    nameHr: "Elementi računa paušalista",
    nameEn: "Invoice elements for lump-sum",
    parentSlug: "pausalni-posebna-pravila",
    legalCategory: "racun-pausalni",
    synonyms: ["sadržaj računa"],
    searchTerms: ["račun", "elementi", "invoice"],
  },

  // ============================================================================
  // POREZ NA DOBIT (CORPORATE TAX)
  // ============================================================================

  // === CORPORATE TAX ROOT ===
  {
    slug: "porez-dobit-domena",
    nameHr: "Porez na dobit",
    nameEn: "Corporate income tax",
    synonyms: ["corporate tax", "porez na profit"],
    searchTerms: ["porez na dobit", "corporate tax", "dobit"],
  },

  // === TAX RATES ===
  {
    slug: "porez-dobit-stope",
    nameHr: "Stope poreza na dobit",
    nameEn: "Corporate tax rates",
    parentSlug: "porez-dobit-domena",
    synonyms: ["stope"],
    searchTerms: ["stopa", "rate"],
  },
  {
    slug: "porez-dobit-stopa-10",
    nameHr: "Snižena stopa poreza na dobit 10%",
    nameEn: "Reduced corporate tax rate 10%",
    parentSlug: "porez-dobit-stope",
    legalCategory: "stopa-10-dobit",
    synonyms: ["mala poduzeća"],
    searchTerms: ["10%", "snižena stopa", "mali poduzetnici"],
  },
  {
    slug: "porez-dobit-stopa-18",
    nameHr: "Standardna stopa poreza na dobit 18%",
    nameEn: "Standard corporate tax rate 18%",
    parentSlug: "porez-dobit-stope",
    legalCategory: "stopa-18-dobit",
    synonyms: ["redovna stopa"],
    searchTerms: ["18%", "standardna stopa"],
  },

  // === TAX BASE ===
  {
    slug: "porez-dobit-osnovica",
    nameHr: "Porezna osnovica za porez na dobit",
    nameEn: "Corporate tax base",
    parentSlug: "porez-dobit-domena",
    synonyms: ["osnovica"],
    searchTerms: ["osnovica", "base", "dobit"],
  },
  {
    slug: "porez-dobit-priznati-rashodi",
    nameHr: "Porezno priznati rashodi",
    nameEn: "Tax-deductible expenses",
    parentSlug: "porez-dobit-osnovica",
    legalCategory: "priznati-rashodi",
    synonyms: ["odbitni troškovi"],
    searchTerms: ["rashodi", "troškovi", "deductible"],
  },
  {
    slug: "porez-dobit-nepriznati-rashodi",
    nameHr: "Porezno nepriznati rashodi",
    nameEn: "Non-deductible expenses",
    parentSlug: "porez-dobit-osnovica",
    legalCategory: "nepriznati-rashodi",
    synonyms: ["neodbitni troškovi"],
    searchTerms: ["nepriznati", "non-deductible"],
  },
  {
    slug: "porez-dobit-amortizacija",
    nameHr: "Amortizacija",
    nameEn: "Depreciation",
    parentSlug: "porez-dobit-priznati-rashodi",
    legalCategory: "amortizacija",
    synonyms: ["otpis"],
    searchTerms: ["amortizacija", "depreciation", "otpis"],
  },

  // === FILING ===
  {
    slug: "porez-dobit-prijave",
    nameHr: "Prijava poreza na dobit",
    nameEn: "Corporate tax returns",
    parentSlug: "porez-dobit-domena",
    synonyms: ["prijava", "obrazac"],
    searchTerms: ["prijava", "obrazac", "return"],
  },
  {
    slug: "porez-dobit-obrazac-pd",
    nameHr: "Obrazac PD",
    nameEn: "Corporate tax return form",
    parentSlug: "porez-dobit-prijave",
    legalCategory: "obrazac-pd",
    synonyms: ["prijava pd"],
    searchTerms: ["obrazac pd", "pd", "prijava dobiti"],
  },
  {
    slug: "porez-dobit-predujam",
    nameHr: "Predujam poreza na dobit",
    nameEn: "Corporate tax advance payment",
    parentSlug: "porez-dobit-prijave",
    legalCategory: "predujam-dobit",
    synonyms: ["akontacija"],
    searchTerms: ["predujam", "akontacija", "advance"],
  },

  // ============================================================================
  // POREZ NA DOHODAK (INCOME TAX)
  // ============================================================================

  // === INCOME TAX ROOT ===
  {
    slug: "dohodak-domena",
    nameHr: "Porez na dohodak",
    nameEn: "Income tax",
    synonyms: ["income tax", "personal income tax"],
    searchTerms: ["dohodak", "income tax", "porez na dohodak"],
  },

  // === TAX RATES ===
  {
    slug: "dohodak-stope",
    nameHr: "Stope poreza na dohodak",
    nameEn: "Income tax rates",
    parentSlug: "dohodak-domena",
    synonyms: ["porezne stope"],
    searchTerms: ["stope", "rates"],
  },
  {
    slug: "dohodak-stopa-20",
    nameHr: "Stopa poreza na dohodak 20%",
    nameEn: "Income tax rate 20%",
    parentSlug: "dohodak-stope",
    legalCategory: "stopa-20-dohodak",
    synonyms: ["niža stopa"],
    searchTerms: ["20%", "dvadeset posto"],
  },
  {
    slug: "dohodak-stopa-30",
    nameHr: "Stopa poreza na dohodak 30%",
    nameEn: "Income tax rate 30%",
    parentSlug: "dohodak-stope",
    legalCategory: "stopa-30-dohodak",
    synonyms: ["viša stopa"],
    searchTerms: ["30%", "trideset posto"],
  },

  // === PERSONAL ALLOWANCE ===
  {
    slug: "dohodak-osobni-odbitak",
    nameHr: "Osobni odbitak",
    nameEn: "Personal allowance",
    parentSlug: "dohodak-domena",
    legalCategory: "osobni-odbitak",
    synonyms: ["neoporezivi dio", "odbitak"],
    searchTerms: ["osobni odbitak", "allowance", "odbitak"],
  },
  {
    slug: "dohodak-osnovni-odbitak",
    nameHr: "Osnovni osobni odbitak",
    nameEn: "Basic personal allowance",
    parentSlug: "dohodak-osobni-odbitak",
    legalCategory: "osnovni-odbitak",
    synonyms: ["temeljni odbitak"],
    searchTerms: ["osnovni", "basic", "560"],
  },
  {
    slug: "dohodak-uzdrzavani-clanovi",
    nameHr: "Uvećanje za uzdržavane članove",
    nameEn: "Dependent family members allowance",
    parentSlug: "dohodak-osobni-odbitak",
    legalCategory: "uzdrzavani-clanovi",
    synonyms: ["uzdržavanici"],
    searchTerms: ["uzdržavani", "dependents", "obitelj"],
  },

  // === INCOME SOURCES ===
  {
    slug: "dohodak-izvori",
    nameHr: "Izvori dohotka",
    nameEn: "Income sources",
    parentSlug: "dohodak-domena",
    synonyms: ["vrste dohotka"],
    searchTerms: ["izvori", "sources"],
  },
  {
    slug: "dohodak-od-rada",
    nameHr: "Dohodak od nesamostalnog rada",
    nameEn: "Employment income",
    parentSlug: "dohodak-izvori",
    legalCategory: "dohodak-rad",
    synonyms: ["plaća", "salary"],
    searchTerms: ["plaća", "zaposlenje", "rad"],
  },
  {
    slug: "dohodak-od-djelatnosti",
    nameHr: "Dohodak od samostalne djelatnosti",
    nameEn: "Self-employment income",
    parentSlug: "dohodak-izvori",
    legalCategory: "dohodak-djelatnost",
    synonyms: ["obrt", "samostalna djelatnost"],
    searchTerms: ["djelatnost", "obrt", "self-employment"],
  },
  {
    slug: "dohodak-od-kapitala",
    nameHr: "Dohodak od kapitala",
    nameEn: "Capital income",
    parentSlug: "dohodak-izvori",
    legalCategory: "dohodak-kapital",
    synonyms: ["dividende", "kamate"],
    searchTerms: ["kapital", "dividende", "kamate"],
  },

  // ============================================================================
  // DOPRINOSI (CONTRIBUTIONS)
  // ============================================================================

  // === CONTRIBUTIONS ROOT ===
  {
    slug: "doprinosi-domena",
    nameHr: "Doprinosi",
    nameEn: "Contributions",
    synonyms: ["social contributions", "insurance contributions"],
    searchTerms: ["doprinosi", "contributions", "osiguranje"],
  },

  // === PENSION CONTRIBUTIONS ===
  {
    slug: "doprinosi-mio",
    nameHr: "Doprinosi za mirovinsko osiguranje",
    nameEn: "Pension contributions",
    parentSlug: "doprinosi-domena",
    synonyms: ["mirovinsko", "pension"],
    searchTerms: ["mio", "mirovina", "pension"],
  },
  {
    slug: "doprinosi-mio-i-stup",
    nameHr: "MIO I. stup",
    nameEn: "First pillar pension",
    parentSlug: "doprinosi-mio",
    legalCategory: "mio-prvi-stup",
    synonyms: ["prvi stup"],
    searchTerms: ["prvi stup", "15%", "first pillar"],
  },
  {
    slug: "doprinosi-mio-ii-stup",
    nameHr: "MIO II. stup",
    nameEn: "Second pillar pension",
    parentSlug: "doprinosi-mio",
    legalCategory: "mio-drugi-stup",
    synonyms: ["drugi stup", "kapitalizirana štednja"],
    searchTerms: ["drugi stup", "5%", "second pillar"],
  },

  // === HEALTH CONTRIBUTIONS ===
  {
    slug: "doprinosi-zdravstveno",
    nameHr: "Doprinosi za zdravstveno osiguranje",
    nameEn: "Health insurance contributions",
    parentSlug: "doprinosi-domena",
    synonyms: ["zdravstveno", "hzzo"],
    searchTerms: ["zdravstveno", "hzzo", "health"],
  },
  {
    slug: "doprinosi-zdravstveno-stopa",
    nameHr: "Stopa doprinosa za zdravstveno",
    nameEn: "Health contribution rate",
    parentSlug: "doprinosi-zdravstveno",
    legalCategory: "zdravstveno-stopa",
    synonyms: ["stopa zdravstveno"],
    searchTerms: ["16.5%", "zdravstveno stopa"],
  },

  // === CONTRIBUTION BASES ===
  {
    slug: "doprinosi-osnovica",
    nameHr: "Osnovica za doprinose",
    nameEn: "Contribution base",
    parentSlug: "doprinosi-domena",
    synonyms: ["baza za doprinose"],
    searchTerms: ["osnovica", "base"],
  },
  {
    slug: "doprinosi-najniza-osnovica",
    nameHr: "Najniža mjesečna osnovica",
    nameEn: "Minimum monthly base",
    parentSlug: "doprinosi-osnovica",
    legalCategory: "najniza-osnovica",
    synonyms: ["minimalna osnovica"],
    searchTerms: ["najniža", "minimalna", "minimum"],
  },
  {
    slug: "doprinosi-najvisa-osnovica",
    nameHr: "Najviša mjesečna osnovica",
    nameEn: "Maximum monthly base",
    parentSlug: "doprinosi-osnovica",
    legalCategory: "najvisa-osnovica",
    synonyms: ["maksimalna osnovica"],
    searchTerms: ["najviša", "maksimalna", "maximum"],
  },

  // === CONTRIBUTION RATES ===
  {
    slug: "doprinosi-stope",
    nameHr: "Stope doprinosa",
    nameEn: "Contribution rates",
    parentSlug: "doprinosi-domena",
    synonyms: ["tarife"],
    searchTerms: ["stope", "rates"],
  },
  {
    slug: "doprinosi-na-placu",
    nameHr: "Doprinosi na plaću",
    nameEn: "Contributions on salary",
    parentSlug: "doprinosi-stope",
    legalCategory: "doprinosi-na",
    synonyms: ["poslodavac plaća"],
    searchTerms: ["na plaću", "employer contributions"],
  },
  {
    slug: "doprinosi-iz-place",
    nameHr: "Doprinosi iz plaće",
    nameEn: "Contributions from salary",
    parentSlug: "doprinosi-stope",
    legalCategory: "doprinosi-iz",
    synonyms: ["radnik plaća"],
    searchTerms: ["iz plaće", "employee contributions"],
  },

  // ============================================================================
  // ROKOVI I KALENDAR (DEADLINES & CALENDAR)
  // ============================================================================

  // === DEADLINES ROOT ===
  {
    slug: "rokovi-domena",
    nameHr: "Porezni rokovi",
    nameEn: "Tax deadlines",
    synonyms: ["kalendar", "datumi"],
    searchTerms: ["rokovi", "deadlines", "kalendar"],
  },

  // === MONTHLY DEADLINES ===
  {
    slug: "rokovi-mjesecni",
    nameHr: "Mjesečni rokovi",
    nameEn: "Monthly deadlines",
    parentSlug: "rokovi-domena",
    synonyms: ["mjesečne obveze"],
    searchTerms: ["mjesečno", "monthly"],
  },
  {
    slug: "rokovi-joppd",
    nameHr: "Rok za JOPPD obrazac",
    nameEn: "JOPPD form deadline",
    parentSlug: "rokovi-mjesecni",
    legalCategory: "rok-joppd",
    synonyms: ["joppd rok"],
    searchTerms: ["joppd", "do 15.", "15. u mjesecu"],
  },
  {
    slug: "rokovi-pdv-mjesecni",
    nameHr: "Mjesečna PDV prijava",
    nameEn: "Monthly VAT return deadline",
    parentSlug: "rokovi-mjesecni",
    legalCategory: "rok-pdv-mjesecni",
    synonyms: ["pdv prijava mjesečno"],
    searchTerms: ["pdv mjesečno", "do 20.", "20. u mjesecu"],
  },
  {
    slug: "rokovi-doprinosi-obrtnici",
    nameHr: "Rok za doprinose obrtnika",
    nameEn: "Craftsman contribution deadline",
    parentSlug: "rokovi-mjesecni",
    legalCategory: "rok-doprinosi-obrtnik",
    synonyms: ["doprinosi obrtnici"],
    searchTerms: ["doprinosi obrtnik", "do 15.", "15. u mjesecu"],
  },

  // === QUARTERLY DEADLINES ===
  {
    slug: "rokovi-kvartalni",
    nameHr: "Kvartalni rokovi",
    nameEn: "Quarterly deadlines",
    parentSlug: "rokovi-domena",
    synonyms: ["tromjesečne obveze"],
    searchTerms: ["kvartalno", "quarterly", "tromjesečno"],
  },
  {
    slug: "rokovi-pdv-kvartalni",
    nameHr: "Kvartalna PDV prijava",
    nameEn: "Quarterly VAT return deadline",
    parentSlug: "rokovi-kvartalni",
    legalCategory: "rok-pdv-kvartalni",
    synonyms: ["pdv prijava kvartalno"],
    searchTerms: ["pdv kvartalno", "20. nakon kvartala"],
  },
  {
    slug: "rokovi-predujam-dobit",
    nameHr: "Predujam poreza na dobit",
    nameEn: "Corporate tax advance deadline",
    parentSlug: "rokovi-kvartalni",
    legalCategory: "rok-predujam-dobit",
    synonyms: ["akontacija dobit"],
    searchTerms: ["predujam dobit", "akontacija"],
  },

  // === ANNUAL DEADLINES ===
  {
    slug: "rokovi-godisnji",
    nameHr: "Godišnji rokovi",
    nameEn: "Annual deadlines",
    parentSlug: "rokovi-domena",
    synonyms: ["godišnje obveze"],
    searchTerms: ["godišnje", "annual"],
  },
  {
    slug: "rokovi-po-sd",
    nameHr: "Rok za PO-SD (paušalisti)",
    nameEn: "PO-SD deadline (lump-sum)",
    parentSlug: "rokovi-godisnji",
    legalCategory: "rok-po-sd",
    synonyms: ["paušalni rok"],
    searchTerms: ["po-sd", "15. siječnja", "januari"],
  },
  {
    slug: "rokovi-doh",
    nameHr: "Rok za godišnju prijavu poreza na dohodak",
    nameEn: "Annual income tax return deadline",
    parentSlug: "rokovi-godisnji",
    legalCategory: "rok-doh",
    synonyms: ["godišnja prijava dohodak"],
    searchTerms: ["godišnja prijava", "28. veljače", "februar"],
  },
  {
    slug: "rokovi-pd",
    nameHr: "Rok za prijavu poreza na dobit",
    nameEn: "Corporate tax return deadline",
    parentSlug: "rokovi-godisnji",
    legalCategory: "rok-pd",
    synonyms: ["prijava dobit"],
    searchTerms: ["obrazac pd", "30. travnja", "april"],
  },
  {
    slug: "rokovi-gfi",
    nameHr: "Rok za godišnje financijsko izvješće",
    nameEn: "Annual financial statement deadline",
    parentSlug: "rokovi-godisnji",
    legalCategory: "rok-gfi",
    synonyms: ["gfi rok"],
    searchTerms: ["gfi", "financijsko izvješće", "30. lipnja"],
  },

  // === SPECIFIC DATE DEADLINES ===
  {
    slug: "rokovi-specificni",
    nameHr: "Specifični datumi",
    nameEn: "Specific dates",
    parentSlug: "rokovi-domena",
    synonyms: ["fiksni datumi"],
    searchTerms: ["datum", "date"],
  },
  {
    slug: "rokovi-zatezne-kamate",
    nameHr: "Zatezne kamate za kašnjenje",
    nameEn: "Late payment interest",
    parentSlug: "rokovi-specificni",
    legalCategory: "zatezne-kamate",
    synonyms: ["kamate kašnjenje", "penali"],
    searchTerms: ["zatezne kamate", "kašnjenje", "late payment"],
  },
  {
    slug: "rokovi-zastara",
    nameHr: "Zastara porezne obveze",
    nameEn: "Tax obligation statute of limitations",
    parentSlug: "rokovi-specificni",
    legalCategory: "zastara",
    synonyms: ["rok zastare"],
    searchTerms: ["zastara", "statute of limitations"],
  },

  // ============================================================================
  // FISKALIZACIJA (FISCALIZATION)
  // ============================================================================

  // === FISCALIZATION ROOT ===
  {
    slug: "fiskalizacija-domena",
    nameHr: "Fiskalizacija",
    nameEn: "Fiscalization",
    synonyms: ["fiskalna blagajna"],
    searchTerms: ["fiskalizacija", "fiscalization", "blagajna"],
  },

  // === FISCALIZATION REQUIREMENTS ===
  {
    slug: "fiskalizacija-obveznici",
    nameHr: "Obveznici fiskalizacije",
    nameEn: "Fiscalization obligors",
    parentSlug: "fiskalizacija-domena",
    synonyms: ["tko mora fiskalizirati"],
    searchTerms: ["obveznici", "obligors"],
  },
  {
    slug: "fiskalizacija-izuzeci",
    nameHr: "Izuzeća od fiskalizacije",
    nameEn: "Fiscalization exemptions",
    parentSlug: "fiskalizacija-domena",
    legalCategory: "fiskalizacija-izuzeca",
    synonyms: ["oslobođeni fiskalizacije"],
    searchTerms: ["izuzeća", "exemptions"],
  },

  // === TECHNICAL REQUIREMENTS ===
  {
    slug: "fiskalizacija-tehnicko",
    nameHr: "Tehničke specifikacije fiskalizacije",
    nameEn: "Fiscalization technical specs",
    parentSlug: "fiskalizacija-domena",
    synonyms: ["tehnički zahtjevi"],
    searchTerms: ["tehničko", "specifikacije", "technical"],
  },
  {
    slug: "fiskalizacija-certifikat",
    nameHr: "Fiskalizacijski certifikat",
    nameEn: "Fiscalization certificate",
    parentSlug: "fiskalizacija-tehnicko",
    legalCategory: "certifikat-fina",
    synonyms: ["fina certifikat"],
    searchTerms: ["certifikat", "fina", "certificate"],
  },
  {
    slug: "fiskalizacija-jir",
    nameHr: "JIR - Jedinstveni identifikator računa",
    nameEn: "Unique invoice identifier",
    parentSlug: "fiskalizacija-tehnicko",
    legalCategory: "jir",
    synonyms: ["jedinstveni identifikator"],
    searchTerms: ["jir", "identifikator"],
  },
  {
    slug: "fiskalizacija-zki",
    nameHr: "ZKI - Zaštitni kod izdavatelja",
    nameEn: "Issuer security code",
    parentSlug: "fiskalizacija-tehnicko",
    legalCategory: "zki",
    synonyms: ["zaštitni kod"],
    searchTerms: ["zki", "zaštitni kod"],
  },

  // ============================================================================
  // OBRASCI (FORMS)
  // ============================================================================

  // === FORMS ROOT ===
  {
    slug: "obrasci-domena",
    nameHr: "Porezni obrasci",
    nameEn: "Tax forms",
    synonyms: ["prijave", "formulari"],
    searchTerms: ["obrasci", "forms", "prijave"],
  },

  // === COMMON FORMS ===
  {
    slug: "obrazac-joppd",
    nameHr: "Obrazac JOPPD",
    nameEn: "JOPPD form",
    parentSlug: "obrasci-domena",
    legalCategory: "joppd",
    synonyms: ["izvješće o primicima"],
    searchTerms: ["joppd", "izvješće", "primici"],
  },
  {
    slug: "obrazac-r-sm",
    nameHr: "Obrazac R-Sm",
    nameEn: "R-Sm form",
    parentSlug: "obrasci-domena",
    legalCategory: "r-sm",
    synonyms: ["specifikacija za mirovinsko"],
    searchTerms: ["r-sm", "rsm", "mirovinsko"],
  },
  {
    slug: "obrazac-ip1",
    nameHr: "Potvrda IP1",
    nameEn: "IP1 certificate",
    parentSlug: "obrasci-domena",
    legalCategory: "ip1",
    synonyms: ["potvrda o plaći"],
    searchTerms: ["ip1", "potvrda", "plaća"],
  },

  // ============================================================================
  // TAXPAYER TYPES (EXPANDED)
  // ============================================================================

  // === TAXPAYER ROOT ===
  {
    slug: "porezni-obveznik",
    nameHr: "Porezni obveznik",
    nameEn: "Taxpayer",
    searchTerms: ["taxpayer", "porezni obveznik", "obveznik"],
  },

  // === BUSINESS TYPES ===
  {
    slug: "obrt",
    nameHr: "Obrt",
    nameEn: "Sole proprietorship / Craft business",
    parentSlug: "porezni-obveznik",
    synonyms: ["obrtnik"],
    searchTerms: ["obrt", "craft", "sole proprietorship"],
  },
  {
    slug: "pausalni-obrt",
    nameHr: "Paušalni obrt",
    nameEn: "Lump-sum business",
    parentSlug: "obrt",
    legalCategory: "paušalno-oporezivanje",
    synonyms: ["pausalni obrtnik", "pausalist"],
    searchTerms: ["pausalni", "lump sum", "flat rate"],
  },
  {
    slug: "obrt-dohodak",
    nameHr: "Obrt s vođenjem knjiga",
    nameEn: "Business with bookkeeping",
    parentSlug: "obrt",
    legalCategory: "obrt-knjige",
    synonyms: ["obrt na dohodak", "pravi obrt"],
    searchTerms: ["knjige", "bookkeeping", "vođenje knjiga"],
  },
  {
    slug: "doo",
    nameHr: "Društvo s ograničenom odgovornošću",
    nameEn: "Limited liability company",
    parentSlug: "porezni-obveznik",
    legalCategory: "doo",
    synonyms: ["d.o.o.", "LLC"],
    searchTerms: ["doo", "d.o.o.", "LLC", "društvo"],
  },
  {
    slug: "jdoo",
    nameHr: "Jednostavno društvo s ograničenom odgovornošću",
    nameEn: "Simple LLC",
    parentSlug: "doo",
    legalCategory: "jdoo",
    synonyms: ["j.d.o.o."],
    searchTerms: ["jdoo", "j.d.o.o.", "jednostavno"],
  },
  {
    slug: "dd",
    nameHr: "Dioničko društvo",
    nameEn: "Joint stock company",
    parentSlug: "porezni-obveznik",
    legalCategory: "dd",
    synonyms: ["d.d."],
    searchTerms: ["dd", "d.d.", "dioničko"],
  },

  // ============================================================================
  // PRODUCT CATEGORIES (VAT CLASSIFICATION)
  // ============================================================================

  {
    slug: "hrana",
    nameHr: "Hrana",
    nameEn: "Food",
    legalCategory: "prehrambeni-proizvodi",
    vatCategory: "5%",
    synonyms: ["namirnice", "prehrambeni proizvodi"],
    searchTerms: ["food", "hrana"],
  },
  {
    slug: "pice",
    nameHr: "Piće",
    nameEn: "Beverage",
    parentSlug: "hrana",
    legalCategory: "pića",
    searchTerms: ["drink", "piće", "napitak"],
  },
  {
    slug: "bezalkoholno-pice",
    nameHr: "Bezalkoholno piće",
    nameEn: "Non-alcoholic beverage",
    parentSlug: "pice",
    legalCategory: "bezalkoholno-piće",
    vatCategory: "5%",
    synonyms: ["soft drink", "osvježavajuće piće"],
    hyponyms: ["sok", "voda", "čaj"],
    searchTerms: ["soft drink", "bezalkoholno"],
  },
  {
    slug: "sok",
    nameHr: "Sok",
    nameEn: "Juice",
    parentSlug: "bezalkoholno-pice",
    legalCategory: "voćni-sok",
    vatCategory: "5%",
    synonyms: ["juice", "voćni sok", "prirodni sok"],
    hyponyms: ["jabučni sok", "narančin sok", "sok od naranče"],
    searchTerms: ["juice", "sok", "voćni"],
  },
  {
    slug: "alkoholno-pice",
    nameHr: "Alkoholno piće",
    nameEn: "Alcoholic beverage",
    parentSlug: "pice",
    legalCategory: "alkoholno-piće",
    vatCategory: "25%",
    synonyms: ["alkohol", "alcoholic drink"],
    hyponyms: ["pivo", "vino", "žestoko piće"],
    searchTerms: ["alcohol", "alkohol", "alkoholno"],
  },
  {
    slug: "pivo",
    nameHr: "Pivo",
    nameEn: "Beer",
    parentSlug: "alkoholno-pice",
    legalCategory: "pivo",
    vatCategory: "25%",
    synonyms: ["beer", "lager", "ale"],
    searchTerms: ["beer", "pivo"],
  },
  {
    slug: "vino",
    nameHr: "Vino",
    nameEn: "Wine",
    parentSlug: "alkoholno-pice",
    legalCategory: "vino",
    vatCategory: "25%",
    synonyms: ["wine", "grape wine"],
    hyponyms: ["crno vino", "bijelo vino", "rose"],
    searchTerms: ["wine", "vino"],
  },
]

/**
 * Seed the initial Croatian regulatory taxonomy
 */
export async function seedTaxonomy(): Promise<{ created: number; updated: number }> {
  let created = 0
  let updated = 0

  // First pass: create all concepts without parents
  for (const seed of INITIAL_TAXONOMY) {
    const existing = await db.conceptNode.findUnique({
      where: { slug: seed.slug },
    })

    if (existing) {
      // Update existing
      await db.conceptNode.update({
        where: { slug: seed.slug },
        data: {
          nameHr: seed.nameHr,
          nameEn: seed.nameEn,
          synonyms: seed.synonyms ?? [],
          hyponyms: seed.hyponyms ?? [],
          legalCategory: seed.legalCategory,
          vatCategory: seed.vatCategory,
          searchTerms: seed.searchTerms ?? [],
        },
      })
      updated++
    } else {
      // Create new
      await db.conceptNode.create({
        data: {
          slug: seed.slug,
          nameHr: seed.nameHr,
          nameEn: seed.nameEn,
          synonyms: seed.synonyms ?? [],
          hyponyms: seed.hyponyms ?? [],
          legalCategory: seed.legalCategory,
          vatCategory: seed.vatCategory,
          searchTerms: seed.searchTerms ?? [],
        },
      })
      created++
    }
  }

  // Second pass: set parent relationships
  for (const seed of INITIAL_TAXONOMY) {
    if (seed.parentSlug) {
      const parent = await db.conceptNode.findUnique({
        where: { slug: seed.parentSlug },
      })

      if (parent) {
        await db.conceptNode.update({
          where: { slug: seed.slug },
          data: { parentId: parent.id },
        })
      }
    }
  }

  console.log(`[seed-taxonomy] Created ${created}, updated ${updated} concepts`)
  return { created, updated }
}

/**
 * CLI entry point
 */
if (require.main === module) {
  seedTaxonomy()
    .then((result) => {
      console.log(`Seeding complete: ${result.created} created, ${result.updated} updated`)
      process.exit(0)
    })
    .catch((error) => {
      console.error("Seeding failed:", error)
      process.exit(1)
    })
}
