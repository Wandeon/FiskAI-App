"use client"

import { useCallback } from "react"
import { useGuidance } from "@/contexts/GuidanceContext"
import type { GuidanceCategory } from "@/lib/guidance/constants"
import { showSuccessToast } from "@/lib/guidance/toast"

export function useGuidanceToast(category: GuidanceCategory = "fakturiranje") {
  const { getHelpDensity } = useGuidance()

  const success = useCallback(
    (
      message: string,
      options?: {
        description?: string
        detailedExplanation?: string
      }
    ) => {
      const helpDensity = getHelpDensity(category)
      showSuccessToast(message, {
        description: options?.description,
        detailedExplanation: options?.detailedExplanation,
        helpDensity,
      })
    },
    [getHelpDensity, category]
  )

  return {
    success,
  }
}
