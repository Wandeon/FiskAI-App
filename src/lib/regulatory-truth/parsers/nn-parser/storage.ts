// src/lib/regulatory-truth/parsers/nn-parser/storage.ts
/**
 * NN Parser Storage Utilities
 *
 * Persists parsed NN documents to the database with proper versioning.
 * Creates immutable snapshots that can be referenced for quote anchoring.
 *
 * Key Invariants:
 * - NNParseSnapshot never changes after creation
 * - New parser version = new NNParseSnapshot (even for same Evidence)
 * - All provision nodes are flattened for indexing/querying
 */

import type { PrismaClient as RegulatoryPrismaClient } from "../../../../generated/regulatory-client"
import type { ParsedNNDocument, ProvisionNode, QuoteLocation } from "./types"
import { createHash } from "crypto"

/**
 * Serialize the provision tree to JSON for hashing.
 * Excludes volatile fields that don't affect content.
 */
function serializeTree(node: ProvisionNode): string {
  const serializable = {
    nodeKey: node.nodeKey,
    nodeLabel: node.nodeLabel,
    nodeType: node.nodeType,
    ordinal: node.ordinal,
    orderIndex: node.orderIndex,
    rawText: node.rawText,
    textNorm: node.textNorm,
    normSha256: node.normSha256,
    title: node.title,
    tableData: node.tableData,
    citationHr: node.citationHr,
    children: node.children.map((child) => JSON.parse(serializeTree(child))),
  }
  return JSON.stringify(serializable)
}

/**
 * Compute SHA256 hash of the serialized tree.
 */
function computeTreeHash(root: ProvisionNode): string {
  const serialized = serializeTree(root)
  return createHash("sha256").update(serialized).digest("hex")
}

/**
 * Map ProvisionNodeType to database enum value.
 */
function mapNodeType(
  nodeType: string
):
  | "DOCUMENT"
  | "DIO"
  | "GLAVA"
  | "ODJELJAK"
  | "PODODJELJAK"
  | "CLANAK"
  | "STAVAK"
  | "TOCKA"
  | "PODTOCKA"
  | "ALINEJA"
  | "TABLICA"
  | "REDAK"
  | "PRILOG" {
  const mapping: Record<
    string,
    | "DOCUMENT"
    | "DIO"
    | "GLAVA"
    | "ODJELJAK"
    | "PODODJELJAK"
    | "CLANAK"
    | "STAVAK"
    | "TOCKA"
    | "PODTOCKA"
    | "ALINEJA"
    | "TABLICA"
    | "REDAK"
    | "PRILOG"
  > = {
    document: "DOCUMENT",
    dio: "DIO",
    glava: "GLAVA",
    odjeljak: "ODJELJAK",
    pododjeljak: "PODODJELJAK",
    clanak: "CLANAK",
    stavak: "STAVAK",
    tocka: "TOCKA",
    podtocka: "PODTOCKA",
    alineja: "ALINEJA",
    tablica: "TABLICA",
    redak: "REDAK",
    prilog: "PRILOG",
  }
  return mapping[nodeType] || "DOCUMENT"
}

/**
 * Flatten provision tree to array of rows for bulk insert.
 */
function flattenTree(
  node: ProvisionNode,
  parseSnapshotId: string,
  parentNodeKey: string | null = null
): Array<{
  parseSnapshotId: string
  nodeKey: string
  nodeLabel: string
  nodeType:
    | "DOCUMENT"
    | "DIO"
    | "GLAVA"
    | "ODJELJAK"
    | "PODODJELJAK"
    | "CLANAK"
    | "STAVAK"
    | "TOCKA"
    | "PODTOCKA"
    | "ALINEJA"
    | "TABLICA"
    | "REDAK"
    | "PRILOG"
  parentNodeKey: string | null
  orderIndex: number
  ordinal: string
  rawText: string
  normText: string
  normSha256: string
  title: string | null
  citationHr: string | null
  tableData: object | null
}> {
  const rows: Array<{
    parseSnapshotId: string
    nodeKey: string
    nodeLabel: string
    nodeType:
      | "DOCUMENT"
      | "DIO"
      | "GLAVA"
      | "ODJELJAK"
      | "PODODJELJAK"
      | "CLANAK"
      | "STAVAK"
      | "TOCKA"
      | "PODTOCKA"
      | "ALINEJA"
      | "TABLICA"
      | "REDAK"
      | "PRILOG"
    parentNodeKey: string | null
    orderIndex: number
    ordinal: string
    rawText: string
    normText: string
    normSha256: string
    title: string | null
    citationHr: string | null
    tableData: object | null
  }> = []

  rows.push({
    parseSnapshotId,
    nodeKey: node.nodeKey,
    nodeLabel: node.nodeLabel,
    nodeType: mapNodeType(node.nodeType),
    parentNodeKey,
    orderIndex: node.orderIndex,
    ordinal: node.ordinal,
    rawText: node.rawText,
    normText: node.textNorm,
    normSha256: node.normSha256,
    title: node.title || null,
    citationHr: node.citationHr || null,
    tableData: node.tableData || null,
  })

  for (const child of node.children) {
    rows.push(...flattenTree(child, parseSnapshotId, node.nodeKey))
  }

  return rows
}

/**
 * Result of persisting a parse snapshot.
 */
export interface PersistResult {
  parseSnapshotId: string
  nodeCount: number
  treeSha256: string
  isNew: boolean // false if snapshot already existed for this evidence+version
}

/**
 * Persist a parsed NN document to the database.
 *
 * Creates an immutable NNParseSnapshot and flattened NNProvisionNode rows.
 * If a snapshot already exists for this evidence+version combo, returns
 * the existing snapshot without modifications.
 *
 * @param db Regulatory Prisma client
 * @param doc Parsed NN document
 * @param evidenceId ID of the Evidence record this was parsed from
 * @returns Persist result with snapshot ID and metadata
 */
export async function persistParseSnapshot(
  db: RegulatoryPrismaClient,
  doc: ParsedNNDocument,
  evidenceId: string
): Promise<PersistResult> {
  const treeSha256 = computeTreeHash(doc.root)

  // Check if snapshot already exists for this evidence+version
  const existing = await db.nNParseSnapshot.findUnique({
    where: {
      evidenceId_parserVersion: {
        evidenceId,
        parserVersion: doc.parserVersion,
      },
    },
  })

  if (existing) {
    return {
      parseSnapshotId: existing.id,
      nodeCount: existing.nodeCount,
      treeSha256: existing.treeSha256,
      isNew: false,
    }
  }

  // Create new snapshot in a transaction
  const result = await db.$transaction(async (tx) => {
    // Create parse snapshot
    // Cast arrays to JSON-compatible format for Prisma
    const eliRelationsJson =
      doc.eli.relations.length > 0
        ? (doc.eli.relations.map((r) => ({
            type: r.type,
            targetEli: r.targetEli,
            rawProperty: r.rawProperty,
          })) as object[])
        : null
    const warningsJson =
      doc.warnings.length > 0
        ? (doc.warnings.map((w) => ({
            code: w.code,
            message: w.message,
            location: w.location,
          })) as object[])
        : null

    const snapshot = await tx.nNParseSnapshot.create({
      data: {
        evidenceId,
        parserName: "nn-parser",
        parserVersion: doc.parserVersion,
        parseStatus: "PARSED",
        eli: doc.eli.eli,
        eliTypeDocument: doc.eli.typeDocument,
        eliNumber: doc.eli.number,
        eliDateDocument: doc.eli.dateDocument ? new Date(doc.eli.dateDocument) : null,
        eliDatePublication: doc.eli.datePublication ? new Date(doc.eli.datePublication) : null,
        eliTitle: doc.eli.title,
        eliPassedBy: doc.eli.passedBy,
        eliRelations: eliRelationsJson,
        treeSha256,
        nodeCount: doc.nodeCount,
        warnings: warningsJson,
      },
    })

    // Flatten tree and bulk insert nodes
    const nodeRows = flattenTree(doc.root, snapshot.id)

    // Insert nodes in batches to avoid parameter limits
    const BATCH_SIZE = 100
    for (let i = 0; i < nodeRows.length; i += BATCH_SIZE) {
      const batch = nodeRows.slice(i, i + BATCH_SIZE)
      await tx.nNProvisionNode.createMany({
        data: batch,
      })
    }

    return {
      parseSnapshotId: snapshot.id,
      nodeCount: nodeRows.length,
      treeSha256,
      isNew: true,
    }
  })

  return result
}

/**
 * Persist a quote anchor after locating a quote in a parsed document.
 *
 * @param db Regulatory Prisma client
 * @param parseSnapshotId ID of the parse snapshot
 * @param quote Original quote text
 * @param normalizedQuote Normalized quote text
 * @param location Quote location result
 * @returns ID of the created quote anchor
 */
export async function persistQuoteAnchor(
  db: RegulatoryPrismaClient,
  parseSnapshotId: string,
  quote: string,
  normalizedQuote: string,
  location: QuoteLocation
): Promise<string> {
  const anchor = await db.nNQuoteAnchor.create({
    data: {
      parseSnapshotId,
      quoteText: quote,
      quoteNorm: normalizedQuote,
      matchNodeKey: location.node.nodeKey,
      matchType: location.matchType,
      matchConfidence: location.confidence,
      normStart: location.normStart ?? null,
      normEnd: location.normEnd ?? null,
    },
  })

  return anchor.id
}

/**
 * Get the latest parse snapshot for an evidence record.
 *
 * @param db Regulatory Prisma client
 * @param evidenceId ID of the Evidence record
 * @returns Latest parse snapshot or null
 */
export async function getLatestParseSnapshot(
  db: RegulatoryPrismaClient,
  evidenceId: string
): Promise<{
  id: string
  parserVersion: string
  parsedAt: Date
  treeSha256: string
  nodeCount: number
} | null> {
  const snapshot = await db.nNParseSnapshot.findFirst({
    where: { evidenceId, parseStatus: "PARSED" },
    orderBy: { parsedAt: "desc" },
    select: {
      id: true,
      parserVersion: true,
      parsedAt: true,
      treeSha256: true,
      nodeCount: true,
    },
  })

  return snapshot
}

/**
 * Get all provision nodes for a parse snapshot.
 *
 * @param db Regulatory Prisma client
 * @param parseSnapshotId ID of the parse snapshot
 * @returns Array of provision node rows
 */
export async function getProvisionNodes(
  db: RegulatoryPrismaClient,
  parseSnapshotId: string
): Promise<
  Array<{
    nodeKey: string
    nodeLabel: string
    nodeType: string
    normSha256: string
    rawText: string
    normText: string
  }>
> {
  const nodes = await db.nNProvisionNode.findMany({
    where: { parseSnapshotId },
    orderBy: { orderIndex: "asc" },
    select: {
      nodeKey: true,
      nodeLabel: true,
      nodeType: true,
      normSha256: true,
      rawText: true,
      normText: true,
    },
  })

  return nodes
}

/**
 * Find a provision node by its key within a parse snapshot.
 *
 * @param db Regulatory Prisma client
 * @param parseSnapshotId ID of the parse snapshot
 * @param nodeKey ASCII canonical path
 * @returns Provision node or null
 */
export async function getProvisionNodeByKey(
  db: RegulatoryPrismaClient,
  parseSnapshotId: string,
  nodeKey: string
): Promise<{
  nodeKey: string
  nodeLabel: string
  nodeType: string
  rawText: string
  normText: string
  normSha256: string
  citationHr: string | null
} | null> {
  const node = await db.nNProvisionNode.findUnique({
    where: {
      parseSnapshotId_nodeKey: {
        parseSnapshotId,
        nodeKey,
      },
    },
    select: {
      nodeKey: true,
      nodeLabel: true,
      nodeType: true,
      rawText: true,
      normText: true,
      normSha256: true,
      citationHr: true,
    },
  })

  return node
}

/**
 * Compare two parse snapshots for the same evidence.
 * Useful for detecting changes across parser versions.
 *
 * @param db Regulatory Prisma client
 * @param snapshotId1 First snapshot ID
 * @param snapshotId2 Second snapshot ID
 * @returns Comparison result
 */
export async function compareSnapshots(
  db: RegulatoryPrismaClient,
  snapshotId1: string,
  snapshotId2: string
): Promise<{
  treeHashMatch: boolean
  nodeCountMatch: boolean
  nodeKeyDiff: {
    added: string[]
    removed: string[]
  }
  normHashDiff: Array<{
    nodeKey: string
    hash1: string
    hash2: string
  }>
}> {
  const [snapshot1, snapshot2, nodes1, nodes2] = await Promise.all([
    db.nNParseSnapshot.findUnique({
      where: { id: snapshotId1 },
      select: { treeSha256: true, nodeCount: true },
    }),
    db.nNParseSnapshot.findUnique({
      where: { id: snapshotId2 },
      select: { treeSha256: true, nodeCount: true },
    }),
    db.nNProvisionNode.findMany({
      where: { parseSnapshotId: snapshotId1 },
      select: { nodeKey: true, normSha256: true },
    }),
    db.nNProvisionNode.findMany({
      where: { parseSnapshotId: snapshotId2 },
      select: { nodeKey: true, normSha256: true },
    }),
  ])

  if (!snapshot1 || !snapshot2) {
    throw new Error("One or both snapshots not found")
  }

  const keys1 = new Set<string>(nodes1.map((n) => n.nodeKey))
  const keys2 = new Set<string>(nodes2.map((n) => n.nodeKey))

  const added: string[] = Array.from(keys2).filter((k) => !keys1.has(k))
  const removed: string[] = Array.from(keys1).filter((k) => !keys2.has(k))

  // Build hash maps
  const hashMap1 = new Map<string, string>(nodes1.map((n) => [n.nodeKey, n.normSha256]))
  const hashMap2 = new Map<string, string>(nodes2.map((n) => [n.nodeKey, n.normSha256]))

  // Find nodes with different hashes
  const normHashDiff: Array<{ nodeKey: string; hash1: string; hash2: string }> = []
  for (const key of Array.from(keys1)) {
    if (keys2.has(key)) {
      const hash1 = hashMap1.get(key)!
      const hash2 = hashMap2.get(key)!
      if (hash1 !== hash2) {
        normHashDiff.push({ nodeKey: key, hash1, hash2 })
      }
    }
  }

  return {
    treeHashMatch: snapshot1.treeSha256 === snapshot2.treeSha256,
    nodeCountMatch: snapshot1.nodeCount === snapshot2.nodeCount,
    nodeKeyDiff: { added, removed },
    normHashDiff,
  }
}
