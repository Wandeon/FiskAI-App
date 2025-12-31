"use client"

import { useState } from "react"
import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

// Croatian compliance terms glossary
const GLOSSARY: Record<string, { term: string; definition: string }> = {
  oib: {
    term: "OIB",
    definition:
      "Osobni identifikacijski broj - jedinstveni 11-znamenkasti identifikator za sve pravne i fizičke osobe u Hrvatskoj.",
  },
  pdv: {
    term: "PDV",
    definition:
      "Porez na dodanu vrijednost - standardna stopa je 25%, snižena 13% ili 5% za određene proizvode i usluge.",
  },
  jir: {
    term: "JIR",
    definition:
      "Jedinstveni identifikator računa - kod koji Porezna uprava dodjeljuje svakom fiskaliziranom računu.",
  },
  zki: {
    term: "ZKI",
    definition:
      "Zaštitni kod izdavatelja - sigurnosni kod koji se generira iz podataka računa i certifikata.",
  },
  fiskalizacija: {
    term: "Fiskalizacija",
    definition:
      "Postupak prijave računa Poreznoj upravi u realnom vremenu. Obavezna za gotovinska i kartična plaćanja.",
  },
  iban: {
    term: "IBAN",
    definition: "International Bank Account Number - međunarodni format broja bankovnog računa.",
  },
  pausalist: {
    term: "Paušalist",
    definition:
      "Obrtnik koji plaća porez u paušalnom iznosu. Ne obračunava PDV i ima jednostavnije knjiženje.",
  },
  eracun: {
    term: "e-Račun",
    definition:
      "Elektronički račun u strukturiranom XML formatu (UBL 2.1) koji omogućuje automatsku obradu.",
  },
  kpr: {
    term: "KPR",
    definition: "Knjiga prometa - evidencija svih poslovnih primitaka, obavezna za paušaliste.",
  },
}

interface GlossaryTermProps {
  term: keyof typeof GLOSSARY
  children?: React.ReactNode
  className?: string
  showIcon?: boolean
}

export function GlossaryTerm({ term, children, className, showIcon = true }: GlossaryTermProps) {
  const [isOpen, setIsOpen] = useState(false)
  const glossaryItem = GLOSSARY[term]

  if (!glossaryItem) {
    return <span className={className}>{children || term}</span>
  }

  return (
    <span className={cn("relative inline-flex items-center gap-1", className)}>
      <span className="border-b border-dotted border-current">{children || glossaryItem.term}</span>
      {showIcon && (
        <button
          type="button"
          className="inline-flex text-[var(--muted)] hover:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-1 rounded-full"
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => setIsOpen(false)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={`Više informacija o ${glossaryItem.term}`}
          aria-expanded={isOpen}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      )}
      {isOpen && (
        <div
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg"
        >
          <div className="font-semibold text-sm text-[var(--foreground)]">{glossaryItem.term}</div>
          <div className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
            {glossaryItem.definition}
          </div>
          <div className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 border-b border-r border-[var(--border)] bg-[var(--surface)]" />
        </div>
      )}
    </span>
  )
}

// Export glossary for use elsewhere
export { GLOSSARY }
