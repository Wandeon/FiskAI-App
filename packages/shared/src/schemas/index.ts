import { z } from 'zod';
import { oibSchema } from '../validations/oib';

export * from "./e-invoice"

// Company schemas
export const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  oib: oibSchema,
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default('HR'),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

// Business premises schemas
export const createBusinessPremisesSchema = z.object({
  companyId: z.string().cuid(),
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
});

export type CreateBusinessPremisesInput = z.infer<typeof createBusinessPremisesSchema>;

// Payment device schemas
export const createPaymentDeviceSchema = z.object({
  businessPremisesId: z.string().cuid(),
  code: z.string().min(1, 'Code is required'),
  name: z.string().optional(),
});

export type CreatePaymentDeviceInput = z.infer<typeof createPaymentDeviceSchema>;

// Invoice line schemas
export const invoiceLineSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPriceCents: z.number().int('Price must be in cents'),
  vatRate: z.number().int().min(0).max(100),
});

export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;

// Invoice schemas
export const createInvoiceSchema = z.object({
  companyId: z.string().cuid(),
  businessPremisesId: z.string().cuid(),
  paymentDeviceId: z.string().cuid(),
  contactId: z.string().cuid().optional(),
  issueDate: z.date(),
  dueDate: z.date().optional(),
  deliveryDate: z.date().optional(),
  notes: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, 'At least one line is required'),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

// Contact schemas
export const createContactSchema = z.object({
  companyId: z.string().cuid(),
  type: z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']),
  name: z.string().min(1, 'Name is required'),
  oib: oibSchema.optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().default('HR'),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
