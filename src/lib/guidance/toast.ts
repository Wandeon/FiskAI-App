import { toast as sonnerToast } from "sonner"
import type { HelpDensityConfig } from "./help-density"

export function showSuccessToast(
  message: string,
  options: {
    description?: string
    detailedExplanation?: string
    helpDensity: HelpDensityConfig
  }
) {
  const { description, detailedExplanation, helpDensity } = options
  const { successExplanations } = helpDensity

  switch (successExplanations) {
    case "detailed":
      sonnerToast.success(message, {
        description: detailedExplanation || description,
      })
      break

    case "brief":
      if (description) {
        sonnerToast.success(message, { description })
      } else {
        sonnerToast.success(message)
      }
      break

    case "toast":
      sonnerToast.success(message)
      break

    default:
      sonnerToast.success(message, { description })
  }
}

export const toast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, { description })
  },
  error: (message: string, description?: string) => {
    sonnerToast.error(message, { description })
  },
  info: (message: string, description?: string) => {
    sonnerToast.info(message, { description })
  },
  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, { description })
  },
  loading: (message: string) => {
    return sonnerToast.loading(message)
  },
  dismiss: (id?: string | number) => {
    sonnerToast.dismiss(id)
  },
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string
      success: string
      error: string
    }
  ) => {
    return sonnerToast.promise(promise, messages)
  },
}
