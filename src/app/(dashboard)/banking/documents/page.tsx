import { redirect } from 'next/navigation'

// Redirect to unified documents hub
// Keep this file for backwards compatibility - old bookmarks will redirect
export default async function BankingDocumentsPage() {
  redirect('/documents?category=bank-statement')
}
