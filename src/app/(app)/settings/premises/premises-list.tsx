"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { PremisesCard } from "@/components/settings/premises-card"
import { PremisesImportDialog } from "@/components/settings/premises-import-dialog"
import { DevicesList } from "./devices-list"
import { bulkTogglePremisesStatus } from "@/lib/premises/bulk-actions"
import { Upload, Power, PowerOff, CheckSquare, Square } from "lucide-react"
import type { BusinessPremises, PaymentDevice } from "@prisma/client"

interface PremisesListProps {
  premises: (BusinessPremises & { devices: PaymentDevice[] })[]
  companyId: string
}

export function PremisesList({ premises, companyId }: PremisesListProps) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const hasSelection = selectedIds.size > 0
  const allSelected = selectedIds.size === premises.length

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(premises.map((p) => p.id)))
    }
  }

  const handleSelect = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedIds)
    if (selected) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  const handleBulkActivate = async () => {
    if (selectedIds.size === 0) return
    setIsProcessing(true)

    const result = await bulkTogglePremisesStatus(Array.from(selectedIds), true)
    setIsProcessing(false)

    if (result.success) {
      toast.success(`Aktivirano ${selectedIds.size} poslovnih prostora`)
      setSelectedIds(new Set())
      router.refresh()
    } else {
      toast.error(result.error || "Greska pri aktivaciji")
    }
  }

  const handleBulkDeactivate = async () => {
    if (selectedIds.size === 0) return
    setIsProcessing(true)

    const result = await bulkTogglePremisesStatus(Array.from(selectedIds), false)
    setIsProcessing(false)

    if (result.success) {
      toast.success(`Deaktivirano ${selectedIds.size} poslovnih prostora`)
      setSelectedIds(new Set())
      router.refresh()
    } else {
      toast.error(result.error || "Greska pri deaktivaciji")
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Postojeci poslovni prostori</h2>
          <span className="text-sm text-[var(--muted)]">({premises.length})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Import button */}
          <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Uvezi iz CSV-a
          </Button>

          {/* Bulk selection toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSelectAll}
            title={allSelected ? "Odznaci sve" : "Oznaci sve"}
          >
            {allSelected ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Bulk actions bar */}
      {hasSelection && (
        <div className="flex items-center gap-3 p-3 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg">
          <span className="text-sm font-medium text-[var(--foreground)]">
            {selectedIds.size} odabrano
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkActivate}
              disabled={isProcessing}
            >
              <Power className="mr-2 h-4 w-4" />
              Aktiviraj
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDeactivate}
              disabled={isProcessing}
            >
              <PowerOff className="mr-2 h-4 w-4" />
              Deaktiviraj
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Odustani
            </Button>
          </div>
        </div>
      )}

      {/* Premises cards */}
      <div className="space-y-4">
        {premises.map((p) => (
          <PremisesCard
            key={p.id}
            premises={p}
            companyId={companyId}
            isSelected={selectedIds.has(p.id)}
            onSelect={handleSelect}
          >
            <DevicesList premisesId={p.id} companyId={companyId} devices={p.devices} />
          </PremisesCard>
        ))}
      </div>

      {/* Import dialog */}
      <PremisesImportDialog
        companyId={companyId}
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />
    </div>
  )
}
