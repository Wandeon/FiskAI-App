import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { runWithContext } from "./context"
import { logger } from "./logger"
import { redirect } from "next/navigation"

type ActionHandler<T, R> = (input: T) => Promise<R>

/**
 * Wraps a server action with logging context and optional authentication.
 * Automatically tracks request ID, User ID, and handles errors.
 */
export function createSafeAction<T, R>(
  handler: ActionHandler<T, R>,
  options: { requireAuth?: boolean } = {}
) {
  return async (input: T): Promise<R> => {
    const headerLists = await headers()
    const requestId = headerLists.get("x-request-id") || crypto.randomUUID()
    const path = headerLists.get("x-invoke-path") || "server-action"

    // Get session if possible
    const session = await auth()
    const userId = session?.user?.id

    if (options.requireAuth && !userId) {
      // Simple redirect or error depending on preference.
      // For actions, throwing or returning error result is often better,
      // but matching auth-utils style:
      redirect("/auth")
    }

    // Run within context
    return runWithContext(
      {
        requestId,
        userId,
        // companyId could be fetched here if we wanted to enforce it
        path,
        method: "POST", // Actions are always POST essentially
      },
      async () => {
        try {
          return await handler(input)
        } catch (error) {
          logger.error(
            { error, input: typeof input === "object" ? input : "..." },
            "Server Action Failed"
          )
          throw error
        }
      }
    )
  }
}
