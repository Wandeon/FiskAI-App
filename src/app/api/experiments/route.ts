/**
 * Experiments API - List and Create
 *
 * GET /api/experiments - List all experiments
 * POST /api/experiments - Create new experiment
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { listExperiments, createExperiment } from "@/lib/experiments"
import type { CreateExperimentInput, ExperimentFilters } from "@/lib/experiments/types"
import {
  parseBody,
  parseQuery,
  isValidationError,
  formatValidationError,
} from "@/lib/api/validation"

const experimentFiltersSchema = z.object({
  status: z.enum(["DRAFT", "RUNNING", "PAUSED", "COMPLETED"]).optional(),
  search: z.string().optional(),
  activeOnly: z.coerce.boolean().optional(),
})

const createExperimentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  hypothesis: z.string().optional(),
  trafficPercent: z.number().min(0).max(100).optional(),
  successMetric: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  variants: z
    .array(
      z.object({
        name: z.string().min(1),
        weight: z.number().min(0).max(100).optional(),
        isControl: z.boolean().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can view experiments
    if (session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const filters: ExperimentFilters = {
      status: searchParams.get("status") as any,
      search: searchParams.get("search") || undefined,
      activeOnly: searchParams.get("activeOnly") === "true",
    }

    const experiments = await listExperiments(filters)

    return NextResponse.json({ experiments })
  } catch (error) {
    console.error("Error listing experiments:", error)
    return NextResponse.json({ error: "Failed to list experiments" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admins can create experiments
    if (session.user.systemRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const input: CreateExperimentInput = {
      name: body.name,
      description: body.description,
      hypothesis: body.hypothesis,
      trafficPercent: body.trafficPercent,
      successMetric: body.successMetric,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      variants: body.variants,
    }

    const experiment = await createExperiment(input, session.user.id)

    return NextResponse.json({ experiment }, { status: 201 })
  } catch (error) {
    console.error("Error creating experiment:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create experiment" },
      { status: 400 }
    )
  }
}
