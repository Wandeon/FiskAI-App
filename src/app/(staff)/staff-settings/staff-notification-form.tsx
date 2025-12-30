"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Save, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface StaffNotificationFormProps {
  userId: string
}

export function StaffNotificationForm({ userId: _userId }: StaffNotificationFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Default notification preferences
  // In a production app, these would be loaded from the database
  const [preferences, setPreferences] = useState({
    newAssignments: true,
    newTickets: true,
    clientActivity: false,
    weeklyDigest: true,
    systemUpdates: true,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      // For now, we'll just simulate saving
      // In production, this would call an API endpoint to save preferences
      await new Promise((resolve) => setTimeout(resolve, 500))

      setMessage({ type: "success", text: "Notification preferences updated successfully" })
      router.refresh()
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update preferences",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between py-3">
          <div className="space-y-0.5">
            <Label htmlFor="new-assignments" className="text-base">
              New Assignments
            </Label>
            <p className="text-sm text-tertiary">
              Get notified when you&apos;re assigned to a new client or task
            </p>
          </div>
          <Switch
            id="new-assignments"
            checked={preferences.newAssignments}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, newAssignments: checked })
            }
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="space-y-0.5">
            <Label htmlFor="new-tickets" className="text-base">
              New Support Tickets
            </Label>
            <p className="text-sm text-tertiary">
              Get notified when a client creates a new support ticket
            </p>
          </div>
          <Switch
            id="new-tickets"
            checked={preferences.newTickets}
            onCheckedChange={(checked) => setPreferences({ ...preferences, newTickets: checked })}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="space-y-0.5">
            <Label htmlFor="client-activity" className="text-base">
              Client Activity
            </Label>
            <p className="text-sm text-tertiary">
              Get notified about important client activities (invoices, documents)
            </p>
          </div>
          <Switch
            id="client-activity"
            checked={preferences.clientActivity}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, clientActivity: checked })
            }
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="space-y-0.5">
            <Label htmlFor="weekly-digest" className="text-base">
              Weekly Digest
            </Label>
            <p className="text-sm text-tertiary">
              Receive a weekly summary of your client activities and tasks
            </p>
          </div>
          <Switch
            id="weekly-digest"
            checked={preferences.weeklyDigest}
            onCheckedChange={(checked) => setPreferences({ ...preferences, weeklyDigest: checked })}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="space-y-0.5">
            <Label htmlFor="system-updates" className="text-base">
              System Updates
            </Label>
            <p className="text-sm text-tertiary">
              Get notified about platform updates and maintenance
            </p>
          </div>
          <Switch
            id="system-updates"
            checked={preferences.systemUpdates}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, systemUpdates: checked })
            }
            disabled={isLoading}
          />
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${
            message.type === "success"
              ? "bg-success-bg text-green-800 border border-success-border"
              : "bg-danger-bg text-red-800 border border-danger-border"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Preferences
            </>
          )}
        </Button>
        <p className="text-sm text-tertiary">
          Note: Notification preferences are currently in development
        </p>
      </div>
    </form>
  )
}
