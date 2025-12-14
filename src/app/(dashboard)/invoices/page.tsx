import { redirect } from 'next/navigation'

// Redirect to unified documents hub
// Keep this file for backwards compatibility - old bookmarks will redirect
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const typeParam = Array.isArray(params.type) ? params.type[0] : params.type

  // Map old type params to new category
  if (typeParam === 'E_INVOICE') {
    redirect('/documents?category=e-invoice')
  }

  redirect('/documents?category=invoice')
}
