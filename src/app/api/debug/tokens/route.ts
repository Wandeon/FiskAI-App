/**
 * Debug endpoint for design token verification
 *
 * TEMPORARY - Guarded by FISKAI_DEBUG=1
 *
 * Returns:
 * - NODE_ENV
 * - Memory usage
 * - Parsed CSS variables from variables.css (:root and .dark)
 * - Legacy variable mapping from globals.css
 */

import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  // Guard: Only accessible when FISKAI_DEBUG=1
  if (process.env.FISKAI_DEBUG !== "1") {
    return new NextResponse(null, { status: 404 })
  }

  try {
    // Read variables.css
    const variablesPath = path.join(process.cwd(), "src/design-system/css/variables.css")
    const variablesContent = fs.readFileSync(variablesPath, "utf-8")

    // Parse :root variables
    const rootMatch = variablesContent.match(/:root\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/)
    const rootVars: Record<string, string> = {}
    if (rootMatch) {
      const rootBlock = rootMatch[1]
      const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g
      let match
      while ((match = varRegex.exec(rootBlock)) !== null) {
        rootVars[`--${match[1]}`] = match[2].trim()
      }
    }

    // Parse .dark variables
    const darkMatch = variablesContent.match(/\.dark\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/)
    const darkVars: Record<string, string> = {}
    if (darkMatch) {
      const darkBlock = darkMatch[1]
      const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g
      let match
      while ((match = varRegex.exec(darkBlock)) !== null) {
        darkVars[`--${match[1]}`] = match[2].trim()
      }
    }

    // Read globals.css for legacy mapping
    const globalsPath = path.join(process.cwd(), "src/app/globals.css")
    const globalsContent = fs.readFileSync(globalsPath, "utf-8")

    // Extract legacy variable mapping (lines that map --background, --foreground, etc.)
    const legacyMapping: Record<string, string> = {}
    const legacyRegex =
      /--(background|foreground|surface|border|muted|accent)\s*:\s*var\(([^)]+)\)/g
    let legacyMatch
    while ((legacyMatch = legacyRegex.exec(globalsContent)) !== null) {
      legacyMapping[`--${legacyMatch[1]}`] = `var(${legacyMatch[2]})`
    }

    const memoryUsage = process.memoryUsage()

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        FISKAI_DEBUG: process.env.FISKAI_DEBUG,
      },
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      },
      variablesCss: {
        path: variablesPath,
        rootVariablesCount: Object.keys(rootVars).length,
        darkVariablesCount: Object.keys(darkVars).length,
        rootVariables: rootVars,
        darkVariables: darkVars,
      },
      globalsCss: {
        path: globalsPath,
        legacyMappingCount: Object.keys(legacyMapping).length,
        legacyMapping,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
