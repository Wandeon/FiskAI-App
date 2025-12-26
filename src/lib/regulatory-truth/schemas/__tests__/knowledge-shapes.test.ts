// src/lib/regulatory-truth/schemas/__tests__/knowledge-shapes.test.ts
import { describe, it, expect } from "vitest"
import {
  AtomicClaimSchema,
  RegulatoryProcessSchema,
  ReferenceTableSchema,
  RegulatoryAssetSchema,
  TransitionalProvisionSchema,
} from "../index"

describe("AtomicClaimSchema", () => {
  it("validates a complete atomic claim", () => {
    const claim = {
      subjectType: "TAXPAYER",
      subjectQualifiers: ["pausalni-obrt"],
      triggerExpr: "sales > 10000 EUR",
      temporalExpr: "per_calendar_year",
      jurisdiction: "HR",
      assertionType: "OBLIGATION",
      logicExpr: "tax_place = destination",
      value: "10000",
      valueType: "currency_eur",
      exactQuote: "Prag u iznosu od 10.000,00 eura...",
      articleNumber: "58",
      lawReference: "Zakon o PDV-u",
      confidence: 0.9,
      exceptions: [
        {
          condition: "sales <= 10000 EUR",
          overridesTo: "origin-taxation",
          sourceArticle: "Art 58(1)",
        },
      ],
    }

    const result = AtomicClaimSchema.safeParse(claim)
    expect(result.success).toBe(true)
  })

  it("validates a minimal atomic claim with defaults", () => {
    const claim = {
      subjectType: "TAXPAYER",
      assertionType: "OBLIGATION",
      logicExpr: "must_pay = true",
      exactQuote: "Porezni obveznik mora...",
    }

    const result = AtomicClaimSchema.safeParse(claim)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.jurisdiction).toBe("HR")
      expect(result.data.confidence).toBe(0.8)
      expect(result.data.subjectQualifiers).toEqual([])
      expect(result.data.exceptions).toEqual([])
    }
  })

  it("requires exactQuote", () => {
    const claim = {
      subjectType: "TAXPAYER",
      assertionType: "OBLIGATION",
      logicExpr: "must_pay = true",
      // missing exactQuote
    }

    const result = AtomicClaimSchema.safeParse(claim)
    expect(result.success).toBe(false)
  })

  it("requires logicExpr", () => {
    const claim = {
      subjectType: "TAXPAYER",
      assertionType: "OBLIGATION",
      exactQuote: "Some quote",
      // missing logicExpr
    }

    const result = AtomicClaimSchema.safeParse(claim)
    expect(result.success).toBe(false)
  })

  it("validates subjectType enum values", () => {
    const validTypes = ["TAXPAYER", "EMPLOYER", "COMPANY", "INDIVIDUAL", "ALL"]

    for (const subjectType of validTypes) {
      const claim = {
        subjectType,
        assertionType: "OBLIGATION",
        logicExpr: "test = true",
        exactQuote: "Test quote",
      }
      const result = AtomicClaimSchema.safeParse(claim)
      expect(result.success).toBe(true)
    }

    // Invalid type
    const invalidClaim = {
      subjectType: "INVALID",
      assertionType: "OBLIGATION",
      logicExpr: "test = true",
      exactQuote: "Test quote",
    }
    const result = AtomicClaimSchema.safeParse(invalidClaim)
    expect(result.success).toBe(false)
  })

  it("validates assertionType enum values", () => {
    const validTypes = ["OBLIGATION", "PROHIBITION", "PERMISSION", "DEFINITION"]

    for (const assertionType of validTypes) {
      const claim = {
        subjectType: "TAXPAYER",
        assertionType,
        logicExpr: "test = true",
        exactQuote: "Test quote",
      }
      const result = AtomicClaimSchema.safeParse(claim)
      expect(result.success).toBe(true)
    }
  })

  it("validates confidence is between 0 and 1", () => {
    const validClaim = {
      subjectType: "TAXPAYER",
      assertionType: "OBLIGATION",
      logicExpr: "test = true",
      exactQuote: "Test quote",
      confidence: 0.5,
    }
    expect(AtomicClaimSchema.safeParse(validClaim).success).toBe(true)

    const tooLow = { ...validClaim, confidence: -0.1 }
    expect(AtomicClaimSchema.safeParse(tooLow).success).toBe(false)

    const tooHigh = { ...validClaim, confidence: 1.1 }
    expect(AtomicClaimSchema.safeParse(tooHigh).success).toBe(false)
  })

  it("validates exception structure", () => {
    const claimWithInvalidException = {
      subjectType: "TAXPAYER",
      assertionType: "OBLIGATION",
      logicExpr: "test = true",
      exactQuote: "Test quote",
      exceptions: [
        {
          condition: "sales > 10000",
          // missing overridesTo and sourceArticle
        },
      ],
    }
    const result = AtomicClaimSchema.safeParse(claimWithInvalidException)
    expect(result.success).toBe(false)
  })
})

describe("RegulatoryProcessSchema", () => {
  it("validates a process with steps", () => {
    const process = {
      slug: "oss-registration",
      titleHr: "Registracija za OSS",
      processType: "REGISTRATION",
      steps: [
        {
          orderNum: 1,
          actionHr: "Prijavite se na ePorezna",
        },
        {
          orderNum: 2,
          actionHr: "Ispunite obrazac OSS-1",
          requiresStepIds: [],
        },
      ],
    }

    const result = RegulatoryProcessSchema.safeParse(process)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.jurisdiction).toBe("HR")
    }
  })

  it("validates a complete process with all optional fields", () => {
    const process = {
      slug: "vat-filing",
      titleHr: "Prijava PDV-a",
      titleEn: "VAT Filing",
      jurisdiction: "HR",
      processType: "FILING",
      estimatedTime: "3-5 radnih dana",
      prerequisites: { requires: ["digital-certificate"] },
      steps: [
        {
          orderNum: 1,
          actionHr: "Prijava u sustav",
          actionEn: "Log into system",
          requiresStepIds: [],
          requiresAssets: ["form-pdv-1"],
          onSuccessStepId: "step-2",
          onFailureStepId: null,
          failureAction: "Kontaktirajte podršku",
        },
      ],
    }

    const result = RegulatoryProcessSchema.safeParse(process)
    expect(result.success).toBe(true)
  })

  it("requires at least one step", () => {
    const process = {
      slug: "empty-process",
      titleHr: "Prazan postupak",
      processType: "FILING",
      steps: [],
    }

    const result = RegulatoryProcessSchema.safeParse(process)
    expect(result.success).toBe(false)
  })

  it("requires slug field", () => {
    const process = {
      titleHr: "Postupak bez slug-a",
      processType: "FILING",
      steps: [{ orderNum: 1, actionHr: "Step 1" }],
    }

    const result = RegulatoryProcessSchema.safeParse(process)
    expect(result.success).toBe(false)
  })

  it("validates slug format (lowercase, numbers, hyphens only)", () => {
    const validSlugs = ["oss-registration", "vat-filing", "process-123", "a-b-c"]
    const invalidSlugs = ["OSS-Registration", "vat_filing", "process 123", "slug!"]

    for (const slug of validSlugs) {
      const process = {
        slug,
        titleHr: "Test",
        processType: "FILING",
        steps: [{ orderNum: 1, actionHr: "Step 1" }],
      }
      expect(RegulatoryProcessSchema.safeParse(process).success).toBe(true)
    }

    for (const slug of invalidSlugs) {
      const process = {
        slug,
        titleHr: "Test",
        processType: "FILING",
        steps: [{ orderNum: 1, actionHr: "Step 1" }],
      }
      expect(RegulatoryProcessSchema.safeParse(process).success).toBe(false)
    }
  })

  it("validates processType enum values", () => {
    const validTypes = ["REGISTRATION", "FILING", "APPEAL", "CLOSURE", "AMENDMENT", "INQUIRY"]

    for (const processType of validTypes) {
      const process = {
        slug: "test-process",
        titleHr: "Test",
        processType,
        steps: [{ orderNum: 1, actionHr: "Step 1" }],
      }
      expect(RegulatoryProcessSchema.safeParse(process).success).toBe(true)
    }
  })

  it("validates step orderNum is positive integer", () => {
    const invalidOrderNum = {
      slug: "test",
      titleHr: "Test",
      processType: "FILING",
      steps: [{ orderNum: 0, actionHr: "Step 1" }],
    }
    expect(RegulatoryProcessSchema.safeParse(invalidOrderNum).success).toBe(false)

    const negativeOrderNum = {
      slug: "test",
      titleHr: "Test",
      processType: "FILING",
      steps: [{ orderNum: -1, actionHr: "Step 1" }],
    }
    expect(RegulatoryProcessSchema.safeParse(negativeOrderNum).success).toBe(false)
  })
})

describe("ReferenceTableSchema", () => {
  it("validates an IBAN reference table", () => {
    const table = {
      category: "IBAN",
      name: "Uplatni računi porezne uprave",
      keyColumn: "city",
      valueColumn: "iban",
      entries: [
        { key: "Zagreb", value: "HR1234567890123456789" },
        { key: "Split", value: "HR9876543210987654321" },
      ],
    }

    const result = ReferenceTableSchema.safeParse(table)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.jurisdiction).toBe("HR")
    }
  })

  it("validates a CN_CODE reference table with metadata", () => {
    const table = {
      category: "CN_CODE",
      name: "Carinska nomenklatura",
      jurisdiction: "HR",
      keyColumn: "code",
      valueColumn: "description",
      entries: [
        { key: "6201.11", value: "Računalne usluge", metadata: { model: "21" } },
        { key: "6202.00", value: "Ostale usluge", metadata: null },
      ],
      sourceUrl: "https://carina.gov.hr/codes",
    }

    const result = ReferenceTableSchema.safeParse(table)
    expect(result.success).toBe(true)
  })

  it("requires at least one entry", () => {
    const table = {
      category: "IBAN",
      name: "Empty table",
      keyColumn: "key",
      valueColumn: "value",
      entries: [],
    }

    const result = ReferenceTableSchema.safeParse(table)
    expect(result.success).toBe(false)
  })

  it("requires category field", () => {
    const table = {
      name: "No category",
      keyColumn: "key",
      valueColumn: "value",
      entries: [{ key: "k", value: "v" }],
    }

    const result = ReferenceTableSchema.safeParse(table)
    expect(result.success).toBe(false)
  })

  it("validates category enum values", () => {
    const validCategories = [
      "IBAN",
      "CN_CODE",
      "TAX_OFFICE",
      "INTEREST_RATE",
      "EXCHANGE_RATE",
      "FORM_CODE",
      "DEADLINE_CALENDAR",
    ]

    for (const category of validCategories) {
      const table = {
        category,
        name: "Test",
        keyColumn: "key",
        valueColumn: "value",
        entries: [{ key: "k", value: "v" }],
      }
      expect(ReferenceTableSchema.safeParse(table).success).toBe(true)
    }
  })

  it("validates sourceUrl is a valid URL when provided", () => {
    const validUrl = {
      category: "IBAN",
      name: "Test",
      keyColumn: "key",
      valueColumn: "value",
      entries: [{ key: "k", value: "v" }],
      sourceUrl: "https://example.com/data",
    }
    expect(ReferenceTableSchema.safeParse(validUrl).success).toBe(true)

    const invalidUrl = {
      category: "IBAN",
      name: "Test",
      keyColumn: "key",
      valueColumn: "value",
      entries: [{ key: "k", value: "v" }],
      sourceUrl: "not-a-url",
    }
    expect(ReferenceTableSchema.safeParse(invalidUrl).success).toBe(false)
  })

  it("validates entry key and value are non-empty strings", () => {
    const emptyKey = {
      category: "IBAN",
      name: "Test",
      keyColumn: "key",
      valueColumn: "value",
      entries: [{ key: "", value: "v" }],
    }
    expect(ReferenceTableSchema.safeParse(emptyKey).success).toBe(false)

    const emptyValue = {
      category: "IBAN",
      name: "Test",
      keyColumn: "key",
      valueColumn: "value",
      entries: [{ key: "k", value: "" }],
    }
    expect(ReferenceTableSchema.safeParse(emptyValue).success).toBe(false)
  })
})

describe("RegulatoryAssetSchema", () => {
  it("validates a form asset", () => {
    const asset = {
      formCode: "PDV-P",
      officialName: "Prijava poreza na dodanu vrijednost",
      downloadUrl: "https://porezna.gov.hr/forms/pdv-p.pdf",
      format: "PDF",
      assetType: "FORM",
      sourceUrl: "https://porezna.gov.hr/forms",
    }

    const result = RegulatoryAssetSchema.safeParse(asset)
    expect(result.success).toBe(true)
  })

  it("validates a complete asset with all optional fields", () => {
    const asset = {
      formCode: "JOPPD",
      officialName: "Obrazac JOPPD",
      description: "Izvješće o primicima, porezu na dohodak i doprinosima",
      downloadUrl: "https://porezna.gov.hr/forms/joppd.xlsx",
      format: "XLSX",
      fileSize: 102400,
      assetType: "FORM",
      stepNumber: 3,
      validFrom: "2024-01-01T00:00:00.000Z",
      validUntil: "2025-12-31T23:59:59.999Z",
      version: "2.1",
      sourceUrl: "https://porezna.gov.hr/forms",
    }

    const result = RegulatoryAssetSchema.safeParse(asset)
    expect(result.success).toBe(true)
  })

  it("requires officialName field", () => {
    const asset = {
      downloadUrl: "https://porezna.gov.hr/forms/pdv-p.pdf",
      format: "PDF",
      assetType: "FORM",
      sourceUrl: "https://porezna.gov.hr/forms",
    }

    const result = RegulatoryAssetSchema.safeParse(asset)
    expect(result.success).toBe(false)
  })

  it("requires downloadUrl field", () => {
    const asset = {
      officialName: "Test Form",
      format: "PDF",
      assetType: "FORM",
      sourceUrl: "https://porezna.gov.hr/forms",
    }

    const result = RegulatoryAssetSchema.safeParse(asset)
    expect(result.success).toBe(false)
  })

  it("validates format enum values", () => {
    const validFormats = ["PDF", "XML", "XLS", "XLSX", "DOC", "DOCX", "HTML"]

    for (const format of validFormats) {
      const asset = {
        officialName: "Test",
        downloadUrl: "https://example.com/file",
        format,
        assetType: "FORM",
        sourceUrl: "https://example.com",
      }
      expect(RegulatoryAssetSchema.safeParse(asset).success).toBe(true)
    }
  })

  it("validates assetType enum values", () => {
    const validTypes = ["FORM", "TEMPLATE", "GUIDE", "INSTRUCTION", "REGULATION_TEXT"]

    for (const assetType of validTypes) {
      const asset = {
        officialName: "Test",
        downloadUrl: "https://example.com/file",
        format: "PDF",
        assetType,
        sourceUrl: "https://example.com",
      }
      expect(RegulatoryAssetSchema.safeParse(asset).success).toBe(true)
    }
  })

  it("validates downloadUrl and sourceUrl are valid URLs", () => {
    const invalidDownloadUrl = {
      officialName: "Test",
      downloadUrl: "not-a-url",
      format: "PDF",
      assetType: "FORM",
      sourceUrl: "https://example.com",
    }
    expect(RegulatoryAssetSchema.safeParse(invalidDownloadUrl).success).toBe(false)

    const invalidSourceUrl = {
      officialName: "Test",
      downloadUrl: "https://example.com/file",
      format: "PDF",
      assetType: "FORM",
      sourceUrl: "not-a-url",
    }
    expect(RegulatoryAssetSchema.safeParse(invalidSourceUrl).success).toBe(false)
  })

  it("validates fileSize is positive integer when provided", () => {
    const validSize = {
      officialName: "Test",
      downloadUrl: "https://example.com/file",
      format: "PDF",
      assetType: "FORM",
      sourceUrl: "https://example.com",
      fileSize: 1024,
    }
    expect(RegulatoryAssetSchema.safeParse(validSize).success).toBe(true)

    const zeroSize = {
      officialName: "Test",
      downloadUrl: "https://example.com/file",
      format: "PDF",
      assetType: "FORM",
      sourceUrl: "https://example.com",
      fileSize: 0,
    }
    expect(RegulatoryAssetSchema.safeParse(zeroSize).success).toBe(false)

    const negativeSize = {
      officialName: "Test",
      downloadUrl: "https://example.com/file",
      format: "PDF",
      assetType: "FORM",
      sourceUrl: "https://example.com",
      fileSize: -100,
    }
    expect(RegulatoryAssetSchema.safeParse(negativeSize).success).toBe(false)
  })

  it("validates datetime format for validFrom and validUntil", () => {
    const validDates = {
      officialName: "Test",
      downloadUrl: "https://example.com/file",
      format: "PDF",
      assetType: "FORM",
      sourceUrl: "https://example.com",
      validFrom: "2024-01-01T00:00:00.000Z",
      validUntil: "2025-12-31T23:59:59.999Z",
    }
    expect(RegulatoryAssetSchema.safeParse(validDates).success).toBe(true)

    const invalidDate = {
      officialName: "Test",
      downloadUrl: "https://example.com/file",
      format: "PDF",
      assetType: "FORM",
      sourceUrl: "https://example.com",
      validFrom: "2024-01-01", // Not ISO datetime
    }
    expect(RegulatoryAssetSchema.safeParse(invalidDate).success).toBe(false)
  })
})

describe("TransitionalProvisionSchema", () => {
  it("validates a transitional provision", () => {
    const provision = {
      fromRule: "vat-rate-25-old",
      toRule: "vat-rate-25-new",
      cutoffDate: "2025-01-01T00:00:00.000Z",
      logicExpr: "IF invoice_date < cutoff AND delivery_date >= cutoff",
      appliesRule: "vat-rate-25-new",
      explanationHr: "Za račune izdane prije 1.1.2025. primjenjuje se stara stopa...",
      pattern: "DELIVERY_DATE",
      sourceArticle: "Čl. 45 Prijelazne odredbe",
    }

    const result = TransitionalProvisionSchema.safeParse(provision)
    expect(result.success).toBe(true)
  })

  it("validates a provision with optional explanationEn", () => {
    const provision = {
      fromRule: "vat-rate-25-old",
      toRule: "vat-rate-25-new",
      cutoffDate: "2025-01-01T00:00:00.000Z",
      logicExpr: "IF invoice_date < cutoff",
      appliesRule: "vat-rate-25-new",
      explanationHr: "Prijelazna odredba...",
      explanationEn: "Transitional provision...",
      pattern: "INVOICE_DATE",
      sourceArticle: "Art. 45",
    }

    const result = TransitionalProvisionSchema.safeParse(provision)
    expect(result.success).toBe(true)
  })

  it("requires fromRule field", () => {
    const provision = {
      toRule: "vat-rate-25-new",
      cutoffDate: "2025-01-01T00:00:00.000Z",
      logicExpr: "IF invoice_date < cutoff",
      appliesRule: "vat-rate-25-new",
      explanationHr: "Test",
      pattern: "INVOICE_DATE",
      sourceArticle: "Art. 45",
    }

    const result = TransitionalProvisionSchema.safeParse(provision)
    expect(result.success).toBe(false)
  })

  it("requires cutoffDate field", () => {
    const provision = {
      fromRule: "vat-rate-25-old",
      toRule: "vat-rate-25-new",
      logicExpr: "IF invoice_date < cutoff",
      appliesRule: "vat-rate-25-new",
      explanationHr: "Test",
      pattern: "INVOICE_DATE",
      sourceArticle: "Art. 45",
    }

    const result = TransitionalProvisionSchema.safeParse(provision)
    expect(result.success).toBe(false)
  })

  it("validates pattern enum values", () => {
    const validPatterns = [
      "INVOICE_DATE",
      "DELIVERY_DATE",
      "PAYMENT_DATE",
      "EARLIER_EVENT",
      "LATER_EVENT",
      "TAXPAYER_CHOICE",
    ]

    for (const pattern of validPatterns) {
      const provision = {
        fromRule: "old",
        toRule: "new",
        cutoffDate: "2025-01-01T00:00:00.000Z",
        logicExpr: "test",
        appliesRule: "new",
        explanationHr: "Test",
        pattern,
        sourceArticle: "Art. 1",
      }
      expect(TransitionalProvisionSchema.safeParse(provision).success).toBe(true)
    }

    const invalidPattern = {
      fromRule: "old",
      toRule: "new",
      cutoffDate: "2025-01-01T00:00:00.000Z",
      logicExpr: "test",
      appliesRule: "new",
      explanationHr: "Test",
      pattern: "INVALID_PATTERN",
      sourceArticle: "Art. 1",
    }
    expect(TransitionalProvisionSchema.safeParse(invalidPattern).success).toBe(false)
  })

  it("validates cutoffDate is ISO datetime format", () => {
    const validDate = {
      fromRule: "old",
      toRule: "new",
      cutoffDate: "2025-01-01T00:00:00.000Z",
      logicExpr: "test",
      appliesRule: "new",
      explanationHr: "Test",
      pattern: "INVOICE_DATE",
      sourceArticle: "Art. 1",
    }
    expect(TransitionalProvisionSchema.safeParse(validDate).success).toBe(true)

    const invalidDate = {
      fromRule: "old",
      toRule: "new",
      cutoffDate: "2025-01-01", // Not ISO datetime
      logicExpr: "test",
      appliesRule: "new",
      explanationHr: "Test",
      pattern: "INVOICE_DATE",
      sourceArticle: "Art. 1",
    }
    expect(TransitionalProvisionSchema.safeParse(invalidDate).success).toBe(false)
  })

  it("requires explanationHr field", () => {
    const provision = {
      fromRule: "old",
      toRule: "new",
      cutoffDate: "2025-01-01T00:00:00.000Z",
      logicExpr: "test",
      appliesRule: "new",
      pattern: "INVOICE_DATE",
      sourceArticle: "Art. 1",
    }

    const result = TransitionalProvisionSchema.safeParse(provision)
    expect(result.success).toBe(false)
  })

  it("requires sourceArticle field", () => {
    const provision = {
      fromRule: "old",
      toRule: "new",
      cutoffDate: "2025-01-01T00:00:00.000Z",
      logicExpr: "test",
      appliesRule: "new",
      explanationHr: "Test",
      pattern: "INVOICE_DATE",
    }

    const result = TransitionalProvisionSchema.safeParse(provision)
    expect(result.success).toBe(false)
  })
})
