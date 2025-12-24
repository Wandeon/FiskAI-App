// src/lib/assistant/hooks/useRovingTabindex.ts
import { useState, useCallback, type KeyboardEvent } from "react"

interface UseRovingTabindexProps {
  itemCount: number
  initialIndex?: number
  orientation?: "horizontal" | "vertical"
}

export function useRovingTabindex({
  itemCount,
  initialIndex = 0,
  orientation = "horizontal",
}: UseRovingTabindexProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const nextKey = orientation === "horizontal" ? "ArrowRight" : "ArrowDown"
      const prevKey = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp"

      switch (e.key) {
        case nextKey:
          e.preventDefault()
          setActiveIndex((prev) => (prev + 1) % itemCount)
          break
        case prevKey:
          e.preventDefault()
          setActiveIndex((prev) => (prev - 1 + itemCount) % itemCount)
          break
        case "Home":
          e.preventDefault()
          setActiveIndex(0)
          break
        case "End":
          e.preventDefault()
          setActiveIndex(itemCount - 1)
          break
      }
    },
    [itemCount, orientation]
  )

  const getTabIndex = useCallback(
    (index: number) => (index === activeIndex ? 0 : -1),
    [activeIndex]
  )

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
    getTabIndex,
  }
}
