// src/lib/security/virus-scanner.ts
// Virus scanning utility using ClamAV

import NodeClam from "clamscan"
import { createLogger } from "@/lib/logger"

const logger = createLogger("security:virus-scanner")

// Singleton instance to avoid reinitializing ClamAV for every scan
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clamInstance: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let initializationPromise: Promise<any> | null = null

/**
 * Initialize ClamAV scanner
 * Uses Unix socket in production (ClamAV daemon) or fallback to local scanning in dev
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClamScanner = any

async function initClamAV(): Promise<ClamScanner> {
  if (clamInstance) {
    return clamInstance
  }

  // If already initializing, return the existing promise to avoid race conditions
  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = (async (): Promise<ClamScanner> => {
    try {
      const isDev = process.env.NODE_ENV !== "production"

      // In production, use ClamAV daemon via Unix socket
      // In development, use local scanning or skip if ClamAV not installed
      const config = {
        removeInfected: false, // Don't auto-delete, let application handle it
        scanLog: null, // Don't write scan logs to file
        debugMode: isDev,
        preference: isDev ? "clamdscan" : "clamdscan", // Prefer daemon in both cases
        clamdscan: {
          socket: process.env.CLAMAV_SOCKET || "/var/run/clamav/clamd.sock",
          timeout: 60000, // 60 second timeout for large files
          localFallback: isDev, // Allow fallback to local scanning in dev
        },
      }

      logger.info({ config: { socket: config.clamdscan.socket } }, "Initializing ClamAV scanner")

      const clam = await new NodeClam().init(
        config as unknown as Parameters<typeof NodeClam.prototype.init>[0]
      )
      clamInstance = clam as ClamScanner

      logger.info("ClamAV scanner initialized successfully")
      return clam as ClamScanner
    } catch (error) {
      logger.error({ error }, "Failed to initialize ClamAV scanner")
      throw error
    }
  })()

  return initializationPromise
}

/**
 * Scan result interface
 */
export interface ScanResult {
  isInfected: boolean
  viruses: string[]
  error?: string
}

/**
 * Scan a file buffer for viruses
 *
 * @param buffer - File buffer to scan
 * @param fileName - Original file name (for logging)
 * @returns Scan result with infection status and virus names
 */
export async function scanBuffer(buffer: Buffer, fileName: string): Promise<ScanResult> {
  try {
    // Check if virus scanning is disabled via environment variable
    // Useful for development environments without ClamAV
    if (process.env.DISABLE_VIRUS_SCANNING === "true") {
      logger.warn({ fileName }, "Virus scanning disabled by environment variable")
      return { isInfected: false, viruses: [] }
    }

    const clam = await initClamAV()

    logger.debug({ fileName, size: buffer.length }, "Scanning file for viruses")

    const { isInfected, viruses } = await clam.scanBuffer(buffer)

    if (isInfected) {
      logger.warn({ fileName, viruses, size: buffer.length }, "Infected file detected and blocked")
    } else {
      logger.debug({ fileName, size: buffer.length }, "File scan clean")
    }

    return { isInfected, viruses: viruses || [] }
  } catch (error) {
    logger.error(
      { error, fileName, size: buffer.length },
      "Virus scan failed - defaulting to blocking upload for security"
    )

    // FAIL-CLOSED: If scanning fails, treat as infected to prevent potential malware
    // This is a security-first approach
    return {
      isInfected: true,
      viruses: [],
      error: error instanceof Error ? error.message : "Unknown scan error",
    }
  }
}

/**
 * Get ClamAV version info for health checks
 */
export async function getClamAVVersion(): Promise<string | null> {
  try {
    const clam = await initClamAV()
    const version = await clam.getVersion()
    return version
  } catch (error) {
    logger.error({ error }, "Failed to get ClamAV version")
    return null
  }
}

/**
 * Reset the ClamAV instance (useful for testing)
 */
export function resetClamAV(): void {
  clamInstance = null
  initializationPromise = null
  logger.debug("ClamAV instance reset")
}
