import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { dbReg } from "@/lib/db"
import { NNParser } from "../index"
import { ParseStatus, ProvisionNodeType } from "@/generated/regulatory-client"
import { createHash } from "crypto"

// This is a DB test - only runs in integration environment
describe.skipIf(!process.env.REGULATORY_DATABASE_URL)("NN Parser Integration", () => {
  const testSourceId = "test-source-" + Date.now()
  const testEvidenceId = "test-evidence-" + Date.now()

  const testHtml = `
    <html>
    <head><title>Test Pravilnik</title></head>
    <body>
      <h1>Pravilnik o testiranju</h1>
      <p class="clanak">Članak 1.</p>
      <p>Ovaj pravilnik uređuje testiranje.</p>
      <p class="clanak">Članak 2.</p>
      <p>(1) Prvi stavak članka 2.</p>
      <p>(2) Drugi stavak članka 2.</p>
    </body>
    </html>
  `
  const contentHash = createHash("sha256").update(testHtml).digest("hex")

  beforeAll(async () => {
    // Create test source
    await dbReg.regulatorySource.create({
      data: {
        id: testSourceId,
        name: "Test Source",
        slug: "test-source-" + Date.now(),
        url: "https://test.example.com",
        isActive: true,
      },
    })

    // Create test evidence
    await dbReg.evidence.create({
      data: {
        id: testEvidenceId,
        sourceId: testSourceId,
        url: "https://test.example.com/doc",
        rawContent: testHtml,
        contentHash,
        contentType: "html",
        contentClass: "HTML",
        stalenessStatus: "FRESH",
      },
    })
  })

  afterAll(async () => {
    // Cleanup in reverse order
    await dbReg.provisionNode.deleteMany({
      where: { parsedDocument: { evidenceId: testEvidenceId } },
    })
    await dbReg.parsedDocument.deleteMany({
      where: { evidenceId: testEvidenceId },
    })
    await dbReg.evidenceArtifact.deleteMany({
      where: { evidenceId: testEvidenceId },
    })
    await dbReg.evidence.delete({
      where: { id: testEvidenceId },
    })
    await dbReg.regulatorySource.delete({
      where: { id: testSourceId },
    })
  })

  it("parses evidence and stores results", async () => {
    // Parse
    const result = await NNParser.parse({
      evidenceId: testEvidenceId,
      contentClass: "HTML",
      artifact: {
        id: "test",
        kind: "HTML_RAW",
        content: testHtml,
        contentHash,
      },
    })

    expect(result.status).toBe("SUCCESS")
    expect(result.nodes.length).toBeGreaterThan(0)

    // Store artifact
    const artifact = await dbReg.evidenceArtifact.create({
      data: {
        evidenceId: testEvidenceId,
        kind: "CLEAN_TEXT",
        content: result.cleanText,
        contentHash: result.cleanTextHash,
      },
    })

    // Store parsed document
    const parsedDoc = await dbReg.parsedDocument.create({
      data: {
        evidenceId: testEvidenceId,
        parserId: NNParser.parserId,
        parserVersion: NNParser.parserVersion,
        parseConfigHash: NNParser.parseConfigHash,
        status: ParseStatus.SUCCESS,
        docMeta: result.docMeta,
        cleanTextArtifactId: artifact.id,
        cleanTextLength: result.cleanText.length,
        cleanTextHash: result.cleanTextHash,
        offsetUnit: "UTF16",
        nodeCount: result.stats.nodeCount,
        maxDepth: result.stats.maxDepth,
        statsByType: result.stats.byType,
        coverageChars: result.stats.coverageChars,
        coveragePercent: result.stats.coveragePercent,
        isLatest: true,
      },
    })

    expect(parsedDoc.id).toBeDefined()

    // Store nodes
    const nodeData = result.nodes.map((node) => ({
      parsedDocumentId: parsedDoc.id,
      nodeType: node.nodeType,
      nodePath: node.nodePath,
      label: node.label,
      orderIndex: node.orderIndex,
      depth: node.depth,
      rawText: node.rawText,
      startOffset: node.startOffset,
      endOffset: node.endOffset,
      isContainer: node.isContainer,
    }))

    await dbReg.provisionNode.createMany({ data: nodeData })

    // Verify storage
    const storedNodes = await dbReg.provisionNode.findMany({
      where: { parsedDocumentId: parsedDoc.id },
    })

    expect(storedNodes.length).toBe(result.nodes.length)
    expect(storedNodes.some((n) => n.nodePath === "/članak:1")).toBe(true)
    expect(storedNodes.some((n) => n.nodePath === "/članak:2")).toBe(true)
  })

  it("enforces unique nodePath within document", async () => {
    // This tests the DB constraint
    const parsedDoc = await dbReg.parsedDocument.findFirst({
      where: { evidenceId: testEvidenceId },
    })

    if (!parsedDoc) {
      throw new Error("ParsedDocument not found - run previous test first")
    }

    // Try to create duplicate nodePath
    await expect(
      dbReg.provisionNode.create({
        data: {
          parsedDocumentId: parsedDoc.id,
          nodeType: ProvisionNodeType.CLANAK,
          nodePath: "/članak:1", // Duplicate!
          orderIndex: 99,
          depth: 1,
          startOffset: 0,
          endOffset: 10,
          isContainer: false,
        },
      })
    ).rejects.toThrow()
  })
})
