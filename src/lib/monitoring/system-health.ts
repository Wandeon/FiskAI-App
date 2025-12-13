// src/lib/monitoring/system-health.ts
// System health and monitoring utilities

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheck[];
  timestamp: Date;
}

export interface HealthCheck {
  name: string;
  status: "passed" | "failed" | "warning";
  message?: string;
  details?: Record<string, unknown>;
}

export interface DatabaseHealth {
  connected: boolean;
  pingTime?: number;
  version?: string;
}

export interface ServiceHealth {
  name: string;
  status: "up" | "down";
  responseTime?: number;
  error?: string;
}

/**
 * Perform comprehensive system health check
 */
export async function checkSystemHealth(): Promise<SystemHealth> {
  const checks: HealthCheck[] = [];
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Check database connectivity
  try {
    const dbStart = Date.now();
    const dbResult = await checkDatabaseHealth();
    const dbResponseTime = Date.now() - dbStart;
    
    checks.push({
      name: "database",
      status: dbResult.connected ? "passed" : "failed",
      message: dbResult.connected 
        ? `Connected, ping: ${dbResponseTime}ms` 
        : "Database connection failed",
      details: {
        connected: dbResult.connected,
        pingTime: dbResponseTime,
        version: dbResult.version
      }
    });
    
    if (!dbResult.connected) {
      overallStatus = "unhealthy";
    }
  } catch (error) {
    checks.push({
      name: "database",
      status: "failed",
      message: `Database check failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    overallStatus = "unhealthy";
  }

  // Check API responsiveness
  try {
    const apiStart = Date.now();
    
    // Test basic API functionality
    const userCount = await db.user.count();
    const companyCount = await db.company.count();
    
    checks.push({
      name: "api",
      status: "passed",
      message: "API functional",
      details: {
        userCount,
        companyCount,
        responseTime: Date.now() - apiStart,
      }
    });
  } catch (error) {
    checks.push({
      name: "api",
      status: "failed",
      message: `API check failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    overallStatus = "unhealthy";
  }

  // Check disk space (if available in the environment)
  try {
    // Note: In a real implementation, this would check actual disk space
    // For now, we'll just add a placeholder that would check the actual disk
    checks.push({
      name: "disk_space",
      status: "passed", // Assuming OK for now
      message: "Disk space check (implementation needed)",
      details: {
        // In a real implementation: freeSpace, totalSpace, usagePercentage
      }
    });
  } catch (error) {
    checks.push({
      name: "disk_space",
      status: "warning",
      message: `Disk space check failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  // Check if there are any warnings that should degrade the status
  const warningCount = checks.filter(check => check.status === "warning").length;
  const failedCount = checks.filter(check => check.status === "failed").length;

  if (failedCount > 0) {
    overallStatus = "unhealthy";
  } else if (warningCount > 0) {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    checks,
    timestamp: new Date(),
  };
}

/**
 * Check database health specifically
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  try {
    // Test database connectivity
    const start = new Date().getTime();
    await db.$queryRaw`SELECT 1`;
    const pingTime = new Date().getTime() - start;
    
    // Get database version
    const result: any = await db.$queryRaw`SELECT version()`;
    const version = result?.[0]?.version || "unknown";
    
    return {
      connected: true,
      pingTime,
      version,
    };
  } catch (error) {
    logger.error({ error }, "Database health check failed");
    return {
      connected: false,
    };
  }
}

/**
 * Get system metrics for monitoring
 */
export async function getSystemMetrics() {
  try {
    const [
      userCount,
      companyCount,
      invoiceCount,
      expenseCount,
      contactCount
    ] = await Promise.all([
      db.user.count(),
      db.company.count(),
      db.eInvoice.count(),
      db.expense.count(),
      db.contact.count(),
    ]);

    const metrics = {
      users: userCount,
      companies: companyCount,
      invoices: invoiceCount,
      expenses: expenseCount,
      contacts: contactCount,
      timestamp: new Date(),
    };

    logger.info({ metrics }, "System metrics collected");

    return metrics;
  } catch (error) {
    logger.error({ error }, "Failed to collect system metrics");
    throw error;
  }
}

/**
 * Log system performance metrics
 */
export async function logPerformanceMetrics() {
  try {
    const start = Date.now();
    
    // Perform a simple query to measure database performance
    await db.user.count();
    
    const dbQueryTime = Date.now() - start;
    
    logger.info({
      dbQueryTime,
      metricType: "performance"
    }, "Performance metrics logged");
    
    return { dbQueryTime };
  } catch (error) {
    logger.error({ error }, "Failed to log performance metrics");
    throw error;
  }
}

/**
 * Enhanced health check endpoint that includes more detail
 */
export async function getDetailedHealth() {
  const [systemHealth, metrics] = await Promise.all([
    checkSystemHealth(),
    getSystemMetrics().catch(() => null), // Don't fail if metrics collection fails
  ]);

  return {
    ...systemHealth,
    metrics: metrics || undefined,
  };
}