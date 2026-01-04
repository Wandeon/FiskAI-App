# E-Invoice Providers (Informacijski Posrednici) - Research

## Overview

In Croatia's Fiskalizacija 2.0 system, businesses must connect to the tax authority through certified "information intermediaries" (informacijski posrednici). These providers handle the technical complexity of AS4 protocol, EN 16931 compliance, and fiscalization.

## Provider Landscape

### FINA (Financijska agencija)

**Status**: Government agency, most established provider

**Services**:

- B2G e-invoicing (Servis eRačun za državu) - since 2019
- B2B e-invoicing - expanding for 2026
- PEPPOL Access Point
- Long-term archival

**Pros**:

- Official government backing
- Already handles all B2G invoices
- PEPPOL integrated
- Trusted by enterprises

**Cons**:

- Can be slower to innovate
- Government bureaucracy

**API**: REST API available for ERP integration

**Website**: [fina.hr/e-invoice](https://www.fina.hr/eng/business-digitalization/e-invoice)

---

### IE Računi

**Status**: Private certified intermediary

**Services**:

- B2G, B2B, B2C e-invoicing
- EN 16931 compliant
- 11-year archival
- Multi-network integration (FINA B2G, FINA B2B, HT, mSTART, REDOK)

**Pros**:

- Partner API program for software developers
- Revenue share model for integrators
- Modern API
- Focused on software integration

**Cons**:

- Smaller than FINA

**Integration**: API with partner program - good candidate for FiskAI

**Website**: [ie-racuni.com](https://www.ie-racuni.com/)

---

### Solo

**Status**: Private provider (solo.com.hr - competitor product)

**Services**:

- Full accounting/invoicing SaaS
- E-invoicing built-in
- Targeting small businesses

**Notes**: This is a competitor to FiskAI, not a pure intermediary service

**Website**: [solo.com.hr](https://solo.com.hr/)

---

### Moj-eRačun

**Status**: Private certified intermediary

**Services**:

- E-invoicing exchange
- PDF to XML conversion
- Archival services

---

### EDICOM

**Status**: International EDI provider with Croatian presence

**Services**:

- Global e-invoicing compliance
- Multi-country support
- Enterprise-focused

**Pros**:

- Good for companies with international operations

**Cons**:

- Enterprise pricing
- May be overkill for SMB

---

### DDD Invoices

**Status**: International compliance API

**Services**:

- Single API for global e-invoicing/fiscalization
- Croatia support included

**Pros**:

- Modern REST API
- Good documentation
- Multi-country from one integration

**Website**: [dddinvoices.com](https://dddinvoices.com/learn/e-invoicing-croatia)

---

## Provider Selection Criteria for FiskAI

| Criterion       | Weight | Notes                             |
| --------------- | ------ | --------------------------------- |
| API Quality     | High   | Must have modern REST/GraphQL API |
| Documentation   | High   | Clear integration docs            |
| Partner Program | Medium | Revenue share or flat fee         |
| Reliability     | High   | Uptime SLA                        |
| Pricing         | Medium | Per-invoice or subscription       |
| Support         | Medium | Developer support quality         |
| Multi-network   | Medium | Connects to all intermediaries    |

## Recommended Strategy

### Primary Integration: IE Računi or DDD Invoices

**Rationale**:

1. Partner programs designed for software integrators
2. Modern APIs
3. Good documentation
4. Reasonable pricing for SaaS model

### Adapter Architecture

```typescript
// Provider-agnostic interface
interface EInvoiceProvider {
  sendInvoice(invoice: EInvoice): Promise<SendResult>;
  receiveInvoices(): Promise<EInvoice[]>;
  getStatus(invoiceId: string): Promise<InvoiceStatus>;
  archive(invoice: EInvoice): Promise<ArchiveResult>;
}

// Implementations
class IERacuniProvider implements EInvoiceProvider { ... }
class DDDInvoicesProvider implements EInvoiceProvider { ... }
class FinaProvider implements EInvoiceProvider { ... }
```

This allows:

- Starting with one provider
- Easy switching if needed
- Customer choice of provider (enterprise feature)

## API Requirements Checklist

For any provider integration, we need:

- [ ] Send e-invoice (UBL 2.1 XML)
- [ ] Receive e-invoices
- [ ] Query invoice status
- [ ] Fiscalization confirmation
- [ ] Archive/retrieval
- [ ] Webhook support for incoming invoices
- [ ] Sandbox/test environment
- [ ] Error handling and retry logic

## Cost Considerations

| Provider Type        | Typical Pricing           |
| -------------------- | ------------------------- |
| Per invoice          | €0.10 - €0.50 per invoice |
| Monthly subscription | €20 - €100/month          |
| Enterprise           | Custom pricing            |

FiskAI should build pricing to cover intermediary costs + margin.

## Next Steps

1. Contact IE Računi about partner program
2. Evaluate DDD Invoices sandbox
3. Request FINA API documentation
4. Design adapter interface
5. Implement first provider integration

## Sources

- [FINA e-Invoice](https://www.fina.hr/eng/business-digitalization/e-invoice)
- [IE Računi](https://www.ie-racuni.com/)
- [DDD Invoices - Croatia](https://dddinvoices.com/learn/e-invoicing-croatia)
- [EU eInvoicing in Croatia](https://ec.europa.eu/digital-building-blocks/sites/spaces/DIGITAL/pages/467108879/eInvoicing+in+Croatia)
