'use client'

// src/app/(dashboard)/settings/email/components/import-rules.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, X } from 'lucide-react'
import type { EmailImportRule } from '@prisma/client'

interface ImportRulesSectionProps {
  connectionId: string
  rules: EmailImportRule[]
}

export function ImportRulesSection({ connectionId, rules }: ImportRulesSectionProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    senderEmail: '',
    senderDomain: '',
    subjectContains: '',
    filenameContains: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/email/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, ...formData }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create rule')
      }

      setFormData({ senderEmail: '', senderDomain: '', subjectContains: '', filenameContains: '' })
      setShowForm(false)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create rule')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(ruleId: string) {
    setDeleting(ruleId)
    try {
      const response = await fetch(`/api/email/rules/${ruleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete rule')
      }

      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete rule')
    } finally {
      setDeleting(null)
    }
  }

  async function handleToggle(rule: EmailImportRule) {
    try {
      const response = await fetch(`/api/email/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      })

      if (!response.ok) {
        throw new Error('Failed to update rule')
      }

      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update rule')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Import Rules</h4>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 p-3 border rounded-md bg-muted/50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="senderEmail">Sender Email</Label>
              <Input
                id="senderEmail"
                placeholder="statements@bank.com"
                value={formData.senderEmail}
                onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="senderDomain">Sender Domain</Label>
              <Input
                id="senderDomain"
                placeholder="bank.com"
                value={formData.senderDomain}
                onChange={(e) => setFormData({ ...formData, senderDomain: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="subjectContains">Subject Contains</Label>
              <Input
                id="subjectContains"
                placeholder="statement"
                value={formData.subjectContains}
                onChange={(e) => setFormData({ ...formData, subjectContains: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="filenameContains">Filename Contains</Label>
              <Input
                id="filenameContains"
                placeholder=".pdf"
                value={formData.filenameContains}
                onChange={(e) => setFormData({ ...formData, filenameContains: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving...' : 'Add Rule'}
          </Button>
        </form>
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No import rules configured. Add a rule to automatically import matching attachments.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-2 border rounded-md text-sm"
            >
              <div className="flex-1">
                {rule.senderEmail && <span className="mr-2">From: {rule.senderEmail}</span>}
                {rule.senderDomain && <span className="mr-2">Domain: @{rule.senderDomain}</span>}
                {rule.subjectContains && <span className="mr-2">Subject: *{rule.subjectContains}*</span>}
                {rule.filenameContains && <span>File: *{rule.filenameContains}*</span>}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={() => handleToggle(rule)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(rule.id)}
                  disabled={deleting === rule.id}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
