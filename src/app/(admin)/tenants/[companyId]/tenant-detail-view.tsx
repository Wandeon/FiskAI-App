"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Modal, ModalFooter } from "@/components/ui/modal"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Mail, Gift, Download, Flag, UserPlus, Trash2, Shield, Clock, FileText } from "lucide-react"
import { toast } from "@/lib/toast"
import type { TenantDetail } from "@/lib/admin/tenant-health"

const AVAILABLE_MODULES = [
  { key: "platform-core", name: "Platform Core" },
  { key: "invoicing", name: "Invoicing" },
  { key: "e-invoicing", name: "E-Invoicing" },
  { key: "fiscalization", name: "Fiscalization" },
  { key: "contacts", name: "Contacts" },
  { key: "products", name: "Products" },
  { key: "expenses", name: "Expenses" },
  { key: "banking", name: "Banking" },
  { key: "reconciliation", name: "Reconciliation" },
  { key: "reports-basic", name: "Basic Reports" },
  { key: "reports-advanced", name: "Advanced Reports" },
  { key: "pausalni", name: "Pausalni" },
  { key: "vat", name: "VAT" },
  { key: "corporate-tax", name: "Corporate Tax" },
  { key: "pos", name: "POS" },
  { key: "documents", name: "Documents" },
  { key: "ai-assistant", name: "AI Assistant" },
]

const AVAILABLE_FLAGS = [
  { key: "needs-help", name: "Needs Help", color: "yellow" },
  { key: "at-risk", name: "At Risk", color: "orange" },
  { key: "churning", name: "Churning", color: "red" },
]

const ROLE_OPTIONS = ["OWNER", "ADMIN", "MEMBER", "ACCOUNTANT", "VIEWER"]

interface TenantUser {
  id: string
  userId: string
  email: string
  name: string | null
  role: string
  isDefault: boolean
  joinedAt: Date
  lastActive: Date
}

interface ActivityLog {
  id: string
  action: string
  entity: string
  entityId: string
  changes: Record<string, unknown>
  timestamp: Date
  user: {
    id: string
    email: string
    name: string | null
  } | null
}

interface SubscriptionHistory {
  id: string
  timestamp: Date
  action: string
  changes: {
    status?: { from?: string; to?: string }
    plan?: { from?: string; to?: string }
    periodStart?: string
    periodEnd?: string
    stripeId?: string
  }
  user: {
    id: string
    email: string
    name: string | null
  } | null
}

export function TenantDetailView({ tenant }: { tenant: TenantDetail }) {
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [giftModalOpen, setGiftModalOpen] = useState(false)
  const [flagModalOpen, setFlagModalOpen] = useState(false)
  const [addUserModalOpen, setAddUserModalOpen] = useState(false)
  const [changeRoleModalOpen, setChangeRoleModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Email form state
  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")

  // Gift module state
  const [selectedModule, setSelectedModule] = useState("")

  // Flag state
  const [selectedFlag, setSelectedFlag] = useState("")
  const [flagReason, setFlagReason] = useState("")
  const [flagAction, setFlagAction] = useState<"add" | "remove">("add")

  // User management state
  const [users, setUsers] = useState<TenantUser[]>([])
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserRole, setNewUserRole] = useState("MEMBER")
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null)
  const [newRole, setNewRole] = useState("")

  // Activity log state
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [activityTotal, setActivityTotal] = useState(0)
  const [activityPage, setActivityPage] = useState(0)

  // Subscription history state
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistory[]>([])

  // Fetch users on mount
  useEffect(() => {
    void fetchUsers()
    void fetchActivityLogs()
    void fetchSubscriptionHistory()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch(`/api/admin/tenants/${tenant.profile.id}/users`)
      const data = await response.json()
      if (response.ok) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error("Failed to fetch users:", error)
    }
  }

  const fetchActivityLogs = async (page = 0) => {
    try {
      const response = await fetch(
        `/api/admin/tenants/${tenant.profile.id}/activity?limit=20&offset=${page * 20}`
      )
      const data = await response.json()
      if (response.ok) {
        setActivityLogs(data.logs)
        setActivityTotal(data.total)
        setActivityPage(page)
      }
    } catch (error) {
      console.error("Failed to fetch activity logs:", error)
    }
  }

  const fetchSubscriptionHistory = async () => {
    try {
      const response = await fetch(`/api/admin/tenants/${tenant.profile.id}/subscription-history`)
      const data = await response.json()
      if (response.ok) {
        setSubscriptionHistory(data.history)
      }
    } catch (error) {
      console.error("Failed to fetch subscription history:", error)
    }
  }

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) {
      toast.error("Please fill in all fields")
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/tenants/${tenant.profile.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "email",
          subject: emailSubject,
          body: emailBody,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send email")
      }

      toast.success("Email sent successfully")
      setEmailModalOpen(false)
      setEmailSubject("")
      setEmailBody("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send email")
    } finally {
      setLoading(false)
    }
  }

  const handleGiftModule = async () => {
    if (!selectedModule) {
      toast.error("Please select a module")
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/tenants/${tenant.profile.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "gift-module",
          moduleKey: selectedModule,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to gift module")
      }

      toast.success("Module gifted successfully")
      setGiftModalOpen(false)
      setSelectedModule("")
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to gift module")
    } finally {
      setLoading(false)
    }
  }

  const handleFlag = async () => {
    if (!selectedFlag || !flagReason.trim()) {
      toast.error("Please fill in all fields")
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/tenants/${tenant.profile.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "flag",
          flag: selectedFlag,
          reason: flagReason,
          flagAction,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to update flag")
      }

      toast.success(`Flag ${flagAction === "add" ? "added" : "removed"} successfully`)
      setFlagModalOpen(false)
      setSelectedFlag("")
      setFlagReason("")
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update flag")
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/tenants/${tenant.profile.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export" }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to export data")
      }

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data.data, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `tenant-${tenant.profile.oib}-${new Date().toISOString().split("T")[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success("Data exported successfully")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export data")
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      toast.error("Please enter an email address")
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/tenants/${tenant.profile.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          email: newUserEmail,
          role: newUserRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to add user")
      }

      toast.success("User added successfully")
      setAddUserModalOpen(false)
      setNewUserEmail("")
      setNewUserRole("MEMBER")
      void fetchUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add user")
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveUser = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this user from the company?")) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/tenants/${tenant.profile.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          userId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove user")
      }

      toast.success("User removed successfully")
      void fetchUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove user")
    } finally {
      setLoading(false)
    }
  }

  const handleChangeRole = async () => {
    if (!selectedUser || !newRole) {
      toast.error("Please select a role")
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/tenants/${tenant.profile.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change-role",
          userId: selectedUser.userId,
          role: newRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to change role")
      }

      toast.success("Role changed successfully")
      setChangeRoleModalOpen(false)
      setSelectedUser(null)
      setNewRole("")
      void fetchUsers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to change role")
    } finally {
      setLoading(false)
    }
  }

  const openChangeRoleModal = (user: TenantUser) => {
    setSelectedUser(user)
    setNewRole(user.role)
    setChangeRoleModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tenant.profile.name}</h1>
          <p className="text-muted-foreground">OIB: {tenant.profile.oib}</p>
        </div>
        <div className="flex gap-2">
          {tenant.flags.map((flag) => (
            <Badge key={flag} variant="destructive">
              {flag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Profile */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Legal Form: {tenant.profile.legalForm}</p>
            <p>VAT: {tenant.profile.isVatPayer ? "Yes" : "No"}</p>
            <p>Since: {tenant.profile.createdAt.toLocaleDateString()}</p>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Plan: {tenant.subscription.plan}</p>
            <Badge>{tenant.subscription.status}</Badge>
          </CardContent>
        </Card>

        {/* Owner */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Owner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{tenant.owner?.email || "No owner"}</p>
            <p className="text-muted-foreground">
              Last login: {tenant.owner?.lastLoginAt?.toLocaleDateString() || "Never"}
            </p>
          </CardContent>
        </Card>

        {/* Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              Onboarding:{" "}
              {tenant.health.onboardingComplete
                ? "Complete"
                : `Step ${tenant.health.onboardingStep}`}
            </p>
            <p>Competence: {tenant.health.competenceLevel}</p>
            <p>30-day activity: {tenant.health.thirtyDayActivity} invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* 60k Limit Tracker */}
      <Card>
        <CardHeader>
          <CardTitle>60k Limit Tracker</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Current: €{tenant.limitTracker.currentRevenue.toFixed(2)}</span>
            <span>Limit: €{tenant.limitTracker.limit.toLocaleString()}</span>
          </div>
          <Progress
            value={Math.min(tenant.limitTracker.percentage, 100)}
            className={
              tenant.limitTracker.status === "critical"
                ? "bg-danger-bg"
                : tenant.limitTracker.status === "warning"
                  ? "bg-warning-bg"
                  : ""
            }
          />
          <p className="text-sm text-muted-foreground">
            Projected yearly: €{tenant.limitTracker.projectedYearly.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      {/* User Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Users</CardTitle>
            <Button size="sm" onClick={() => setAddUserModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{user.name || user.email}</p>
                        {user.name && <p className="text-sm text-muted-foreground">{user.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === "OWNER" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(user.joinedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(user.lastActive).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openChangeRoleModal(user)}
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        {user.role !== "OWNER" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveUser(user.userId)}
                            disabled={loading}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity logs found</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.entity}
                        {log.entityId && (
                          <span className="ml-1 text-muted-foreground">
                            ({log.entityId.slice(0, 8)}...)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.user ? log.user.name || log.user.email : "System"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {activityPage * 20 + 1}-{activityPage * 20 + activityLogs.length} of{" "}
                  {activityTotal}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchActivityLogs(activityPage - 1)}
                    disabled={activityPage === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchActivityLogs(activityPage + 1)}
                    disabled={activityPage * 20 + activityLogs.length >= activityTotal}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Subscription History */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription History</CardTitle>
        </CardHeader>
        <CardContent>
          {subscriptionHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscription changes found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Modified By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptionHistory.map((history) => (
                  <TableRow key={history.id}>
                    <TableCell className="text-sm">
                      {new Date(history.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        {history.changes.status && (
                          <div>
                            Status:{" "}
                            <Badge variant="outline">
                              {history.changes.status.from || "none"} →{" "}
                              {history.changes.status.to || "none"}
                            </Badge>
                          </div>
                        )}
                        {history.changes.plan && (
                          <div>
                            Plan:{" "}
                            <Badge variant="outline">
                              {history.changes.plan.from || "none"} →{" "}
                              {history.changes.plan.to || "none"}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {history.user ? history.user.name || history.user.email : "System"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Admin Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEmailModalOpen(true)}>
            <Mail className="mr-2 h-4 w-4" />
            Email
          </Button>
          <Button variant="outline" size="sm" onClick={() => setGiftModalOpen(true)}>
            <Gift className="mr-2 h-4 w-4" />
            Gift Module
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setFlagModalOpen(true)}>
            <Flag className="mr-2 h-4 w-4" />
            Flag
          </Button>
        </CardContent>
      </Card>

      {/* Email Modal */}
      <Modal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        title="Send Email to Tenant"
        description="Send an email to the company owner"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="email-to">To</Label>
            <Input
              id="email-to"
              value={tenant.owner?.email || "No owner"}
              disabled
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Email subject"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Email message"
              rows={6}
              className="mt-1"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setEmailModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSendEmail} disabled={loading}>
            {loading ? "Sending..." : "Send Email"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Gift Module Modal */}
      <Modal
        isOpen={giftModalOpen}
        onClose={() => setGiftModalOpen(false)}
        title="Gift Module to Tenant"
        description="Add a module to the company's entitlements"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="module-select">Select Module</Label>
            <select
              id="module-select"
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="">Choose a module...</option>
              {AVAILABLE_MODULES.filter((m) => !tenant.modules.includes(m.key)).map((module) => (
                <option key={module.key} value={module.key}>
                  {module.name}
                </option>
              ))}
            </select>
          </div>
          {tenant.modules.length > 0 && (
            <div>
              <Label>Current Modules</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {tenant.modules.map((mod) => (
                  <Badge key={mod} variant="secondary">
                    {mod}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setGiftModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGiftModule} disabled={loading}>
            {loading ? "Gifting..." : "Gift Module"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Flag Modal */}
      <Modal
        isOpen={flagModalOpen}
        onClose={() => setFlagModalOpen(false)}
        title="Manage Tenant Flag"
        description="Add or remove a flag from this tenant"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="flag-action">Action</Label>
            <select
              id="flag-action"
              value={flagAction}
              onChange={(e) => setFlagAction(e.target.value as "add" | "remove")}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="add">Add Flag</option>
              <option value="remove">Remove Flag</option>
            </select>
          </div>
          <div>
            <Label htmlFor="flag-select">Select Flag</Label>
            <select
              id="flag-select"
              value={selectedFlag}
              onChange={(e) => setSelectedFlag(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="">Choose a flag...</option>
              {AVAILABLE_FLAGS.map((flag) => (
                <option key={flag.key} value={flag.key}>
                  {flag.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="flag-reason">Reason</Label>
            <Textarea
              id="flag-reason"
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="Why are you adding/removing this flag?"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setFlagModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleFlag} disabled={loading}>
            {loading ? "Updating..." : flagAction === "add" ? "Add Flag" : "Remove Flag"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Add User Modal */}
      <Modal
        isOpen={addUserModalOpen}
        onClose={() => setAddUserModalOpen(false)}
        title="Add User to Company"
        description="Add an existing user to this company"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="user-email">User Email</Label>
            <Input
              id="user-email"
              type="email"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              User must already have an account in the system
            </p>
          </div>
          <div>
            <Label htmlFor="user-role">Role</Label>
            <select
              id="user-role"
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            >
              {ROLE_OPTIONS.filter((r) => r !== "OWNER").map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setAddUserModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddUser} disabled={loading}>
            {loading ? "Adding..." : "Add User"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        isOpen={changeRoleModalOpen}
        onClose={() => setChangeRoleModalOpen(false)}
        title="Change User Role"
        description={`Change role for ${selectedUser?.name || selectedUser?.email}`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="new-role">New Role</Label>
            <select
              id="new-role"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
            >
              {ROLE_OPTIONS.filter((r) => r !== "OWNER" || selectedUser?.role === "OWNER").map(
                (role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                )
              )}
            </select>
            {selectedUser?.role === "OWNER" && (
              <p className="mt-2 text-sm text-warning-icon">
                Warning: Changing the owner role requires transferring ownership first.
              </p>
            )}
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setChangeRoleModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleChangeRole} disabled={loading}>
            {loading ? "Changing..." : "Change Role"}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
