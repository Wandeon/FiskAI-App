import { createHash } from "crypto"

export function createControlSum(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex")
}
