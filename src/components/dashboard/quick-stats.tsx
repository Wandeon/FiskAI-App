import { TrendingUp, FileText, Users, Package } from "lucide-react"
import { StatCard } from "@/components/ui/stat-card"

interface QuickStatsProps {
  totalRevenue: number
  eInvoiceCount: number
  contactCount: number
  productCount: number
  draftCount?: number
}

export function QuickStats({
  totalRevenue,
  eInvoiceCount,
  contactCount,
  productCount,
  draftCount = 0,
}: QuickStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Ukupni prihod"
        value={`${totalRevenue.toLocaleString('hr-HR', { minimumFractionDigits: 2 })} €`}
        icon={<TrendingUp className="h-5 w-5" />}
        className="sm:col-span-2 lg:col-span-1"
      />
      <StatCard
        title="E-Računi"
        value={eInvoiceCount}
        description={draftCount > 0 ? `${draftCount} u nacrtu` : undefined}
        icon={<FileText className="h-5 w-5" />}
      />
      <StatCard
        title="Kontakti"
        value={contactCount}
        icon={<Users className="h-5 w-5" />}
      />
      <StatCard
        title="Proizvodi"
        value={productCount}
        icon={<Package className="h-5 w-5" />}
      />
    </div>
  )
}
