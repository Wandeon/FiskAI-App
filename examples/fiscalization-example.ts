/**
 * Croatian Fiscalization Example
 *
 * This file demonstrates how to use the fiscalization system in FiskAI
 */

import {
  calculateZKI,
  validateZKIInput,
  getFiscalProvider,
  type FiscalInvoice,
  type ZKIInput,
} from "@/lib/e-invoice"

/**
 * Example 1: Calculate ZKI for an invoice
 */
async function exampleCalculateZKI() {
  const zkiInput: ZKIInput = {
    oib: "12345678901", // Company OIB (11 digits)
    dateTime: new Date(), // Invoice date/time
    invoiceNumber: "2024/1-1-1", // Invoice number
    premisesCode: "1", // Business premises code
    deviceCode: "1", // Payment device code
    totalAmount: 125000, // Total in cents (1250.00 EUR)
  }

  // Validate input
  const validation = validateZKIInput(zkiInput)
  if (!validation.valid) {
    console.error("Validation errors:", validation.errors)
    return
  }

  // Calculate ZKI
  const zki = calculateZKI(zkiInput)
  console.log("ZKI:", zki)
  // Output: ZKI: a1b2c3d4e5f6...32 characters
}

/**
 * Example 2: Fiscalize an invoice using Mock Provider
 */
async function exampleFiscalizeMock() {
  // Get the mock provider (for development)
  const provider = getFiscalProvider({ provider: "mock" })

  // Prepare invoice data
  const fiscalInvoice: FiscalInvoice = {
    invoiceNumber: "2024/1-1-1",
    zki: "a1b2c3d4e5f6...", // Pre-calculated ZKI
    dateTime: new Date(),
    company: {
      oib: "12345678901",
      name: "Test d.o.o.",
      address: "Ulica Grada Vukovara 269, Zagreb",
    },
    premisesCode: "1",
    deviceCode: "1",
    items: [
      {
        description: "Web Development Services",
        quantity: 10,
        unitPrice: 100,
        vatRate: 25,
        total: 1250,
      },
    ],
    totals: {
      net: 1000,
      vat25: 250,
      vat13: 0,
      vat5: 0,
      vat0: 0,
      total: 1250,
    },
    paymentMethod: "T", // Bank transfer
  }

  // Send to fiscal provider
  const result = await provider.send(fiscalInvoice)

  if (result.success) {
    console.log("✅ Invoice fiscalized!")
    console.log("JIR:", result.jir)
  } else {
    console.error("❌ Fiscalization failed:", result.error)
  }
}

/**
 * Example 3: Check fiscalization status
 */
async function exampleCheckStatus() {
  const provider = getFiscalProvider()

  const jir = "abc123-def456-ghi789"
  const status = await provider.getStatus(jir)

  console.log("Status:", status.status)
  console.log("Fiscalized at:", status.fiscalizedAt)
}

/**
 * Example 4: Test provider connection
 */
async function exampleTestConnection() {
  const provider = getFiscalProvider()

  if (provider.testConnection) {
    const isConnected = await provider.testConnection()
    console.log("Provider connected:", isConnected)
  }
}

/**
 * Example 5: Using IE-Računi Provider (Production)
 */
async function exampleIeRacuni() {
  // Make sure environment variables are set:
  // FISCAL_PROVIDER=ie-racuni
  // IE_RACUNI_API_KEY=your_key
  // IE_RACUNI_SANDBOX=true

  const provider = getFiscalProvider({
    provider: "ie-racuni",
    apiKey: process.env.IE_RACUNI_API_KEY,
    sandbox: true,
  })

  // Test connection first
  if (provider.testConnection) {
    const connected = await provider.testConnection()
    if (!connected) {
      console.error("Cannot connect to IE-Računi")
      return
    }
  }

  // Now fiscalize the invoice
  const fiscalInvoice: FiscalInvoice = {
    // ... same as above
    invoiceNumber: "2024/1-1-1",
    zki: "calculated_zki",
    dateTime: new Date(),
    company: {
      oib: "12345678901",
      name: "Real Company d.o.o.",
      address: "Real Address",
    },
    premisesCode: "1",
    deviceCode: "1",
    items: [
      {
        description: "Service",
        quantity: 1,
        unitPrice: 1000,
        vatRate: 25,
        total: 1250,
      },
    ],
    totals: {
      net: 1000,
      vat25: 250,
      vat13: 0,
      vat5: 0,
      vat0: 0,
      total: 1250,
    },
    paymentMethod: "T",
  }

  const result = await provider.send(fiscalInvoice)

  if (result.success) {
    console.log("✅ Real fiscalization successful!")
    console.log("JIR:", result.jir)
    // Now you must print this JIR on the invoice
  } else {
    console.error("❌ Fiscalization failed:", result.error)
    console.error("Error code:", result.errorCode)
  }
}

/**
 * Example 6: Complete workflow from invoice to fiscalization
 */
async function exampleCompleteWorkflow() {
  // Step 1: Prepare invoice data
  const invoiceData = {
    company: {
      oib: "12345678901",
      name: "My Company d.o.o.",
      address: "Address 123, Zagreb",
    },
    invoiceNumber: "2024/1-1-5",
    dateTime: new Date(),
    premisesCode: "1",
    deviceCode: "1",
    totalAmount: 250000, // 2500.00 EUR
    items: [
      {
        description: "Consulting Services",
        quantity: 20,
        unitPrice: 100,
        vatRate: 25,
        total: 2500,
      },
    ],
  }

  // Step 2: Calculate ZKI
  const zkiInput: ZKIInput = {
    oib: invoiceData.company.oib,
    dateTime: invoiceData.dateTime,
    invoiceNumber: invoiceData.invoiceNumber,
    premisesCode: invoiceData.premisesCode,
    deviceCode: invoiceData.deviceCode,
    totalAmount: invoiceData.totalAmount,
  }

  const validation = validateZKIInput(zkiInput)
  if (!validation.valid) {
    console.error("Invalid data:", validation.errors)
    return
  }

  const zki = calculateZKI(zkiInput)
  console.log("ZKI calculated:", zki)

  // Step 3: Prepare fiscal invoice
  const fiscalInvoice: FiscalInvoice = {
    invoiceNumber: invoiceData.invoiceNumber,
    zki,
    dateTime: invoiceData.dateTime,
    company: invoiceData.company,
    premisesCode: invoiceData.premisesCode,
    deviceCode: invoiceData.deviceCode,
    items: invoiceData.items,
    totals: {
      net: 2000,
      vat25: 500,
      vat13: 0,
      vat5: 0,
      vat0: 0,
      total: 2500,
    },
    paymentMethod: "T",
  }

  // Step 4: Send to fiscal provider
  const provider = getFiscalProvider()
  const result = await provider.send(fiscalInvoice)

  if (result.success) {
    console.log("✅ Complete workflow successful!")
    console.log("Invoice Number:", invoiceData.invoiceNumber)
    console.log("ZKI:", zki)
    console.log("JIR:", result.jir)
    console.log("\n📄 Print this on your invoice:")
    console.log(`ZKI: ${zki}`)
    console.log(`JIR: ${result.jir}`)
  } else {
    console.error("❌ Workflow failed:", result.error)
  }
}

// Run examples
if (require.main === module) {
  console.log("=== Croatian Fiscalization Examples ===\n")

  // Uncomment the example you want to run:
  // exampleCalculateZKI()
  // exampleFiscalizeMock()
  // exampleCheckStatus()
  // exampleTestConnection()
  // exampleIeRacuni()
  exampleCompleteWorkflow()
}
