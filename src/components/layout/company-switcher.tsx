"use client"

import { useState, useTransition } from "react"
import { switchCompany } from "@/lib/actions/company-switch"

type Company = {
  id: string
  name: string
  oib: string
  isDefault: boolean
  role: string
}

export function CompanySwitcher({
  companies,
  currentCompanyId,
}: {
  companies: Company[]
  currentCompanyId: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const currentCompany = companies.find((c) => c.id === currentCompanyId)

  if (companies.length <= 1) {
    return <div className="text-sm text-secondary">{currentCompany?.name}</div>
  }

  const handleSwitch = (companyId: string) => {
    startTransition(async () => {
      await switchCompany(companyId)
      setIsOpen(false)
    })
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md border border-default bg-surface px-3 py-1.5 text-sm hover:bg-surface-1"
        disabled={isPending}
      >
        <span className="max-w-[150px] truncate">{currentCompany?.name}</span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-md border border-default bg-surface py-1 shadow-lg">
          {companies.map((company) => (
            <button
              key={company.id}
              onClick={() => handleSwitch(company.id)}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-surface-1 ${
                company.id === currentCompanyId ? "bg-info-bg text-link" : ""
              }`}
              disabled={isPending}
            >
              <div>
                <div className="font-medium">{company.name}</div>
                <div className="text-xs text-tertiary">OIB: {company.oib}</div>
              </div>
              {company.id === currentCompanyId && (
                <svg className="h-4 w-4 text-link" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
