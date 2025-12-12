import { NextResponse } from "next/server"
import { searchCompaniesByName } from "@/lib/oib-lookup"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("query") || ""

  if (query.trim().length < 3) {
    return NextResponse.json({ results: [] })
  }

  const result = await searchCompaniesByName(query.trim())
  if (!result.success) {
    return NextResponse.json({ error: result.error || "Pretraga nije uspjela" }, { status: 400 })
  }

  return NextResponse.json({ results: result.results || [] })
}
