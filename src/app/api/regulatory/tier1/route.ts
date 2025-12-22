// src/app/api/regulatory/tier1/route.ts
// API endpoint for Tier 1 Structured Fetchers

import { NextRequest, NextResponse } from "next/server"
import { runTier1Fetchers, getTier1Status } from "@/lib/regulatory-truth/fetchers"
import { createHNBRules } from "@/lib/regulatory-truth/fetchers/hnb-fetcher"
import { fetchNNIssue, getLatestIssueNumber } from "@/lib/regulatory-truth/fetchers/nn-fetcher"
import { fetchKeyEULegislation } from "@/lib/regulatory-truth/fetchers/eurlex-fetcher"

/**
 * GET /api/regulatory/tier1
 * Get status of Tier 1 structured data sources
 */
export async function GET() {
  try {
    const status = await getTier1Status()

    return NextResponse.json({
      tier: 1,
      description: "Structured APIs - 100% reliable, no AI needed",
      sources: {
        hnb: {
          name: "HNB Exchange Rates",
          available: status.hnb.available,
          lastRate: status.hnb.lastRate,
          endpoint: "https://api.hnb.hr/tecajn-eur/v3",
        },
        nn: {
          name: "Narodne novine JSON-LD",
          available: status.nn.available,
          latestIssue: status.nn.latestIssue,
          endpoint: "https://narodne-novine.nn.hr/article_metadata.aspx?format=json-ld",
        },
        eurlex: {
          name: "EUR-Lex Key Legislation",
          available: status.eurlex.available,
          legislationCount: status.eurlex.legislationCount,
          endpoint: "https://eur-lex.europa.eu",
        },
      },
    })
  } catch (error) {
    console.error("[api/regulatory/tier1] GET Error:", error)
    return NextResponse.json({ error: "Failed to get Tier 1 status" }, { status: 500 })
  }
}

/**
 * POST /api/regulatory/tier1
 * Trigger Tier 1 fetchers
 * Body: { source?: "hnb" | "nn" | "eurlex" | "all" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const source = (body.source as string) || "all"

    let result

    switch (source) {
      case "hnb": {
        const hnbResult = await createHNBRules()
        result = {
          source: "hnb",
          success: hnbResult.success,
          rulesCreated: hnbResult.rulesCreated,
          error: hnbResult.error,
        }
        break
      }

      case "nn": {
        const year = new Date().getFullYear()
        const latestIssue = await getLatestIssueNumber(year)
        if (!latestIssue) {
          result = { source: "nn", success: false, error: "Could not find latest issue" }
        } else {
          const nnResult = await fetchNNIssue(year, latestIssue)
          result = {
            source: "nn",
            success: nnResult.success,
            issue: `${year}/${latestIssue}`,
            evidenceCreated: nnResult.evidenceCreated,
            error: nnResult.error,
          }
        }
        break
      }

      case "eurlex": {
        const eurlexResult = await fetchKeyEULegislation()
        result = {
          source: "eurlex",
          success: eurlexResult.errors.length === 0,
          evidenceCreated: eurlexResult.created,
          errors: eurlexResult.errors,
        }
        break
      }

      case "all":
      default: {
        result = await runTier1Fetchers()
        break
      }
    }

    return NextResponse.json({
      triggered: source,
      timestamp: new Date().toISOString(),
      result,
    })
  } catch (error) {
    console.error("[api/regulatory/tier1] POST Error:", error)
    return NextResponse.json({ error: "Failed to run Tier 1 fetchers" }, { status: 500 })
  }
}
