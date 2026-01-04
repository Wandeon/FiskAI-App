# Fiscalization Integration Guide

Quick guide for integrating Croatian fiscalization into your invoice workflow.

## Quick Start (5 minutes)

### 1. Set Environment Variable

Add to `.env.local`:

```env
FISCAL_PROVIDER=mock
```

### 2. Configure Business Premises

Run this once in your setup or settings page:

```typescript
import { db } from "@/lib/db"

// Create default business premises
const premises = await db.businessPremises.create({
  data: {
    companyId: company.id,
    code: 1,
    name: "Glavni ured",
    address: "Your business address",
    isDefault: true,
    isActive: true,
  },
})

// Create default payment device
await db.paymentDevice.create({
  data: {
    companyId: company.id,
    businessPremisesId: premises.id,
    code: 1,
    name: "Blagajna 1",
    isDefault: true,
    isActive: true,
  },
})
```

### 3. Add Fiscalization to Your UI

In your invoice detail page, add a fiscalization button:

```typescript
'use client'

import { fiscalizeInvoice } from '@/app/actions/fiscalize'
import { useState } from 'react'

export function FiscalizeButton({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleFiscalize() {
    setLoading(true)
    const result = await fiscalizeInvoice(invoiceId)

    if (result.success) {
      alert(`Fiskalizirano! JIR: ${result.jir}`)
      // Refresh or redirect
    } else {
      alert(`Greška: ${result.error}`)
    }
    setLoading(false)
  }

  return (
    <button onClick={handleFiscalize} disabled={loading}>
      {loading ? 'Fiskalizacija...' : 'Fiskaliziraj račun'}
    </button>
  )
}
```

### 4. Display JIR and ZKI on Invoice

After fiscalization, show JIR and ZKI:

```typescript
export function InvoiceDetails({ invoice }: { invoice: EInvoice }) {
  return (
    <div>
      <h2>Račun {invoice.invoiceNumber}</h2>

      {invoice.status === 'FISCALIZED' && (
        <div className="fiscal-info">
          <p><strong>ZKI:</strong> {invoice.zki}</p>
          <p><strong>JIR:</strong> {invoice.jir}</p>
          <p><small>Fiskalizirano: {invoice.fiscalizedAt?.toLocaleString('hr-HR')}</small></p>
        </div>
      )}

      {/* Rest of invoice details */}
    </div>
  )
}
```

## Advanced Usage

### Custom Fiscalization with Specific Premises

If you need to fiscalize with a specific premises/device (not default):

```typescript
// Modify the fiscalize action to accept premises/device parameters
export async function fiscalizeInvoiceWithPremises(
  invoiceId: string,
  premisesId: string,
  deviceId: string
) {
  // ... similar to fiscalizeInvoice but use provided IDs
}
```

### Check Fiscalization Status

```typescript
import { checkFiscalStatus } from "@/app/actions/fiscalize"

const status = await checkFiscalStatus(invoiceId)
console.log(status.status) // 'FISCALIZED' | 'PENDING' | 'ERROR'
```

### Batch Fiscalization

To fiscalize multiple invoices:

```typescript
async function fiscalizeMultiple(invoiceIds: string[]) {
  const results = await Promise.allSettled(invoiceIds.map((id) => fiscalizeInvoice(id)))

  return results.map((result, i) => ({
    invoiceId: invoiceIds[i],
    success: result.status === "fulfilled" && result.value.success,
    error: result.status === "rejected" ? result.reason : undefined,
  }))
}
```

## Invoice PDF Integration

When generating PDF invoices, include ZKI and JIR:

```typescript
export async function generateInvoicePDF(invoice: EInvoice) {
  // Your PDF generation logic
  const pdf = new PDFDocument()

  // Add invoice data
  pdf.text(`Invoice: ${invoice.invoiceNumber}`)

  // Add fiscal data if fiscalized
  if (invoice.fiscalizedAt) {
    pdf.fontSize(10)
    pdf.text("─────────────────────────────")
    pdf.text(`ZKI: ${invoice.zki}`)
    pdf.text(`JIR: ${invoice.jir}`)
    pdf.text(`Fiscalized: ${invoice.fiscalizedAt.toLocaleString("hr-HR")}`)

    // Optionally add QR code with JIR
    // const qrCode = await generateQRCode(invoice.jir)
    // pdf.image(qrCode, ...)
  }

  return pdf
}
```

## Email Template

Include fiscal info in email notifications:

```typescript
export function getFiscalEmailTemplate(invoice: EInvoice) {
  return `
    <html>
      <body>
        <h2>Račun ${invoice.invoiceNumber}</h2>

        ${
          invoice.fiscalizedAt
            ? `
          <div style="background: #f0f0f0; padding: 15px; margin: 20px 0;">
            <h3>Podaci fiskalizacije</h3>
            <p><strong>ZKI:</strong> ${invoice.zki}</p>
            <p><strong>JIR:</strong> ${invoice.jir}</p>
            <p><em>Fiskalizirano: ${invoice.fiscalizedAt.toLocaleString("hr-HR")}</em></p>
          </div>
        `
            : ""
        }

        <!-- Rest of email -->
      </body>
    </html>
  `
}
```

## Workflow Integration

### Option 1: Manual Fiscalization

User creates invoice → Reviews → Clicks "Fiscalize" button → Gets JIR

### Option 2: Auto-fiscalize on Send

```typescript
export async function sendInvoiceWithFiscalization(invoiceId: string) {
  // First fiscalize
  const fiscalResult = await fiscalizeInvoice(invoiceId)
  if (!fiscalResult.success) {
    return { error: fiscalResult.error }
  }

  // Then send email
  const invoice = await getInvoice(invoiceId)
  await sendInvoiceEmail(invoice)

  return { success: true }
}
```

### Option 3: Fiscalize on Create

```typescript
export async function createAndFiscalizeInvoice(data) {
  // Create invoice
  const invoice = await createEInvoice(data)

  // Auto-fiscalize if company has fiscalization enabled
  if (invoice.company.fiscalizationEnabled) {
    await fiscalizeInvoice(invoice.id)
  }

  return invoice
}
```

## Error Handling UI

```typescript
export function FiscalizationStatus({ invoice }: { invoice: EInvoice }) {
  if (invoice.status === 'FISCALIZED') {
    return (
      <div className="alert alert-success">
        ✅ Fiskalizirano
        <div className="text-xs mt-1">
          JIR: {invoice.jir}
        </div>
      </div>
    )
  }

  if (invoice.status === 'ERROR' && invoice.providerError) {
    return (
      <div className="alert alert-error">
        ❌ Greška: {invoice.providerError}
        <button onClick={() => fiscalizeInvoice(invoice.id)}>
          Pokušaj ponovno
        </button>
      </div>
    )
  }

  return (
    <div className="alert alert-warning">
      ⚠️ Nije fiskalizirano
      <FiscalizeButton invoiceId={invoice.id} />
    </div>
  )
}
```

## Testing

### Test with Mock Provider

```typescript
// .env.local
FISCAL_PROVIDER = mock

// Your test
const result = await fiscalizeInvoice(testInvoiceId)
expect(result.success).toBe(true)
expect(result.jir).toMatch(/^[a-z0-9-]+$/)
```

### Test with Real Provider (Sandbox)

```typescript
// .env.local
FISCAL_PROVIDER = ie - racuni
IE_RACUNI_API_KEY = your_sandbox_key
IE_RACUNI_SANDBOX = true

// Your test
const result = await fiscalizeInvoice(testInvoiceId)
// Will hit real IE-Računi sandbox
```

## Production Deployment

### Before Going Live

1. ✅ Test thoroughly with mock provider
2. ✅ Test in IE-Računi sandbox
3. ✅ Verify JIR/ZKI display correctly on invoices
4. ✅ Verify PDF generation includes fiscal data
5. ✅ Verify email templates include fiscal data
6. ✅ Test error scenarios
7. ✅ Set up monitoring/alerts

### Switch to Production

```env
# .env.production
FISCAL_PROVIDER=ie-racuni
IE_RACUNI_API_KEY=your_production_key
IE_RACUNI_SANDBOX=false
IE_RACUNI_API_URL=https://api.ie-racuni.hr/v1
```

## Common Issues

### "Nije konfiguriran poslovni prostor"

➡️ Run step 2 above to create business premises

### "Račun je već fiskaliziran"

➡️ Can't fiscalize twice. Create credit note to reverse.

### "Invalid OIB format"

➡️ Check company.oib is exactly 11 digits

### JIR not showing

➡️ Check invoice.status === 'FISCALIZED' and invoice.jir exists

## Support

- **Documentation**: `/FISCALIZATION.md`
- **Examples**: `/examples/fiscalization-example.ts`
- **Tests**: `/src/lib/e-invoice/__tests__/zki.test.ts`
- **Issues**: Create GitHub issue with tag `fiscalization`
