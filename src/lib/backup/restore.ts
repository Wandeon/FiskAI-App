// src/lib/backup/restore.ts
// Data restore/import utilities for backup restoration

import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { BackupData, validateBackupData } from "./export"

export type RestoreMode = "merge" | "replace"

export interface RestoreOptions {
  companyId: string
  userId: string
  mode: RestoreMode
  skipContacts?: boolean
  skipProducts?: boolean
  skipWarehouses?: boolean
  skipStockItems?: boolean
  skipStockMovements?: boolean
  skipInvoices?: boolean
  skipExpenses?: boolean
}

export interface RestoreResult {
  success: boolean
  mode: RestoreMode
  counts: {
    contacts: { created: number; updated: number; skipped: number }
    products: { created: number; updated: number; skipped: number }
    warehouses: { created: number; updated: number; skipped: number }
    stockItems: { created: number; updated: number; skipped: number }
    stockMovements: { created: number; updated: number; skipped: number }
    invoices: { created: number; updated: number; skipped: number }
    expenses: { created: number; updated: number; skipped: number }
  }
  errors: string[]
  restoredAt: Date
}

/**
 * Restore company data from a backup
 *
 * @param backupData - The backup data to restore
 * @param options - Restore options including mode (merge/replace)
 * @returns RestoreResult with counts and any errors
 */
export async function restoreCompanyData(
  backupData: BackupData,
  options: RestoreOptions
): Promise<RestoreResult> {
  const {
    companyId,
    userId,
    mode,
    skipContacts,
    skipProducts,
    skipWarehouses,
    skipStockItems,
    skipStockMovements,
    skipInvoices,
    skipExpenses,
  } = options

  logger.info(
    { companyId, userId, mode, operation: "data_restore_start" },
    "Starting company data restore"
  )

  // Validate backup data first
  const validation = validateBackupData(backupData)
  if (!validation.valid) {
    throw new Error(`Invalid backup data: ${validation.errors.join(", ")}`)
  }

  // Verify company exists and user has access
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  })

  if (!company) {
    throw new Error(`Company with id ${companyId} not found`)
  }

  const result: RestoreResult = {
    success: false,
    mode,
    counts: {
      contacts: { created: 0, updated: 0, skipped: 0 },
      products: { created: 0, updated: 0, skipped: 0 },
      warehouses: { created: 0, updated: 0, skipped: 0 },
      stockItems: { created: 0, updated: 0, skipped: 0 },
      stockMovements: { created: 0, updated: 0, skipped: 0 },
      invoices: { created: 0, updated: 0, skipped: 0 },
      expenses: { created: 0, updated: 0, skipped: 0 },
    },
    errors: [],
    restoredAt: new Date(),
  }

  const backupProductsById = new Map(backupData.products.map((product) => [product.id, product]))
  const backupWarehousesById = new Map(
    backupData.warehouses.map((warehouse) => [warehouse.id, warehouse])
  )
  const productIdMap = new Map<string, string>()
  const warehouseIdMap = new Map<string, string>()
  const stockItemIdMap = new Map<string, string>()

  try {
    await db.$transaction(async (tx) => {
      // If replace mode, delete existing data first (in reverse order for FK constraints)
      if (mode === "replace") {
        if (!skipExpenses) {
          await tx.expense.deleteMany({ where: { companyId } })
        }
        if (!skipInvoices) {
          // Delete invoice lines first
          await tx.eInvoiceLine.deleteMany({
            where: { eInvoice: { companyId } },
          })
          await tx.eInvoice.deleteMany({ where: { companyId } })
        }
        if (!skipStockMovements) {
          await tx.stockMovement.deleteMany({ where: { companyId } })
        }
        if (!skipStockItems) {
          await tx.stockItem.deleteMany({ where: { companyId } })
        }
        if (!skipWarehouses) {
          await tx.warehouse.deleteMany({ where: { companyId } })
        }
        if (!skipProducts) {
          await tx.product.deleteMany({ where: { companyId } })
        }
        if (!skipContacts) {
          await tx.contact.deleteMany({ where: { companyId } })
        }
      }

      // Restore contacts
      if (!skipContacts && backupData.contacts.length > 0) {
        for (const contact of backupData.contacts) {
          try {
            if (mode === "merge") {
              // Try to find existing by OIB or email
              const existing = await tx.contact.findFirst({
                where: {
                  companyId,
                  OR: [
                    contact.oib ? { oib: contact.oib } : {},
                    contact.email ? { email: contact.email } : {},
                  ].filter((c) => Object.keys(c).length > 0),
                },
              })

              if (existing) {
                await tx.contact.update({
                  where: { id: existing.id },
                  data: {
                    name: contact.name,
                    email: contact.email,
                    phone: contact.phone,
                    address: contact.address,
                    city: contact.city,
                    postalCode: contact.postalCode,
                    country: contact.country,
                  },
                })
                result.counts.contacts.updated++
              } else {
                await tx.contact.create({
                  data: {
                    companyId,
                    type: contact.type ?? "CUSTOMER",
                    name: contact.name,
                    email: contact.email,
                    oib: contact.oib,
                    phone: contact.phone,
                    address: contact.address,
                    city: contact.city,
                    postalCode: contact.postalCode,
                    country: contact.country,
                  },
                })
                result.counts.contacts.created++
              }
            } else {
              // Replace mode - just create
              await tx.contact.create({
                data: {
                  companyId,
                  type: contact.type ?? "CUSTOMER",
                  name: contact.name,
                  email: contact.email,
                  oib: contact.oib,
                  phone: contact.phone,
                  address: contact.address,
                  city: contact.city,
                  postalCode: contact.postalCode,
                  country: contact.country,
                },
              })
              result.counts.contacts.created++
            }
          } catch (err) {
            result.counts.contacts.skipped++
            result.errors.push(
              `Contact "${contact.name}": ${err instanceof Error ? err.message : "Unknown error"}`
            )
          }
        }
      }

      // Restore products
      if (!skipProducts && backupData.products.length > 0) {
        for (const product of backupData.products) {
          try {
            if (mode === "merge") {
              const existing = await tx.product.findFirst({
                where: {
                  companyId,
                  OR: [product.sku ? { sku: product.sku } : {}, { name: product.name }].filter(
                    (c) => Object.keys(c).length > 0
                  ),
                },
              })

              if (existing) {
                const updated = await tx.product.update({
                  where: { id: existing.id },
                  data: {
                    name: product.name,
                    description: product.description,
                    unit: product.unit,
                    price: product.price,
                    vatRate: product.vatRate,
                  },
                })
                productIdMap.set(product.id, updated.id)
                result.counts.products.updated++
              } else {
                const created = await tx.product.create({
                  data: {
                    companyId,
                    name: product.name,
                    sku: product.sku,
                    description: product.description,
                    unit: product.unit,
                    price: product.price,
                    vatRate: product.vatRate,
                  },
                })
                productIdMap.set(product.id, created.id)
                result.counts.products.created++
              }
            } else {
              const created = await tx.product.create({
                data: {
                  companyId,
                  name: product.name,
                  sku: product.sku,
                  description: product.description,
                  unit: product.unit,
                  price: product.price,
                  vatRate: product.vatRate,
                },
              })
              productIdMap.set(product.id, created.id)
              result.counts.products.created++
            }
          } catch (err) {
            result.counts.products.skipped++
            result.errors.push(
              `Product "${product.name}": ${err instanceof Error ? err.message : "Unknown error"}`
            )
          }
        }
      }

      // Restore warehouses
      if (!skipWarehouses && backupData.warehouses.length > 0) {
        for (const warehouse of backupData.warehouses) {
          try {
            if (mode === "merge") {
              const existing = await tx.warehouse.findFirst({
                where: {
                  companyId,
                  OR: [
                    warehouse.code ? { code: warehouse.code } : {},
                    { name: warehouse.name },
                  ].filter((c) => Object.keys(c).length > 0),
                },
              })

              if (existing) {
                const updated = await tx.warehouse.update({
                  where: { id: existing.id },
                  data: {
                    name: warehouse.name,
                    code: warehouse.code,
                    address: warehouse.address,
                    city: warehouse.city,
                    postalCode: warehouse.postalCode,
                    country: warehouse.country,
                    isDefault: warehouse.isDefault,
                  },
                })
                warehouseIdMap.set(warehouse.id, updated.id)
                result.counts.warehouses.updated++
              } else {
                const created = await tx.warehouse.create({
                  data: {
                    companyId,
                    name: warehouse.name,
                    code: warehouse.code,
                    address: warehouse.address,
                    city: warehouse.city,
                    postalCode: warehouse.postalCode,
                    country: warehouse.country,
                    isDefault: warehouse.isDefault,
                  },
                })
                warehouseIdMap.set(warehouse.id, created.id)
                result.counts.warehouses.created++
              }
            } else {
              const created = await tx.warehouse.create({
                data: {
                  companyId,
                  name: warehouse.name,
                  code: warehouse.code,
                  address: warehouse.address,
                  city: warehouse.city,
                  postalCode: warehouse.postalCode,
                  country: warehouse.country,
                  isDefault: warehouse.isDefault,
                },
              })
              warehouseIdMap.set(warehouse.id, created.id)
              result.counts.warehouses.created++
            }
          } catch (err) {
            result.counts.warehouses.skipped++
            result.errors.push(
              `Warehouse "${warehouse.name}": ${err instanceof Error ? err.message : "Unknown error"}`
            )
          }
        }
      }

      // Restore stock items
      if (!skipStockItems && backupData.stockItems.length > 0) {
        for (const stockItem of backupData.stockItems) {
          try {
            const backupProduct = backupProductsById.get(stockItem.productId)
            const backupWarehouse = backupWarehousesById.get(stockItem.warehouseId)
            const mappedProductId = productIdMap.get(stockItem.productId)
            const mappedWarehouseId = warehouseIdMap.get(stockItem.warehouseId)

            const resolvedProductId =
              mappedProductId ??
              (backupProduct?.sku
                ? (
                    await tx.product.findFirst({
                      where: { companyId, sku: backupProduct.sku },
                      select: { id: true },
                    })
                  )?.id
                : (
                    await tx.product.findFirst({
                      where: { companyId, name: backupProduct?.name || "" },
                      select: { id: true },
                    })
                  )?.id)

            const resolvedWarehouseId =
              mappedWarehouseId ??
              (backupWarehouse?.code
                ? (
                    await tx.warehouse.findFirst({
                      where: { companyId, code: backupWarehouse.code },
                      select: { id: true },
                    })
                  )?.id
                : (
                    await tx.warehouse.findFirst({
                      where: { companyId, name: backupWarehouse?.name || "" },
                      select: { id: true },
                    })
                  )?.id)

            if (!resolvedProductId || !resolvedWarehouseId) {
              throw new Error("Missing product or warehouse mapping")
            }

            const existing = await tx.stockItem.findFirst({
              where: {
                companyId,
                warehouseId: resolvedWarehouseId,
                productId: resolvedProductId,
              },
            })

            if (existing) {
              const updated = await tx.stockItem.update({
                where: { id: existing.id },
                data: {
                  quantityOnHand: stockItem.quantityOnHand,
                  averageCost: stockItem.averageCost,
                  lastMovementAt: stockItem.lastMovementAt,
                },
              })
              stockItemIdMap.set(stockItem.id, updated.id)
              result.counts.stockItems.updated++
            } else {
              const created = await tx.stockItem.create({
                data: {
                  companyId,
                  warehouseId: resolvedWarehouseId,
                  productId: resolvedProductId,
                  quantityOnHand: stockItem.quantityOnHand,
                  averageCost: stockItem.averageCost,
                  lastMovementAt: stockItem.lastMovementAt,
                },
              })
              stockItemIdMap.set(stockItem.id, created.id)
              result.counts.stockItems.created++
            }
          } catch (err) {
            result.counts.stockItems.skipped++
            result.errors.push(
              `Stock item "${stockItem.id}": ${err instanceof Error ? err.message : "Unknown error"}`
            )
          }
        }
      }

      // Restore stock movements
      if (!skipStockMovements && backupData.stockMovements.length > 0) {
        for (const movement of backupData.stockMovements) {
          try {
            const backupProduct = backupProductsById.get(movement.productId)
            const backupWarehouse = backupWarehousesById.get(movement.warehouseId)
            const resolvedProductId =
              productIdMap.get(movement.productId) ??
              (backupProduct?.sku
                ? (
                    await tx.product.findFirst({
                      where: { companyId, sku: backupProduct.sku },
                      select: { id: true },
                    })
                  )?.id
                : (
                    await tx.product.findFirst({
                      where: { companyId, name: backupProduct?.name || "" },
                      select: { id: true },
                    })
                  )?.id)

            const resolvedWarehouseId =
              warehouseIdMap.get(movement.warehouseId) ??
              (backupWarehouse?.code
                ? (
                    await tx.warehouse.findFirst({
                      where: { companyId, code: backupWarehouse.code },
                      select: { id: true },
                    })
                  )?.id
                : (
                    await tx.warehouse.findFirst({
                      where: { companyId, name: backupWarehouse?.name || "" },
                      select: { id: true },
                    })
                  )?.id)

            if (!resolvedProductId || !resolvedWarehouseId) {
              throw new Error("Missing product or warehouse mapping")
            }

            const resolvedStockItemId =
              (movement.stockItemId && stockItemIdMap.get(movement.stockItemId)) ||
              (
                await tx.stockItem.findFirst({
                  where: {
                    companyId,
                    warehouseId: resolvedWarehouseId,
                    productId: resolvedProductId,
                  },
                  select: { id: true },
                })
              )?.id

            if (mode === "merge" && movement.referenceNumber) {
              const existing = await tx.stockMovement.findFirst({
                where: {
                  companyId,
                  warehouseId: resolvedWarehouseId,
                  productId: resolvedProductId,
                  referenceNumber: movement.referenceNumber,
                  movementDate: movement.movementDate,
                },
                select: { id: true },
              })
              if (existing) {
                result.counts.stockMovements.skipped++
                continue
              }
            }

            await tx.stockMovement.create({
              data: {
                companyId,
                warehouseId: resolvedWarehouseId,
                productId: resolvedProductId,
                stockItemId: resolvedStockItemId,
                movementType: movement.movementType,
                quantity: movement.quantity,
                unitCost: movement.unitCost,
                movementDate: movement.movementDate,
                referenceNumber: movement.referenceNumber,
              },
            })

            result.counts.stockMovements.created++
          } catch (err) {
            result.counts.stockMovements.skipped++
            result.errors.push(
              `Stock movement "${movement.id}": ${err instanceof Error ? err.message : "Unknown error"}`
            )
          }
        }
      }

      // Restore invoices (with lines)
      if (!skipInvoices && backupData.invoices.length > 0) {
        for (const invoice of backupData.invoices) {
          try {
            if (mode === "merge") {
              const existing = await tx.eInvoice.findFirst({
                where: {
                  companyId,
                  invoiceNumber: invoice.invoiceNumber,
                },
              })

              if (existing) {
                // Update invoice and replace lines
                await tx.eInvoiceLine.deleteMany({
                  where: { eInvoiceId: existing.id },
                })
                await tx.eInvoice.update({
                  where: { id: existing.id },
                  data: {
                    issueDate: invoice.issueDate,
                    dueDate: invoice.dueDate,
                    direction: invoice.direction,
                    type: invoice.type,
                    status: invoice.status,
                    netAmount: invoice.netAmount,
                    vatAmount: invoice.vatAmount,
                    totalAmount: invoice.totalAmount,
                    currency: invoice.currency,
                  },
                })
                // Create new lines
                for (const line of invoice.lines) {
                  await tx.eInvoiceLine.create({
                    data: {
                      eInvoiceId: existing.id,
                      lineNumber: line.lineNumber,
                      description: line.description,
                      quantity: line.quantity,
                      unitPrice: line.unitPrice,
                      netAmount: line.netAmount,
                      vatRate: line.vatRate,
                      vatAmount: line.vatAmount,
                    },
                  })
                }
                result.counts.invoices.updated++
              } else {
                const newInvoice = await tx.eInvoice.create({
                  data: {
                    companyId,
                    invoiceNumber: invoice.invoiceNumber,
                    issueDate: invoice.issueDate,
                    dueDate: invoice.dueDate,
                    direction: invoice.direction,
                    type: invoice.type,
                    status: invoice.status,
                    netAmount: invoice.netAmount,
                    vatAmount: invoice.vatAmount,
                    totalAmount: invoice.totalAmount,
                    currency: invoice.currency,
                  },
                })
                for (const line of invoice.lines) {
                  await tx.eInvoiceLine.create({
                    data: {
                      eInvoiceId: newInvoice.id,
                      lineNumber: line.lineNumber,
                      description: line.description,
                      quantity: line.quantity,
                      unitPrice: line.unitPrice,
                      netAmount: line.netAmount,
                      vatRate: line.vatRate,
                      vatAmount: line.vatAmount,
                    },
                  })
                }
                result.counts.invoices.created++
              }
            } else {
              const newInvoice = await tx.eInvoice.create({
                data: {
                  companyId,
                  invoiceNumber: invoice.invoiceNumber,
                  issueDate: invoice.issueDate,
                  dueDate: invoice.dueDate,
                  direction: invoice.direction,
                  type: invoice.type,
                  status: invoice.status,
                  netAmount: invoice.netAmount,
                  vatAmount: invoice.vatAmount,
                  totalAmount: invoice.totalAmount,
                  currency: invoice.currency,
                },
              })
              for (const line of invoice.lines) {
                await tx.eInvoiceLine.create({
                  data: {
                    eInvoiceId: newInvoice.id,
                    lineNumber: line.lineNumber,
                    description: line.description,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    netAmount: line.netAmount,
                    vatRate: line.vatRate,
                    vatAmount: line.vatAmount,
                  },
                })
              }
              result.counts.invoices.created++
            }
          } catch (err) {
            result.counts.invoices.skipped++
            result.errors.push(
              `Invoice "${invoice.invoiceNumber}": ${err instanceof Error ? err.message : "Unknown error"}`
            )
          }
        }
      }

      // Restore expenses
      if (!skipExpenses && backupData.expenses.length > 0) {
        for (const expense of backupData.expenses) {
          try {
            if (mode === "merge") {
              // For expenses, match by date and description as there's no unique identifier
              const existing = await tx.expense.findFirst({
                where: {
                  companyId,
                  date: expense.date,
                  description: expense.description,
                  totalAmount: expense.totalAmount,
                },
              })

              if (existing) {
                await tx.expense.update({
                  where: { id: existing.id },
                  data: {
                    status: expense.status,
                    netAmount: expense.netAmount,
                    vatAmount: expense.vatAmount,
                    paymentMethod: expense.paymentMethod,
                  },
                })
                result.counts.expenses.updated++
              } else {
                await tx.expense.create({
                  data: {
                    companyId,
                    categoryId: expense.categoryId,
                    date: expense.date,
                    description: expense.description,
                    status: expense.status,
                    netAmount: expense.netAmount,
                    vatAmount: expense.vatAmount,
                    totalAmount: expense.totalAmount,
                    paymentMethod: expense.paymentMethod,
                  },
                })
                result.counts.expenses.created++
              }
            } else {
              await tx.expense.create({
                data: {
                  companyId,
                  categoryId: expense.categoryId,
                  date: expense.date,
                  description: expense.description,
                  status: expense.status,
                  netAmount: expense.netAmount,
                  vatAmount: expense.vatAmount,
                  totalAmount: expense.totalAmount,
                  paymentMethod: expense.paymentMethod,
                },
              })
              result.counts.expenses.created++
            }
          } catch (err) {
            result.counts.expenses.skipped++
            result.errors.push(
              `Expense "${expense.description}": ${err instanceof Error ? err.message : "Unknown error"}`
            )
          }
        }
      }
    })

    result.success = true

    logger.info(
      {
        companyId,
        userId,
        mode,
        counts: result.counts,
        errorCount: result.errors.length,
        operation: "data_restore_complete",
      },
      "Company data restore completed"
    )

    return result
  } catch (error) {
    logger.error({ companyId, userId, error }, "Failed to restore company data")
    throw error
  }
}

/**
 * Parse backup data from JSON string
 */
export function parseBackupJson(jsonString: string): BackupData {
  try {
    const data = JSON.parse(jsonString)

    // Convert date strings back to Date objects
    if (data.createdAt) {
      data.createdAt = new Date(data.createdAt)
    }

    // Convert invoice dates
    if (Array.isArray(data.invoices)) {
      data.invoices = data.invoices.map((inv: any) => ({
        ...inv,
        issueDate: inv.issueDate ? new Date(inv.issueDate) : null,
        dueDate: inv.dueDate ? new Date(inv.dueDate) : null,
        createdAt: inv.createdAt ? new Date(inv.createdAt) : null,
        updatedAt: inv.updatedAt ? new Date(inv.updatedAt) : null,
      }))
    }

    // Convert expense dates
    if (Array.isArray(data.expenses)) {
      data.expenses = data.expenses.map((exp: any) => ({
        ...exp,
        date: exp.date ? new Date(exp.date) : null,
        createdAt: exp.createdAt ? new Date(exp.createdAt) : null,
        updatedAt: exp.updatedAt ? new Date(exp.updatedAt) : null,
      }))
    }

    // Convert contact dates
    if (Array.isArray(data.contacts)) {
      data.contacts = data.contacts.map((contact: any) => ({
        ...contact,
        createdAt: contact.createdAt ? new Date(contact.createdAt) : null,
        updatedAt: contact.updatedAt ? new Date(contact.updatedAt) : null,
      }))
    }

    // Convert product dates
    if (Array.isArray(data.products)) {
      data.products = data.products.map((product: any) => ({
        ...product,
        createdAt: product.createdAt ? new Date(product.createdAt) : null,
        updatedAt: product.updatedAt ? new Date(product.updatedAt) : null,
      }))
    }

    // Convert warehouse dates
    if (Array.isArray(data.warehouses)) {
      data.warehouses = data.warehouses.map((warehouse: any) => ({
        ...warehouse,
        createdAt: warehouse.createdAt ? new Date(warehouse.createdAt) : null,
        updatedAt: warehouse.updatedAt ? new Date(warehouse.updatedAt) : null,
      }))
    }

    // Convert stock item dates
    if (Array.isArray(data.stockItems)) {
      data.stockItems = data.stockItems.map((stockItem: any) => ({
        ...stockItem,
        createdAt: stockItem.createdAt ? new Date(stockItem.createdAt) : null,
        updatedAt: stockItem.updatedAt ? new Date(stockItem.updatedAt) : null,
        lastMovementAt: stockItem.lastMovementAt ? new Date(stockItem.lastMovementAt) : null,
      }))
    }

    // Convert stock movement dates
    if (Array.isArray(data.stockMovements)) {
      data.stockMovements = data.stockMovements.map((movement: any) => ({
        ...movement,
        movementDate: movement.movementDate ? new Date(movement.movementDate) : null,
        createdAt: movement.createdAt ? new Date(movement.createdAt) : null,
      }))
    }

    return data as BackupData
  } catch (error) {
    throw new Error(
      `Failed to parse backup JSON: ${error instanceof Error ? error.message : "Invalid JSON"}`
    )
  }
}
