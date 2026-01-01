"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { PremisesCloneDialog } from "./premises-clone-dialog"
import { BulkDevicesDialog } from "./premises-bulk-devices-dialog"
import { bulkTogglePremisesStatus } from "@/lib/premises/bulk-actions"
import { Copy, Power, PowerOff, MoreVertical, Layers } from "lucide-react"
// Local types for premises data (containment: removed @prisma/client import)
interface BusinessPremisesData {
  id: string
  code: number
  name: string
  address: string | null
  isDefault: boolean
  isActive: boolean
}

interface PaymentDeviceData {
  id: string
  name: string
}

interface PremisesCardProps {
  premises: BusinessPremisesData & { devices: PaymentDeviceData[] }
  companyId: string
  isSelected?: boolean
  onSelect?: (id: string, selected: boolean) => void
  children?: ReactNode
}

export function PremisesCard({
  premises,
  companyId,
  isSelected,
  onSelect,
  children,
}: PremisesCardProps) {
  const router = useRouter()
  const [showCloneDialog, setShowCloneDialog] = useState(false)
  const [showBulkDevicesDialog, setShowBulkDevicesDialog] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const [isToggling, setIsToggling] = useState(false)

  const handleToggleStatus = async () => {
    setIsToggling(true)
    const result = await bulkTogglePremisesStatus([premises.id], !premises.isActive)
    setIsToggling(false)

    if (result.success) {
      toast.success(
        premises.isActive ? "Poslovni prostor je deaktiviran" : "Poslovni prostor je aktiviran"
      )
      router.refresh()
    } else {
      toast.error(result.error || "Greska pri promjeni statusa")
    }
  }

  return (
    <>
      <Card
        className={`${premises.isDefault ? "border-success-border" : ""} ${isSelected ? "ring-2 ring-[var(--primary)]" : ""}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {onSelect && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onSelect(premises.id, e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)]"
                />
              )}
              <span className="bg-[var(--surface-secondary)] text-[var(--foreground)] px-3 py-1 rounded-full font-mono font-bold">
                {premises.code}
              </span>
              <div>
                <CardTitle className="text-base">{premises.name}</CardTitle>
                {premises.address && <CardDescription>{premises.address}</CardDescription>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {premises.isDefault && <Badge variant="success">Zadani</Badge>}
              {!premises.isActive && <Badge variant="danger">Neaktivan</Badge>}

              {/* Actions dropdown */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowActions(!showActions)}
                  className="h-8 w-8 p-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {showActions && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-48 rounded-md border bg-[var(--surface)] shadow-lg">
                      <button
                        onClick={() => {
                          setShowActions(false)
                          setShowCloneDialog(true)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface-secondary)]"
                      >
                        <Copy className="h-4 w-4" />
                        Kloniraj prostor
                      </button>
                      <button
                        onClick={() => {
                          setShowActions(false)
                          setShowBulkDevicesDialog(true)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface-secondary)]"
                      >
                        <Layers className="h-4 w-4" />
                        Dodaj vise uredaja
                      </button>
                      <button
                        onClick={() => {
                          setShowActions(false)
                          void handleToggleStatus()
                        }}
                        disabled={isToggling}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--surface-secondary)]"
                      >
                        {premises.isActive ? (
                          <>
                            <PowerOff className="h-4 w-4" />
                            Deaktiviraj
                          </>
                        ) : (
                          <>
                            <Power className="h-4 w-4" />
                            Aktiviraj
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>

      <PremisesCloneDialog
        premisesId={premises.id}
        premisesName={premises.name}
        isOpen={showCloneDialog}
        onClose={() => setShowCloneDialog(false)}
      />

      <BulkDevicesDialog
        companyId={companyId}
        premisesId={premises.id}
        premisesName={premises.name}
        isOpen={showBulkDevicesDialog}
        onClose={() => setShowBulkDevicesDialog(false)}
      />
    </>
  )
}
