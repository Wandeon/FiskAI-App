// src/app/(admin)/admin/regulatory-truth/coverage/page.tsx
import { getCurrentUser } from "@/lib/auth-utils"
import { redirect } from "next/navigation"
import { CoverageDashboard } from "./coverage-dashboard"

export default async function CoveragePage() {
 const user = await getCurrentUser()

 if (!user || user.systemRole !== "ADMIN") {
 redirect("/")
 }

 return (
 <div className="space-y-6">
 <div>
 <h1 className="text-2xl font-bold">Knowledge Shape Coverage</h1>
 <p className="text-muted-foreground">
 Track extraction completeness and quality across evidence records
 </p>
 </div>
 <CoverageDashboard />
 </div>
 )
}
