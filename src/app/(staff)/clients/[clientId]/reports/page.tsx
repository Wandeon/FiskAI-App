import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { logStaffAccess, getRequestMetadata } from "@/lib/staff-audit"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
 BarChart3,
 TrendingUp,
 FileText,
 Calendar,
 PieChart,
 ArrowUpRight,
 ArrowDownRight,
} from "lucide-react"
import Link from "next/link"
import { ExportButtons } from "./export-buttons"

interface PageProps {
 params: Promise<{ clientId: string }>
}

async function getClientReportData(companyId: string) {
 const now = new Date()
 const startOfYear = new Date(now.getFullYear(), 0, 1)
 const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
 const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
 const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

 const [company, yearlyRevenue, monthlyRevenue, lastMonthRevenue, expenseTotal] =
 await Promise.all([
 db.company.findUnique({
 where: { id: companyId },
 select: {
 id: true,
 name: true,
 legalForm: true,
 isVatPayer: true,
 entitlements: true,
 },
 }),
 db.eInvoice.aggregate({
 where: {
 companyId,
 status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
 issueDate: { gte: startOfYear },
 },
 _sum: { totalAmount: true, vatAmount: true },
 _count: { id: true },
 }),
 db.eInvoice.aggregate({
 where: {
 companyId,
 status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
 issueDate: { gte: startOfMonth },
 },
 _sum: { totalAmount: true },
 _count: { id: true },
 }),
 db.eInvoice.aggregate({
 where: {
 companyId,
 status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
 issueDate: { gte: startOfLastMonth, lte: endOfLastMonth },
 },
 _sum: { totalAmount: true },
 }),
 db.document.aggregate({
 where: {
 companyId,
 category: "expense",
 uploadedAt: { gte: startOfYear },
 },
 _sum: { totalAmount: true },
 _count: { id: true },
 }),
 ])

 return { company, yearlyRevenue, monthlyRevenue, lastMonthRevenue, expenseTotal }
}

export default async function ClientReportsPage({ params }: PageProps) {
 const { clientId } = await params
 const session = await auth()

 if (!session?.user) {
 redirect("/login")
 }

 const { company, yearlyRevenue, monthlyRevenue, lastMonthRevenue, expenseTotal } =
 await getClientReportData(clientId)

 const reqHeaders = await headers()
 const { ipAddress, userAgent } = getRequestMetadata(reqHeaders)
 logStaffAccess({
 staffUserId: session.user.id,
 clientCompanyId: clientId,
 action: "STAFF_VIEW_REPORTS",
 resourceType: "Report",
 metadata: {
 companyName: company?.name,
 legalForm: company?.legalForm,
 },
 ipAddress,
 userAgent,
 })

 const ytdRevenue = Number(yearlyRevenue._sum.totalAmount || 0)
 const ytdVat = Number(yearlyRevenue._sum.vatAmount || 0)
 const thisMonthRevenue = Number(monthlyRevenue._sum.totalAmount || 0)
 const prevMonthRevenue = Number(lastMonthRevenue._sum.totalAmount || 0)
 const ytdExpenses = Number(expenseTotal._sum.totalAmount || 0)

 const monthChange =
 prevMonthRevenue > 0 ? ((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0

 const isPausalni = company?.legalForm === "OBRT_PAUSAL"

 const availableReports = [
 {
 id: "kpr",
 name: "KPR Report",
 description: "Knjiga primitaka i izdataka",
 icon: FileText,
 available: true,
 },
 {
 id: "vat",
 name: "VAT Report",
 description: "PDV prijava",
 icon: PieChart,
 available: company?.isVatPayer,
 },
 {
 id: "pausalni",
 name: "PO-SD Report",
 description: "Pausalni obrt godisnje izvjesce",
 icon: Calendar,
 available: isPausalni,
 },
 {
 id: "profit-loss",
 name: "Profit & Loss",
 description: "Income statement",
 icon: TrendingUp,
 available: true,
 },
 {
 id: "aging",
 name: "Aging Report",
 description: "Receivables aging analysis",
 icon: BarChart3,
 available: true,
 },
 ]

 return (
 <div className="space-y-6">
 <div className="grid gap-4 md:grid-cols-4">
 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium">YTD Revenue</CardTitle>
 <TrendingUp className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">
 {ytdRevenue.toLocaleString("hr-HR", { style: "currency", currency: "EUR" })}
 </div>
 <p className="text-xs text-muted-foreground">
 {yearlyRevenue._count.id} invoices this year
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium">This Month</CardTitle>
 {monthChange >= 0 ? (
 <ArrowUpRight className="h-4 w-4 text-success-icon" />
 ) : (
 <ArrowDownRight className="h-4 w-4 text-danger-icon" />
 )}
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">
 {thisMonthRevenue.toLocaleString("hr-HR", { style: "currency", currency: "EUR" })}
 </div>
 <p className={monthChange >= 0 ? "text-xs text-success-icon" : "text-xs text-danger-icon"}>
 {monthChange >= 0 ? "+" : ""}{monthChange.toFixed(1)}% vs last month
 </p>
 </CardContent>
 </Card>

 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium">YTD Expenses</CardTitle>
 <FileText className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">
 {ytdExpenses.toLocaleString("hr-HR", { style: "currency", currency: "EUR" })}
 </div>
 <p className="text-xs text-muted-foreground">
 {expenseTotal._count.id} expense documents
 </p>
 </CardContent>
 </Card>

 {company?.isVatPayer && (
 <Card>
 <CardHeader className="flex flex-row items-center justify-between pb-2">
 <CardTitle className="text-sm font-medium">YTD VAT</CardTitle>
 <PieChart className="h-4 w-4 text-muted-foreground" />
 </CardHeader>
 <CardContent>
 <div className="text-2xl font-bold">
 {ytdVat.toLocaleString("hr-HR", { style: "currency", currency: "EUR" })}
 </div>
 <p className="text-xs text-muted-foreground">Collected VAT</p>
 </CardContent>
 </Card>
 )}
 </div>

 {isPausalni && ytdRevenue > 0 && (
 <Card
 className={
 ytdRevenue > 50000
 ? "border-orange-200 bg-warning-bg"
 : ytdRevenue > 40000
 ? "border-yellow-200 bg-warning-bg"
 : "border-success-border bg-success-bg"
 }
 >
 <CardContent className="flex items-center justify-between py-4">
 <div>
 <p className="font-medium">VAT Threshold Status</p>
 <p className="text-sm text-muted-foreground">
 {ytdRevenue.toLocaleString("hr-HR", { style: "currency", currency: "EUR" })} / 60,000.00 EUR ({((ytdRevenue / 60000) * 100).toFixed(1)}%)
 </p>
 </div>
 <Badge
 variant={
 ytdRevenue > 50000 ? "destructive" : ytdRevenue > 40000 ? "secondary" : "default"
 }
 >
 {ytdRevenue > 50000
 ? "Near Threshold"
 : ytdRevenue > 40000
 ? "Monitor Closely"
 : "Within Limits"}
 </Badge>
 </CardContent>
 </Card>
 )}

 <Card>
 <CardHeader>
 <CardTitle>Available Reports</CardTitle>
 <CardDescription>Generate and export financial reports for this client</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {availableReports.map((report) => (
 <Card
 key={report.id}
 className={report.available ? "hover:bg-accent/50 transition-colors" : "opacity-50"}
 >
 <CardContent className="flex items-start gap-4 p-4">
 <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
 <report.icon className="h-5 w-5 text-primary" />
 </div>
 <div className="flex-1">
 <h3 className="font-medium">{report.name}</h3>
 <p className="text-sm text-muted-foreground">{report.description}</p>
 {report.available ? (
 <Button variant="link" size="sm" className="px-0 mt-2" asChild>
 <Link href={"/clients/" + clientId + "/reports/" + report.id}>
 Generate Report
 </Link>
 </Button>
 ) : (
 <Badge variant="outline" className="mt-2">
 Not applicable
 </Badge>
 )}
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 </CardContent>
 </Card>

 <Card>
 <CardHeader>
 <CardTitle>Export Data</CardTitle>
 <CardDescription>Download client data in various formats</CardDescription>
 </CardHeader>
 <CardContent className="flex gap-4">
 <ExportButtons clientId={clientId} />
 </CardContent>
 </Card>
 </div>
 )
}
