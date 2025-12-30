import Link from "next/link"
import { requireAdmin } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { getComplianceHealth } from "@/lib/admin/metrics"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata = {
  title: "Compliance Status | Admin | FiskAI",
  description: "Compliance status overview for operational monitoring",
}

const getUniqueCertificates = (
  certificates: Array<{
    id: string
    companyId: string
    certNotAfter: Date
    status: string
    company: { id: string; name: string }
  }>
) => {
  const map = new Map<string, (typeof certificates)[number]>()
  certificates.forEach((certificate) => {
    if (!map.has(certificate.companyId)) {
      map.set(certificate.companyId, certificate)
    }
  })
  return Array.from(map.values())
}

export default async function ComplianceStatusPage() {
  await requireAdmin()

  const now = new Date()
  const thirtyDaysFromNow = new Date()
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const [
    summary,
    expiringCertificatesRaw,
    expiredCertificatesRaw,
    missingCertificates,
    failedRequests,
  ] = await Promise.all([
    getComplianceHealth(),
    db.fiscalCertificate.findMany({
      where: {
        certNotAfter: { gte: now, lte: thirtyDaysFromNow },
      },
      orderBy: { certNotAfter: "asc" },
      include: { company: { select: { id: true, name: true } } },
    }),
    db.fiscalCertificate.findMany({
      where: {
        certNotAfter: { lt: now },
      },
      orderBy: { certNotAfter: "asc" },
      include: { company: { select: { id: true, name: true } } },
    }),
    db.company.findMany({
      where: {
        fiscalCertificates: { none: {} },
        legalForm: { in: ["OBRT_PAUSAL", "OBRT_REAL", "OBRT_VAT"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        legalForm: true,
        createdAt: true,
      },
    }),
    db.fiscalRequest.findMany({
      where: {
        status: "FAILED",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { company: { select: { id: true, name: true } } },
    }),
  ])

  const expiringCertificates = getUniqueCertificates(expiringCertificatesRaw)
  const expiredCertificates = getUniqueCertificates(expiredCertificatesRaw)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Compliance Status</h1>
        <p className="text-sm text-muted-foreground">
          Monitor certificate validity and fiscalization risks across tenants.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.certificatesActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning-icon">
              {summary.certificatesExpiring}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Missing Certificates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-danger-icon">{summary.certificatesMissing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fiscalization Success</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.successRate}%</div>
            <p className="text-xs text-muted-foreground">{summary.fiscalizedToday} today</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expiring Certificates (Next 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {expiringCertificates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No certificates expiring soon.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringCertificates.map((certificate) => (
                  <TableRow key={certificate.id}>
                    <TableCell>
                      <Link
                        href={`/tenants/${certificate.company.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {certificate.company.name}
                      </Link>
                    </TableCell>
                    <TableCell>{certificate.certNotAfter.toLocaleDateString("hr-HR")}</TableCell>
                    <TableCell>
                      <Badge variant="warning">Expiring</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Expired Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          {expiredCertificates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expired certificates found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Expired On</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiredCertificates.map((certificate) => (
                  <TableRow key={certificate.id}>
                    <TableCell>
                      <Link
                        href={`/tenants/${certificate.company.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {certificate.company.name}
                      </Link>
                    </TableCell>
                    <TableCell>{certificate.certNotAfter.toLocaleDateString("hr-HR")}</TableCell>
                    <TableCell>
                      <Badge variant="danger">Expired</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Missing Certificates</CardTitle>
        </CardHeader>
        <CardContent>
          {missingCertificates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No missing certificates.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Legal Form</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missingCertificates.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <Link
                        href={`/tenants/${company.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {company.name}
                      </Link>
                    </TableCell>
                    <TableCell>{company.legalForm}</TableCell>
                    <TableCell>{company.createdAt.toLocaleDateString("hr-HR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Fiscalization Failures (7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          {failedRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent failed requests.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Request</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <Link
                        href={`/tenants/${request.company.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {request.company.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{request.messageType}</span>
                    </TableCell>
                    <TableCell>{request.createdAt.toLocaleDateString("hr-HR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
