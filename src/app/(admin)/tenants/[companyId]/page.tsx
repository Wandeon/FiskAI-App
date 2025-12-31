import { requireAdmin } from "@/lib/auth-utils"
import { getTenantDetail } from "@/lib/admin/tenant-health"
import { TenantDetailView } from "./tenant-detail-view"
import { notFound } from "next/navigation"

type PageProps = {
  params: Promise<{ companyId: string }>
}

export default async function TenantDetailPage({ params }: PageProps) {
  await requireAdmin()

  const { companyId } = await params
  const tenant = await getTenantDetail(companyId)

  if (!tenant) notFound()

  return <TenantDetailView tenant={tenant} />
}
