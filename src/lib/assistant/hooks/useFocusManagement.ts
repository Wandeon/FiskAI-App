// src/lib/assistant/hooks/useFocusManagement.ts
import { useEffect, useCallback, useRef, type RefObject } from "react"
import type { ControllerStatus } from "../types"

interface UseFocusManagementProps {
  status: ControllerStatus
  headlineRef: RefObject<HTMLHeadingElement | null>
  inputRef: RefObject<HTMLTextAreaElement | null>
}

export function useFocusManagement({ status, headlineRef, inputRef }: UseFocusManagementProps) {
  const previousStatus = useRef<ControllerStatus>(status)

  const focusHeadline = useCallback(() => {
    headlineRef.current?.focus()
  }, [headlineRef])

  const focusInput = useCallback(() => {
    inputRef.current?.focus()
  }, [inputRef])

  useEffect(() => {
    const prev = previousStatus.current
    previousStatus.current = status

    // Focus headline when answer arrives
    if (
      (prev === "LOADING" || prev === "STREAMING") &&
      (status === "COMPLETE" || status === "PARTIAL_COMPLETE" || status === "ERROR")
    ) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        focusHeadline()
      })
    }

    // Focus input when returning to idle
    if (prev === "COMPLETE" && status === "IDLE") {
      focusInput()
    }
  }, [status, focusHeadline, focusInput])

  return {
    focusHeadline,
    focusInput,
  }
}
