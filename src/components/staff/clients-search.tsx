"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState, useTransition } from "react"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ClientsSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(searchParams.get("q") || "")

  const handleSearch = useCallback(
    (term: string) => {
      setValue(term)
      startTransition(() => {
        const params = new URLSearchParams(searchParams)
        if (term) {
          params.set("q", term)
        } else {
          params.delete("q")
        }
        router.push(`/clients?${params.toString()}`)
      })
    },
    [router, searchParams]
  )

  const clearSearch = useCallback(() => {
    setValue("")
    startTransition(() => {
      router.push("/clients")
    })
  }, [router])

  return (
    <div className="relative w-64">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search clients..."
        className="pl-9 pr-9"
        value={value}
        onChange={(e) => handleSearch(e.target.value)}
        aria-label="Search clients"
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
          onClick={clearSearch}
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      {isPending && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
