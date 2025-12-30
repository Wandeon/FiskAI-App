-- Add credit note correction link
ALTER TABLE "EInvoice" ADD COLUMN "correctsInvoiceId" TEXT;
CREATE INDEX "EInvoice_correctsInvoiceId_idx" ON "EInvoice"("correctsInvoiceId");
ALTER TABLE "EInvoice" ADD CONSTRAINT "EInvoice_correctsInvoiceId_fkey" FOREIGN KEY ("correctsInvoiceId") REFERENCES "EInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add VAT rule reference for lines
ALTER TABLE "EInvoiceLine" ADD COLUMN "vatRuleId" TEXT;
CREATE INDEX "EInvoiceLine_vatRuleId_idx" ON "EInvoiceLine"("vatRuleId");
ALTER TABLE "EInvoiceLine" ADD CONSTRAINT "EInvoiceLine_vatRuleId_fkey" FOREIGN KEY ("vatRuleId") REFERENCES "RegulatoryRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create enum for invoice events
CREATE TYPE "InvoiceEventType" AS ENUM ('REVENUE_REGISTERED', 'FISCALIZATION_TRIGGERED');

-- Create revenue register entries
CREATE TABLE "RevenueRegisterEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "vatAmount" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevenueRegisterEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RevenueRegisterEntry_invoiceId_key" ON "RevenueRegisterEntry"("invoiceId");
CREATE INDEX "RevenueRegisterEntry_companyId_idx" ON "RevenueRegisterEntry"("companyId");
CREATE INDEX "RevenueRegisterEntry_issueDate_idx" ON "RevenueRegisterEntry"("issueDate");

ALTER TABLE "RevenueRegisterEntry" ADD CONSTRAINT "RevenueRegisterEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueRegisterEntry" ADD CONSTRAINT "RevenueRegisterEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "EInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create invoice events
CREATE TABLE "InvoiceEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "InvoiceEventType" NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceEvent_invoiceId_type_key" ON "InvoiceEvent"("invoiceId", "type");
CREATE INDEX "InvoiceEvent_companyId_idx" ON "InvoiceEvent"("companyId");
CREATE INDEX "InvoiceEvent_type_idx" ON "InvoiceEvent"("type");

ALTER TABLE "InvoiceEvent" ADD CONSTRAINT "InvoiceEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceEvent" ADD CONSTRAINT "InvoiceEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "EInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
