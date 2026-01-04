# Croatian Fiscalization System - FiskAI

This document explains the Croatian fiscalization implementation in FiskAI.

## Overview

FiskAI integrates with the Croatian fiscalization system (Fiskalizacija) as required by Croatian tax law. This system ensures all invoices are reported to the Croatian Tax Authority (CIS - Centralni Informacijski Sustav).

## Key Concepts

### ZKI (Zaštitni Kod Izdavatelja)

- **Protective Code of the Issuer**
- Generated before sending invoice to CIS
- Created by signing invoice data with company's private key
- Format: 32-character hexadecimal string

### JIR (Jedinstveni Identifikator Računa)

- **Unique Invoice Identifier**
- Received from CIS after successful fiscalization
- Must be printed on the invoice
- Format: UUID-like string

### Business Premises (Poslovni prostor)

- Physical location where business is conducted
- Each location has a unique code (numeric)
- Must be registered with tax authority

### Payment Device (Naplatni uređaj)

- Cash register or POS terminal
- Each device has a unique code (numeric)
- Associated with a business premises

## Architecture

```
┌─────────────────┐
│   User Action   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│ fiscalize.ts    │ Server Action
│ (Action Layer)  │
└────────┬────────┘
         │
         v
┌─────────────────┐
│   ZKI Utility   │ Calculate ZKI code
└────────┬────────┘
         │
         v
┌─────────────────┐
│ Fiscal Provider │ Mock / IE-Računi / FINA
└────────┬────────┘
         │
         v
┌─────────────────┐
│   Tax CIS API   │ Croatian Tax Authority
└─────────────────┘
```

## File Structure

```
src/
├── lib/
│   └── e-invoice/
│       ├── fiscal-types.ts        # TypeScript types for fiscalization
│       ├── fiscal-provider.ts     # Provider factory
│       ├── zki.ts                 # ZKI calculation utility
│       ├── providers/
│       │   ├── mock-fiscal.ts     # Mock provider for development
│       │   └── ie-racuni.ts       # IE-Računi integration
│       └── index.ts               # Exports
└── app/
    └── actions/
        └── fiscalize.ts           # Server actions for fiscalization
```

## Usage

### 1. Configure Environment

```bash
# .env.local
FISCAL_PROVIDER=mock  # Use 'mock' for development

# For production with IE-Računi:
# FISCAL_PROVIDER=ie-racuni
# IE_RACUNI_API_KEY=your_api_key
# IE_RACUNI_SANDBOX=true
```

### 2. Set Up Business Premises and Devices

Before fiscalizing invoices, configure at least one business premises and payment device:

```typescript
// In your settings or setup flow
await db.businessPremises.create({
  data: {
    companyId: company.id,
    code: 1,
    name: "Glavni ured",
    address: "Ulica Grada Vukovara 269",
    isDefault: true,
    isActive: true,
  },
})

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

### 3. Fiscalize an Invoice

```typescript
import { fiscalizeInvoice } from "@/app/actions/fiscalize"

// In your component or API route
const result = await fiscalizeInvoice(invoiceId)

if (result.success) {
  console.log("JIR:", result.jir)
  console.log("ZKI:", result.zki)
} else {
  console.error("Error:", result.error)
}
```

## ZKI Calculation

The ZKI is calculated from the following data:

```
OIB + DateTime + InvoiceNumber + PremisesCode + DeviceCode + TotalAmount
```

**Example:**

```
OIB: 12345678901
DateTime: 15.12.2024 14:30:25
Invoice: 2024/1-1-1
Premises: 1
Device: 1
Total: 1250,00 HRK

Data String: 1234567890115.12.202414:30:252024/1-1-111 1250,00
```

### Development Mode (without certificate)

- Uses SHA-256 hash of data string
- First 32 characters used as ZKI
- Suitable for testing and development

### Production Mode (with certificate)

- Signs data string with RSA private key
- Hashes signature with MD5
- Result is 32-character ZKI

## Fiscal Providers

### Mock Provider (Development)

- No external API calls
- Generates fake JIR codes
- Simulates API delays
- Validates invoice data
- Perfect for development and testing

**Usage:**

```typescript
FISCAL_PROVIDER = mock
```

### IE-Računi Provider (Production)

- Integrates with IE-Računi service
- Communicates with Croatian CIS
- Requires API credentials
- Supports sandbox mode

**Usage:**

```typescript
FISCAL_PROVIDER=ie-racuni
IE_RACUNI_API_KEY=your_api_key
IE_RACUNI_SANDBOX=true  # Start with sandbox
```

**Implementation Status:**

- ✅ Basic structure implemented
- ✅ API client ready
- ⚠️ API endpoints need IE-Računi documentation
- ⚠️ Requires account setup with IE-Računi

### FINA Provider (Future)

- Direct integration with FINA
- Alternative to IE-Računi
- Not yet implemented

## Database Schema

The EInvoice model includes fiscalization fields:

```prisma
model EInvoice {
  // ... other fields ...

  // Fiscalization
  jir          String?    // JIR from CIS
  zki          String?    // Calculated ZKI
  fiscalizedAt DateTime?  // When fiscalized

  status EInvoiceStatus
}

enum EInvoiceStatus {
  DRAFT
  PENDING_FISCALIZATION
  FISCALIZED  // Has JIR
  SENT
  DELIVERED
  ACCEPTED
  REJECTED
  ARCHIVED
  ERROR
}
```

## Error Handling

Common errors and solutions:

### "Nije konfiguriran poslovni prostor"

**Solution:** Configure business premises in settings

### "Nije konfiguriran naplatni uređaj"

**Solution:** Configure payment device for your premises

### "Invalid OIB format"

**Solution:** Ensure company OIB is exactly 11 digits

### "IE-Računi API key not configured"

**Solution:** Set `IE_RACUNI_API_KEY` environment variable

## Testing

### Test ZKI Calculation

```typescript
import { calculateZKI, validateZKIInput } from "@/lib/e-invoice"

const zkiInput = {
  oib: "12345678901",
  dateTime: new Date(),
  invoiceNumber: "2024/1-1-1",
  premisesCode: "1",
  deviceCode: "1",
  totalAmount: 125000, // in cents
}

// Validate
const validation = validateZKIInput(zkiInput)
console.log(validation)

// Calculate
const zki = calculateZKI(zkiInput)
console.log("ZKI:", zki)
```

### Test Mock Provider

```typescript
import { getFiscalProvider } from "@/lib/e-invoice"

const provider = getFiscalProvider({ provider: "mock" })

const result = await provider.send({
  invoiceNumber: "2024/1-1-1",
  zki: "abc123...",
  // ... other fields
})

console.log("JIR:", result.jir)
```

## Production Checklist

Before going live with real fiscalization:

- [ ] Obtain FINA certificate (.pfx file)
- [ ] Register with IE-Računi or FINA
- [ ] Configure API credentials
- [ ] Test in sandbox environment
- [ ] Register business premises with tax authority
- [ ] Register payment devices
- [ ] Configure certificate path and password
- [ ] Test with real invoices in sandbox
- [ ] Verify JIR codes are received correctly
- [ ] Test error scenarios
- [ ] Set up monitoring and alerts
- [ ] Switch from sandbox to production

## Legal Requirements

According to Croatian law:

1. **All B2C invoices must be fiscalized** immediately at point of sale
2. **B2B invoices** may be fiscalized later (subsequent delivery)
3. **JIR must be printed** on all fiscalized invoices
4. **ZKI must be printed** on all fiscalized invoices
5. **Backup procedure** required in case of CIS downtime
6. **Invoice format** must follow legal requirements

## Resources

- [Croatian Tax Authority - Fiskalizacija](https://www.porezna-uprava.hr/HR_Fiskalizacija/Stranice/Fiskalizacija.aspx)
- [Technical Specification](https://www.porezna-uprava.hr/HR_Fiskalizacija/Stranice/Tehnicka-specifikacija.aspx)
- IE-Računi Provider: Contact provider for documentation
- FINA eRačun: Contact FINA for integration details

## Support

For implementation support:

1. Check this documentation
2. Review test cases in development
3. Contact IE-Računi support (if using their service)
4. Consult with Croatian tax advisor for legal questions
