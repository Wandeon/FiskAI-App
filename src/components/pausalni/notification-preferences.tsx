"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Bell, Calendar, Download, Loader2, Mail, CheckCircle2, AlertCircle } from "lucide-react"

interface EmailPreferences {
  enabled: boolean
  remind7Days: boolean
  remind3Days: boolean
  remind1Day: boolean
  remindDayOf: boolean
}

interface CalendarPreferences {
  enabled: boolean
  googleCalendarConnected: boolean
  googleCalendarId: string | null
}

interface NotificationPreferencesProps {
  className?: string
}

export function NotificationPreferences({ className }: NotificationPreferencesProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [emailPrefs, setEmailPrefs] = useState<EmailPreferences>({
    enabled: true,
    remind7Days: true,
    remind3Days: true,
    remind1Day: true,
    remindDayOf: true,
  })
  const [calendarPrefs, setCalendarPrefs] = useState<CalendarPreferences>({
    enabled: false,
    googleCalendarConnected: false,
    googleCalendarId: null,
  })
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")

  useEffect(() => {
    fetchPreferences()
  }, [])

  async function fetchPreferences() {
    try {
      const res = await fetch("/api/pausalni/preferences")
      if (!res.ok) throw new Error("Failed to fetch preferences")
      const data = await res.json()

      setEmailPrefs(data.email)
      setCalendarPrefs(data.calendar)
    } catch (error) {
      console.error("Failed to fetch notification preferences:", error)
      setSaveStatus("error")
    } finally {
      setIsLoading(false)
    }
  }

  async function saveEmailPreferences(updates: Partial<EmailPreferences>) {
    const newPrefs = { ...emailPrefs, ...updates }
    setEmailPrefs(newPrefs)
    setIsSaving(true)
    setSaveStatus("idle")

    try {
      const res = await fetch("/api/pausalni/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "EMAIL",
          ...newPrefs,
        }),
      })

      if (!res.ok) throw new Error("Failed to save preferences")
      setSaveStatus("success")
      setTimeout(() => setSaveStatus("idle"), 2000)
    } catch (error) {
      console.error("Failed to save email preferences:", error)
      setSaveStatus("error")
      // Revert on error
      setEmailPrefs(emailPrefs)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleExportICS() {
    try {
      const res = await fetch("/api/pausalni/calendar/export")
      if (!res.ok) throw new Error("Failed to export calendar")

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "pausalni-obveze.ics"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error("Failed to export ICS:", error)
      setSaveStatus("error")
    }
  }

  async function handleGoogleCalendarConnect() {
    try {
      // Check if Google Calendar sync is available via existing Gmail connection
      const res = await fetch("/api/pausalni/calendar/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setCalendarPrefs((prev) => ({ ...prev, googleCalendarConnected: true }))
          setSaveStatus("success")
          setTimeout(() => setSaveStatus("idle"), 2000)
        } else {
          // Show specific error message
          console.warn("Calendar sync:", data.message || data.errors?.join(", "))
          setSaveStatus("error")
        }
      } else {
        const data = await res.json().catch(() => ({}))
        // If Gmail is not connected, show info message
        console.warn("Calendar sync not available:", data.error || "Unknown error")
        setSaveStatus("error")
      }
    } catch (error) {
      console.error("Failed to connect Google Calendar:", error)
      setSaveStatus("error")
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {/* Email Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <CardTitle>Email obavijesti</CardTitle>
              </div>
              {saveStatus === "success" && (
                <Badge variant="default" className="bg-success">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Spremljeno
                </Badge>
              )}
              {saveStatus === "error" && (
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Greška
                </Badge>
              )}
            </div>
            <CardDescription>
              Primajte obavijesti o nadolazećim obvezama na svoju email adresu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Omogući email obavijesti</p>
                <p className="text-sm text-muted-foreground">
                  Omogući ili onemogući sve email obavijesti
                </p>
              </div>
              <Switch
                checked={emailPrefs.enabled}
                onCheckedChange={(checked) => saveEmailPreferences({ enabled: checked })}
                disabled={isSaving}
              />
            </div>

            {emailPrefs.enabled && (
              <div className="space-y-4 pt-4 border-t">
                <p className="text-sm font-medium text-muted-foreground">Podsjetnici prije roka:</p>

                <div className="flex items-center justify-between">
                  <label htmlFor="remind-7" className="text-sm">
                    7 dana prije roka
                  </label>
                  <Switch
                    id="remind-7"
                    checked={emailPrefs.remind7Days}
                    onCheckedChange={(checked) => saveEmailPreferences({ remind7Days: checked })}
                    disabled={isSaving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label htmlFor="remind-3" className="text-sm">
                    3 dana prije roka
                  </label>
                  <Switch
                    id="remind-3"
                    checked={emailPrefs.remind3Days}
                    onCheckedChange={(checked) => saveEmailPreferences({ remind3Days: checked })}
                    disabled={isSaving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label htmlFor="remind-1" className="text-sm">
                    1 dan prije roka
                  </label>
                  <Switch
                    id="remind-1"
                    checked={emailPrefs.remind1Day}
                    onCheckedChange={(checked) => saveEmailPreferences({ remind1Day: checked })}
                    disabled={isSaving}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label htmlFor="remind-day-of" className="text-sm">
                    Na dan roka
                  </label>
                  <Switch
                    id="remind-day-of"
                    checked={emailPrefs.remindDayOf}
                    onCheckedChange={(checked) => saveEmailPreferences({ remindDayOf: checked })}
                    disabled={isSaving}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Kalendar integracija</CardTitle>
            </div>
            <CardDescription>
              Sinkronizirajte obveze s Google Calendar ili preuzmite ICS datoteku
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google Calendar Sync */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Google Calendar sinkronizacija</p>
                  <p className="text-sm text-muted-foreground">
                    {calendarPrefs.googleCalendarConnected
                      ? "Povezan s Google Calendar"
                      : "Automatski dodaj obveze u Google Calendar"}
                  </p>
                </div>
                {calendarPrefs.googleCalendarConnected ? (
                  <Badge variant="default" className="bg-success">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Povezano
                  </Badge>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleGoogleCalendarConnect}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Poveži
                  </Button>
                )}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="space-y-3">
                <div>
                  <p className="font-medium">Preuzmi ICS datoteku</p>
                  <p className="text-sm text-muted-foreground">
                    Preuzmite kalendar datoteku koju možete uvesti u bilo koji kalendar aplikaciju
                  </p>
                </div>
                <Button variant="secondary" onClick={handleExportICS} className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-2" />
                  Preuzmi ICS datoteku
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Bell className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  <strong>Napomena:</strong> Email obavijesti se šalju automatski na osnovu rokova
                  vaših obveza.
                </p>
                <p>Možete u bilo kojem trenutku promijeniti svoje postavke obavijesti.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
