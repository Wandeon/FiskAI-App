"use server"

import { db } from "@/lib/db"
import { requireAuth, requireCompanyWithContext } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const updateSchema = z.object({
  stripeTerminalLocationId: z.string().optional().nullable(),
  stripeTerminalReaderId: z.string().startsWith("tmr_").optional().nullable(),
})

export async function updateTerminalSettings(input: z.infer<typeof updateSchema>) {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async (company) => {
    const validated = updateSchema.parse(input)

    await db.company.update({
      where: { id: company.id },
      data: {
        stripeTerminalLocationId: validated.stripeTerminalLocationId,
        stripeTerminalReaderId: validated.stripeTerminalReaderId,
      },
    })

    revalidatePath("/settings")
    revalidatePath("/settings/terminal")
    revalidatePath("/pos")

    return { success: true }
  })
}

export async function getTerminalSettings() {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async (company) => {
    return {
      stripeTerminalLocationId: company.stripeTerminalLocationId,
      stripeTerminalReaderId: company.stripeTerminalReaderId,
    }
  })
}
