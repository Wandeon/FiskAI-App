"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GitBranch, Calendar, FileText } from "lucide-react"
import type { RuleRelease } from "@prisma/client"
import Link from "next/link"

type ReleaseWithCount = RuleRelease & {
  _count: {
    rules: number
  }
}

interface ReleasesViewProps {
  releases: ReleaseWithCount[]
}

export function ReleasesView({ releases }: ReleasesViewProps) {
  const releaseTypeColors = {
    major: "bg-danger-bg text-danger-text border-danger-border",
    minor: "bg-warning-bg text-warning-text border-warning-border",
    patch: "bg-info-bg text-info-text border-info-border",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rule Releases</h1>
          <p className="text-muted-foreground">Version history of regulatory knowledge base</p>
        </div>
        {releases.length > 0 && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Latest Version</div>
            <div className="text-2xl font-bold">{releases[0].version}</div>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Releases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{releases.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Rules (Latest)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{releases[0]?._count.rules || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Last Released</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {releases[0] ? new Date(releases[0].releasedAt).toLocaleDateString() : "Never"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Releases Timeline */}
      <div className="space-y-4">
        {releases.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No releases yet</p>
            </CardContent>
          </Card>
        ) : (
          releases.map((release, index) => (
            <Card key={release.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-5 w-5" />
                        <span className="text-xl font-bold">{release.version}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          releaseTypeColors[release.releaseType as keyof typeof releaseTypeColors]
                        }
                      >
                        {release.releaseType.toUpperCase()}
                      </Badge>
                      {index === 0 && <Badge variant="default">Latest</Badge>}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Released: {new Date(release.releasedAt).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        {release._count.rules} rules
                      </div>
                      <div>
                        Effective from: {new Date(release.effectiveFrom).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Changelog */}
                {release.changelogHr && (
                  <div>
                    <div className="font-medium mb-2">Changes (Hrvatski):</div>
                    <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                      {release.changelogHr}
                    </div>
                  </div>
                )}

                {release.changelogEn && (
                  <div>
                    <div className="font-medium mb-2">Changes (English):</div>
                    <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                      {release.changelogEn}
                    </div>
                  </div>
                )}

                {/* Audit Trail */}
                {release.auditTrail && (
                  <div className="border-t pt-4">
                    <div className="font-medium mb-2">Audit Trail:</div>
                    <div className="grid gap-2 md:grid-cols-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Evidence:</span>{" "}
                        <span className="font-medium">
                          {(release.auditTrail as any).sourceEvidenceCount || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Source Pointers:</span>{" "}
                        <span className="font-medium">
                          {(release.auditTrail as any).sourcePointerCount || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Reviews:</span>{" "}
                        <span className="font-medium">
                          {(release.auditTrail as any).reviewCount || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Human Approvals:</span>{" "}
                        <span className="font-medium">
                          {(release.auditTrail as any).humanApprovals || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Approvers */}
                {release.approvedBy && release.approvedBy.length > 0 && (
                  <div className="border-t pt-4">
                    <div className="font-medium mb-2">Approved By:</div>
                    <div className="flex gap-2">
                      {release.approvedBy.map((approverId) => (
                        <Badge key={approverId} variant="secondary">
                          {approverId}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Hash */}
                <div className="border-t pt-4">
                  <div className="text-xs text-muted-foreground">
                    Content Hash:{" "}
                    <code className="bg-muted px-1 py-0.5 rounded">{release.contentHash}</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
