// src/lib/shared/queue-contracts/v1/payloads/ocr.ts
/**
 * OCR job payload - scanned PDF text extraction.
 * Queue: ocr
 * Job names: ocr
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * OCR job payload schema.
 */
export const OcrJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Evidence ID to OCR. */
  evidenceId: z.string().min(1),
})

export type OcrJobV1 = z.infer<typeof OcrJobV1Schema>

/**
 * Validate OCR job payload.
 */
export function validateOcrJob(data: unknown): OcrJobV1 {
  return OcrJobV1Schema.parse(data)
}

/**
 * Check if data is a valid OCR job payload.
 */
export function isOcrJobValid(data: unknown): data is OcrJobV1 {
  return OcrJobV1Schema.safeParse(data).success
}
