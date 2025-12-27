// src/lib/regulatory-truth/utils/node-classifier.ts

import { NodeType, NodeRole, FreshnessRisk } from "@prisma/client"

export interface ClassificationResult {
  nodeType: NodeType
  nodeRole: NodeRole | null
  freshnessRisk: FreshnessRisk
}

interface RolePattern {
  pattern: RegExp
  role: NodeRole
  risk: FreshnessRisk
  isHubCandidate: boolean
}

const ROLE_PATTERNS: RolePattern[] = [
  {
    pattern: /\/(arhiva?|archive|povijest|history|stari-?)\//,
    role: "ARCHIVE",
    risk: "LOW",
    isHubCandidate: true,
  },
  {
    pattern: /\/(savjetovanja|e-?savjetovanja|javna-rasprava|public-consult)/,
    role: "GUIDANCE",
    risk: "CRITICAL",
    isHubCandidate: true,
  },
  {
    pattern: /\/(natjecaji|tenders|javna-nabava|pozivi)/,
    role: "NEWS_FEED",
    risk: "HIGH",
    isHubCandidate: true,
  },
  {
    pattern: /\/(vijesti|novosti|news|priopcenja|priopćenja|aktual|objave|mediji)/,
    role: "NEWS_FEED",
    risk: "HIGH",
    isHubCandidate: true,
  },
  {
    pattern: /\/(obrasci?|forms?|tiskanice|prijave?|zahtjevi)/,
    role: "FORM",
    risk: "MEDIUM",
    isHubCandidate: false,
  },
  {
    pattern:
      /\/(uput[ea]|misljenj[ea]|mišljenj[ea]|tumacenj[ea]|tumačenj[ea]|stajalist[ea]|guidance)/,
    role: "GUIDANCE",
    risk: "MEDIUM",
    isHubCandidate: false,
  },
  {
    pattern: /\/(propisi|zakoni?|pravilnici?|uredbe?|odluke?|akti|sluzbeni)/,
    role: "REGULATION",
    risk: "CRITICAL",
    isHubCandidate: false,
  },
  {
    pattern: /\/(index|sadržaj|sadrzaj|pregled|contents?)\./,
    role: "INDEX",
    risk: "LOW",
    isHubCandidate: true,
  },
]

const ASSET_EXTENSIONS = /\.(pdf|docx?|xlsx?|pptx?|odt|ods)$/i

export function classifyUrl(url: string, contentType?: string): ClassificationResult {
  if (
    ASSET_EXTENSIONS.test(url) ||
    contentType?.includes("pdf") ||
    contentType?.includes("document") ||
    contentType?.includes("msword") ||
    contentType?.includes("spreadsheet")
  ) {
    return { nodeType: "ASSET", nodeRole: null, freshnessRisk: "MEDIUM" }
  }

  for (const { pattern, role, risk, isHubCandidate } of ROLE_PATTERNS) {
    if (pattern.test(url)) {
      return { nodeType: isHubCandidate ? "HUB" : "LEAF", nodeRole: role, freshnessRisk: risk }
    }
  }

  return { nodeType: "LEAF", nodeRole: null, freshnessRisk: "MEDIUM" }
}

export function applyRiskInheritance(
  classification: ClassificationResult,
  parentRisk: FreshnessRisk | null
): ClassificationResult {
  if (classification.nodeType === "ASSET" && parentRisk === "CRITICAL") {
    return { ...classification, freshnessRisk: "CRITICAL" }
  }
  if (classification.nodeType === "ASSET" && parentRisk === "HIGH") {
    return { ...classification, freshnessRisk: "HIGH" }
  }
  return classification
}
