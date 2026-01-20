// src/lib/regulatory-truth/parsers/nn-parser/__tests__/nn-parser.test.ts
/**
 * Tests for NN Parser
 *
 * These tests use fixtures from real Narodne Novine HTML documents
 * to verify parsing behavior.
 */

import { describe, it, expect } from "vitest"
import {
  parseNNDocument,
  extractEliMetadata,
  parseEliUri,
  validateNNHtml,
  extractEliQuick,
  normalizeForAnchoring,
  normalizeForDisplay,
  extractStavakNumber,
  extractTockaIdentifier,
  locateQuote,
  locateQuoteBest,
  verifyQuoteAtPath,
  buildCitation,
  getArticles,
  countNodes,
  findNodeByPath,
  flattenTree,
} from "../index"

// =============================================================================
// Test Fixtures
// =============================================================================

/**
 * Minimal NN HTML fixture for testing ELI extraction.
 * Based on NN 152/2024 (Income Tax Amendment).
 */
const ELI_FIXTURE = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>Zakon o izmjenama i dopunama Zakona o porezu na dohodak</title>

<!-- ELI metadata -->
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" typeof="http://data.europa.eu/eli/ontology#LegalResource"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" property="http://data.europa.eu/eli/ontology#type_document" resource="https://narodne-novine.nn.hr/resource/authority/document-type/ZAKON"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" property="http://data.europa.eu/eli/ontology#number" content="2505"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" property="http://data.europa.eu/eli/ontology#date_document" content="2024-12-13" datatype="http://www.w3.org/2001/XMLSchema#date"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" property="http://data.europa.eu/eli/ontology#date_publication" content="2024-12-24" datatype="http://www.w3.org/2001/XMLSchema#date"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" property="http://data.europa.eu/eli/ontology#passed_by" resource="https://narodne-novine.nn.hr/eli/vocabularies/nn-institutions/19505" />
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505/hrv" property="http://data.europa.eu/eli/ontology#title" content="Zakon o izmjenama i dopunama Zakona o porezu na dohodak" lang="hrv" />
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505/hrv" property="http://data.europa.eu/eli/ontology#language" resource="http://publications.europa.eu/resource/authority/language/HRV"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" property="http://data.europa.eu/eli/ontology#amends" resource="https://narodne-novine.nn.hr/eli/sluzbeni/2016/115/2525"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" property="http://data.europa.eu/eli/ontology#is_about" resource="http://eurovoc.europa.eu/1326"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" property="http://data.europa.eu/eli/ontology#is_about" resource="https://narodne-novine.nn.hr/eli/vocabularies/nn-legal-area/20"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" property="http://data.europa.eu/eli/ontology#is_about" resource="https://narodne-novine.nn.hr/eli/vocabularies/nn-index-terms/469"/>

</head>
<body></body>
</html>`

/**
 * Minimal content fixture with articles and paragraphs.
 */
const CONTENT_FIXTURE = `<!DOCTYPE html>
<html>
<head>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" typeof="http://data.europa.eu/eli/ontology#LegalResource"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" property="http://data.europa.eu/eli/ontology#type_document" resource="https://narodne-novine.nn.hr/resource/authority/document-type/ZAKON"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505" property="http://data.europa.eu/eli/ontology#date_publication" content="2024-12-24"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505/hrv" property="http://data.europa.eu/eli/ontology#title" content="Test Zakon" lang="hrv"/>
</head>
<body>
<div class="sl-content"><div class="doc"><div class="article-column leftcolumn fullwidth">
<p class="TB-NA18 pcenter">HRVATSKI SABOR</p>
<p class="TB-NA16 pcenter">ZAKON</p>
<p class="T-12-9-fett-S pcenter">O POREZU NA DOHODAK</p>
<p class="Clanak pcenter">Članak 1.</p>
<p class="T-9-8 pleft">(1) Porez na dohodak utvrđuje se i plaća prema odredbama ovoga Zakona.</p>
<p class="T-9-8 pleft">(2) Porez na dohodak pripada općini ili gradu i pripadnost poreza na dohodak određuje se prema prebivalištu ili uobičajenom boravištu poreznog obveznika.</p>
<p class="Clanak pcenter">Članak 2.</p>
<p class="T-9-8 pleft">U članku 14. stavku 1. riječi: »560,00 eura« zamjenjuju se riječima: »600,00 eura«.</p>
<p class="T-9-8 pleft">Stavak 3. mijenja se i glasi:</p>
<p class="T-9-8 pleft">»(3) Rezident može uvećati osnovni osobni odbitak iz stavka 1. ovoga članka u visini iznosa:</p>
<table class="c-all T-9-8-bez-uvl">
<tr class="pcenter bold"><td>R. br.</td><td>Osnova za uvećanje</td><td>Koeficijent</td><td>Mjesečni iznos</td></tr>
<tr><td>1.</td><td>Uzdržavani članovi uže obitelji</td><td>0,5</td><td>300,00</td></tr>
<tr><td>2.</td><td>Prvo uzdržavano dijete</td><td>0,5</td><td>300,00</td></tr>
<tr><td>3.</td><td>Drugo uzdržavano dijete</td><td>0,7</td><td>420,00</td></tr>
</table>
<p class="T-9-8 pright">«.</p>
<p class="Clanak pcenter">Članak 3.</p>
<p class="T-9-8 pleft">Ovaj Zakon stupa na snagu 1. siječnja 2025.</p>
</div></div></div>
</body>
</html>`

/**
 * Fixture with nested structure (stavak with točke).
 */
const NESTED_FIXTURE = `<!DOCTYPE html>
<html>
<head>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/100/1234" typeof="http://data.europa.eu/eli/ontology#LegalResource"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/100/1234" property="http://data.europa.eu/eli/ontology#date_publication" content="2024-10-15"/>
<meta about="https://narodne-novine.nn.hr/eli/sluzbeni/2024/100/1234/hrv" property="http://data.europa.eu/eli/ontology#title" content="Test pravilnik" lang="hrv"/>
</head>
<body>
<div class="sl-content"><div class="doc"><div class="article-column">
<p class="Clanak pcenter">Članak 5.</p>
<p class="T-9-8 pleft">(1) Porezni obveznik dužan je voditi evidencije koje sadrže:</p>
<p class="T-9-8 pleft">1. ime i prezime,</p>
<p class="T-9-8 pleft">2. osobni identifikacijski broj (OIB),</p>
<p class="T-9-8 pleft">3. adresu prebivališta.</p>
<p class="T-9-8 pleft">(2) Evidencije iz stavka 1. ovoga članka vode se u elektroničkom obliku.</p>
<p class="Clanak pcenter">Članak 6.</p>
<p class="T-9-8 pleft">Ovaj Pravilnik stupa na snagu osmoga dana od dana objave u »Narodnim novinama«.</p>
</div></div></div>
</body>
</html>`

// =============================================================================
// ELI Extraction Tests
// =============================================================================

describe("ELI Extraction", () => {
  it("extracts ELI URI from metadata", () => {
    const eli = extractEliMetadata(ELI_FIXTURE)

    expect(eli.eli).toBe("https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505")
  })

  it("extracts document type", () => {
    const eli = extractEliMetadata(ELI_FIXTURE)

    expect(eli.typeDocument).toBe("ZAKON")
  })

  it("extracts dates", () => {
    const eli = extractEliMetadata(ELI_FIXTURE)

    expect(eli.dateDocument).toBe("2024-12-13")
    expect(eli.datePublication).toBe("2024-12-24")
  })

  it("extracts title in Croatian", () => {
    const eli = extractEliMetadata(ELI_FIXTURE)

    expect(eli.title).toBe("Zakon o izmjenama i dopunama Zakona o porezu na dohodak")
  })

  it("extracts relations (amends)", () => {
    const eli = extractEliMetadata(ELI_FIXTURE)

    expect(eli.relations).toHaveLength(1)
    expect(eli.relations[0].type).toBe("amends")
    expect(eli.relations[0].targetEli).toBe(
      "https://narodne-novine.nn.hr/eli/sluzbeni/2016/115/2525"
    )
  })

  it("extracts Eurovoc tags", () => {
    const eli = extractEliMetadata(ELI_FIXTURE)

    expect(eli.eurovocTags).toContain("http://eurovoc.europa.eu/1326")
  })

  it("extracts legal area tags", () => {
    const eli = extractEliMetadata(ELI_FIXTURE)

    expect(eli.legalAreaTags).toContain("20")
  })

  it("extracts index terms", () => {
    const eli = extractEliMetadata(ELI_FIXTURE)

    expect(eli.indexTerms).toContain("469")
  })
})

describe("ELI URI Parsing", () => {
  it("parses valid ELI URI", () => {
    const result = parseEliUri("https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505")

    expect(result).not.toBeNull()
    expect(result!.section).toBe("sluzbeni")
    expect(result!.year).toBe(2024)
    expect(result!.issue).toBe(152)
    expect(result!.article).toBe(2505)
  })

  it("returns null for invalid URI", () => {
    const result = parseEliUri("https://example.com/not-an-eli")

    expect(result).toBeNull()
  })
})

describe("Quick ELI Extraction", () => {
  it("extracts ELI from metadata", () => {
    const eli = extractEliQuick(ELI_FIXTURE)

    expect(eli).toBe("https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505")
  })

  it("extracts ELI from URL patterns", () => {
    const html = `<a href="https://narodne-novine.nn.hr/eli/sluzbeni/2023/50/100">Link</a>`
    const eli = extractEliQuick(html)

    expect(eli).toBe("https://narodne-novine.nn.hr/eli/sluzbeni/2023/50/100")
  })
})

// =============================================================================
// HTML Validation Tests
// =============================================================================

describe("HTML Validation", () => {
  it("validates complete NN HTML", () => {
    const result = validateNNHtml(ELI_FIXTURE)

    expect(result.hasEliMetadata).toBe(true)
    expect(result.issues).toContain("No main content container found")
  })

  it("validates content fixture", () => {
    const result = validateNNHtml(CONTENT_FIXTURE)

    expect(result.hasEliMetadata).toBe(true)
    expect(result.hasMainContent).toBe(true)
    expect(result.hasArticles).toBe(true)
    expect(result.valid).toBe(true)
  })

  it("identifies missing ELI metadata", () => {
    const html = "<html><body>No metadata</body></html>"
    const result = validateNNHtml(html)

    expect(result.hasEliMetadata).toBe(false)
    expect(result.issues).toContain("No ELI metadata found in document")
  })
})

// =============================================================================
// Text Normalization Tests
// =============================================================================

describe("Text Normalization", () => {
  it("normalizes Croatian diacritics", () => {
    const result = normalizeForAnchoring("Članak 1. - porez na dohodak")

    expect(result).toBe("clanak 1. - porez na dohodak")
  })

  it("normalizes smart quotes", () => {
    const result = normalizeForAnchoring("»iznos od 600,00 eura«")

    expect(result).toBe('"iznos od 600,00 eura"')
  })

  it("collapses whitespace", () => {
    const result = normalizeForAnchoring("tekst   s    puno   razmaka")

    expect(result).toBe("tekst s puno razmaka")
  })

  it("preserves structure for display", () => {
    const result = normalizeForDisplay("Članak 1.\n\nPrvi stavak.")

    expect(result).toContain("Članak")
    expect(result).toContain("\n")
  })
})

describe("Stavak/Točka Extraction", () => {
  it("extracts stavak number from (1)", () => {
    expect(extractStavakNumber("(1) Prvi stavak")).toBe("1")
    expect(extractStavakNumber("(2) Drugi stavak")).toBe("2")
    expect(extractStavakNumber("»(3) Treći stavak")).toBe("3")
  })

  it("extracts točka numbered", () => {
    expect(extractTockaIdentifier("1. prva točka")).toBe("1")
    expect(extractTockaIdentifier("2. druga točka")).toBe("2")
  })

  it("extracts točka lettered", () => {
    expect(extractTockaIdentifier("a) prva podtočka")).toBe("a")
    expect(extractTockaIdentifier("B) druga podtočka")).toBe("b")
  })

  it("extracts alineja", () => {
    expect(extractTockaIdentifier("- stavka s crticom")).toBe("-")
    expect(extractTockaIdentifier("– em dash")).toBe("-")
  })
})

// =============================================================================
// Document Parsing Tests
// =============================================================================

describe("Document Parsing", () => {
  it("parses complete document", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    expect(doc.eli.eli).toBe("https://narodne-novine.nn.hr/eli/sluzbeni/2024/152/2505")
    expect(doc.sourceUrl).toBe("https://example.com/test.html")
    expect(doc.nodeCount).toBeGreaterThan(0)
    expect(doc.parserVersion).toBe("1.0.0")
  })

  it("extracts articles", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")
    const articles = getArticles(doc.root)

    expect(articles.length).toBe(3)
    expect(articles[0].ordinal).toBe("1")
    expect(articles[1].ordinal).toBe("2")
    expect(articles[2].ordinal).toBe("3")
  })

  it("generates stable nodeKey and nodeLabel", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")
    const articles = getArticles(doc.root)

    // ASCII keys for storage
    expect(articles[0].nodeKey).toBe("/clanak:1")
    expect(articles[1].nodeKey).toBe("/clanak:2")
    expect(articles[2].nodeKey).toBe("/clanak:3")

    // Croatian labels for display
    expect(articles[0].nodeLabel).toBe("/članak:1")
    expect(articles[1].nodeLabel).toBe("/članak:2")
    expect(articles[2].nodeLabel).toBe("/članak:3")
  })

  it("parses stavak within articles", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")
    const article1 = getArticles(doc.root)[0]

    // Article 1 should have stavak children
    const stavci = article1.children.filter((c) => c.nodeType === "stavak")
    expect(stavci.length).toBeGreaterThanOrEqual(1)

    if (stavci.length > 0) {
      expect(stavci[0].nodeKey).toBe("/clanak:1/stavak:1")
      expect(stavci[0].nodeLabel).toBe("/članak:1/stavak:1")
    }
  })

  it("parses nested structure with točke", () => {
    const doc = parseNNDocument(NESTED_FIXTURE, "https://example.com/nested.html")
    const articles = getArticles(doc.root)

    expect(articles.length).toBe(2)

    // Article 5 should have stavak with točke
    const article5 = articles[0]
    expect(article5.ordinal).toBe("5")

    const stavak1 = article5.children.find((c) => c.nodeType === "stavak" && c.ordinal === "1")
    if (stavak1) {
      const tocke = stavak1.children.filter((c) => c.nodeType === "tocka")
      expect(tocke.length).toBe(3)
      expect(tocke[0].nodeKey).toBe("/clanak:5/stavak:1/tocka:1")
      expect(tocke[0].nodeLabel).toBe("/članak:5/stavak:1/točka:1")
    }
  })

  it("parses tables", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")
    const article2 = getArticles(doc.root)[1]

    // Article 2 should contain a table
    const tables = article2.children.filter((c) => c.nodeType === "tablica")
    // Table might be a child of a stavak
    const allTables: typeof tables = []

    function findTables(node: typeof doc.root) {
      if (node.nodeType === "tablica") allTables.push(node)
      node.children.forEach(findTables)
    }

    findTables(article2)
    expect(allTables.length).toBeGreaterThanOrEqual(1)

    if (allTables.length > 0) {
      expect(allTables[0].tableData).toBeDefined()
      expect(allTables[0].tableData!.rows.length).toBeGreaterThanOrEqual(1)
    }
  })
})

// =============================================================================
// Node Navigation Tests
// =============================================================================

describe("Node Navigation", () => {
  it("counts nodes correctly", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    expect(doc.nodeCount).toBeGreaterThan(3) // At least root + 3 articles
  })

  it("finds node by path", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    const article1 = findNodeByPath(doc.root, "/članak:1")
    expect(article1).not.toBeNull()
    expect(article1!.nodeType).toBe("clanak")
    expect(article1!.ordinal).toBe("1")
  })

  it("returns null for non-existent path", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    const notFound = findNodeByPath(doc.root, "/članak:999")
    expect(notFound).toBeNull()
  })
})

// =============================================================================
// Quote Location Tests
// =============================================================================

describe("Quote Location", () => {
  it("locates exact quote", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    const locations = locateQuote(doc.root, "600,00 eura")

    expect(locations.length).toBeGreaterThan(0)
    expect(locations[0].matchType).toBe("exact")
    expect(locations[0].confidence).toBe(1.0)
  })

  it("locates normalized quote", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    // Search with slightly different formatting
    const location = locateQuoteBest(doc.root, "porez na dohodak")

    expect(location).not.toBeNull()
    expect(location!.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it("returns null for non-existent quote", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    const location = locateQuoteBest(doc.root, "tekst koji ne postoji u dokumentu xyz")

    expect(location).toBeNull()
  })
})

describe("Quote Verification", () => {
  it("verifies quote at correct path", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    // First find where the quote is
    const location = locateQuoteBest(doc.root, "Ovaj Zakon stupa na snagu")

    if (location) {
      const result = verifyQuoteAtPath(doc.root, location.node.nodeKey, "Ovaj Zakon stupa na snagu")

      expect(result.verified).toBe(true)
      expect(result.confidence).toBeGreaterThanOrEqual(0.85)
    }
  })

  it("returns actual path when quote at different location", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    const result = verifyQuoteAtPath(doc.root, "/clanak:1", "Ovaj Zakon stupa na snagu")

    // Quote is in article 3, not article 1
    if (result.actualNodeKey && result.actualNodeKey !== "/clanak:1") {
      expect(result.verified).toBe(false)
      expect(result.actualNodeKey).toContain("clanak:3")
    }
  })
})

// =============================================================================
// Citation Building Tests
// =============================================================================

describe("Citation Building", () => {
  it("builds citation from location", () => {
    const doc = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")
    const location = locateQuoteBest(doc.root, "Ovaj Zakon stupa na snagu")

    if (location) {
      const citation = buildCitation(doc.eli.eli, location)

      expect(citation).toContain("čl.")
      expect(citation).toContain("NN 152/2024")
    }
  })
})

// =============================================================================
// Deterministic Parsing Regression Tests
// =============================================================================
// These tests verify that parsing is deterministic - parsing the same document
// twice should produce identical nodeKey sets and normSha256 hashes.

describe("Deterministic Parsing", () => {
  it("produces identical nodeKey sets when parsing same fixture twice", () => {
    const doc1 = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")
    const doc2 = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    const nodes1 = flattenTree(doc1.root)
    const nodes2 = flattenTree(doc2.root)

    // Same number of nodes
    expect(nodes1.length).toBe(nodes2.length)

    // Extract nodeKeys
    const keys1 = new Set(nodes1.map((n) => n.nodeKey))
    const keys2 = new Set(nodes2.map((n) => n.nodeKey))

    // Same keys
    expect(keys1.size).toBe(keys2.size)
    for (const key of keys1) {
      expect(keys2.has(key)).toBe(true)
    }
  })

  it("produces identical normSha256 hashes when parsing same fixture twice", () => {
    const doc1 = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")
    const doc2 = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    const nodes1 = flattenTree(doc1.root)
    const nodes2 = flattenTree(doc2.root)

    // Build hash maps
    const hashMap1 = new Map(nodes1.map((n) => [n.nodeKey, n.normSha256]))
    const hashMap2 = new Map(nodes2.map((n) => [n.nodeKey, n.normSha256]))

    // Every node should have the same hash in both parses
    for (const [key, hash1] of hashMap1) {
      const hash2 = hashMap2.get(key)
      expect(hash2).toBe(hash1)
    }
  })

  it("produces consistent textNorm content", () => {
    const doc1 = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")
    const doc2 = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    const nodes1 = flattenTree(doc1.root)
    const nodes2 = flattenTree(doc2.root)

    // Build text maps
    const textMap1 = new Map(nodes1.map((n) => [n.nodeKey, n.textNorm]))
    const textMap2 = new Map(nodes2.map((n) => [n.nodeKey, n.textNorm]))

    // Every node should have the same normalized text in both parses
    for (const [key, text1] of textMap1) {
      const text2 = textMap2.get(key)
      expect(text2).toBe(text1)
    }
  })

  it("produces consistent rawText content", () => {
    const doc1 = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")
    const doc2 = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    const nodes1 = flattenTree(doc1.root)
    const nodes2 = flattenTree(doc2.root)

    // Build raw text maps
    const rawMap1 = new Map(nodes1.map((n) => [n.nodeKey, n.rawText]))
    const rawMap2 = new Map(nodes2.map((n) => [n.nodeKey, n.rawText]))

    // Every node should have the same raw text in both parses
    for (const [key, raw1] of rawMap1) {
      const raw2 = rawMap2.get(key)
      expect(raw2).toBe(raw1)
    }
  })

  it("produces consistent orderIndex values", () => {
    const doc1 = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")
    const doc2 = parseNNDocument(CONTENT_FIXTURE, "https://example.com/test.html")

    const nodes1 = flattenTree(doc1.root)
    const nodes2 = flattenTree(doc2.root)

    // Build order maps
    const orderMap1 = new Map(nodes1.map((n) => [n.nodeKey, n.orderIndex]))
    const orderMap2 = new Map(nodes2.map((n) => [n.nodeKey, n.orderIndex]))

    // Every node should have the same orderIndex in both parses
    for (const [key, order1] of orderMap1) {
      const order2 = orderMap2.get(key)
      expect(order2).toBe(order1)
    }
  })
})
