"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/lib/toast"
import { updateExpenseCategory, deleteExpenseCategory } from "@/app/actions/expense"

interface CategoryItemProps {
  category: {
    id: string
    code: string
    name: string
    vatDeductibleDefault: boolean
    _count: { expenses: number }
  }
}

export function CategoryItem({ category }: CategoryItemProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [name, setName] = useState(category.name)
  const [code, setCode] = useState(category.code)
  const [vatDeductible, setVatDeductible] = useState(category.vatDeductibleDefault)

  async function handleSave() {
    const result = await updateExpenseCategory(category.id, {
      name,
      code,
      vatDeductibleDefault: vatDeductible,
    })

    if (result.success) {
      toast.success("Kategorija je ažurirana")
      setIsEditing(false)
      router.refresh()
    } else {
      toast.error(result.error || "Greška pri ažuriranju")
    }
  }

  function handleCancel() {
    setName(category.name)
    setCode(category.code)
    setVatDeductible(category.vatDeductibleDefault)
    setIsEditing(false)
  }

  async function handleDelete() {
    if (!confirm(`Jeste li sigurni da želite obrisati kategoriju "${category.name}"?`)) {
      return
    }

    setIsDeleting(true)
    const result = await deleteExpenseCategory(category.id)
    setIsDeleting(false)

    if (result.success) {
      toast.success("Kategorija je obrisana")
      router.refresh()
    } else {
      toast.error(result.error || "Greška pri brisanju")
    }
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-2 px-3 bg-surface-1 rounded border-2 border-info-border">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono text-sm w-32"
          placeholder="KOD"
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1"
          placeholder="Naziv kategorije"
        />
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            checked={vatDeductible}
            onChange={(e) => setVatDeductible(e.target.checked)}
            className="rounded"
          />
          PDV priznati
        </label>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={handleSave} className="text-success-text">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} className="text-secondary">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-surface-1 rounded hover:bg-surface-1 transition-colors">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm bg-[var(--surface)] px-2 py-0.5 rounded border">
          {category.code}
        </span>
        <span>{category.name}</span>
        <span className="text-xs text-secondary">({category._count.expenses} troškova)</span>
      </div>
      <div className="flex items-center gap-2">
        {category.vatDeductibleDefault ? (
          <span className="text-xs bg-success-bg text-success-text px-2 py-0.5 rounded">
            PDV priznati
          </span>
        ) : (
          <span className="text-xs bg-warning-bg text-warning-text px-2 py-0.5 rounded">
            PDV nepriznati
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(true)}
          className="text-link hover:text-info-text"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isDeleting || category._count.expenses > 0}
          className="text-danger-text hover:text-danger-text disabled:opacity-50"
          title={
            category._count.expenses > 0
              ? "Nije moguće obrisati kategoriju koja ima troškove"
              : "Obriši kategoriju"
          }
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
