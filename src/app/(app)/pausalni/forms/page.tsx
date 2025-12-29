"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Loader2, Plus } from "lucide-react"
import { FormGeneratorDialog } from "@/components/pausalni/form-generator-dialog"
import { CROATIAN_MONTHS } from "@/lib/pausalni/constants"

interface GeneratedForm {
  id: string
  formType: string
  periodMonth: number
  periodYear: number
  generatedAt: string
  fileUrl: string
  status: string
}

// Form types relevant for pausalni obrt
const FORM_TYPE_LABELS: Record<string, string> = {
  "PO-SD": "PO-SD obrazac (godisnja prijava)",
  DOH: "DOH obrazac (porez na dohodak)",
}

export default function FormsPage() {
  const [forms, setForms] = useState<GeneratedForm[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)

  useEffect(() => {
    fetchForms()
  }, [])

  async function fetchForms() {
    try {
      const response = await fetch("/api/pausalni/forms")
      const data = await response.json()
      setForms(data.forms || [])
    } catch (error) {
      console.error("Failed to fetch forms:", error)
    } finally {
      setIsLoading(false)
    }
  }

  function handleDownload(form: GeneratedForm) {
    // Create a temporary anchor element to trigger download
    const link = document.createElement("a")
    link.href = form.fileUrl
    link.download = `${form.formType}_${form.periodMonth}_${form.periodYear}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  function getFormBadgeVariant(status: string) {
    switch (status) {
      case "READY":
        return "default"
      case "GENERATING":
        return "secondary"
      case "ERROR":
        return "destructive"
      default:
        return "secondary"
    }
  }

  function getFormStatusLabel(status: string) {
    switch (status) {
      case "READY":
        return "Spremno"
      case "GENERATING":
        return "Generiranje..."
      case "ERROR":
        return "Greska"
      default:
        return status
    }
  }

  function groupFormsByPeriod(forms: GeneratedForm[]) {
    const grouped: Record<string, GeneratedForm[]> = {}

    for (const form of forms) {
      const key = `${form.periodYear}-${form.periodMonth}`
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(form)
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a)) // Sort descending (newest first)
      .map(([key, formsList]) => {
        const [year, month] = key.split("-").map(Number)
        return {
          year,
          month,
          label: `${CROATIAN_MONTHS[month - 1].charAt(0).toUpperCase() + CROATIAN_MONTHS[month - 1].slice(1)} ${year}`,
          forms: formsList.sort((a, b) => a.formType.localeCompare(b.formType)),
        }
      })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const groupedForms = groupFormsByPeriod(forms)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Obrasci</h1>
          <p className="text-muted-foreground mt-1">Povijest generiranih poreznih obrazaca za pausalni obrt</p>
        </div>
        <Button onClick={() => setShowGenerateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Generiraj obrazac
        </Button>
      </div>

      {/* Forms List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generirani obrasci
          </CardTitle>
        </CardHeader>
        <CardContent>
          {groupedForms.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Jos nema generiranih obrazaca</p>
              <Button onClick={() => setShowGenerateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Generiraj prvi obrazac
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {groupedForms.map(({ label, forms: periodForms }) => (
                <div key={label}>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {label}
                  </h3>
                  <div className="space-y-2">
                    {periodForms.map((form) => (
                      <div
                        key={form.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface)] transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-blue-500/10">
                            <FileText className="h-5 w-5 text-link" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {FORM_TYPE_LABELS[form.formType] || form.formType}
                              </span>
                              <Badge variant={getFormBadgeVariant(form.status)}>
                                {getFormStatusLabel(form.status)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Generirano:{" "}
                              {new Date(form.generatedAt).toLocaleDateString("hr-HR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                        <div>
                          {form.status === "READY" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDownload(form)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Preuzmi
                            </Button>
                          )}
                          {form.status === "GENERATING" && (
                            <Button variant="outline" size="sm" disabled>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Generiranje...
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Form Dialog */}
      {showGenerateDialog && (
        <FormGeneratorDialog
          isOpen={showGenerateDialog}
          onClose={() => setShowGenerateDialog(false)}
          onGenerated={() => {
            fetchForms() // Refresh the list
          }}
        />
      )}
    </div>
  )
}
