import { Metadata } from "next"
import { OfflineContent } from "./offline-content"

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return <OfflineContent />
}
