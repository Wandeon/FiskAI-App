import { createTRPCReact } from "@trpc/react-query"
import type { AppRouter } from "@fiskai/trpc"

export const trpc: ReturnType<typeof createTRPCReact<AppRouter>> =
  createTRPCReact<AppRouter>()
