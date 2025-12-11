"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { eInvoiceSchema } from "@/lib/validations"
import { createEInvoice } from "@/app/actions/e-invoice"
import { z } from "zod"
import { Plus, ArrowLeft, ArrowRight, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageCard, PageCardHeader, PageCardTitle, PageCardContent } from "@/components/ui/page-card"
import { Combobox, ComboboxOption } from "@/components/ui/combobox"
import { ProductPicker } from "@/components/invoice/product-picker"
import { InvoiceSummary } from "@/components/invoice/invoice-summary"
import { StepIndicator } from "@/components/invoice/invoice-step-indicator"
import { LineItemEditor } from "@/components/invoice/line-item-editor"
import { AlertBanner } from "@/components/dashboard/alert-banner"
import { Contact, Product } from "@prisma/client"
import { toast } from "@/lib/toast"
import { trackEvent, AnalyticsEvents } from "@/lib/analytics"
import { cn } from "@/lib/utils"

type EInvoiceFormInput = z.input<typeof eInvoiceSchema>

interface InvoiceFormProps {
  contacts: Contact[]
  products: Product[]
}

const STEPS = [
  { id: "buyer", name: "Kupac" },
  { id: "items", name: "Stavke" },
  { id: "review", name: "Pregled" },
]

export function InvoiceForm({ contacts, products }: InvoiceFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

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
      issueDate: new Date(),
      currency: "EUR",
      lines: [
        {
          description: "",
          quantity: 1,
          unit: "C62",
          unitPrice: 0,
          vatRate: 25,
          vatCategory: "S",
        },
      ],
    },
  })

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "lines",
  })

  const watchedValues = watch()
  const selectedBuyer = contacts.find(c => c.id === watchedValues.buyerId)

  // Autosave to localStorage
  useEffect(() => {
    const savedDraft = localStorage.getItem('einvoice-draft')
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft)
        Object.keys(draft).forEach(key => {
          setValue(key as keyof EInvoiceFormInput, draft[key])
        })
      } catch {
        // Invalid draft, ignore
      }
    }
  }, [setValue])

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem('einvoice-draft', JSON.stringify(watchedValues))
    }, 1000)
    return () => clearTimeout(timer)
  }, [watchedValues])

  const handleNextStep = async () => {
    let isValid = true

    if (currentStep === 0) {
      isValid = await trigger(['buyerId', 'issueDate'])
    } else if (currentStep === 1) {
      isValid = await trigger('lines')
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

    localStorage.removeItem('einvoice-draft')
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

  const handleProductSelect = (product: Product) => {
    const unitPrice = typeof product.price === 'number'
      ? product.price
      : product.price.toNumber()
    const vatRate = typeof product.vatRate === 'number'
      ? product.vatRate
      : product.vatRate.toNumber()

    append({
      description: product.name,
      quantity: 1,
      unit: product.unit,
      unitPrice: unitPrice,
      vatRate: vatRate,
      vatCategory: "S",
    })
  }

  const handleLineChange = (index: number, field: string, value: string | number) => {
    const currentLine = fields[index]
    update(index, { ...currentLine, [field]: value })
  }

  return (
    <div className="space-y-6">
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
      <div className="pt-4 pb-8">
        <StepIndicator
          steps={STEPS}
          currentStep={currentStep}
          onStepClick={setCurrentStep}
        />
      </div>

      {error && (
        <AlertBanner type="error" title="Greška pri spremanju" description={error} />
      )}

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Main Form Area */}
          <div className="lg:col-span-8 space-y-6">
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
                      <Input type="date" {...register("dueDate")} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                        Broj računa
                      </label>
                      <Input
                        {...register("invoiceNumber")}
                        placeholder="Automatski"
                        error={errors.invoiceNumber?.message}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                        Referenca kupca
                      </label>
                      <Input {...register("buyerReference")} placeholder="Opcionalno" />
                    </div>
                  </div>
                </PageCardContent>
              </PageCard>
            </div>

            {/* Step 2: Line Items */}
            <div className={cn(currentStep !== 1 && "hidden")}>
              <PageCard>
                <PageCardHeader
                  actions={
                    <ProductPicker products={products} onSelect={handleProductSelect} />
                  }
                >
                  <PageCardTitle>Stavke računa</PageCardTitle>
                </PageCardHeader>
                <PageCardContent>
                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <LineItemEditor
                        key={field.id}
                        index={index}
                        line={watchedValues.lines[index] || field}
                        onChange={(f, v) => handleLineChange(index, f, v)}
                        onRemove={() => remove(index)}
                        canRemove={fields.length > 1}
                      />
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        append({
                          description: "",
                          quantity: 1,
                          unit: "C62",
                          unitPrice: 0,
                          vatRate: 25,
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
                <PageCardHeader>
                  <PageCardTitle>Pregled i slanje</PageCardTitle>
                </PageCardHeader>
                <PageCardContent>
                  <div className="space-y-6">
                    {/* Buyer Summary */}
                    <div className="rounded-lg bg-[var(--surface-secondary)] p-4">
                      <h4 className="font-medium text-[var(--foreground)] mb-2">Kupac</h4>
                      <p className="text-[var(--foreground)]">{selectedBuyer?.name || "—"}</p>
                      <p className="text-sm text-[var(--muted)]">OIB: {selectedBuyer?.oib || "—"}</p>
                    </div>

                    {/* Items Summary */}
                    <div>
                      <h4 className="font-medium text-[var(--foreground)] mb-3">Stavke</h4>
                      <div className="border border-[var(--border)] rounded-lg divide-y divide-[var(--border)]">
                        {watchedValues.lines.map((line, i) => (
                          <div key={i} className="flex justify-between items-center p-3">
                            <div>
                              <p className="font-medium">{line.description || `Stavka ${i + 1}`}</p>
                              <p className="text-sm text-[var(--muted)]">
                                {line.quantity} × {(line.unitPrice || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2 })} € (PDV {line.vatRate}%)
                              </p>
                            </div>
                            <p className="font-medium">
                              {((line.quantity || 0) * (line.unitPrice || 0) * (1 + (line.vatRate || 0) / 100)).toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <p className="text-sm text-[var(--muted)]">
                      Klikom na &quot;Spremi&quot; račun će biti spremljen kao nacrt. Možete ga kasnije pregledati i poslati kupcu.
                    </p>
                  </div>
                </PageCardContent>
              </PageCard>
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-4">
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
          <div className="lg:col-span-4">
            <InvoiceSummary
              buyer={selectedBuyer ? { name: selectedBuyer.name, oib: selectedBuyer.oib } : null}
              invoiceNumber={watchedValues.invoiceNumber}
              issueDate={watchedValues.issueDate as Date | undefined}
              lines={watchedValues.lines}
              currency={watchedValues.currency}
            />
          </div>
        </div>
      </form>
    </div>
  )
}
