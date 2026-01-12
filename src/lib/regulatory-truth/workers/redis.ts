// src/lib/regulatory-truth/workers/redis.ts
import Redis, { RedisOptions } from "ioredis"

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379"

/**
 * Parse a Redis URL into ioredis connection options.
 * Supports: redis://host:port/db, redis://:pass@host, redis://user:pass@host, rediss:// (TLS)
 */
export function buildRedisOptions(redisUrl: string): RedisOptions {
  const u = new URL(redisUrl)

  const port = u.port ? Number(u.port) : 6379
  const db = u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0

  // ioredis uses `username` + `password` for ACL auth (Redis 6+)
  const username = u.username ? decodeURIComponent(u.username) : undefined
  const password = u.password ? decodeURIComponent(u.password) : undefined

  const opts: RedisOptions = {
    host: u.hostname,
    port,
    db,
    username,
    password,

    // Required by BullMQ
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  }

  // TLS if using rediss://
  if (u.protocol === "rediss:") {
    opts.tls = {}
  }

  return opts
}

/**
 * Redis connection options (NOT a live instance)
 * Pass these to BullMQ Queue/Worker constructors
 */
export const redisConnectionOptions: RedisOptions = buildRedisOptions(REDIS_URL)

/**
 * BullMQ prefix for all queues/workers
 */
export const BULLMQ_PREFIX = process.env.BULLMQ_PREFIX || "fiskai"

/**
 * Get BullMQ connection options (for Queue and Worker constructors)
 */
export function getBullMqOptions() {
  return {
    connection: redisConnectionOptions,
    prefix: BULLMQ_PREFIX,
  }
}

// Lazy-loaded Redis instance to avoid Next.js build issues with worker threads
let _redis: Redis | null = null

/**
 * Get the shared Redis instance (lazy-loaded)
 * Use this for non-BullMQ operations (heartbeats, version tracking, rate limiting)
 */
export function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      ...redisConnectionOptions,
      lazyConnect: true, // Don't connect until first command
    })
  }
  return _redis
}

/**
 * Shared Redis instance - uses lazy loading via Proxy
 * This is the backwards-compatible export that can be used like the old redis instance
 */
export const redis: Redis = new Proxy({} as Redis, {
  get(_, prop: string | symbol) {
    const instance = getRedis()
    const value = (instance as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof value === "function") {
      return value.bind(instance)
    }
    return value
  },
})

// Separate connection for workers (BullMQ requirement)
export function createWorkerConnection(): Redis {
  return new Redis(redisConnectionOptions)
}

// Health check with timeout protection
export async function checkRedisHealth(timeoutMs: number = 2000): Promise<boolean> {
  try {
    const pong = await Promise.race([
      getRedis().ping(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("Redis ping timeout")), timeoutMs)
      ),
    ])
    return pong === "PONG"
  } catch {
    return false
  }
}

// Graceful shutdown
export async function closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit()
    _redis = null
  }
}

// ============================================================================
// DRAINER HEARTBEAT (PR #90 fix: stall detection)
// ============================================================================

const DRAINER_HEARTBEAT_KEY = "regulatory-truth:drainer:heartbeat"
const DRAINER_STATS_KEY = "regulatory-truth:drainer:stats"

export interface DrainerHeartbeat {
  lastActivity: string // ISO timestamp
  queueName: string // Which queue was last processed
  itemsProcessed: number // Total items processed this session
  cycleCount: number // Number of drain cycles
}

/**
 * Update drainer heartbeat in Redis (called after each successful operation)
 */
export async function updateDrainerHeartbeat(data: DrainerHeartbeat): Promise<void> {
  await getRedis().set(DRAINER_HEARTBEAT_KEY, JSON.stringify(data))
  // Also update individual stage timestamps
  await getRedis().hset(DRAINER_STATS_KEY, {
    lastActivity: data.lastActivity,
    lastQueue: data.queueName,
    itemsProcessed: String(data.itemsProcessed),
    cycleCount: String(data.cycleCount),
  })
}

/**
 * Get drainer heartbeat from Redis
 */
export async function getDrainerHeartbeat(): Promise<DrainerHeartbeat | null> {
  const data = await getRedis().get(DRAINER_HEARTBEAT_KEY)
  if (!data) return null
  try {
    return JSON.parse(data) as DrainerHeartbeat
  } catch {
    return null
  }
}

/**
 * Get time since last drainer activity in minutes
 */
export async function getDrainerIdleMinutes(): Promise<number> {
  const heartbeat = await getDrainerHeartbeat()
  if (!heartbeat) {
    // No heartbeat means drainer hasn't started or crashed before first heartbeat
    return Infinity
  }
  const lastActivity = new Date(heartbeat.lastActivity)
  const now = new Date()
  return (now.getTime() - lastActivity.getTime()) / (1000 * 60)
}

// ============================================================================
// PER-STAGE HEARTBEAT TRACKING (Issue #807 fix)
// ============================================================================

const DRAINER_STAGES_KEY = "regulatory-truth:drainer:stages"

export interface StageHeartbeat {
  stage: string
  lastActivity: string // ISO timestamp
  itemsProcessed: number
  avgDurationMs: number
  lastError?: string
}

export async function updateStageHeartbeat(data: StageHeartbeat): Promise<void> {
  await getRedis().hset(DRAINER_STAGES_KEY, {
    [data.stage]: JSON.stringify(data),
  })
}

export async function getStageHeartbeat(stage: string): Promise<StageHeartbeat | null> {
  const data = await getRedis().hget(DRAINER_STAGES_KEY, stage)
  if (!data) return null
  try {
    return JSON.parse(data) as StageHeartbeat
  } catch {
    return null
  }
}

export async function getAllStageHeartbeats(): Promise<Record<string, StageHeartbeat>> {
  const data = await getRedis().hgetall(DRAINER_STAGES_KEY)
  const heartbeats: Record<string, StageHeartbeat> = {}
  for (const [stage, value] of Object.entries(data)) {
    try {
      heartbeats[stage] = JSON.parse(value) as StageHeartbeat
    } catch {
      // Skip malformed data
    }
  }
  return heartbeats
}

export async function getStageIdleMinutes(stage: string): Promise<number> {
  const heartbeat = await getStageHeartbeat(stage)
  if (!heartbeat) {
    return Infinity
  }
  const lastActivity = new Date(heartbeat.lastActivity)
  const now = new Date()
  return (now.getTime() - lastActivity.getTime()) / (1000 * 60)
}
