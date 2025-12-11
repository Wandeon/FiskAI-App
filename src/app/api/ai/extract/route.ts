import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { extractFromImage } from '@/lib/ai/ocr'
import { extractReceipt } from '@/lib/ai/extract'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { image, text } = body

    if (image) {
      // Image extraction (base64)
      // Remove data URL prefix if present
      const base64Image = image.replace(/^data:image\/\w+;base64,/, '')
      const result = await extractFromImage(base64Image)
      return NextResponse.json(result)
    }

    if (text) {
      // Text extraction
      const result = await extractReceipt(text)
      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'No input provided' }, { status: 400 })
  } catch (error) {
    console.error('AI extraction error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Extraction failed' },
      { status: 500 }
    )
  }
}
