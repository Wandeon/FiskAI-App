// scripts/validate-content.ts
import { glob } from "glob"
import matter from "gray-matter"
import { readFileSync } from "fs"
import { validateChangelog } from "../src/lib/knowledge-hub/validate-frontmatter"

async function validateContent() {
  console.log("[validate-content] Scanning MDX files...")

  const mdxFiles = await glob("content/**/*.mdx")
  let errorCount = 0
  let changelogsValidated = 0

  for (const file of mdxFiles) {
    let content: string
    try {
      content = readFileSync(file, "utf-8")
    } catch (error) {
      console.error(
        `❌ Failed to read ${file}: ${error instanceof Error ? error.message : String(error)}`
      )
      errorCount++
      continue
    }

    const { data } = matter(content)

    // Validate changelog if present and is an array
    if (Array.isArray(data.changelog) && data.changelog.length > 0) {
      changelogsValidated++
      try {
        const result = validateChangelog(data.changelog)
        if (!result.valid) {
          console.error(`\n❌ ${file}:`)
          for (const error of result.errors) {
            console.error(`   - ${error}`)
          }
          errorCount++
        }
      } catch (error) {
        console.error(
          `❌ Validation error in ${file}: ${error instanceof Error ? error.message : String(error)}`
        )
        errorCount++
      }
    }
  }

  console.log(
    `\n[validate-content] Checked ${mdxFiles.length} files, ${changelogsValidated} with changelogs, ${errorCount} errors`
  )

  if (errorCount > 0) {
    console.error("\n❌ Content validation failed!")
    process.exit(1)
  }

  console.log("✅ All content validated successfully")
}

validateContent().catch((err) => {
  console.error("[validate-content] Error:", err)
  process.exit(1)
})
