"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronDown, FileText, Mail, Building2, Receipt } from "lucide-react"
import { cn } from "@/lib/utils"
import { useElementStatus } from "@/lib/visibility"
import type { ElementId } from "@/lib/visibility"

const DOCUMENT_OPTIONS = [
  {
    label: "Novi račun",
    href: "/invoices/new?type=INVOICE",
    icon: FileText,
    description: "Kreiraj standardni račun",
    elementId: "action:create-invoice" as ElementId,
  },
  {
    label: "Novi e-račun",
    href: "/e-invoices/new",
    icon: Mail,
    description: "Kreiraj fiskalizirani e-račun",
    elementId: "action:create-invoice" as ElementId,
  },
  {
    label: "Uvezi bankovni izvod",
    href: "/banking/import",
    icon: Building2,
    description: "Učitaj PDF ili XML izvod",
    elementId: "action:import-statements" as ElementId,
  },
  {
    label: "Novi trošak",
    href: "/expenses/new",
    icon: Receipt,
    description: "Evidentiraj trošak",
    elementId: undefined, // No specific action ID for expenses
  },
]

function DocumentOption({
  option,
  onClick,
}: {
  option: (typeof DOCUMENT_OPTIONS)[number]
  onClick: () => void
}) {
  const Icon = option.icon
  const status = useElementStatus(option.elementId || ("action:create-invoice" as ElementId))

  // If element has an ID and is not visible, don't render
  if (option.elementId && !status.visible) {
    return null
  }

  // If element is locked, show disabled state
  const isLocked = option.elementId && status.locked

  if (isLocked) {
    return (
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg px-3 py-2.5 opacity-50 cursor-not-allowed"
        )}
        title={status.hint || undefined}
      >
        <Icon className="h-5 w-5 text-[var(--muted)] mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-[var(--foreground)]">{option.label}</p>
          <p className="text-xs text-[var(--muted)]">{status.hint || option.description}</p>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={option.href}
      onClick={onClick}
      className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-[var(--surface-secondary)] transition-colors"
    >
      <Icon className="h-5 w-5 text-[var(--muted)] mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-medium text-[var(--foreground)]">{option.label}</p>
        <p className="text-xs text-[var(--muted)]">{option.description}</p>
      </div>
    </Link>
  )
}

export function NewDocumentDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => document.removeEventListener("keydown", handleEscape)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <Button onClick={() => setIsOpen(!isOpen)} className="gap-2">
        Novi dokument
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-lg z-50">
          <div className="p-1">
            {DOCUMENT_OPTIONS.map((option) => (
              <DocumentOption key={option.href} option={option} onClick={() => setIsOpen(false)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
