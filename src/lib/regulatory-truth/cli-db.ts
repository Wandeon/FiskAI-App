// src/lib/regulatory-truth/cli-db.ts
// CLI-compatible database client that loads env and properly connects

import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { PrismaClient as RegPrismaClient } from "@/generated/regulatory-client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// Load environment variables for CLI usage
config({ path: ".env.local" })
config({ path: ".env" })

// Create shared pool and prisma instance
let _pool: Pool | null = null
let _db: PrismaClient | null = null
let _dbReg: RegPrismaClient | null = null

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return _pool
}

export function getCliDb(): PrismaClient {
  if (!_db) {
    const pool = getPool()
    _db = new PrismaClient({ adapter: new PrismaPg(pool) })
  }
  return _db
}

export function getCliDbReg(): RegPrismaClient {
  if (!_dbReg) {
    const pool = getPool()
    _dbReg = new RegPrismaClient({ adapter: new PrismaPg(pool) })
  }
  return _dbReg
}

export async function closeCliDb(): Promise<void> {
  if (_db) {
    await _db.$disconnect()
    _db = null
  }
  if (_dbReg) {
    await _dbReg.$disconnect()
    _dbReg = null
  }
  if (_pool) {
    await _pool.end()
    _pool = null
  }
}

// Export singleton instances for use by agents
export const cliDb = getCliDb()
export const dbReg = getCliDbReg()
