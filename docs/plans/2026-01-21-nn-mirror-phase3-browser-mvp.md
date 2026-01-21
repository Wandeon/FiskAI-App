# NN Mirror Phase 3: Clean Browser MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build internal-facing browser for navigating gazette items by Issue → Item → Article tree with stable citation links via nodePath.

**Architecture:** Server-rendered Next.js pages with hierarchical navigation. Citation URLs use nodePath for stability. Search within document via cleanText index.

**Tech Stack:** Next.js 15 App Router, React Server Components, Prisma queries, Tailwind CSS

**Reference:** `docs/specs/nn-mirror-v1.md` Phase 3

**Prerequisite:** Phase 1 & 2 complete (ParsedDocument, ProvisionNode, InstrumentEvidenceLink tables populated)

---

## Part A: App Repository (API & UI)

### Task A1: Create NN Browser Route Group

**Files:**

- Create: `src/app/(app)/nn-browser/layout.tsx`
- Create: `src/app/(app)/nn-browser/page.tsx`

**Step 1: Write the layout**

Create: `src/app/(app)/nn-browser/layout.tsx`

```typescript
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "NN Browser | FiskAI",
  description: "Browse Narodne Novine gazette items"
}

export default function NNBrowserLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">
            Narodne Novine Browser
          </h1>
          <span className="text-sm text-gray-500">Internal Tool</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
```

**Step 2: Write the index page (year/issue selector)**

Create: `src/app/(app)/nn-browser/page.tsx`

```typescript
import { dbReg } from "@/lib/db"
import Link from "next/link"

async function getYearStats() {
  // ⚠️ AUDIT FIX: Use docMeta.nnYear for grouping, NOT fetchedAt
  // fetchedAt is when we scraped it, nnYear is the actual publication year
  const stats = await dbReg.$queryRaw<Array<{
    year: number
    issue_count: bigint
    item_count: bigint
  }>>`
    SELECT
      (pd."docMeta"->>'nnYear')::int as year,
      COUNT(DISTINCT (pd."docMeta"->>'nnIssue')::int) as issue_count,
      COUNT(*) as item_count
    FROM "ParsedDocument" pd
    WHERE pd."isLatest" = true
      AND pd.status = 'SUCCESS'
      AND (pd."docMeta"->>'nnYear') IS NOT NULL
    GROUP BY (pd."docMeta"->>'nnYear')::int
    ORDER BY year DESC
  `

  return stats.map(s => ({
    year: s.year,
    issueCount: Number(s.issue_count),
    itemCount: Number(s.item_count)
  }))
}

export default async function NNBrowserIndex() {
  const yearStats = await getYearStats()

  return (
    <div>
      <h2 className="text-lg font-medium text-gray-900 mb-4">
        Browse by Year
      </h2>

      {yearStats.length === 0 ? (
        <p className="text-gray-500">No parsed documents found.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {yearStats.map(({ year, issueCount, itemCount }) => (
            <Link
              key={year}
              href={`/nn-browser/${year}`}
              className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-500 hover:shadow-sm transition-all"
            >
              <div className="text-2xl font-bold text-gray-900">{year}</div>
              <div className="text-sm text-gray-500 mt-1">
                {issueCount} issues · {itemCount} items
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/nn-browser/
git commit -m "feat(nn-browser): add browser route group with year index

Server-rendered year selector showing issue/item counts.
Foundation for hierarchical gazette navigation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A2: Create Year → Issue List Page

**Files:**

- Create: `src/app/(app)/nn-browser/[year]/page.tsx`

**Step 1: Write the year page**

```typescript
import { dbReg } from "@/lib/db"
import Link from "next/link"
import { notFound } from "next/navigation"

interface Props {
  params: { year: string }
}

async function getIssuesForYear(year: number) {
  // ⚠️ AUDIT FIX: Use docMeta.nnYear for filtering, NOT fetchedAt
  // Use docMeta.publishedAt for display date
  const issues = await dbReg.$queryRaw<Array<{
    issue: number
    item_count: bigint
    published_at: Date | null
  }>>`
    SELECT
      (pd."docMeta"->>'nnIssue')::int as issue,
      COUNT(*) as item_count,
      MIN((pd."docMeta"->>'publishedAt')::timestamp) as published_at
    FROM "ParsedDocument" pd
    WHERE pd."isLatest" = true
      AND pd.status = 'SUCCESS'
      AND (pd."docMeta"->>'nnYear')::int = ${year}
    GROUP BY issue
    ORDER BY issue DESC
  `

  return issues.map(i => ({
    issue: i.issue,
    itemCount: Number(i.item_count),
    date: i.published_at
  }))
}

export default async function YearPage({ params }: Props) {
  const year = parseInt(params.year, 10)

  if (isNaN(year) || year < 1990 || year > 2100) {
    notFound()
  }

  const issues = await getIssuesForYear(year)

  if (issues.length === 0) {
    return (
      <div>
        <Breadcrumb year={year} />
        <p className="text-gray-500 mt-4">No issues found for {year}.</p>
      </div>
    )
  }

  return (
    <div>
      <Breadcrumb year={year} />

      <h2 className="text-lg font-medium text-gray-900 mb-4">
        Issues in {year}
      </h2>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {issues.map(({ issue, itemCount, date }) => (
          <Link
            key={issue}
            href={`/nn-browser/${year}/${issue}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div>
              <span className="font-medium text-gray-900">
                NN {issue}/{year}
              </span>
              {date && (
                <span className="text-sm text-gray-500 ml-2">
                  {date.toLocaleDateString("hr-HR")}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Breadcrumb({ year }: { year: number }) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
      <Link href="/nn-browser" className="hover:text-gray-900">
        Browser
      </Link>
      <span>/</span>
      <span className="text-gray-900">{year}</span>
    </nav>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/nn-browser/\[year\]/
git commit -m "feat(nn-browser): add year page with issue list

Shows all NN issues for selected year with item counts.
Breadcrumb navigation for hierarchy.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A3: Create Issue → Item List Page

**Files:**

- Create: `src/app/(app)/nn-browser/[year]/[issue]/page.tsx`

**Step 1: Write the issue page**

```typescript
import { dbReg } from "@/lib/db"
import Link from "next/link"
import { notFound } from "next/navigation"
import { InstrumentEventType } from "@prisma/client"

interface Props {
  params: { year: string; issue: string }
}

async function getItemsForIssue(year: number, issue: number) {
  const items = await dbReg.parsedDocument.findMany({
    where: {
      isLatest: true,
      status: "SUCCESS",
      docMeta: {
        path: ["nnYear"],
        equals: year
      }
    },
    include: {
      evidence: {
        include: {
          instrumentLinks: {
            include: {
              instrument: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  })

  // Filter by issue in JS (Prisma JSON path filtering is limited)
  return items.filter(item => {
    const meta = item.docMeta as Record<string, unknown>
    return meta?.nnIssue === issue
  }).map(item => {
    const meta = item.docMeta as Record<string, unknown>
    const link = item.evidence.instrumentLinks[0]

    return {
      evidenceId: item.evidenceId,
      item: meta?.nnItem as number,
      title: meta?.title as string || "Untitled",
      textType: meta?.textType as string,
      eventType: link?.eventType as InstrumentEventType | undefined,
      instrumentTitle: link?.instrument?.title,
      nodeCount: item.nodeCount,
      coveragePercent: item.coveragePercent
    }
  }).sort((a, b) => (a.item || 0) - (b.item || 0))
}

export default async function IssuePage({ params }: Props) {
  const year = parseInt(params.year, 10)
  const issue = parseInt(params.issue, 10)

  if (isNaN(year) || isNaN(issue)) {
    notFound()
  }

  const items = await getItemsForIssue(year, issue)

  return (
    <div>
      <Breadcrumb year={year} issue={issue} />

      <h2 className="text-lg font-medium text-gray-900 mb-4">
        NN {issue}/{year}
      </h2>

      {items.length === 0 ? (
        <p className="text-gray-500">No items found in this issue.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {items.map((item) => (
            <Link
              key={item.evidenceId}
              href={`/nn-browser/${year}/${issue}/${item.item}`}
              className="block px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">
                      {item.item}.
                    </span>
                    <span className="font-medium text-gray-900 truncate">
                      {item.title}
                    </span>
                  </div>
                  {item.instrumentTitle && (
                    <div className="text-sm text-gray-500 mt-1">
                      → {item.instrumentTitle}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {item.eventType && (
                    <EventTypeBadge type={item.eventType} />
                  )}
                  <span className="text-xs text-gray-400">
                    {item.nodeCount} nodes
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Breadcrumb({ year, issue }: { year: number; issue: number }) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
      <Link href="/nn-browser" className="hover:text-gray-900">
        Browser
      </Link>
      <span>/</span>
      <Link href={`/nn-browser/${year}`} className="hover:text-gray-900">
        {year}
      </Link>
      <span>/</span>
      <span className="text-gray-900">NN {issue}</span>
    </nav>
  )
}

function EventTypeBadge({ type }: { type: InstrumentEventType }) {
  const config: Record<InstrumentEventType, { label: string; color: string }> = {
    ORIGINAL: { label: "Izvorni", color: "bg-green-100 text-green-800" },
    AMENDMENT: { label: "Izmjene", color: "bg-blue-100 text-blue-800" },
    CONSOLIDATED: { label: "Pročišćeni", color: "bg-purple-100 text-purple-800" },
    CORRECTION: { label: "Ispravak", color: "bg-yellow-100 text-yellow-800" },
    DECISION: { label: "Odluka", color: "bg-gray-100 text-gray-800" },
    INTERPRETATION: { label: "Tumačenje", color: "bg-indigo-100 text-indigo-800" },
    REPEAL: { label: "Prestanak", color: "bg-red-100 text-red-800" },
    UNKNOWN: { label: "?", color: "bg-gray-100 text-gray-500" }
  }

  const { label, color } = config[type] || config.UNKNOWN

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/nn-browser/\[year\]/\[issue\]/
git commit -m "feat(nn-browser): add issue page with item list

Shows all items in NN issue with event type badges.
Links to instrument when resolved.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A4: Create Item Detail Page with Article Tree

**Files:**

- Create: `src/app/(app)/nn-browser/[year]/[issue]/[item]/page.tsx`

**Step 1: Write the item detail page**

```typescript
import { dbReg } from "@/lib/db"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ProvisionNodeType } from "@prisma/client"

interface Props {
  params: { year: string; issue: string; item: string }
}

async function getItemDetail(year: number, issue: number, item: number) {
  // Find the parsed document
  const parsedDocs = await dbReg.parsedDocument.findMany({
    where: {
      isLatest: true,
      status: "SUCCESS"
    },
    include: {
      evidence: true,
      nodes: {
        orderBy: [
          { depth: "asc" },
          { orderIndex: "asc" }
        ]
      }
    }
  })

  // Filter by metadata
  const doc = parsedDocs.find(pd => {
    const meta = pd.docMeta as Record<string, unknown>
    return meta?.nnYear === year && meta?.nnIssue === issue && meta?.nnItem === item
  })

  if (!doc) return null

  return {
    parsedDocument: doc,
    evidence: doc.evidence,
    nodes: doc.nodes,
    meta: doc.docMeta as Record<string, unknown>
  }
}

export default async function ItemDetailPage({ params }: Props) {
  const year = parseInt(params.year, 10)
  const issue = parseInt(params.issue, 10)
  const item = parseInt(params.item, 10)

  if (isNaN(year) || isNaN(issue) || isNaN(item)) {
    notFound()
  }

  const detail = await getItemDetail(year, issue, item)

  if (!detail) {
    notFound()
  }

  const { parsedDocument, nodes, meta } = detail

  // Build tree structure
  const tree = buildNodeTree(nodes)

  return (
    <div>
      <Breadcrumb year={year} issue={issue} item={item} />

      {/* Document header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {meta?.title as string || "Untitled Document"}
        </h2>
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          <span>NN {issue}/{year}, br. {item}</span>
          {meta?.textType && <span>• {meta.textType}</span>}
          <span>• {nodes.length} nodes</span>
          <span>• {parsedDocument.coveragePercent?.toFixed(1)}% coverage</span>
        </div>
      </div>

      {/* Article tree */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Document Structure</h3>
        </div>
        <div className="p-4">
          <ArticleTree
            nodes={tree}
            year={year}
            issue={issue}
            item={item}
          />
        </div>
      </div>
    </div>
  )
}

interface TreeNode {
  id: string
  nodePath: string
  nodeType: ProvisionNodeType
  label: string | null
  depth: number
  children: TreeNode[]
}

function buildNodeTree(nodes: Array<{
  id: string
  nodePath: string
  nodeType: ProvisionNodeType
  label: string | null
  depth: number
  parentId: string | null
}>): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  // Create tree nodes
  for (const node of nodes) {
    nodeMap.set(node.id, {
      id: node.id,
      nodePath: node.nodePath,
      nodeType: node.nodeType,
      label: node.label,
      depth: node.depth,
      children: []
    })
  }

  // Build tree
  for (const node of nodes) {
    const treeNode = nodeMap.get(node.id)!
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId)
      if (parent) {
        parent.children.push(treeNode)
      } else {
        roots.push(treeNode)
      }
    } else {
      roots.push(treeNode)
    }
  }

  return roots
}

function ArticleTree({
  nodes,
  year,
  issue,
  item
}: {
  nodes: TreeNode[]
  year: number
  issue: number
  item: number
}) {
  if (nodes.length === 0) {
    return <p className="text-gray-500">No structure found.</p>
  }

  return (
    <ul className="space-y-1">
      {nodes.map(node => (
        <TreeNodeItem
          key={node.id}
          node={node}
          year={year}
          issue={issue}
          item={item}
        />
      ))}
    </ul>
  )
}

function TreeNodeItem({
  node,
  year,
  issue,
  item
}: {
  node: TreeNode
  year: number
  issue: number
  item: number
}) {
  const isArticle = node.nodeType === ProvisionNodeType.CLANAK
  const nodeUrl = `/nn-browser/${year}/${issue}/${item}${node.nodePath}`

  return (
    <li>
      <div
        className="flex items-center py-1 hover:bg-gray-50 rounded px-2 -mx-2"
        style={{ paddingLeft: `${node.depth * 16}px` }}
      >
        <NodeTypeIcon type={node.nodeType} />
        <Link
          href={nodeUrl}
          className={`ml-2 ${isArticle ? "font-medium text-blue-600 hover:underline" : "text-gray-700"}`}
        >
          {node.label || node.nodePath}
        </Link>
      </div>
      {node.children.length > 0 && (
        <ul className="space-y-1">
          {node.children.map(child => (
            <TreeNodeItem
              key={child.id}
              node={child}
              year={year}
              issue={issue}
              item={item}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function NodeTypeIcon({ type }: { type: ProvisionNodeType }) {
  const icons: Partial<Record<ProvisionNodeType, string>> = {
    CLANAK: "§",
    STAVAK: "¶",
    TOCKA: "•",
    PODTOCKA: "◦",
    TITLE: "▸",
    CHAPTER: "▪"
  }

  return (
    <span className="w-4 text-center text-gray-400 text-sm">
      {icons[type] || "·"}
    </span>
  )
}

function Breadcrumb({ year, issue, item }: { year: number; issue: number; item: number }) {
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
      <Link href="/nn-browser" className="hover:text-gray-900">Browser</Link>
      <span>/</span>
      <Link href={`/nn-browser/${year}`} className="hover:text-gray-900">{year}</Link>
      <span>/</span>
      <Link href={`/nn-browser/${year}/${issue}`} className="hover:text-gray-900">NN {issue}</Link>
      <span>/</span>
      <span className="text-gray-900">{item}</span>
    </nav>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/nn-browser/\[year\]/\[issue\]/\[item\]/
git commit -m "feat(nn-browser): add item detail page with article tree

Shows document structure as navigable tree.
Links to individual provisions via nodePath.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A5: Create Provision Detail Page with Stable Citation URL

**Files:**

- Create: `src/app/(app)/nn-browser/[year]/[issue]/[item]/[...nodePath]/page.tsx`

**Step 1: Write the provision detail page**

```typescript
import { dbReg } from "@/lib/db"
import Link from "next/link"
import { notFound } from "next/navigation"

interface Props {
  params: {
    year: string
    issue: string
    item: string
    nodePath: string[]  // Catch-all for /članak:1/stavak:2
  }
}

async function getProvisionDetail(
  year: number,
  issue: number,
  item: number,
  nodePath: string
) {
  // Find parsed document
  const parsedDocs = await dbReg.parsedDocument.findMany({
    where: {
      isLatest: true,
      status: "SUCCESS"
    },
    include: {
      nodes: {
        where: { nodePath }
      },
      cleanTextArtifact: true
    }
  })

  const doc = parsedDocs.find(pd => {
    const meta = pd.docMeta as Record<string, unknown>
    return meta?.nnYear === year && meta?.nnIssue === issue && meta?.nnItem === item
  })

  if (!doc || doc.nodes.length === 0) return null

  const node = doc.nodes[0]

  // Get text from offsets
  let text = node.rawText
  if (!text && doc.cleanTextArtifact) {
    text = doc.cleanTextArtifact.content.substring(
      node.startOffset,
      node.endOffset
    )
  }

  // Get siblings for context
  const siblings = await dbReg.provisionNode.findMany({
    where: {
      parsedDocumentId: doc.id,
      parentId: node.parentId
    },
    orderBy: { orderIndex: "asc" }
  })

  // Get children
  const children = await dbReg.provisionNode.findMany({
    where: {
      parsedDocumentId: doc.id,
      parentId: node.id
    },
    orderBy: { orderIndex: "asc" }
  })

  return {
    node,
    text,
    siblings,
    children,
    meta: doc.docMeta as Record<string, unknown>
  }
}

export default async function ProvisionDetailPage({ params }: Props) {
  const year = parseInt(params.year, 10)
  const issue = parseInt(params.issue, 10)
  const item = parseInt(params.item, 10)
  const nodePath = "/" + params.nodePath.join("/")

  if (isNaN(year) || isNaN(issue) || isNaN(item)) {
    notFound()
  }

  const detail = await getProvisionDetail(year, issue, item, nodePath)

  if (!detail) {
    notFound()
  }

  const { node, text, siblings, children, meta } = detail
  const currentIndex = siblings.findIndex(s => s.id === node.id)
  const prevSibling = currentIndex > 0 ? siblings[currentIndex - 1] : null
  const nextSibling = currentIndex < siblings.length - 1 ? siblings[currentIndex + 1] : null

  const baseUrl = `/nn-browser/${year}/${issue}/${item}`

  return (
    <div>
      <Breadcrumb
        year={year}
        issue={issue}
        item={item}
        nodePath={nodePath}
        title={meta?.title as string}
      />

      {/* Provision content */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-500">{node.nodeType}</span>
            <h2 className="font-medium text-gray-900">{node.label || nodePath}</h2>
          </div>
          <CopyLinkButton url={`${baseUrl}${nodePath}`} />
        </div>
        <div className="p-4">
          <div className="prose prose-sm max-w-none">
            {text || <span className="text-gray-400">No text content</span>}
          </div>
        </div>
      </div>

      {/* Children (if any) */}
      {children.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 mb-6">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Contents</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {children.map(child => (
              <Link
                key={child.id}
                href={`${baseUrl}${child.nodePath}`}
                className="flex items-center px-4 py-2 hover:bg-gray-50"
              >
                <span className="text-gray-500 mr-2">{child.label}</span>
                <span className="text-sm text-gray-400 truncate">
                  {child.rawText?.substring(0, 80)}...
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {prevSibling ? (
          <Link
            href={`${baseUrl}${prevSibling.nodePath}`}
            className="flex items-center text-sm text-blue-600 hover:underline"
          >
            ← {prevSibling.label || "Previous"}
          </Link>
        ) : (
          <div />
        )}
        {nextSibling && (
          <Link
            href={`${baseUrl}${nextSibling.nodePath}`}
            className="flex items-center text-sm text-blue-600 hover:underline"
          >
            {nextSibling.label || "Next"} →
          </Link>
        )}
      </div>
    </div>
  )
}

function Breadcrumb({
  year,
  issue,
  item,
  nodePath,
  title
}: {
  year: number
  issue: number
  item: number
  nodePath: string
  title?: string
}) {
  // Parse nodePath into segments
  const segments = nodePath.split("/").filter(Boolean)

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mb-4">
      <Link href="/nn-browser" className="hover:text-gray-900">Browser</Link>
      <span>/</span>
      <Link href={`/nn-browser/${year}`} className="hover:text-gray-900">{year}</Link>
      <span>/</span>
      <Link href={`/nn-browser/${year}/${issue}`} className="hover:text-gray-900">NN {issue}</Link>
      <span>/</span>
      <Link href={`/nn-browser/${year}/${issue}/${item}`} className="hover:text-gray-900">
        {title?.substring(0, 30) || `Item ${item}`}
      </Link>
      {segments.map((segment, i) => {
        const partialPath = "/" + segments.slice(0, i + 1).join("/")
        const isLast = i === segments.length - 1
        return (
          <span key={i} className="flex items-center gap-2">
            <span>/</span>
            {isLast ? (
              <span className="text-gray-900">{segment}</span>
            ) : (
              <Link
                href={`/nn-browser/${year}/${issue}/${item}${partialPath}`}
                className="hover:text-gray-900"
              >
                {segment}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

function CopyLinkButton({ url }: { url: string }) {
  return (
    <button
      className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:border-gray-300"
      onClick={() => navigator.clipboard?.writeText(window.location.origin + url)}
    >
      Copy Link
    </button>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/nn-browser/
git commit -m "feat(nn-browser): add provision detail page with stable citation URLs

Catch-all route for nodePath enables /članak:1/stavak:2 URLs.
Shows provision text with sibling navigation.
Copy link button for stable citations.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A6: Add Document Search Component

**Files:**

- Create: `src/app/(app)/nn-browser/[year]/[issue]/[item]/search.tsx`
- Modify: `src/app/(app)/nn-browser/[year]/[issue]/[item]/page.tsx`

**Step 1: Create the search component**

Create: `src/app/(app)/nn-browser/[year]/[issue]/[item]/search.tsx`

```typescript
"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

interface SearchResult {
  nodePath: string
  label: string | null
  snippet: string
  matchCount: number
}

interface Props {
  parsedDocumentId: string
  year: number
  issue: number
  item: number
}

export function DocumentSearch({ parsedDocumentId, year, issue, item }: Props) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([])
      return
    }

    startTransition(async () => {
      const response = await fetch(
        `/api/nn-browser/search?docId=${parsedDocumentId}&q=${encodeURIComponent(query)}`
      )
      const data = await response.json()
      setResults(data.results || [])
    })
  }

  const baseUrl = `/nn-browser/${year}/${issue}/${item}`

  return (
    <div className="bg-white rounded-lg border border-gray-200 mb-6">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Search in Document</h3>
      </div>
      <div className="p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search provisions..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            disabled={isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "..." : "Search"}
          </button>
        </div>

        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-sm text-gray-500 mb-2">
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </div>
            {results.map((result, i) => (
              <button
                key={i}
                onClick={() => router.push(`${baseUrl}${result.nodePath}`)}
                className="w-full text-left p-3 border border-gray-200 rounded-md hover:border-blue-500 hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-gray-900">
                  {result.label || result.nodePath}
                </div>
                <div
                  className="text-sm text-gray-600 mt-1"
                  dangerouslySetInnerHTML={{
                    __html: result.snippet.replace(
                      new RegExp(`(${query})`, "gi"),
                      "<mark class='bg-yellow-200'>$1</mark>"
                    )
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {query && results.length === 0 && !isPending && (
          <div className="mt-4 text-sm text-gray-500">
            No results found for "{query}"
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Create the search API route**

Create: `src/app/api/nn-browser/search/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { dbReg } from "@/lib/db"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const docId = searchParams.get("docId")
  const query = searchParams.get("q")

  if (!docId || !query) {
    return NextResponse.json({ results: [] })
  }

  const normalizedQuery = query.toLowerCase().trim()

  // Get all nodes with text
  const nodes = await dbReg.provisionNode.findMany({
    where: {
      parsedDocumentId: docId,
      rawText: { not: null },
    },
    select: {
      nodePath: true,
      label: true,
      rawText: true,
    },
  })

  // Filter and rank by match
  const results = nodes
    .filter((node) => node.rawText?.toLowerCase().includes(normalizedQuery))
    .map((node) => {
      const text = node.rawText || ""
      const lowerText = text.toLowerCase()
      const matchIndex = lowerText.indexOf(normalizedQuery)

      // Extract snippet around match
      const snippetStart = Math.max(0, matchIndex - 50)
      const snippetEnd = Math.min(text.length, matchIndex + query.length + 50)
      let snippet = text.substring(snippetStart, snippetEnd)

      if (snippetStart > 0) snippet = "..." + snippet
      if (snippetEnd < text.length) snippet = snippet + "..."

      // Count matches
      const matchCount = (lowerText.match(new RegExp(normalizedQuery, "g")) || []).length

      return {
        nodePath: node.nodePath,
        label: node.label,
        snippet,
        matchCount,
      }
    })
    .sort((a, b) => b.matchCount - a.matchCount)
    .slice(0, 20)

  return NextResponse.json({ results })
}
```

**Step 3: Add search to item page**

Update `src/app/(app)/nn-browser/[year]/[issue]/[item]/page.tsx` to include the search component after the header and before the tree.

**Step 4: Commit**

```bash
git add src/app/\(app\)/nn-browser/ src/app/api/nn-browser/
git commit -m "feat(nn-browser): add document search with highlighted results

Client-side search component with API backend.
Searches provision text and shows snippets with highlights.
Navigates to matching nodePath on click.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A7: Add Instrument Timeline View

**Files:**

- Create: `src/app/(app)/nn-browser/instrument/[id]/page.tsx`

**Step 1: Write the instrument timeline page**

```typescript
import { dbReg } from "@/lib/db"
import Link from "next/link"
import { notFound } from "next/navigation"
import { InstrumentEventType } from "@prisma/client"

interface Props {
  params: { id: string }
}

async function getInstrumentTimeline(id: string) {
  const instrument = await dbReg.instrument.findUnique({
    where: { id },
    include: {
      evidenceLinks: {
        orderBy: { publishedAt: "asc" },
        include: {
          evidence: {
            include: {
              parsedDocuments: {
                where: { isLatest: true },
                take: 1
              }
            }
          }
        }
      },
      coverage: true
    }
  })

  if (!instrument) return null

  return instrument
}

export default async function InstrumentTimelinePage({ params }: Props) {
  const instrument = await getInstrumentTimeline(params.id)

  if (!instrument) {
    notFound()
  }

  const { evidenceLinks, coverage } = instrument

  return (
    <div>
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/nn-browser" className="hover:text-gray-900">Browser</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Instrument Timeline</span>
      </nav>

      {/* Instrument header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {instrument.title}
        </h2>
        {instrument.shortTitle && (
          <div className="text-gray-500 mt-1">{instrument.shortTitle}</div>
        )}
        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
          {instrument.eliUri && <span>ELI: {instrument.eliUri}</span>}
          <span>• {evidenceLinks.length} gazette items</span>
          {coverage && (
            <>
              <span>• {coverage.startDate?.toLocaleDateString("hr-HR")} – {coverage.endDate?.toLocaleDateString("hr-HR") || "present"}</span>
            </>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Timeline</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {evidenceLinks.map((link, index) => {
            const meta = link.evidence.parsedDocuments[0]?.docMeta as Record<string, unknown>
            const nnYear = meta?.nnYear as number
            const nnIssue = meta?.nnIssue as number
            const nnItem = meta?.nnItem as number

            return (
              <div key={link.id} className="px-4 py-3 flex items-start gap-4">
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${
                    link.eventType === InstrumentEventType.ORIGINAL
                      ? "bg-green-500"
                      : link.eventType === InstrumentEventType.REPEAL
                        ? "bg-red-500"
                        : "bg-blue-500"
                  }`} />
                  {index < evidenceLinks.length - 1 && (
                    <div className="w-0.5 h-full bg-gray-200 mt-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <EventTypeBadge type={link.eventType} />
                    <span className="text-sm text-gray-500">
                      {link.publishedAt?.toLocaleDateString("hr-HR")}
                    </span>
                  </div>
                  <div className="mt-1">
                    {nnYear && nnIssue && nnItem ? (
                      <Link
                        href={`/nn-browser/${nnYear}/${nnIssue}/${nnItem}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        NN {nnIssue}/{nnYear}, br. {nnItem}
                      </Link>
                    ) : (
                      <span className="text-gray-700">
                        {meta?.title as string || "Untitled"}
                      </span>
                    )}
                  </div>
                  {link.effectiveFrom && (
                    <div className="text-sm text-gray-500 mt-1">
                      Effective from: {link.effectiveFrom.toLocaleDateString("hr-HR")}
                    </div>
                  )}
                </div>

                {/* Confidence badge */}
                <div className={`text-xs px-2 py-1 rounded ${
                  link.confidence === "HIGH"
                    ? "bg-green-100 text-green-800"
                    : link.confidence === "MEDIUM"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-600"
                }`}>
                  {link.confidence}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function EventTypeBadge({ type }: { type: InstrumentEventType }) {
  const config: Record<InstrumentEventType, { label: string; color: string }> = {
    ORIGINAL: { label: "Izvorni tekst", color: "bg-green-100 text-green-800" },
    AMENDMENT: { label: "Izmjene", color: "bg-blue-100 text-blue-800" },
    CONSOLIDATED: { label: "Pročišćeni", color: "bg-purple-100 text-purple-800" },
    CORRECTION: { label: "Ispravak", color: "bg-yellow-100 text-yellow-800" },
    DECISION: { label: "Odluka", color: "bg-gray-100 text-gray-800" },
    INTERPRETATION: { label: "Tumačenje", color: "bg-indigo-100 text-indigo-800" },
    REPEAL: { label: "Prestanak", color: "bg-red-100 text-red-800" },
    UNKNOWN: { label: "?", color: "bg-gray-100 text-gray-500" }
  }

  const { label, color } = config[type] || config.UNKNOWN

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(app\)/nn-browser/instrument/
git commit -m "feat(nn-browser): add instrument timeline view

Visual timeline of all gazette items for an instrument.
Shows event types, dates, and confidence levels.
Links to individual gazette items.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

### Task A8: Add Browse by Instrument Index

**Files:**

- Create: `src/app/(app)/nn-browser/instruments/page.tsx`

**Step 1: Write the instruments index page**

```typescript
import { dbReg } from "@/lib/db"
import Link from "next/link"

async function getInstruments() {
  const instruments = await dbReg.instrument.findMany({
    where: { status: "TRACKING" },
    include: {
      _count: {
        select: { evidenceLinks: true }
      },
      coverage: true
    },
    orderBy: { title: "asc" }
  })

  return instruments
}

export default async function InstrumentsIndexPage() {
  const instruments = await getInstruments()

  return (
    <div>
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/nn-browser" className="hover:text-gray-900">Browser</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Instruments</span>
      </nav>

      <h2 className="text-lg font-medium text-gray-900 mb-4">
        Browse by Instrument ({instruments.length})
      </h2>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {instruments.map(instrument => (
          <Link
            key={instrument.id}
            href={`/nn-browser/instrument/${instrument.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900 truncate">
                {instrument.title}
              </div>
              {instrument.shortTitle && (
                <div className="text-sm text-gray-500">
                  {instrument.shortTitle}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 ml-4">
              <span className="text-sm text-gray-500">
                {instrument._count.evidenceLinks} items
              </span>
              {instrument.coverage?.startDate && (
                <span className="text-sm text-gray-400">
                  {instrument.coverage.startDate.getFullYear()}–
                  {instrument.coverage.endDate?.getFullYear() || "present"}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Add navigation link to main browser page**

Update `src/app/(app)/nn-browser/page.tsx` to include a link to `/nn-browser/instruments`.

**Step 3: Commit**

```bash
git add src/app/\(app\)/nn-browser/
git commit -m "feat(nn-browser): add instruments index page

Lists all tracked instruments with gazette item counts.
Links to individual instrument timelines.
Alternative navigation path to year-based browsing.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Exit Criteria Verification

> **AUDIT FIX:** Exit criteria now include proper grouping verification and Parse Debug View.

After completing all tasks, verify:

| Criteria                  | Verification                                                 |
| ------------------------- | ------------------------------------------------------------ |
| Year index loads          | `/nn-browser` shows years with counts (using docMeta.nnYear) |
| Issue navigation works    | `/nn-browser/2024` shows issues (using docMeta.nnIssue)      |
| Item list loads           | `/nn-browser/2024/100` shows items (using docMeta.nnItem)    |
| Article tree renders      | Item page shows hierarchical tree with parentId links        |
| Citation URLs work        | `/nn-browser/2024/100/1/članak:1/stavak:2` loads provision   |
| Search returns results    | Document search finds matching text                          |
| Instrument timeline works | `/nn-browser/instrument/{id}` shows timeline                 |
| **Parse Debug View**      | `/nn-browser/debug/{evidenceId}` shows parse diagnostics     |
| **URL routing correct**   | URLs use (nnYear, nnIssue, nnItem) + nodePath, NOT fetchedAt |
| Internal dogfooding       | Team uses browser for 2 weeks                                |

---

## Task A9: Add Parse Debug View Page (AUDIT FIX)

> **AUDIT FIX:** Add a debug page to inspect parse results, offsets, and warnings.

**Files:**

- Create: `src/app/(app)/nn-browser/debug/[evidenceId]/page.tsx`

**Step 1: Create the debug page**

```typescript
import { dbReg } from "@/lib/db"
import { notFound } from "next/navigation"

interface Props {
  params: { evidenceId: string }
}

async function getParseDebugData(evidenceId: string) {
  const evidence = await dbReg.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      parsedDocuments: {
        where: { isLatest: true },
        include: {
          nodes: {
            orderBy: { startOffset: "asc" },
          },
          cleanTextArtifact: true,
        },
      },
      artifacts: true,
    },
  })
  return evidence
}

export default async function ParseDebugPage({ params }: Props) {
  const data = await getParseDebugData(params.evidenceId)

  if (!data) {
    notFound()
  }

  const parsedDoc = data.parsedDocuments[0]
  const cleanText = parsedDoc?.cleanTextArtifact?.content || ""
  const docMeta = (parsedDoc?.docMeta as Record<string, unknown>) || {}

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Parse Debug: {params.evidenceId}</h2>

      {/* Document Metadata */}
      <section className="bg-white rounded-lg border p-4">
        <h3 className="font-medium mb-2">Document Metadata</h3>
        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">
          {JSON.stringify(docMeta, null, 2)}
        </pre>
      </section>

      {/* Parse Status */}
      <section className="bg-white rounded-lg border p-4">
        <h3 className="font-medium mb-2">Parse Status</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>Status:</dt><dd className="font-mono">{parsedDoc?.status}</dd>
          <dt>Node Count:</dt><dd className="font-mono">{parsedDoc?.nodeCount}</dd>
          <dt>Coverage:</dt><dd className="font-mono">{parsedDoc?.coveragePercent?.toFixed(1)}%</dd>
          <dt>Clean Text Length:</dt><dd className="font-mono">{parsedDoc?.cleanTextLength}</dd>
        </dl>
      </section>

      {/* Warnings */}
      {parsedDoc?.warnings && (
        <section className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
          <h3 className="font-medium mb-2">Warnings ({(parsedDoc.warnings as unknown[]).length})</h3>
          <ul className="text-sm space-y-1">
            {(parsedDoc.warnings as Array<{code: string; message: string; nodePath?: string}>).map((w, i) => (
              <li key={i} className="font-mono">
                [{w.code}] {w.message} {w.nodePath && `@ ${w.nodePath}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Node Offset Verification */}
      <section className="bg-white rounded-lg border p-4">
        <h3 className="font-medium mb-2">Node Offsets (first 20)</h3>
        <table className="text-xs w-full">
          <thead>
            <tr className="text-left">
              <th>Path</th>
              <th>Start</th>
              <th>End</th>
              <th>Match?</th>
              <th>Extract Preview</th>
            </tr>
          </thead>
          <tbody>
            {parsedDoc?.nodes.slice(0, 20).map((node) => {
              const extracted = cleanText.substring(node.startOffset, node.endOffset)
              const matches = node.rawText ? extracted === node.rawText : "N/A"
              return (
                <tr key={node.id} className="border-t">
                  <td className="font-mono">{node.nodePath}</td>
                  <td>{node.startOffset}</td>
                  <td>{node.endOffset}</td>
                  <td className={matches === true ? "text-green-600" : matches === false ? "text-red-600" : ""}>
                    {String(matches)}
                  </td>
                  <td className="truncate max-w-xs">{extracted.substring(0, 50)}...</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
```

**Step 2: Add link from item page**

Update item page to include debug link for staff:

```typescript
// Add at bottom of item detail page
{session?.user?.systemRole === "ADMIN" && (
  <Link
    href={`/nn-browser/debug/${evidence.id}`}
    className="text-xs text-gray-400 hover:text-gray-600"
  >
    [Debug Parse]
  </Link>
)}
```

**Step 3: Commit**

```bash
git add src/app/\(app\)/nn-browser/debug/
git commit -m "feat(nn-browser): add Parse Debug View page

AUDIT FIX: Internal page for inspecting parse results, offsets, warnings.
Verifies PARSE-INV-003 offset integrity visually.
Admin-only access.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Notes for Implementer

1. **URL encoding**: nodePath contains Croatian characters (članak, stavak). Next.js handles URL encoding automatically, but verify Cyrillic/Latin works.

2. **Performance**: For large documents (100+ nodes), consider pagination or virtualization in the tree view.

3. **Search**: Current implementation is basic text search. For production, consider PostgreSQL full-text search or a dedicated search index.

4. **Copy Link button**: Requires client-side JavaScript. Add a fallback for SSR or use a Server Action.

5. **Authorization**: This is marked as internal tool. Ensure route is protected by authentication middleware.

6. **⚠️ AUDIT FIX - Navigation URLs**: All navigation MUST use (nnYear, nnIssue, nnItem) from docMeta, NOT Evidence.fetchedAt. This ensures proper chronological ordering and stable URLs.

7. **⚠️ AUDIT FIX - Tree requires parentId**: The tree rendering assumes ProvisionNode.parentId is populated. This is done in Phase 1. Verify Phase 1 exit criteria before Phase 3.
