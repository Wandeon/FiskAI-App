import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser, getCurrentCompany } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { pausalniProfile } from "@/lib/db/schema/pausalni"
import { eq } from "drizzle-orm"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { profileUpdateBodySchema } from "@/app/api/pausalni/_schemas"

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company selected" }, { status: 400 })
    }

    // Check if company is pausalni obrt
    if (company.legalForm !== "OBRT_PAUSAL") {
      return NextResponse.json({ error: "Not a pausalni obrt" }, { status: 400 })
    }

    // Get or create profile
    let profile = await drizzleDb
      .select()
      .from(pausalniProfile)
      .where(eq(pausalniProfile.companyId, company.id))
      .limit(1)

    if (profile.length === 0) {
      // Create default profile
      const newProfile = await drizzleDb
        .insert(pausalniProfile)
        .values({
          companyId: company.id,
          hasPdvId: false,
          euActive: false,
          tourismActivity: false,
        })
        .returning()

      profile = newProfile
    }

    return NextResponse.json({ profile: profile[0] })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching pausalni profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getCurrentCompany(user.id!)
    if (!company) {
      return NextResponse.json({ error: "No company selected" }, { status: 400 })
    }

    if (company.legalForm !== "OBRT_PAUSAL") {
      return NextResponse.json({ error: "Not a pausalni obrt" }, { status: 400 })
    }

    // Parse and validate body
    const { hasPdvId, pdvId, pdvIdSince, euActive, hokMemberSince, tourismActivity } =
      await parseBody(request, profileUpdateBodySchema)

    // Format dates as YYYY-MM-DD strings for drizzle date columns
    const formattedPdvIdSince =
      hasPdvId && pdvIdSince ? new Date(pdvIdSince).toISOString().split("T")[0] : null
    const formattedHokMemberSince = hokMemberSince
      ? new Date(hokMemberSince).toISOString().split("T")[0]
      : null

    const updated = await drizzleDb
      .update(pausalniProfile)
      .set({
        hasPdvId: hasPdvId ?? false,
        pdvId: hasPdvId ? pdvId : null,
        pdvIdSince: formattedPdvIdSince,
        euActive: euActive ?? false,
        hokMemberSince: formattedHokMemberSince,
        tourismActivity: tourismActivity ?? false,
        updatedAt: new Date(),
      })
      .where(eq(pausalniProfile.companyId, company.id))
      .returning()

    if (updated.length === 0) {
      // Create if doesn't exist
      const created = await drizzleDb
        .insert(pausalniProfile)
        .values({
          companyId: company.id,
          hasPdvId: hasPdvId ?? false,
          pdvId: hasPdvId ? pdvId : null,
          pdvIdSince: formattedPdvIdSince,
          euActive: euActive ?? false,
          hokMemberSince: formattedHokMemberSince,
          tourismActivity: tourismActivity ?? false,
        })
        .returning()

      return NextResponse.json({ profile: created[0] })
    }

    return NextResponse.json({ profile: updated[0] })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error updating pausalni profile:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
