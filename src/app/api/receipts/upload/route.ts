// src/app/api/receipts/upload/route.ts
// Receipt image upload to R2 storage

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { requireCompany } from '@/lib/auth-utils'
import { uploadToR2, generateR2Key } from '@/lib/r2-client'
import { createHash } from 'crypto'
import { logger } from '@/lib/logger'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const company = await requireCompany(session.user.id)

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Generate content hash for deduplication
    const contentHash = createHash('sha256').update(buffer).digest('hex').substring(0, 16)

    // Generate storage key
    const key = generateR2Key(company.id, contentHash, file.name)

    // Upload to R2
    await uploadToR2(key, buffer, file.type)

    // Generate the URL for accessing the receipt
    // In production, this would be a CDN URL or signed URL
    const receiptUrl = `receipts://${key}`

    logger.info(
      { companyId: company.id, key, size: file.size },
      'Receipt uploaded successfully'
    )

    return NextResponse.json({
      success: true,
      receiptUrl,
      key,
      size: file.size,
      contentType: file.type,
    })
  } catch (error) {
    logger.error({ error }, 'Receipt upload failed')
    return NextResponse.json(
      { error: 'Failed to upload receipt' },
      { status: 500 }
    )
  }
}
