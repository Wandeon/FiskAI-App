"use client"

import { logout } from "@/lib/actions/auth"
import { useTransition } from "react"
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const [isPending, startTransition] = useTransition()

  const handleLogout = () => {
    startTransition(async () => {
      await logout()
    })
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" />
      {isPending ? "Odjavljujem..." : "Odjava"}
    </button>
  )
}
