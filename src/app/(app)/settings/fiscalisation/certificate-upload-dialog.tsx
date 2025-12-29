"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, CheckCircle2, AlertCircle, Shield, Loader2 } from "lucide-react"
import { Modal, ModalFooter } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  validateCertificateAction,
  saveCertificateAction,
  type CertificateInfo,
} from "@/app/actions/fiscal-certificate"

interface CertificateUploadDialogProps {
  environment: "TEST" | "PROD"
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Step = "upload" | "verify" | "done"

// Helper function to convert ArrayBuffer to Base64 (browser-compatible)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function CertificateUploadDialog({
  environment,
  open,
  onOpenChange,
}: CertificateUploadDialogProps) {
  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState("")
  const [certInfo, setCertInfo] = useState<CertificateInfo | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetState = () => {
    setStep("upload")
    setFile(null)
    setPassword("")
    setCertInfo(null)
    setConfirmed(false)
    setLoading(false)
    setError(null)
  }

  const handleClose = () => {
    if (!loading) {
      resetState()
      onOpenChange(false)
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const droppedFile = acceptedFiles[0]
    if (!droppedFile) return

    // Check file size (max 50KB)
    if (droppedFile.size > 50 * 1024) {
      setError("File too large. Maximum size is 50KB.")
      return
    }

    // Check file extension
    const ext = droppedFile.name.toLowerCase().split(".").pop()
    if (ext !== "p12" && ext !== "pfx") {
      setError("Invalid file type. Please upload a .p12 or .pfx file.")
      return
    }

    setFile(droppedFile)
    setError(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/x-pkcs12": [".p12", ".pfx"],
    },
    maxFiles: 1,
    maxSize: 50 * 1024, // 50KB
    disabled: loading,
  })

  const handleValidate = async () => {
    if (!file || !password) {
      setError("Please select a file and enter the password.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Read file as base64
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer
          const base64 = arrayBufferToBase64(arrayBuffer)

          const result = await validateCertificateAction({
            p12Base64: base64,
            password,
            environment,
          })

          if (result.success) {
            setCertInfo(result.info)
            setStep("verify")
          } else {
            setError(result.error)
          }
        } catch (err) {
          setError("Failed to validate certificate. Please check your file and password.")
        } finally {
          setLoading(false)
        }
      }
      reader.onerror = () => {
        setError("Failed to read file.")
        setLoading(false)
      }
      reader.readAsArrayBuffer(file)
    } catch (err) {
      setError("An unexpected error occurred.")
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!file || !password || !certInfo || !confirmed) {
      setError("Please confirm the certificate details.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Read file as base64
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer
          const base64 = arrayBufferToBase64(arrayBuffer)

          const result = await saveCertificateAction({
            p12Base64: base64,
            password,
            environment,
          })

          if (result.success) {
            setStep("done")
            toast.success(`${environment} certificate uploaded successfully!`)
          } else {
            setError(result.error)
          }
        } catch (err) {
          setError("Failed to save certificate.")
        } finally {
          setLoading(false)
        }
      }
      reader.onerror = () => {
        setError("Failed to read file.")
        setLoading(false)
      }
      reader.readAsArrayBuffer(file)
    } catch (err) {
      setError("An unexpected error occurred.")
      setLoading(false)
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("hr-HR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <Modal
      isOpen={open}
      onClose={handleClose}
      title={`Upload ${environment} Certificate`}
      description={
        step === "upload"
          ? "Upload your P12/PFX certificate file"
          : step === "verify"
            ? "Verify certificate details"
            : "Certificate uploaded successfully"
      }
      size="lg"
      showClose={!loading}
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {(["upload", "verify", "done"] as const).map((s, idx) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors
                  ${
                    step === s
                      ? "border-interactive bg-interactive text-white"
                      : ["verify", "done"].includes(step) &&
                          idx < (["upload", "verify", "done"] as const).indexOf(step)
                        ? "border-success bg-success text-white"
                        : "border-default bg-surface text-muted"
                  }
                `}
              >
                {["verify", "done"].includes(step) &&
                idx < (["upload", "verify", "done"] as const).indexOf(step) ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="text-sm font-medium">{idx + 1}</span>
                )}
              </div>
              {idx < 2 && (
                <div
                  className={`
                    flex-1 h-0.5 mx-2 transition-colors
                    ${
                      ["verify", "done"].includes(step) &&
                      idx < (["upload", "verify", "done"] as const).indexOf(step)
                        ? "bg-success"
                        : "border-subtle"
                    }
                  `}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`
                flex flex-col items-center justify-center px-6 py-12 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                ${
                  isDragActive
                    ? "border-interactive bg-info-bg"
                    : "border-default hover:border-strong bg-surface-1"
                }
                ${loading ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <input {...getInputProps()} />
              <Upload
                className={`h-12 w-12 mb-4 ${isDragActive ? "text-interactive" : "text-muted"}`}
              />
              <p className="text-sm font-medium text-foreground mb-1">
                {isDragActive ? "Drop the file here" : "Drag & drop your certificate"}
              </p>
              <p className="text-xs text-secondary mb-3">or click to browse</p>
              <p className="text-xs text-tertiary">Accepts .p12 and .pfx files (max 50KB)</p>
            </div>

            {/* Selected File */}
            {file && (
              <div className="flex items-center gap-3 p-3 bg-info-bg border border-info-border rounded-lg">
                <Shield className="h-5 w-5 text-info-icon flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-secondary">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            )}

            {/* Password Input */}
            <div>
              <Label htmlFor="password">Certificate Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter certificate password"
                disabled={loading}
                className="mt-1"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-danger-bg border border-danger-border rounded-lg">
                <AlertCircle className="h-5 w-5 text-danger-icon flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-text">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Verify */}
        {step === "verify" && certInfo && (
          <div className="space-y-4">
            <div className="bg-surface-1 rounded-lg p-4 space-y-3">
              <div>
                <Label className="text-xs text-secondary">Subject</Label>
                <p className="text-sm font-medium text-foreground mt-1">{certInfo.subject}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-secondary">OIB</Label>
                  <p className="text-sm font-medium text-foreground mt-1">{certInfo.oib}</p>
                </div>
                <div>
                  <Label className="text-xs text-secondary">Serial Number</Label>
                  <p className="text-sm font-medium text-foreground mt-1">{certInfo.serial}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-secondary">Valid From</Label>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {formatDate(certInfo.notBefore)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-secondary">Valid Until</Label>
                  <p className="text-sm font-medium text-foreground mt-1">
                    {formatDate(certInfo.notAfter)}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-xs text-secondary">Issuer</Label>
                <p className="text-sm font-medium text-foreground mt-1">{certInfo.issuer}</p>
              </div>
            </div>

            {/* Confirmation Checkbox */}
            <div className="flex items-start gap-3 p-4 bg-info-bg border border-info-border rounded-lg">
              <input
                type="checkbox"
                id="confirm"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={loading}
                className="mt-1 h-4 w-4 text-interactive rounded border-default focus:ring-border-focus"
              />
              <label htmlFor="confirm" className="text-sm text-secondary cursor-pointer">
                I confirm that this is the correct {environment} fiscalisation certificate for my
                company
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-danger-bg border border-danger-border rounded-lg">
                <AlertCircle className="h-5 w-5 text-danger-icon flex-shrink-0 mt-0.5" />
                <p className="text-sm text-danger-text">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success-bg mb-4">
              <CheckCircle2 className="h-8 w-8 text-success-icon" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Certificate Uploaded</h3>
            <p className="text-sm text-secondary text-center">
              Your {environment} certificate has been securely stored and is ready to use.
            </p>
          </div>
        )}

        {/* Footer */}
        <ModalFooter>
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleValidate} disabled={!file || !password || loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Next"
                )}
              </Button>
            </>
          )}

          {step === "verify" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload")
                  setCertInfo(null)
                  setConfirmed(false)
                  setError(null)
                }}
                disabled={loading}
              >
                Back
              </Button>
              <Button onClick={handleSave} disabled={!confirmed || loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Certificate"
                )}
              </Button>
            </>
          )}

          {step === "done" && <Button onClick={handleClose}>Close</Button>}
        </ModalFooter>
      </div>
    </Modal>
  )
}
