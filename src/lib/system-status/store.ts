import { db } from "@/lib/db"

export async function getCurrentSnapshot() {
  const pointer = await db.systemRegistryStatusPointer.findFirst()
  if (!pointer) return null
  return db.systemRegistryStatusSnapshot.findUnique({ where: { id: pointer.currentId } })
}
