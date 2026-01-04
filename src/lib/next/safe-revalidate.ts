import { revalidatePath } from "next/cache"

function isMissingNextStaticGenerationStore(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Invariant: static generation store missing in revalidatePath")
  )
}

export function safeRevalidatePath(path: string): void {
  try {
    revalidatePath(path)
  } catch (error) {
    if (isMissingNextStaticGenerationStore(error)) return
    throw error
  }
}
