#!/usr/bin/env npx tsx

/**
 * Generates TypeScript stub code for missing concept mappings.
 *
 * This script helps quickly create new concept mapping entries by providing
 * a template that can be filled in with actual MDX paths and descriptions.
 *
 * Usage: npx tsx scripts/generate-concept-stubs.ts <conceptId1> <conceptId2> ...
 *
 * Example: npx tsx scripts/generate-concept-stubs.ts pdv-new-threshold capital-gains-tax
 */

interface ConceptStub {
  conceptId: string
  description: string
  mdxPaths: string[]
  toolIds?: string[]
}

function generateConceptStub(conceptId: string): string {
  // Try to infer a basic description from the conceptId
  const words = conceptId.split("-").map((word) => {
    // Capitalize first letter
    return word.charAt(0).toUpperCase() + word.slice(1)
  })
  const humanReadable = words.join(" ")

  const stub = `  {
    conceptId: "${conceptId}",
    description: "${humanReadable} - TODO: Add detailed description",
    mdxPaths: [
      // TODO: Add MDX file paths that reference this concept
      // Example: "vodici/example.mdx", "rjecnik/${conceptId}.mdx"
    ],
    toolIds: [
      // TODO: (Optional) Add tool/calculator IDs that use this concept
    ],
  },`

  return stub
}

function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error("Error: No conceptIds provided\n")
    console.log("Usage: npx tsx scripts/generate-concept-stubs.ts <conceptId1> <conceptId2> ...")
    console.log("\nExample:")
    console.log("  npx tsx scripts/generate-concept-stubs.ts pdv-new-threshold capital-gains-tax")
    console.log("\nThis will generate stub code that you can add to concept-registry.ts")
    process.exit(1)
  }

  console.log("// Generated concept mapping stubs")
  console.log(
    "// Copy and paste these into src/lib/regulatory-truth/content-sync/concept-registry.ts"
  )
  console.log("// Remember to:")
  console.log("//   1. Add actual MDX paths")
  console.log("//   2. Write accurate descriptions")
  console.log("//   3. Add tool IDs if applicable")
  console.log("//   4. Remove empty toolIds array if not needed")
  console.log("")

  for (const conceptId of args) {
    // Validate conceptId format
    if (!/^[a-z0-9-]+$/.test(conceptId)) {
      console.error(`\n⚠️  Warning: "${conceptId}" contains invalid characters`)
      console.error("   ConceptIds should only contain lowercase letters, numbers, and hyphens\n")
      continue
    }

    console.log(generateConceptStub(conceptId))
    console.log("")
  }

  console.log("\n// Don't forget to run validation after adding these:")
  console.log("// npx tsx scripts/validate-concept-registry.ts")
}

main()

// Make this a module to avoid duplicate function name conflicts
export {}
