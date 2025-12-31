import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function ClientInvoicesLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>
  )
}
