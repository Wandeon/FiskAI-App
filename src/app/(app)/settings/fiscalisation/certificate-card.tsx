"use client"

import { useState } from "react"
import { FiscalCertificate } from "@prisma/client"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Upload,
  Trash2,
  FileKey,
  AlertTriangle,
} from "lucide-react"
import { deleteCertificateAction } from "@/app/actions/fiscal-certificate"
import { CertificateUploadDialog } from "./certificate-upload-dialog"

interface CertificateCardProps {
  environment: "TEST" | "PROD"
  certificate: FiscalCertificate | null
  companyOib: string
}

export function CertificateCard({ environment, certificate, companyOib }: CertificateCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteCertificateAction(environment)
      if (result.success) {
        setShowDeleteDialog(false)
      } else {
        alert(result.error || "Failed to delete certificate")
      }
    } catch (error) {
      console.error("Delete error:", error)
      alert("Failed to delete certificate")
    } finally {
      setIsDeleting(false)
    }
  }

  const status = getCertificateStatus(certificate)
  const hasOibMismatch = certificate && certificate.oibExtracted !== companyOib

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon(status)}
              <div>
                <CardTitle className="text-lg">
                  {environment === "TEST" ? "Test Certificate" : "Production Certificate"}
                </CardTitle>
                <CardDescription>
                  {environment === "TEST"
                    ? "For testing fiscalisation on FINA test environment"
                    : "For live fiscalisation with Croatian Tax Authority"}
                </CardDescription>
              </div>
            </div>
            {status && (
              <Badge
                variant={
                  status === "active"
                    ? "default"
                    : status === "expired" || status === "revoked"
                      ? "destructive"
                      : "secondary"
                }
                className={
                  status === "active"
                    ? "bg-success hover:bg-success"
                    : status === "expiring-soon"
                      ? "bg-warning hover:bg-warning"
                      : undefined
                }
              >
                {status.replace("-", " ").toUpperCase()}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {certificate ? (
            <>
              {/* OIB Mismatch Warning */}
              {hasOibMismatch && (
                <div className="flex items-start gap-2 rounded-md bg-warning-bg border border-warning-border p-3 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning-icon mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-warning-text">OIB Mismatch</p>
                    <p className="text-warning-text mt-1">
                      Certificate OIB ({certificate.oibExtracted}) does not match company OIB (
                      {companyOib}). Fiscalisation will fail unless OIBs match.
                    </p>
                  </div>
                </div>
              )}

              {/* Certificate Details */}
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-secondary">Subject</div>
                  <div className="col-span-2 font-medium">{certificate.certSubject}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-secondary">OIB</div>
                  <div className="col-span-2 font-medium font-mono">{certificate.oibExtracted}</div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-secondary">Serial</div>
                  <div className="col-span-2 font-medium font-mono text-xs">
                    {certificate.certSerial}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-secondary">Valid From</div>
                  <div className="col-span-2 font-medium">
                    {formatDate(certificate.certNotBefore)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-secondary">Expires</div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatDate(certificate.certNotAfter)}</span>
                      {status === "expiring-soon" && (
                        <span className="text-xs text-warning-text">
                          ({daysUntil(certificate.certNotAfter)} days remaining)
                        </span>
                      )}
                      {status === "expired" && (
                        <span className="text-xs text-danger-text">
                          (expired {Math.abs(daysUntil(certificate.certNotAfter))} days ago)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {certificate.lastUsedAt && (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-secondary">Last Used</div>
                    <div className="col-span-2 font-medium">
                      {formatDateTime(certificate.lastUsedAt)}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUploadDialog(true)}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Replace
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="flex justify-center mb-3">
                <div className="h-12 w-12 rounded-full bg-surface-1 flex items-center justify-center">
                  <FileKey className="h-6 w-6 text-muted" />
                </div>
              </div>
              <p className="text-sm text-secondary mb-4">
                No certificate uploaded for {environment === "TEST" ? "test" : "production"}{" "}
                environment
              </p>
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowUploadDialog(true)}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload Certificate
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <CertificateUploadDialog
        environment={environment}
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 bg-overlay flex items-center justify-center z-50">
          <div className="bg-surface rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-2">Delete Certificate?</h3>
            <p className="text-sm text-secondary mb-4">
              This will permanently delete the {environment === "TEST" ? "test" : "production"}{" "}
              certificate. You will need to upload a new certificate to fiscalize invoices.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Helper Functions

type CertificateStatus = "active" | "expired" | "expiring-soon" | "pending" | "revoked" | null

function getCertificateStatus(certificate: FiscalCertificate | null): CertificateStatus {
  if (!certificate) return null

  if (certificate.status === "REVOKED") return "revoked"
  if (certificate.status === "PENDING") return "pending"

  const now = new Date()
  const expiryDate = new Date(certificate.certNotAfter)
  const daysRemaining = daysUntil(expiryDate)

  if (expiryDate < now) return "expired"
  if (daysRemaining <= 30) return "expiring-soon"
  if (certificate.status === "ACTIVE") return "active"

  return null
}

function getStatusIcon(status: CertificateStatus) {
  switch (status) {
    case "active":
      return <ShieldCheck className="h-5 w-5 text-success-icon" />
    case "expiring-soon":
      return <ShieldAlert className="h-5 w-5 text-warning-icon" />
    case "expired":
    case "revoked":
      return <ShieldAlert className="h-5 w-5 text-danger-icon" />
    default:
      return <Shield className="h-5 w-5 text-muted" />
  }
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function daysUntil(date: Date | string): number {
  const d = typeof date === "string" ? new Date(date) : date
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
