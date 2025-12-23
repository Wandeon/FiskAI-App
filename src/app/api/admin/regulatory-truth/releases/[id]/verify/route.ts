import { NextRequest, NextResponse } from "next/server"
import { verifyReleaseHash } from "@/lib/regulatory-truth/utils/release-hash"
import { db } from "@/lib/db"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const result = await verifyReleaseHash(params.id, db)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Verification failed" },
      { status: 500 }
    )
  }
}
