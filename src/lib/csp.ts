import { headers } from "next/headers"

/**
 * Get the CSP nonce for the current request.
 * This nonce is generated in middleware and passed via the x-nonce header.
 *
 * Usage in Server Components:
 * ```tsx
 * import { getNonce } from "@/lib/csp"
 *
 * export default async function MyPage() {
 *   const nonce = await getNonce()
 *   return <script nonce={nonce}>...</script>
 * }
 * ```
 *
 * Usage in Client Components (via props):
 * ```tsx
 * // Server Component
 * const nonce = await getNonce()
 * return <ClientComponent nonce={nonce} />
 *
 * // Client Component
 * 'use client'
 * export function ClientComponent({ nonce }: { nonce: string }) {
 *   return <Script nonce={nonce} src="..." />
 * }
 * ```
 */
export async function getNonce(): Promise<string> {
  const headersList = await headers()
  return headersList.get("x-nonce") || ""
}
