"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
 Flag,
 Plus,
 Search,
 Trash2,
 Edit,
 ToggleLeft,
 ToggleRight,
 Users,
 Building2,
 Globe,
 Percent,
 Clock,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FeatureFlagWithOverrides, FeatureFlagStats } from "@/lib/feature-flags"

interface FeatureFlagsViewProps {
 initialFlags: FeatureFlagWithOverrides[]
 initialStats: FeatureFlagStats
}

export function FeatureFlagsView({ initialFlags, initialStats }: FeatureFlagsViewProps) {
 const router = useRouter()
 const [flags, setFlags] = useState(initialFlags)
 const [stats] = useState(initialStats)
 const [search, setSearch] = useState("")
 const [statusFilter, setStatusFilter] = useState<string>("all")
 const [isCreating, setIsCreating] = useState(false)
 const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ flag: FeatureFlagWithOverrides; reason: string } | null>(null)

 // New flag form state
 const [newFlag, setNewFlag] = useState({
 key: "",
 name: "",
 description: "",
 category: "",
 scope: "GLOBAL" as "GLOBAL" | "TENANT" | "USER",
 })

 const filteredFlags = flags.filter((flag) => {
 const matchesSearch =
 !search ||
 flag.key.toLowerCase().includes(search.toLowerCase()) ||
 flag.name.toLowerCase().includes(search.toLowerCase())
 const matchesStatus = statusFilter === "all" || flag.status === statusFilter
 return matchesSearch && matchesStatus
 })

 const handleCreate = async () => {
 if (!newFlag.key || !newFlag.name) return

 try {
 const res = await fetch("/api/admin/feature-flags", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(newFlag),
 })

 if (!res.ok) {
 const error = await res.json()
 alert(error.error || "Failed to create flag")
 return
 }

 setIsCreating(false)
 setNewFlag({ key: "", name: "", description: "", category: "", scope: "GLOBAL" })
 router.refresh()
 } catch (error) {
 console.error("Failed to create flag:", error)
 }
 }

 const handleToggle = async (flag: FeatureFlagWithOverrides) => {
 const newStatus = flag.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"

 try {
 await fetch(`/api/admin/feature-flags/${flag.id}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ status: newStatus }),
 })

 setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, status: newStatus } : f)))
 } catch (error) {
 console.error("Failed to toggle flag:", error)
 }
 }

 const handleDelete = async (flag: FeatureFlagWithOverrides) => {
 if (!confirm(`Are you sure you want to delete "${flag.name}"?`)) return

 try {
 await fetch(`/api/admin/feature-flags/${flag.id}`, { method: "DELETE" })
 setFlags((prev) => prev.filter((f) => f.id !== flag.id))
 } catch (error) {
 console.error("Failed to delete flag:", error)
 }
 }

 const handleUpdateRollout = async (flag: FeatureFlagWithOverrides, percentage: number) => {
 try {
 await fetch(`/api/admin/feature-flags/${flag.id}`, {
 method: "PATCH",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ rolloutPercentage: percentage }),
 })

 setFlags((prev) =>
 prev.map((f) => (f.id === flag.id ? { ...f, rolloutPercentage: percentage } : f))
 )
 setEditingId(null)
 } catch (error) {
 console.error("Failed to update rollout:", error)
 }
 }

 const getScopeIcon = (scope: string) => {
 switch (scope) {
 case "GLOBAL":
 return <Globe className="h-4 w-4" />
 case "TENANT":
 return <Building2 className="h-4 w-4" />
 case "USER":
 return <Users className="h-4 w-4" />
 default:
 return <Flag className="h-4 w-4" />
 }
 }

 const getStatusBadge = (status: string) => {
 switch (status) {
 case "ACTIVE":
 return <Badge variant="success">Active</Badge>
 case "INACTIVE":
 return <Badge variant="secondary">Inactive</Badge>
 case "ARCHIVED":
 return <Badge variant="warning">Archived</Badge>
 default:
 return <Badge variant="secondary">{status}</Badge>
 }
 }

 return (
 <div className="space-y-6">
 {/* Stats Cards */}
 <div className="grid grid-cols-4 gap-4">
 <div className="rounded-lg border border-default bg-white p-4">
 <div className="text-2xl font-bold text-foreground">{stats.total}</div>
 <div className="text-sm text-tertiary">Total Flags</div>
 </div>
 <div className="rounded-lg border border-success-border bg-success-bg p-4">
 <div className="text-2xl font-bold text-success-text">{stats.active}</div>
 <div className="text-sm text-success-icon">Active</div>
 </div>
 <div className="rounded-lg border border-default bg-surface-1 p-4">
 <div className="text-2xl font-bold text-secondary">{stats.inactive}</div>
 <div className="text-sm text-tertiary">Inactive</div>
 </div>
 <div className="rounded-lg border border-warning-border bg-warning-bg p-4">
 <div className="text-2xl font-bold text-warning-text">{stats.archived}</div>
 <div className="text-sm text-warning-icon">Archived</div>
 </div>
 </div>

 {/* Toolbar */}
 <div className="flex items-center justify-between gap-4">
 <div className="flex items-center gap-4">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
 <Input
 placeholder="Search flags..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 className="w-64 pl-10"
 />
 </div>

 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className="rounded-md border border-default bg-white px-3 py-2 text-sm"
 >
 <option value="all">All Status</option>
 <option value="ACTIVE">Active</option>
 <option value="INACTIVE">Inactive</option>
 <option value="ARCHIVED">Archived</option>
 </select>
 </div>

 <Button onClick={() => setIsCreating(true)}>
 <Plus className="mr-2 h-4 w-4" />
 New Flag
 </Button>
 </div>

 {/* Create Flag Form */}
 {isCreating && (
 <div className="rounded-lg border border-default bg-white p-6">
 <h3 className="mb-4 text-lg font-medium">Create New Feature Flag</h3>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="mb-1 block text-sm font-medium text-secondary">Key</label>
 <Input
 placeholder="feature_key"
 value={newFlag.key}
 onChange={(e) => setNewFlag((prev) => ({ ...prev, key: e.target.value }))}
 />
 <p className="mt-1 text-xs text-tertiary">
 Lowercase letters, numbers, and underscores only
 </p>
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-secondary">Name</label>
 <Input
 placeholder="Feature Name"
 value={newFlag.name}
 onChange={(e) => setNewFlag((prev) => ({ ...prev, name: e.target.value }))}
 />
 </div>
 <div className="col-span-2">
 <label className="mb-1 block text-sm font-medium text-secondary">Description</label>
 <Input
 placeholder="What does this flag control?"
 value={newFlag.description}
 onChange={(e) => setNewFlag((prev) => ({ ...prev, description: e.target.value }))}
 />
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-secondary">Category</label>
 <Input
 placeholder="e.g., ai, billing, ux"
 value={newFlag.category}
 onChange={(e) => setNewFlag((prev) => ({ ...prev, category: e.target.value }))}
 />
 </div>
 <div>
 <label className="mb-1 block text-sm font-medium text-secondary">Scope</label>
 <select
 value={newFlag.scope}
 onChange={(e) =>
 setNewFlag((prev) => ({
 ...prev,
 scope: e.target.value as "GLOBAL" | "TENANT" | "USER",
 }))
 }
 className="w-full rounded-md border border-default bg-white px-3 py-2 text-sm"
 >
 <option value="GLOBAL">Global</option>
 <option value="TENANT">Tenant</option>
 <option value="USER">User</option>
 </select>
 </div>
 </div>
 <div className="mt-4 flex justify-end gap-2">
 <Button variant="outline" onClick={() => setIsCreating(false)}>
 Cancel
 </Button>
 <Button onClick={handleCreate} disabled={!newFlag.key || !newFlag.name}>
 Create Flag
 </Button>
 </div>
 </div>
 )}

 {/* Flags List */}
 <div className="rounded-lg border border-default bg-white">
 <table className="w-full">
 <thead className="border-b border-default bg-surface-1">
 <tr>
 <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
 Flag
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
 Status
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
 Scope
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
 Rollout
 </th>
 <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-tertiary">
 Overrides
 </th>
 <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-tertiary">
 Actions
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 {filteredFlags.map((flag) => (
 <tr key={flag.id} className="hover:bg-surface-1">
 <td className="px-4 py-4">
 <div className="flex items-start gap-3">
 <Flag className="mt-0.5 h-5 w-5 text-secondary" />
 <div>
 <div className="font-medium text-foreground">{flag.name}</div>
 <div className="font-mono text-xs text-tertiary">{flag.key}</div>
 {flag.description && (
 <div className="mt-1 text-sm text-tertiary">{flag.description}</div>
 )}
 {flag.category && (
 <Badge variant="outline" className="mt-1">
 {flag.category}
 </Badge>
 )}
 </div>
 </div>
 </td>
 <td className="px-4 py-4">{getStatusBadge(flag.status)}</td>
 <td className="px-4 py-4">
 <div className="flex items-center gap-2 text-sm text-secondary">
 {getScopeIcon(flag.scope)}
 <span>{flag.scope.toLowerCase()}</span>
 </div>
 </td>
 <td className="px-4 py-4">
 {editingId === flag.id ? (
 <div className="flex items-center gap-2">
 <Input
 type="number"
 min="0"
 max="100"
 defaultValue={flag.rolloutPercentage}
 className="w-20"
 onKeyDown={(e) => {
 if (e.key === "Enter") {
 handleUpdateRollout(flag, parseInt(e.currentTarget.value))
 } else if (e.key === "Escape") {
 setEditingId(null)
 }
 }}
 />
 <span className="text-sm text-tertiary">%</span>
 </div>
 ) : (
 <button
 onClick={() => setEditingId(flag.id)}
 className="flex items-center gap-1 text-sm text-secondary hover:text-foreground"
 >
 <Percent className="h-4 w-4" />
 <span>{flag.rolloutPercentage}%</span>
 </button>
 )}
 </td>
 <td className="px-4 py-4">
 {flag.overrides.length > 0 ? (
 <Badge variant="info">{flag.overrides.length} overrides</Badge>
 ) : (
 <span className="text-sm text-secondary">None</span>
 )}
 </td>
 <td className="px-4 py-4">
 <div className="flex items-center justify-end gap-2">
 <button
 onClick={() => handleToggle(flag)}
 className="rounded p-1 text-secondary hover:bg-surface-1 hover:text-secondary"
 title={flag.status === "ACTIVE" ? "Disable" : "Enable"}
 >
 {flag.status === "ACTIVE" ? (
 <ToggleRight className="h-5 w-5 text-success-icon" />
 ) : (
 <ToggleLeft className="h-5 w-5" />
 )}
 </button>
 <button
 onClick={() => handleDelete(flag)}
 className="rounded p-1 text-secondary hover:bg-danger-bg hover:text-danger-icon"
 title="Delete"
 >
 <Trash2 className="h-5 w-5" />
 </button>
 </div>
 </td>
 </tr>
 ))}
 {filteredFlags.length === 0 && (
 <tr>
 <td colSpan={6} className="px-4 py-12 text-center">
 <Flag className="mx-auto h-12 w-12 text-secondary" />
 <p className="mt-4 text-sm text-tertiary">
 {search || statusFilter !== "all"
 ? "No flags match your filters"
 : "No feature flags yet. Create your first one!"}
 </p>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 )
}
