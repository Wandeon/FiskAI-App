// src/app/api/exports/company/route.ts
import { NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { exportCompanyData, validateBackupData, BackupData } from "@/lib/backup/export"
import { logger } from "@/lib/logger"

function escapeXml(str: string | null | undefined): string {
  if (!str) return ""
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return ""
  return date.toISOString().split("T")[0]
}

function formatDecimal(value: any): string {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num.toFixed(2) : "0.00"
}

function buildCompanyXml(data: BackupData): string {
  const contactsXml = data.contacts
    .map(
      (c) => `
      <Contact>
        <Name>${escapeXml(c.name)}</Name>
        <Email>${escapeXml(c.email)}</Email>
        <OIB>${escapeXml(c.oib)}</OIB>
        <Address>${escapeXml(c.address)}</Address>
        <City>${escapeXml(c.city)}</City>
        <PostalCode>${escapeXml(c.postalCode)}</PostalCode>
        <Country>${escapeXml(c.country)}</Country>
      </Contact>`
    )
    .join("")

  const productsXml = data.products
    .map(
      (p) => `
      <Product>
        <Name>${escapeXml(p.name)}</Name>
        <Code>${escapeXml(p.code)}</Code>
        <Description>${escapeXml(p.description)}</Description>
        <Unit>${escapeXml(p.unit)}</Unit>
        <Price>${formatDecimal(p.price)}</Price>
        <VATRate>${formatDecimal(p.vatRate)}</VATRate>
      </Product>`
    )
    .join("")

  const invoicesXml = data.invoices
    .map(
      (inv) => `
      <Invoice>
        <InvoiceNumber>${escapeXml(inv.invoiceNumber)}</InvoiceNumber>
        <IssueDate>${formatDate(inv.issueDate)}</IssueDate>
        <DueDate>${formatDate(inv.dueDate)}</DueDate>
        <Direction>${escapeXml(inv.direction)}</Direction>
        <Type>${escapeXml(inv.type)}</Type>
        <Status>${escapeXml(inv.status)}</Status>
        <NetAmount>${formatDecimal(inv.netAmount)}</NetAmount>
        <VATAmount>${formatDecimal(inv.vatAmount)}</VATAmount>
        <TotalAmount>${formatDecimal(inv.totalAmount)}</TotalAmount>
        <Currency>${escapeXml(inv.currency)}</Currency>
        <Lines>${inv.lines
          .map(
            (line) => `
          <Line>
            <LineNumber>${line.lineNumber}</LineNumber>
            <Description>${escapeXml(line.description)}</Description>
            <Quantity>${formatDecimal(line.quantity)}</Quantity>
            <UnitPrice>${formatDecimal(line.unitPrice)}</UnitPrice>
            <NetAmount>${formatDecimal(line.netAmount)}</NetAmount>
            <VATRate>${formatDecimal(line.vatRate)}</VATRate>
            <VATAmount>${formatDecimal(line.vatAmount)}</VATAmount>
          </Line>`
          )
          .join("")}
        </Lines>
      </Invoice>`
    )
    .join("")

  const expensesXml = data.expenses
    .map(
      (exp) => `
      <Expense>
        <Date>${formatDate(exp.date)}</Date>
        <Description>${escapeXml(exp.description)}</Description>
        <Status>${escapeXml(exp.status)}</Status>
        <NetAmount>${formatDecimal(exp.netAmount)}</NetAmount>
        <VATAmount>${formatDecimal(exp.vatAmount)}</VATAmount>
        <TotalAmount>${formatDecimal(exp.totalAmount)}</TotalAmount>
        <PaymentMethod>${escapeXml(exp.paymentMethod)}</PaymentMethod>
      </Expense>`
    )
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<CompanyBackup xmlns="urn:fiskai:exports:company:1.0">
  <ExportDate>${data.createdAt.toISOString()}</ExportDate>
  <Company>
    <Name>${escapeXml(data.company.name)}</Name>
    <OIB>${escapeXml(data.company.oib)}</OIB>
    <VATNumber>${escapeXml(data.company.vatNumber)}</VATNumber>
    <Address>${escapeXml(data.company.address)}</Address>
    <City>${escapeXml(data.company.city)}</City>
    <PostalCode>${escapeXml(data.company.postalCode)}</PostalCode>
    <Country>${escapeXml(data.company.country)}</Country>
    <IBAN>${escapeXml(data.company.iban)}</IBAN>
  </Company>
  <Contacts count="${data.contacts.length}">${contactsXml}
  </Contacts>
  <Products count="${data.products.length}">${productsXml}
  </Products>
  <Invoices count="${data.invoices.length}">${invoicesXml}
  </Invoices>
  <Expenses count="${data.expenses.length}">${expensesXml}
  </Expenses>
</CompanyBackup>`
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    logger.info(
      {
        userId: user.id,
        companyId: company.id,
        operation: "company_export_request",
      },
      "Company data export requested"
    )

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const includeSensitive = searchParams.get("includeSensitive") === "true"
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const format = (searchParams.get("format") || "json") as "json" | "xml"

    // Determine date range if provided
    let dateRange = undefined
    if (dateFrom && dateTo) {
      dateRange = {
        from: new Date(dateFrom),
        to: new Date(dateTo),
      }

      // Validate date range
      if (isNaN(dateRange.from.getTime()) || isNaN(dateRange.to.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format. Use ISO format (YYYY-MM-DD)" },
          { status: 400 }
        )
      }
    }

    // Export the company data
    const exportData = await exportCompanyData({
      userId: user.id!,
      companyId: company.id,
      includeSensitive,
      dateRange,
    })

    // Validate the exported data
    const validation = validateBackupData(exportData)
    if (!validation.valid) {
      logger.error(
        {
          userId: user.id,
          companyId: company.id,
          validationErrors: validation.errors,
        },
        "Exported data validation failed"
      )

      return NextResponse.json(
        { error: "Export validation failed", details: validation.errors },
        { status: 500 }
      )
    }

    // Create a filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0]
    const safeCompanyName = company.name.replace(/\s+/g, "_")

    let response: Response
    if (format === "xml") {
      const filename = `fiskai-backup-${safeCompanyName}-${timestamp}.xml`
      const xml = buildCompanyXml(exportData)
      response = new Response(xml, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Export-Type": "company-data",
          "X-Company-Id": company.id,
          "X-Export-Timestamp": exportData.createdAt.toISOString(),
        },
      })
    } else {
      // Default: JSON format
      const filename = `fiskai-backup-${safeCompanyName}-${timestamp}.json`
      response = new Response(JSON.stringify(exportData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "X-Export-Type": "company-data",
          "X-Company-Id": company.id,
          "X-Export-Timestamp": exportData.createdAt.toISOString(),
        },
      })
    }

    logger.info(
      {
        userId: user.id,
        companyId: company.id,
        format,
        operation: "company_export_success",
      },
      "Company data export completed successfully"
    )

    return response
  } catch (error) {
    logger.error({ error }, "Company export failed")

    if (error instanceof Error) {
      return NextResponse.json({ error: "Export failed", details: error.message }, { status: 500 })
    }

    return NextResponse.json({ error: "Export failed due to unknown error" }, { status: 500 })
  }
}
