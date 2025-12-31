"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { startRegistration } from "@simplewebauthn/browser"
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/types"
import { Button } from "@/components/ui/button"
import { toast } from "@/lib/toast"
import { Trash2, KeyRound, Plus } from "lucide-react"

interface Passkey {
  id: string
  name: string | null
  createdAt: string
  lastUsedAt: string | null
}

export function PasskeyManager() {
  const router = useRouter()
  const [passkeys, setPasskeys] = useState<Passkey[]>([])
  const [loading, setLoading] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    // Check if WebAuthn is supported
    setIsSupported(
      window?.PublicKeyCredential !== undefined && navigator?.credentials !== undefined
    )

    // Load passkeys
    loadPasskeys()
  }, [])

  async function loadPasskeys() {
    try {
      const response = await fetch("/api/webauthn/passkeys")
      if (response.ok) {
        const data = await response.json()
        setPasskeys(data.passkeys || [])
      }
    } catch (error) {
      console.error("Failed to load passkeys:", error)
    }
  }

  async function handleAddPasskey() {
    if (!isSupported) {
      toast.error("Passkeys nisu podržani u ovom pregledniku")
      return
    }

    setLoading(true)
    try {
      // Start registration
      const startResponse = await fetch("/api/webauthn/register/start", {
        method: "POST",
      })

      if (!startResponse.ok) {
        throw new Error("Failed to start registration")
      }

      const options: PublicKeyCredentialCreationOptionsJSON = await startResponse.json()

      // Prompt user for passkey
      const registrationResponse = await startRegistration(options)

      // Finish registration
      const finishResponse = await fetch("/api/webauthn/register/finish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          response: registrationResponse,
          name: `Passkey ${new Date().toLocaleDateString("hr-HR")}`,
        }),
      })

      if (!finishResponse.ok) {
        throw new Error("Failed to finish registration")
      }

      toast.success("Passkey uspješno dodan")
      await loadPasskeys()
      router.refresh()
    } catch (error) {
      console.error("Passkey registration error:", error)
      if (error instanceof Error && error.name === "NotAllowedError") {
        toast.error("Registracija otkazana")
      } else {
        toast.error("Greška prilikom dodavanja passkeya")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleDeletePasskey(id: string) {
    if (!confirm("Jeste li sigurni da želite obrisati ovaj passkey?")) {
      return
    }

    try {
      const response = await fetch(`/api/webauthn/passkeys/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete passkey")
      }

      toast.success("Passkey obrisan")
      await loadPasskeys()
      router.refresh()
    } catch (error) {
      console.error("Delete passkey error:", error)
      toast.error("Greška prilikom brisanja passkeya")
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "Nikad"
    return new Date(dateString).toLocaleDateString("hr-HR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (!isSupported) {
    return (
      <div className="rounded-md bg-warning-bg p-4">
        <p className="text-sm text-warning-text">
          Passkeys nisu podržani u ovom pregledniku. Molimo koristite noviju verziju Chrome, Safari,
          ili Edge preglednika.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Upravljanje passkeys</h3>
          <p className="text-sm text-tertiary">
            Passkeys omogućuju brzu i sigurnu prijavu bez lozinke
          </p>
        </div>
        <Button onClick={handleAddPasskey} disabled={loading} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Dodaj passkey
        </Button>
      </div>

      {passkeys.length === 0 ? (
        <div className="rounded-md border border-dashed border-default p-8 text-center">
          <KeyRound className="mx-auto h-12 w-12 text-muted" />
          <h3 className="mt-2 text-sm font-medium text-foreground">Nema registriranih passkeya</h3>
          <p className="mt-1 text-sm text-tertiary">Dodajte passkey za brzu i sigurnu prijavu</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200 rounded-md border">
          {passkeys.map((passkey) => (
            <div key={passkey.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <KeyRound className="h-5 w-5 text-muted" />
                <div>
                  <p className="font-medium">{passkey.name || "Passkey"}</p>
                  <p className="text-sm text-tertiary">
                    Kreiran: {formatDate(passkey.createdAt)}
                    {passkey.lastUsedAt && (
                      <>
                        {" • "}
                        Zadnja upotreba: {formatDate(passkey.lastUsedAt)}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDeletePasskey(passkey.id)}
                className="text-danger-text hover:text-danger-text"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
