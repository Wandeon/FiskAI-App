"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm, useFieldArray, type Path } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { eInvoiceSchema } from "@/lib/validations"
import { createEInvoice } from "@/app/actions/invoice"
import { z } from "zod"
import { Plus, ArrowLeft, ArrowRight, Save, Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageCard, PageCardHeader, PageCardTitle, PageCardContent } from "@/components/ui/page-card"
import { Combobox, ComboboxOption } from "@/components/ui/combobox"
import { InvoiceSummary } from "@/components/invoice/invoice-summary"
import { StepIndicator } from "@/components/invoice/invoice-step-indicator"
import { LineItemTable, type ProductSuggestion } from "@/components/invoice/line-item-table"
import { AlertBanner } from "@/components/dashboard/alert-banner"
import { Contact } from "@prisma/client"
import { InvoicePdfPreview } from "@/components/invoice/invoice-pdf-preview"
import { renderToStaticMarkup } from "react-dom/server"
import { toast } from "@/lib/toast"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import type { Capabilities } from "@/lib/capabilities"
import { getInvoiceVisibility } from "@/lib/field-visibility"

type EInvoiceFormInput = z.input<typeof eInvoiceSchema>

type PlainProduct = {
  id: string
  name: string
  sku?: string | null
  description?: string | null
  unit: string
  price: number
  vatRate: number
  vatCategory: string
}

interface InvoiceFormProps {
  contacts: Contact[]
  products: PlainProduct[]
  company: {
    name: string
    address: string
    postalCode: string
    city: string
    iban?: string | null
  }
  capabilities: Omit<Capabilities, "can">
  nextInvoiceNumber: string
}

const STEPS = [
  { id: "buyer", name: "Kupac" },
  { id: "items", name: "Stavke" },
  { id: "review", name: "Pregled" },
]

const DEFAULT_PAYMENT_TERMS_DAYS = 15

const formatDateInput = (date: Date) => date.toISOString().slice(0, 10)
const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function InvoiceForm({
  contacts,
  products,
  company,
  capabilities,
  nextInvoiceNumber,
}: InvoiceFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [dueDateTouched, setDueDateTouched] = useState(false)
  const invoiceVisibility = getInvoiceVisibility(capabilities)
  const today = useMemo(() => new Date(), [])

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<EInvoiceFormInput>({
    resolver: zodResolver(eInvoiceSchema),
    defaultValues: {
      issueDate: formatDateInput(today),
      dueDate: formatDateInput(addDays(today, DEFAULT_PAYMENT_TERMS_DAYS)),
      invoiceNumber: nextInvoiceNumber,
      currency: "EUR",
      bankAccount: company.iban || "",
      includeBarcode: true,
      lines: [
        {
          description: "",
          quantity: 1,
          unit: "C62",
          unitPrice: 0,
          vatRate: invoiceVisibility.showVatFields ? 25 : 0,
          vatCategory: "S",
        },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "lines",
  })

  const watchedValues = watch()
  const selectedBuyer = contacts.find((c) => c.id === watchedValues.buyerId)
  const buyerPaymentTerms = selectedBuyer?.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS
  const issueDate = useMemo(() => {
    const issueDateValue = watchedValues.issueDate as string | Date | undefined
    return issueDateValue ? new Date(issueDateValue) : null
  }, [watchedValues.issueDate])
  const dueDate = useMemo(() => {
    const dueDateValue = watchedValues.dueDate as string | Date | undefined
    return dueDateValue ? new Date(dueDateValue) : undefined
  }, [watchedValues.dueDate])

  // Autosave to localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem("einvoice-draft")
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft)
        Object.keys(draft).forEach((key) => {
          if (key === "issueDate" && draft[key]) {
            setValue("issueDate", formatDateInput(new Date(draft[key])), { shouldValidate: true })
          } else if (key === "dueDate" && draft[key]) {
            setValue("dueDate", formatDateInput(new Date(draft[key])), { shouldValidate: true })
          } else {
            setValue(key as keyof EInvoiceFormInput, draft[key])
          }
        })
        if (draft.dueDate) {
          setDueDateTouched(true)
        }
      } catch {
        // Invalid draft, ignore
      }
    } else {
      setValue("issueDate", formatDateInput(today), { shouldValidate: true })
      setValue("invoiceNumber", nextInvoiceNumber, { shouldValidate: true })
    }
  }, [setValue, nextInvoiceNumber, today])

  // Ensure issue date is always populated for the date input (prevents mm/dd/yyyy placeholder)
  useEffect(() => {
    if (!watchedValues.issueDate) {
      setValue("issueDate", formatDateInput(today), { shouldValidate: true })
    }
  }, [watchedValues.issueDate, setValue, today])

  // Keep due date aligned with buyer's payment terms unless user overrides it
  useEffect(() => {
    if (!issueDate) return
    if (dueDateTouched) return

    const computedDue = formatDateInput(addDays(issueDate, buyerPaymentTerms))
    setValue("dueDate", computedDue, { shouldValidate: true })
  }, [issueDate, buyerPaymentTerms, dueDateTouched, setValue])

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("einvoice-draft", JSON.stringify(watchedValues))
      setLastSavedAt(new Date())
    }, 1000)
    return () => clearTimeout(timer)
  }, [watchedValues])

  const handleNextStep = async () => {
    let isValid = true

    if (currentStep === 0) {
      isValid = await trigger(["buyerId", "issueDate"])
    } else if (currentStep === 1) {
      isValid = await trigger("lines")
    }

    if (isValid && currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  async function onSubmit(data: EInvoiceFormInput) {
    setLoading(true)
    setError(null)

    const result = await createEInvoice(data)

    if (result?.error) {
      setError(result.error)
      toast.error("Greška", result.error)
      setLoading(false)
      return
    }

    localStorage.removeItem("einvoice-draft")
    trackEvent(AnalyticsEvents.INVOICE_CREATED, {
      lineCount: data.lines.length,
      hasProduct: data.lines.some((l) => l.description),
    })
    toast.success("E-račun kreiran", "Možete ga pregledati i poslati")
    router.push("/e-invoices")
  }

  const buyerOptions: ComboboxOption[] = contacts.map((contact) => ({
    value: contact.id,
    label: contact.name,
    description: `OIB: ${contact.oib}`,
  }))

  const handleLineChange = (index: number, field: string, value: string | number) => {
    if (!invoiceVisibility.showVatFields && field === "vatRate") {
      return
    }
    // Update a single field to avoid replacing the whole array and losing focus
    setValue(`lines.${index}.${field}` as Path<EInvoiceFormInput>, value, {
      shouldDirty: true,
      shouldValidate: false,
    })
  }

  const handleDownloadPdf = () => {
    if (typeof window === "undefined") return
    const markup = renderToStaticMarkup(
      <InvoicePdfPreview
        company={company}
        buyer={selectedBuyer || null}
        invoiceNumber={watchedValues.invoiceNumber || "Draft"}
        issueDate={watchedValues.issueDate as Date | undefined}
        dueDate={watchedValues.dueDate as Date | undefined}
        lines={watchedValues.lines}
        currency={watchedValues.currency || "EUR"}
      />
    )
    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>FiskAI Invoice Preview</title><style>body{margin:0;padding:24px;background:#f1f5f9;font-family:Inter,system-ui,sans-serif;}</style></head><body>${markup}</body></html>`
    const win = window.open("", "_blank")
    if (win) {
      win.document.write(html)
      win.document.close()
      win.focus()
      setTimeout(() => win.print(), 300)
    }
  }

  return (
    <div className="mx-auto max-w-[1780px] space-y-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Novi E-Račun</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Kreirajte novi e-račun za kupca</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Natrag
        </Button>
      </div>

      {/* Step Indicator */}
      <div className="pt-4 pb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <StepIndicator steps={STEPS} currentStep={currentStep} onStepClick={setCurrentStep} />
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span>
            {currentStep === 0
              ? "Odaberite kupca"
              : currentStep === 1
                ? "Dodajte stavke i proizvode"
                : "Pregled prije spremanja"}
          </span>
          {lastSavedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-secondary)] px-2 py-1">
              <Loader2 className="h-3 w-3" />U zadnje vrijeme spremljeno{" "}
              {lastSavedAt.toLocaleTimeString("hr-HR")}
            </span>
          )}
        </div>
      </div>

      {error && <AlertBanner type="error" title="Greška pri spremanju" description={error} />}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Main Form Area */}
          <div className="lg:col-span-9 space-y-6 self-start">
            {/* Step 1: Buyer Info */}
            <div className={cn(currentStep !== 0 && "hidden")}>
              <PageCard>
                <PageCardHeader>
                  <PageCardTitle>Podaci o kupcu</PageCardTitle>
                </PageCardHeader>
                <PageCardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                        Kupac *
                      </label>
                      <Combobox
                        id="buyer-select"
                        options={buyerOptions}
                        value={watch("buyerId") || ""}
                        onChange={(value) => setValue("buyerId", value)}
                        placeholder="Pretraži kupce..."
                        emptyMessage="Nema pronađenih kupaca"
                      />
                      {contacts.length === 0 && (
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-card border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700">
                          <span>Dodajte kupca kako biste mogli izraditi e-račun.</span>
                          <Button size="sm" asChild>
                            <Link href="/contacts/new?returnTo=/e-invoices/new">Dodaj kupca</Link>
                          </Button>
                        </div>
                      )}
                      {errors.buyerId && (
                        <p className="text-sm text-danger-500 mt-1">{errors.buyerId.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                        Datum izdavanja *
                      </label>
                      <Input
                        type="date"
                        {...register("issueDate")}
                        error={errors.issueDate?.message}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                        Datum dospijeća
                      </label>
                      <Input
                        type="date"
                        {...register("dueDate", {
                          onChange: (e) => {
                            setDueDateTouched(true)
                            return e
                          },
                        })}
                      />
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {buyerPaymentTerms} dana prema postavkama kupca.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                        Broj računa
                      </label>
                      <Input
                        readOnly
                        aria-readonly="true"
                        {...register("invoiceNumber")}
                        placeholder={nextInvoiceNumber}
                        error={errors.invoiceNumber?.message}
                        className="bg-surface-1 text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                        Referenca kupca
                      </label>
                      <Input {...register("buyerReference")} placeholder="Opcionalno" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                        IBAN za QR kod
                      </label>
                      <Input
                        {...register("bankAccount")}
                        placeholder="HRXX..."
                        error={errors.bankAccount?.message}
                      />
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Po zadanom koristi IBAN tvrtke. QR kod će biti na PDF-u.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="includeBarcode"
                        {...register("includeBarcode")}
                        defaultChecked
                      />
                      <label htmlFor="includeBarcode" className="text-sm text-[var(--foreground)]">
                        Uključi QR kod za plaćanje na PDF
                      </label>
                    </div>
                  </div>
                </PageCardContent>
              </PageCard>
            </div>

            {/* Step 2: Line Items */}
            <div className={cn(currentStep !== 1 && "hidden")}>
              <PageCard>
                <PageCardHeader>
                  <PageCardTitle>Stavke računa</PageCardTitle>
                </PageCardHeader>
                <PageCardContent>
                  <div className="space-y-3">
                    <LineItemTable
                      lines={watchedValues.lines}
                      onChange={(row, field, value) => handleLineChange(row, field, value)}
                      onRemove={(row) => remove(row)}
                      canRemove={() => fields.length > 1}
                      showVat={invoiceVisibility.showVatFields}
                      products={products as ProductSuggestion[]}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        append({
                          description: "",
                          quantity: 1,
                          unit: "C62",
                          unitPrice: 0,
                          vatRate: invoiceVisibility.showVatFields ? 25 : 0,
                          vatCategory: "S",
                        })
                      }
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Dodaj stavku
                    </Button>
                  </div>
                </PageCardContent>
              </PageCard>
            </div>

            {/* Step 3: Review */}
            <div className={cn(currentStep !== 2 && "hidden")}>
              <PageCard>
                <PageCardHeader
                  actions={
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={handleDownloadPdf}>
                        <FileText className="h-4 w-4 mr-2" />
                        Preuzmi PDF
                      </Button>
                    </div>
                  }
                >
                  <PageCardTitle>Pregled i slanje</PageCardTitle>
                </PageCardHeader>
                <PageCardContent>
                  <div className="mx-auto max-w-6xl space-y-6">
                    <InvoicePdfPreview
                      company={company}
                      buyer={selectedBuyer || null}
                      invoiceNumber={watchedValues.invoiceNumber || "Draft"}
                      issueDate={issueDate ?? undefined}
                      dueDate={dueDate}
                      lines={watchedValues.lines}
                      currency={watchedValues.currency || "EUR"}
                    />

                    <p className="text-sm text-[var(--muted)]">
                      Klikom na &quot;Spremi&quot; račun će biti spremljen kao nacrt. Možete ga
                      kasnije pregledati i poslati kupcu ili preuzeti PDF verziju.
                    </p>
                  </div>
                </PageCardContent>
              </PageCard>
            </div>

            {/* Navigation Buttons */}
            <div className="hidden justify-between pt-4 md:flex">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevStep}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Natrag
              </Button>

              <div className="flex gap-3">
                {currentStep < STEPS.length - 1 ? (
                  <Button type="button" onClick={handleNextStep}>
                    Dalje
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Spremanje...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Spremi kao nacrt
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Summary */}
          <div className="lg:col-span-3">
            <InvoiceSummary
              buyer={selectedBuyer ? { name: selectedBuyer.name, oib: selectedBuyer.oib } : null}
              invoiceNumber={watchedValues.invoiceNumber || nextInvoiceNumber}
              issueDate={issueDate ?? undefined}
              lines={watchedValues.lines}
              currency={watchedValues.currency}
            />
          </div>
        </div>
      </form>

      {/* Mobile sticky controls */}
      <div className="fixed left-0 right-0 bottom-20 z-fixed border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-card md:hidden">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePrevStep}
            disabled={currentStep === 0 || loading}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Nazad
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button size="sm" onClick={handleNextStep}>
              Dalje
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSubmit(onSubmit)} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Spremanje...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Spremi nacrt
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
