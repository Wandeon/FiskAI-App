import { NextResponse } from "next/server"
import { withApiLogging } from "@/lib/api-logging"
import { getDetailedHealth } from "@/lib/monitoring/system-health"

export const dynamic = "force-dynamic"

export const GET = withApiLogging(async (request: Request) => {
  const url = new URL(request.url);
  const detailed = url.searchParams.get("detailed") === "true";

  if (detailed) {
    try {
      const health = await getDetailedHealth();
      return NextResponse.json(health);
    } catch (error) {
      return NextResponse.json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Health check failed",
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }
  } else {
    // Basic health check for load balancers/monitoring tools
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
    })
  }
})
