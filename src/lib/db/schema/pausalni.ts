import {
  pgTable,
  uuid,
  varchar,
  boolean,
  date,
  timestamp,
  decimal,
  integer,
  jsonb,
  text,
  index,
} from "drizzle-orm/pg-core"

// Note: companyId uses text() because Prisma Company model uses CUIDs, not UUIDs
import { relations } from "drizzle-orm"

// Reference table for Prisma-managed Company (for FK constraints)
// This allows Drizzle tables to reference the Prisma Company table
export const company = pgTable("Company", {
  id: text("id").primaryKey(),
})

// Pausalni profile for each company
export const pausalniProfile = pgTable(
  "pausalni_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: text("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    hasPdvId: boolean("has_pdv_id").default(false),
    pdvId: varchar("pdv_id", { length: 20 }), // HR12345678901 format
    pdvIdSince: date("pdv_id_since"),
    euActive: boolean("eu_active").default(false),
    hokMemberSince: date("hok_member_since"),
    tourismActivity: boolean("tourism_activity").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    companyIdx: index("pausalni_profile_company_idx").on(table.companyId),
  })
)

// Known EU vendors (pre-loaded + learned)
export const euVendor = pgTable(
  "eu_vendor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    namePattern: varchar("name_pattern", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    countryCode: varchar("country_code", { length: 2 }).notNull(),
    vendorType: varchar("vendor_type", { length: 50 }).notNull(),
    isEu: boolean("is_eu").default(true),
    confidenceScore: integer("confidence_score").default(100),
    isSystem: boolean("is_system").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    patternIdx: index("eu_vendor_pattern_idx").on(table.namePattern),
  })
)

// Payment obligations (monthly doprinosi, quarterly porez, etc.)
export const paymentObligation = pgTable(
  "payment_obligation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: text("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    obligationType: varchar("obligation_type", { length: 50 }).notNull(),
    periodMonth: integer("period_month").notNull(),
    periodYear: integer("period_year").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    dueDate: date("due_date").notNull(),
    status: varchar("status", { length: 20 }).default("PENDING").notNull(),
    paidDate: date("paid_date"),
    paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }),
    matchedTransactionId: uuid("matched_transaction_id"),
    matchType: varchar("match_type", { length: 20 }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("payment_obligation_company_status_idx").on(
      table.companyId,
      table.status
    ),
    dueDateIdx: index("payment_obligation_due_date_idx").on(table.dueDate),
  })
)

// EU transactions requiring PDV reporting
export const euTransaction = pgTable(
  "eu_transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: text("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    bankTransactionId: uuid("bank_transaction_id"),
    direction: varchar("direction", { length: 20 }).notNull(), // RECEIVED, PROVIDED
    counterpartyName: varchar("counterparty_name", { length: 255 }),
    counterpartyCountry: varchar("counterparty_country", { length: 2 }),
    counterpartyVatId: varchar("counterparty_vat_id", { length: 20 }),
    transactionDate: date("transaction_date").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("EUR"),
    pdvRate: decimal("pdv_rate", { precision: 4, scale: 2 }).default("25.00"),
    pdvAmount: decimal("pdv_amount", { precision: 10, scale: 2 }),
    reportingMonth: integer("reporting_month").notNull(),
    reportingYear: integer("reporting_year").notNull(),
    vendorId: uuid("vendor_id"),
    detectionMethod: varchar("detection_method", { length: 20 }),
    confidenceScore: integer("confidence_score"),
    userConfirmed: boolean("user_confirmed").default(false),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    reportingIdx: index("eu_transaction_reporting_idx").on(
      table.companyId,
      table.reportingYear,
      table.reportingMonth
    ),
  })
)

// Generated forms history
export const generatedForm = pgTable("generated_form", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: text("company_id")
    .notNull()
    .references(() => company.id, { onDelete: "cascade" }),
  formType: varchar("form_type", { length: 20 }).notNull(), // PDV, PDV_S, ZP, PO_SD
  periodMonth: integer("period_month"),
  periodYear: integer("period_year").notNull(),
  format: varchar("format", { length: 10 }).notNull(), // XML, PDF
  filePath: varchar("file_path", { length: 500 }),
  fileHash: varchar("file_hash", { length: 64 }),
  formData: jsonb("form_data"),
  submittedToPorezna: boolean("submitted_to_porezna").default(false),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow(),
})

// Notification preferences
export const notificationPreference = pgTable("notification_preference", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  channel: varchar("channel", { length: 20 }).notNull(), // EMAIL, PUSH, CALENDAR
  enabled: boolean("enabled").default(true),
  remind7Days: boolean("remind_7_days").default(true),
  remind3Days: boolean("remind_3_days").default(true),
  remind1Day: boolean("remind_1_day").default(true),
  remindDayOf: boolean("remind_day_of").default(true),
  googleCalendarConnected: boolean("google_calendar_connected").default(false),
  googleCalendarId: varchar("google_calendar_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})

// Obligation types enum for reference
export const OBLIGATION_TYPES = {
  DOPRINOSI_MIO_I: "DOPRINOSI_MIO_I",
  DOPRINOSI_MIO_II: "DOPRINOSI_MIO_II",
  DOPRINOSI_ZDRAVSTVENO: "DOPRINOSI_ZDRAVSTVENO",
  POREZ_DOHODAK: "POREZ_DOHODAK",
  PDV: "PDV",
  HOK: "HOK",
  PO_SD: "PO_SD",
} as const

export const OBLIGATION_STATUS = {
  PENDING: "PENDING",
  DUE_SOON: "DUE_SOON",
  OVERDUE: "OVERDUE",
  PAID: "PAID",
  SKIPPED: "SKIPPED",
} as const
