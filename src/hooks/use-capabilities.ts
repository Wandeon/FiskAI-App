"use client"

import useSWR from "swr"
import { deriveCapabilities, type Capabilities } from "@/lib/capabilities"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export function useCapabilities(initial?: Capabilities) {
  const { data } = useSWR<Capabilities>("/api/capabilities", fetcher, {
    fallbackData: initial,
  })
  return data ?? deriveCapabilities(null)
}
