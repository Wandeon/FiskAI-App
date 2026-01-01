"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { AlertCircle, CheckCircle, Clock, FileText } from "lucide-react"

interface CoverageData {
 summary: {
 total: number
 complete: number
 incomplete: number
 avgScore: number
 byContentType: Record<string, { count: number; avgScore: number }>
 }
 reportsWithIssues: Array<{
 id: string
 evidenceId: string
 evidenceUrl: string
 coverageScore: number
 isComplete: boolean
 missingShapes: string[]
 warnings: string[]
 createdAt: string
 }>
 pendingReviews: Array<{
 id: string
 evidenceId: string
 evidenceUrl: string
 coverageScore: number
 primaryContentType: string | null
 }>
}

export function CoverageDashboard() {
 const [data, setData] = useState<CoverageData | null>(null)
 const [loading, setLoading] = useState(true)
 const [error, setError] = useState<string | null>(null)

 useEffect(() => {
 async function fetchData() {
 try {
 const response = await fetch("/api/admin/regulatory-truth/coverage")
 if (!response.ok) throw new Error("Failed to fetch coverage data")
 const result = await response.json()
 setData(result)
 } catch (err) {
 setError(err instanceof Error ? err.message : "Unknown error")
 } finally {
 setLoading(false)
 }
 }

 void fetchData()
 }, [])

 if (loading) {
 return (
 <div className="flex items-center justify-center py-12">
 <LoadingSpinner />
 </div>
 )
 }

 if (error) {
 return (
 <div className="flex items-center justify-center py-12 text-danger-icon">
 <AlertCircle className="mr-2 h-5 w-5" />
 Error: {error}
 </div>
 )
 }

 if (!data) {
 return (
 <div className="flex items-center justify-center py-12 text-muted-foreground">
 No coverage data available
 </div>
 )
 }

 return (
 <div className="space-y-8">
 {/* Summary Cards */}
 <div className="grid gap-4 md:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Total Evidence</CardTitle>
 <FileText className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{data.summary.total}</div>
 <p className="text-xs text-muted-foreground">With coverage reports</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Complete</CardTitle>
 <CheckCircle className="h-4 w-4 text-success-icon" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-success-icon">{data.summary.complete}</div>
 <p className="text-xs text-muted-foreground">
 {data.summary.total > 0
 ? `${((data.summary.complete / data.summary.total) * 100).toFixed(0)}% of total`
 : "No data"}
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Incomplete</CardTitle>
 <AlertCircle className="h-4 w-4 text-warning-icon" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold text-warning-icon">{data.summary.incomplete}</div>
 <p className="text-xs text-muted-foreground">Needs attention</p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
 <CardTitle className="text-sm font-medium">Avg Coverage</CardTitle>
 <Clock className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">{(data.summary.avgScore * 100).toFixed(0)}%</div>
 <Progress value={data.summary.avgScore * 100} className="mt-2" />
 </CardContent>
 </Card>
 </div>

 {/* By Content Type */}
 <Card>
 <CardHeader>
 <CardTitle>Coverage by Content Type</CardTitle>
 </CardHeader>
 <CardContent>
 {Object.keys(data.summary.byContentType).length === 0 ? (
 <p className="text-center py-4 text-muted-foreground">No content type data available</p>
 ) : (
 <div className="space-y-4">
 {Object.entries(data.summary.byContentType).map(([type, stats]) => (
 <div key={type} className="flex items-center justify-between">
 <div>
 <Badge variant="outline">{type}</Badge>
 <span className="ml-2 text-sm text-muted-foreground">
 {stats.count} evidence record{stats.count !== 1 ? "s" : ""}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium">
 {(stats.avgScore * 100).toFixed(0)}%
 </span>
 <Progress value={stats.avgScore * 100} className="w-24" />
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>

 {/* Issues */}
 <Card>
 <CardHeader>
 <CardTitle>Evidence with Issues ({data.reportsWithIssues.length})</CardTitle>
 </CardHeader>
 <CardContent>
 {data.reportsWithIssues.length === 0 ? (
 <p className="text-center py-4 text-muted-foreground">No issues found</p>
 ) : (
 <div className="space-y-4">
 {data.reportsWithIssues.map((report) => (
 <div key={report.id} className="rounded-lg border p-4">
 <div className="flex items-start justify-between">
 <div className="space-y-1">
 <a
 href={report.evidenceUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="font-medium text-info-icon hover:underline"
 >
 {(() => {
 try {
 return new URL(report.evidenceUrl).hostname
 } catch {
 return report.evidenceUrl
 }
 })()}
 </a>
 <div className="flex flex-wrap gap-2">
 {!report.isComplete && <Badge variant="destructive">Incomplete</Badge>}
 {report.missingShapes.map((shape) => (
 <Badge key={shape} variant="outline">
 Missing: {shape}
 </Badge>
 ))}
 </div>
 </div>
 <div className="text-right">
 <div className="text-lg font-bold">
 {(report.coverageScore * 100).toFixed(0)}%
 </div>
 <div className="text-xs text-muted-foreground">coverage</div>
 </div>
 </div>
 {report.warnings.length > 0 && (
 <div className="mt-2 text-sm text-warning-icon">
 {report.warnings.join("; ")}
 </div>
 )}
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>

 {/* Pending Reviews */}
 <Card>
 <CardHeader>
 <CardTitle>Pending Reviews ({data.pendingReviews.length})</CardTitle>
 </CardHeader>
 <CardContent>
 {data.pendingReviews.length === 0 ? (
 <p className="text-center py-4 text-muted-foreground">No pending reviews</p>
 ) : (
 <div className="space-y-2">
 {data.pendingReviews.map((review) => (
 <div
 key={review.id}
 className="flex items-center justify-between rounded-lg border p-3"
 >
 <div className="flex items-center gap-2">
 <Badge variant="secondary">{review.primaryContentType ?? "UNKNOWN"}</Badge>
 <span className="text-sm">
 {(() => {
 try {
 return new URL(review.evidenceUrl).hostname
 } catch {
 return review.evidenceUrl
 }
 })()}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-sm font-medium">
 {(review.coverageScore * 100).toFixed(0)}%
 </span>
 <Badge variant="outline">Awaiting Review</Badge>
 </div>
 </div>
 ))}
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 )
}
