'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

interface CreatePremisesInput {
  companyId: string
  code: number
  name: string
  address?: string
  isDefault?: boolean
}

interface CreateDeviceInput {
  companyId: string
  businessPremisesId: string
  code: number
  name: string
  isDefault?: boolean
}

interface ActionResult {
  success: boolean
  error?: string
  data?: unknown
}

export async function createPremises(input: CreatePremisesInput): Promise<ActionResult> {
  try {
    // Validate code is positive
    if (input.code < 1) {
      return { success: false, error: 'Kod mora biti pozitivan broj' }
    }

    // Check for duplicate code
    const existing = await db.businessPremises.findUnique({
      where: {
        companyId_code: {
          companyId: input.companyId,
          code: input.code,
        },
      },
    })

    if (existing) {
      return { success: false, error: `Poslovni prostor s kodom ${input.code} već postoji` }
    }

    // If this should be default, unset other defaults first
    if (input.isDefault) {
      await db.businessPremises.updateMany({
        where: { companyId: input.companyId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const premises = await db.businessPremises.create({
      data: {
        companyId: input.companyId,
        code: input.code,
        name: input.name,
        address: input.address,
        isDefault: input.isDefault ?? false,
        isActive: true,
      },
    })

    revalidatePath('/settings/premises')
    return { success: true, data: premises }
  } catch (error) {
    console.error('Failed to create premises:', error)
    return { success: false, error: 'Greška pri stvaranju poslovnog prostora' }
  }
}

export async function updatePremises(
  id: string,
  input: Partial<Omit<CreatePremisesInput, 'companyId'>>
): Promise<ActionResult> {
  try {
    const existing = await db.businessPremises.findUnique({ where: { id } })
    if (!existing) {
      return { success: false, error: 'Poslovni prostor nije pronađen' }
    }

    // Check for duplicate code if code is being changed
    if (input.code && input.code !== existing.code) {
      const duplicate = await db.businessPremises.findUnique({
        where: {
          companyId_code: {
            companyId: existing.companyId,
            code: input.code,
          },
        },
      })
      if (duplicate) {
        return { success: false, error: `Poslovni prostor s kodom ${input.code} već postoji` }
      }
    }

    // If this should be default, unset other defaults first
    if (input.isDefault) {
      await db.businessPremises.updateMany({
        where: { companyId: existing.companyId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }

    const premises = await db.businessPremises.update({
      where: { id },
      data: input,
    })

    revalidatePath('/settings/premises')
    return { success: true, data: premises }
  } catch (error) {
    console.error('Failed to update premises:', error)
    return { success: false, error: 'Greška pri ažuriranju poslovnog prostora' }
  }
}

export async function deletePremises(id: string): Promise<ActionResult> {
  try {
    // Check if premises has any devices
    const deviceCount = await db.paymentDevice.count({
      where: { businessPremisesId: id },
    })

    if (deviceCount > 0) {
      return {
        success: false,
        error: 'Nije moguće obrisati poslovni prostor koji ima naplatne uređaje',
      }
    }

    // Check if premises has any invoice sequences
    const sequenceCount = await db.invoiceSequence.count({
      where: { businessPremisesId: id },
    })

    if (sequenceCount > 0) {
      return {
        success: false,
        error: 'Nije moguće obrisati poslovni prostor koji ima povijesne račune',
      }
    }

    await db.businessPremises.delete({ where: { id } })

    revalidatePath('/settings/premises')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete premises:', error)
    return { success: false, error: 'Greška pri brisanju poslovnog prostora' }
  }
}

export async function createDevice(input: CreateDeviceInput): Promise<ActionResult> {
  try {
    // Validate code is positive
    if (input.code < 1) {
      return { success: false, error: 'Kod mora biti pozitivan broj' }
    }

    // Check for duplicate code within premises
    const existing = await db.paymentDevice.findUnique({
      where: {
        businessPremisesId_code: {
          businessPremisesId: input.businessPremisesId,
          code: input.code,
        },
      },
    })

    if (existing) {
      return { success: false, error: `Naplatni uređaj s kodom ${input.code} već postoji u ovom poslovnom prostoru` }
    }

    // If this should be default, unset other defaults first
    if (input.isDefault) {
      await db.paymentDevice.updateMany({
        where: { businessPremisesId: input.businessPremisesId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const device = await db.paymentDevice.create({
      data: {
        companyId: input.companyId,
        businessPremisesId: input.businessPremisesId,
        code: input.code,
        name: input.name,
        isDefault: input.isDefault ?? false,
        isActive: true,
      },
    })

    revalidatePath('/settings/premises')
    return { success: true, data: device }
  } catch (error) {
    console.error('Failed to create device:', error)
    return { success: false, error: 'Greška pri stvaranju naplatnog uređaja' }
  }
}

export async function updateDevice(
  id: string,
  input: Partial<Omit<CreateDeviceInput, 'companyId' | 'businessPremisesId'>>
): Promise<ActionResult> {
  try {
    const existing = await db.paymentDevice.findUnique({ where: { id } })
    if (!existing) {
      return { success: false, error: 'Naplatni uređaj nije pronađen' }
    }

    // Check for duplicate code if code is being changed
    if (input.code && input.code !== existing.code) {
      const duplicate = await db.paymentDevice.findUnique({
        where: {
          businessPremisesId_code: {
            businessPremisesId: existing.businessPremisesId,
            code: input.code,
          },
        },
      })
      if (duplicate) {
        return { success: false, error: `Naplatni uređaj s kodom ${input.code} već postoji` }
      }
    }

    // If this should be default, unset other defaults first
    if (input.isDefault) {
      await db.paymentDevice.updateMany({
        where: {
          businessPremisesId: existing.businessPremisesId,
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      })
    }

    const device = await db.paymentDevice.update({
      where: { id },
      data: input,
    })

    revalidatePath('/settings/premises')
    return { success: true, data: device }
  } catch (error) {
    console.error('Failed to update device:', error)
    return { success: false, error: 'Greška pri ažuriranju naplatnog uređaja' }
  }
}

export async function deleteDevice(id: string): Promise<ActionResult> {
  try {
    await db.paymentDevice.delete({ where: { id } })
    revalidatePath('/settings/premises')
    return { success: true }
  } catch (error) {
    console.error('Failed to delete device:', error)
    return { success: false, error: 'Greška pri brisanju naplatnog uređaja' }
  }
}

export async function getDefaultPremisesAndDevice(companyId: string): Promise<{
  premises: { id: string; code: number; name: string } | null
  device: { id: string; code: number; name: string } | null
}> {
  const premises = await db.businessPremises.findFirst({
    where: { companyId, isDefault: true, isActive: true },
    select: { id: true, code: true, name: true },
  })

  if (!premises) {
    return { premises: null, device: null }
  }

  const device = await db.paymentDevice.findFirst({
    where: { businessPremisesId: premises.id, isDefault: true, isActive: true },
    select: { id: true, code: true, name: true },
  })

  return { premises, device }
}
