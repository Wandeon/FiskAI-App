/**
 * System Registry Governance
 *
 * SECURITY-SENSITIVE FILE
 * Changes to this file require CODEOWNERS approval.
 *
 * This file controls what can be excluded from observation and what
 * patterns are recognized. Any bypass must be explicitly declared here
 * with a reason, owner, and optional expiry date.
 *
 * Principle: Observation cannot be silenced without an audited decision.
 */

import type { ComponentType } from "./schema"

// =============================================================================
// GOVERNANCE TYPES
// =============================================================================

export interface ExclusionEntry {
  /** The name/pattern being excluded */
  name: string
  /** Why this is excluded from observation */
  reason: string
  /** Team responsible for this exclusion decision */
  owner: string
  /** Optional expiry date (ISO format) - review after this date */
  expiresAt?: string
  /** Link to issue/discussion where this was decided */
  issueLink?: string
}

export interface IntegrationPattern {
  /** Integration identifier (lowercase) */
  key: string
  /** Human-readable name */
  displayName: string
  /** Environment variable prefix to detect */
  envPrefix?: string
  /** npm package name to detect */
  packageName?: string
  /** Directory name(s) to detect in src/lib/ (if different from key) */
  directoryAliases?: string[]
  /** Why this pattern exists */
  reason: string
}

export interface IgnoredComponent {
  /** Component ID to ignore in drift detection */
  componentId: string
  /** Why this component is ignored */
  reason: string
  /** Team responsible for this decision */
  owner: string
  /** When this was added (for audit trail) */
  addedAt: string
  /** Optional expiry - must re-justify after this date */
  expiresAt?: string
  /** Link to issue where this was decided */
  issueLink?: string
}

// =============================================================================
// LIB EXCLUSIONS
// =============================================================================

/**
 * Directories under src/lib/ that are NOT observed as LIB components.
 *
 * POLICY: A directory should only be excluded if it:
 * 1. Is a different component type (MODULE)
 * 2. Is test infrastructure
 * 3. Is the registry itself (meta-exclusion)
 *
 * DO NOT exclude directories just because you don't want to declare them.
 * If it's a library, declare it as LIB with internal=true if needed.
 *
 * INVARIANT: Entries in PERMANENT_EXCLUSIONS don't need issueLink/expiresAt.
 * All other exclusions MUST have both.
 */

/**
 * Exclusions that are permanent by design (no expiry needed).
 *
 * NOTE: Keep this list minimal. Multi-type observation is valid and correct.
 * A folder can be both a LIB (the code) and contain other component types.
 */
export const PERMANENT_EXCLUSIONS = ["__tests__", "system-registry"] as const

export const LIB_EXCLUSIONS: ExclusionEntry[] = [
  // Test infrastructure - never production code
  {
    name: "__tests__",
    reason: "Test infrastructure, not production code",
    owner: "team:platform",
    // No expiresAt/issueLink needed - permanent exclusion
  },

  // Self-reference - the registry cannot observe itself
  {
    name: "system-registry",
    reason: "This registry itself - meta-exclusion to avoid circular observation",
    owner: "team:platform",
    // No expiresAt/issueLink needed - permanent exclusion
  },

  // NOTE: "modules" was removed. src/lib/modules/ should be harvested as LIB
  // (the library providing module utilities), AND harvest-modules.ts separately
  // extracts the MODULE components defined within it. Multi-type observation
  // is valid and correct - same principle as regulatory-truth.
]

/**
 * Get excluded directory names for lib harvester.
 */
export function getLibExclusions(): string[] {
  return LIB_EXCLUSIONS.map((e) => e.name)
}

// =============================================================================
// WORKER SERVICE EXCLUSIONS
// =============================================================================

/**
 * Services in docker-compose.workers.yml that are NOT workers.
 *
 * POLICY: Any exclusion must be time-bounded and tracked.
 */
export const WORKER_SERVICE_EXCLUSIONS: ExclusionEntry[] = [
  {
    name: "redis",
    reason: "Shared Redis service (store), not a worker process",
    owner: "team:platform",
    expiresAt: "2026-03-15",
    issueLink: "https://github.com/Wandeon/FiskAI/issues/137",
  },
]

// =============================================================================
// GOVERNANCE VALIDATION
// =============================================================================

export interface GovernanceViolation {
  type: "LIB_EXCLUSION" | "WORKER_EXCLUSION" | "IGNORED_COMPONENT"
  name: string
  issue: string
}

/**
 * Maximum TTL for exclusions and ignores (90 days).
 * Prevents indefinite bypasses disguised as "temporary".
 */
const MAX_EXCLUSION_TTL_DAYS = 90

/**
 * Allowed issueLink hostnames.
 * Prevents garbage links like "todo" or "will fix later".
 */
const ALLOWED_ISSUE_HOSTS = [
  "github.com",
  "jira.atlassian.com",
  "linear.app",
  "fiskai.atlassian.net",
]

/**
 * Validates a date string is valid ISO format and within TTL bounds.
 * Returns null if valid, error message if invalid.
 */
function validateExpiresAt(expiresAt: string, name: string): string | null {
  // Check format - must be valid ISO date
  const parsed = new Date(expiresAt)
  if (isNaN(parsed.getTime())) {
    return `Invalid expiresAt date format: "${expiresAt}" (must be ISO format like 2025-03-28)`
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0) // Normalize to start of day

  // Check not in the past
  if (parsed < today) {
    return `expiresAt "${expiresAt}" is in the past - exclusion has expired and must be removed or renewed`
  }

  // Check not beyond max TTL
  const maxDate = new Date(today)
  maxDate.setDate(maxDate.getDate() + MAX_EXCLUSION_TTL_DAYS)
  if (parsed > maxDate) {
    return `expiresAt "${expiresAt}" is more than ${MAX_EXCLUSION_TTL_DAYS} days in the future - max TTL exceeded`
  }

  return null
}

/**
 * Validates an issueLink is a real tracking URL.
 * Returns null if valid, error message if invalid.
 */
function validateIssueLink(issueLink: string, name: string): string | null {
  // Must start with https://
  if (!issueLink.startsWith("https://")) {
    return `issueLink must start with https:// (got: "${issueLink}")`
  }

  // Must be from an allowed host
  try {
    const url = new URL(issueLink)
    const isAllowed = ALLOWED_ISSUE_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
    )
    if (!isAllowed) {
      return `issueLink hostname "${url.hostname}" not in allowed list: ${ALLOWED_ISSUE_HOSTS.join(", ")}`
    }
  } catch {
    return `issueLink is not a valid URL: "${issueLink}"`
  }

  return null
}

/**
 * Validates governance entries for required fields AND format/TTL constraints.
 * Returns list of violations that should cause CI to fail.
 *
 * Validates:
 * - Presence of issueLink and expiresAt for non-permanent exclusions
 * - expiresAt is valid ISO date, not in past, not beyond 90 days
 * - issueLink is https:// from allowed tracking hosts
 */
export function validateGovernance(): GovernanceViolation[] {
  const violations: GovernanceViolation[] = []

  // Check LIB_EXCLUSIONS
  for (const exclusion of LIB_EXCLUSIONS) {
    // Permanent exclusions don't need issueLink/expiresAt
    if (PERMANENT_EXCLUSIONS.includes(exclusion.name as (typeof PERMANENT_EXCLUSIONS)[number])) {
      continue
    }

    // Non-permanent exclusions MUST have both issueLink and expiresAt
    if (!exclusion.issueLink) {
      violations.push({
        type: "LIB_EXCLUSION",
        name: exclusion.name,
        issue: "Missing required issueLink for non-permanent exclusion",
      })
    } else {
      const linkError = validateIssueLink(exclusion.issueLink, exclusion.name)
      if (linkError) {
        violations.push({
          type: "LIB_EXCLUSION",
          name: exclusion.name,
          issue: linkError,
        })
      }
    }

    if (!exclusion.expiresAt) {
      violations.push({
        type: "LIB_EXCLUSION",
        name: exclusion.name,
        issue: "Missing required expiresAt for non-permanent exclusion",
      })
    } else {
      const dateError = validateExpiresAt(exclusion.expiresAt, exclusion.name)
      if (dateError) {
        violations.push({
          type: "LIB_EXCLUSION",
          name: exclusion.name,
          issue: dateError,
        })
      }
    }
  }

  // Check WORKER_SERVICE_EXCLUSIONS
  for (const exclusion of WORKER_SERVICE_EXCLUSIONS) {
    if (!exclusion.issueLink) {
      violations.push({
        type: "WORKER_EXCLUSION",
        name: exclusion.name,
        issue: "Missing required issueLink for worker exclusion",
      })
    } else {
      const linkError = validateIssueLink(exclusion.issueLink, exclusion.name)
      if (linkError) {
        violations.push({
          type: "WORKER_EXCLUSION",
          name: exclusion.name,
          issue: linkError,
        })
      }
    }

    if (!exclusion.expiresAt) {
      violations.push({
        type: "WORKER_EXCLUSION",
        name: exclusion.name,
        issue: "Missing required expiresAt for worker exclusion",
      })
    } else {
      const dateError = validateExpiresAt(exclusion.expiresAt, exclusion.name)
      if (dateError) {
        violations.push({
          type: "WORKER_EXCLUSION",
          name: exclusion.name,
          issue: dateError,
        })
      }
    }
  }

  // Check IGNORED_COMPONENTS
  for (const ignored of IGNORED_COMPONENTS) {
    if (!ignored.issueLink) {
      violations.push({
        type: "IGNORED_COMPONENT",
        name: ignored.componentId,
        issue: "Missing required issueLink",
      })
    } else {
      const linkError = validateIssueLink(ignored.issueLink, ignored.componentId)
      if (linkError) {
        violations.push({
          type: "IGNORED_COMPONENT",
          name: ignored.componentId,
          issue: linkError,
        })
      }
    }

    if (!ignored.expiresAt) {
      violations.push({
        type: "IGNORED_COMPONENT",
        name: ignored.componentId,
        issue: "Missing required expiresAt (all ignores must be temporary)",
      })
    } else {
      const dateError = validateExpiresAt(ignored.expiresAt, ignored.componentId)
      if (dateError) {
        violations.push({
          type: "IGNORED_COMPONENT",
          name: ignored.componentId,
          issue: dateError,
        })
      }
    }
  }

  return violations
}

// =============================================================================
// INTEGRATION PATTERNS
// =============================================================================

/**
 * Known integration patterns for deterministic detection.
 *
 * POLICY: Add patterns for any external service the system integrates with.
 * Unknown integrations will be flagged with WARN-level observations.
 */
export const INTEGRATION_PATTERNS: IntegrationPattern[] = [
  // Payment
  {
    key: "stripe",
    displayName: "Stripe",
    envPrefix: "STRIPE_",
    packageName: "stripe",
    reason: "Payment processing",
  },
  {
    key: "gocardless",
    displayName: "GoCardless",
    envPrefix: "GOCARDLESS_",
    reason: "Direct debit payments",
  },

  // Email
  {
    key: "resend",
    displayName: "Resend Email",
    envPrefix: "RESEND_",
    packageName: "resend",
    reason: "Transactional email",
  },

  // AI/ML - Ollama only (local and cloud instances)
  {
    key: "ollama",
    displayName: "Ollama",
    envPrefix: "OLLAMA_",
    reason: "LLM inference (local and cloud instances)",
  },

  // Croatian government
  {
    key: "fina-cis",
    displayName: "FINA CIS Fiscalization",
    envPrefix: "FINA_",
    directoryAliases: ["fiscal", "porezna"],
    reason: "Croatian Tax Authority fiscalization (Porezna uprava)",
  },

  // Security
  {
    key: "turnstile",
    displayName: "Cloudflare Turnstile",
    envPrefix: "TURNSTILE_",
    reason: "Bot protection",
  },

  // Analytics/Monitoring
  {
    key: "posthog",
    displayName: "PostHog",
    envPrefix: "POSTHOG_",
    packageName: "posthog-js",
    reason: "Product analytics",
  },
  {
    key: "sentry",
    displayName: "Sentry",
    envPrefix: "SENTRY_",
    packageName: "@sentry/nextjs",
    reason: "Error monitoring",
  },

  // Authentication
  {
    key: "microsoft-entra",
    displayName: "Microsoft Entra ID (Azure AD)",
    envPrefix: "MICROSOFT_",
    reason: "Enterprise SSO authentication provider",
  },

  // E-invoicing
  {
    key: "einvoice",
    displayName: "E-Invoice Service",
    envPrefix: "EINVOICE_",
    reason: "Croatian e-invoicing (eRačun) integration",
  },
]

/**
 * Environment variable suffixes that indicate external integrations.
 * Used for unknown integration detection.
 */
export const INTEGRATION_ENV_SUFFIXES = [
  "_API_KEY",
  "_API_TOKEN",
  "_TOKEN",
  "_SECRET",
  "_SECRET_KEY",
  "_WEBHOOK_SECRET",
  "_CLIENT_ID",
  "_CLIENT_SECRET",
]

/**
 * Environment variable prefixes that are internal framework/platform config.
 * These should NOT be flagged as unknown integrations.
 */
export const INTERNAL_ENV_PREFIXES = [
  "NEXTAUTH_", // Auth.js framework config
  "NEXT_PUBLIC_", // Next.js public vars
  "DATABASE_", // Database connection
  "CRON_", // Internal cron security
  "NODE_", // Node.js config
  "CI_", // CI/CD config
  "COOLIFY_", // Deployment platform
]

/**
 * Directory names in src/lib/ that are internal libraries, not external integrations.
 * These should NOT be flagged as unknown integrations even if they have client.ts etc.
 */
export const INTERNAL_LIB_DIRECTORIES = [
  "assistant", // Internal AI assistant engine
  "utils", // Internal utilities
  "shared", // Shared internal code
  "hooks", // React hooks
]

/**
 * File patterns in src/lib/** that suggest an integration wrapper.
 */
export const INTEGRATION_FILE_PATTERNS = [
  "client.ts",
  "sdk.ts",
  "api.ts",
  "webhook.ts",
  "webhooks.ts",
]

// =============================================================================
// IGNORED COMPONENTS
// =============================================================================

/**
 * Components explicitly ignored in drift detection.
 *
 * POLICY: Use this sparingly. Every entry must have:
 * - A clear reason
 * - An owner
 * - Preferably an expiry date for re-evaluation
 *
 * This is the "last resort" for components that cannot be handled
 * by normal declaration or exclusion rules.
 */
export const IGNORED_COMPONENTS: IgnoredComponent[] = [
  // Example (commented out):
  // {
  //   componentId: "lib-legacy-utils",
  //   reason: "Deprecated, scheduled for removal in Q2 2025",
  //   owner: "team:platform",
  //   addedAt: "2024-12-28",
  //   expiresAt: "2025-06-30",
  //   issueLink: "https://github.com/example/issue/123",
  // },
]

/**
 * Check if a component should be ignored in drift detection.
 */
export function isIgnoredComponent(componentId: string): boolean {
  const entry = IGNORED_COMPONENTS.find((e) => e.componentId === componentId)
  if (!entry) return false

  // Check if exclusion has expired
  if (entry.expiresAt) {
    const expiry = new Date(entry.expiresAt)
    if (expiry < new Date()) {
      console.warn(
        `GOVERNANCE WARNING: Ignored component "${componentId}" has expired (${entry.expiresAt}). Review required.`
      )
      return false // Expired exclusions are no longer valid
    }
  }

  return true
}

// =============================================================================
// ALLOWED OWNERS
// =============================================================================

/**
 * Valid owner slugs for component declarations.
 *
 * Format: "team:<slug>" for team ownership (required)
 *
 * The 7-team model:
 * - platform: registry, CI, infra, observability
 * - backend: API, jobs, workers, queues (non-RTL)
 * - rtl: Regulatory Truth Layer pipeline
 * - finance: invoicing, fiscalization, VAT, reports
 * - billing: Stripe, subscriptions, plans
 * - security: auth, webauthn, access control
 * - data: DB, migrations, storage, retention
 */
export const ALLOWED_OWNERS = [
  "team:platform",
  "team:backend",
  "team:rtl",
  "team:ai",
  "team:finance",
  "team:billing",
  "team:security",
  "team:data",
] as const

/**
 * Deprecated owner slugs that are still valid but should be migrated.
 * These will produce WARN in CI after the migration period.
 */
export const DEPRECATED_OWNERS = [
  { slug: "team:compliance", migratesTo: "team:rtl", reason: "Renamed to team:rtl" },
  { slug: "team:frontend", migratesTo: "team:platform", reason: "Merged into team:platform" },
  { slug: "team:infrastructure", migratesTo: "team:platform", reason: "Merged into team:platform" },
  { slug: "team:ops", migratesTo: "team:platform", reason: "Merged into team:platform" },
  { slug: "person:admin", migratesTo: "team:platform", reason: "Individual ownership deprecated" },
] as const

export type AllowedOwner = (typeof ALLOWED_OWNERS)[number]
export type DeprecatedOwner = (typeof DEPRECATED_OWNERS)[number]["slug"]

export interface OwnerValidationResult {
  valid: boolean
  deprecated: boolean
  migratesTo?: string
  reason?: string
}

/**
 * Validate an owner string.
 * Returns detailed result including deprecation status.
 */
export function validateOwner(owner: string): OwnerValidationResult {
  // Check if it's a current valid owner
  if (ALLOWED_OWNERS.includes(owner as AllowedOwner)) {
    return { valid: true, deprecated: false }
  }

  // Check if it's a deprecated owner
  const deprecatedEntry = DEPRECATED_OWNERS.find((d) => d.slug === owner)
  if (deprecatedEntry) {
    return {
      valid: true,
      deprecated: true,
      migratesTo: deprecatedEntry.migratesTo,
      reason: deprecatedEntry.reason,
    }
  }

  return { valid: false, deprecated: false }
}

/**
 * Simple boolean check for owner validity (includes deprecated).
 */
export function isValidOwner(owner: string): boolean {
  return validateOwner(owner).valid
}

// =============================================================================
// CODEREF ENFORCEMENT
// =============================================================================

/**
 * Types that require valid codeRef for CRITICAL/HIGH components.
 */
export const CODEREF_REQUIRED_TYPES: ComponentType[] = [
  "ROUTE_GROUP",
  "WORKER",
  "JOB",
  "QUEUE",
  "MODULE",
  "LIB",
  "STORE",
  "INTEGRATION",
  "UI",
]

/**
 * Criticality levels that require valid codeRef.
 */
export const CODEREF_REQUIRED_CRITICALITIES = {
  CRITICAL: "FAIL" as const, // Missing/invalid codeRef → CI failure
  HIGH: "WARN" as const, // Missing/invalid codeRef → Warning
  MEDIUM: null, // No enforcement
  LOW: null, // No enforcement
}

// =============================================================================
// INTEGRATION WRAPPER CONVENTION
// =============================================================================

/**
 * ARCHITECTURAL RULE: External Service Access
 *
 * All external services MUST be accessed through an integration wrapper
 * located under src/lib/integrations/<service-name>/.
 *
 * This convention enables:
 * - Deterministic detection of external dependencies
 * - Centralized credential management
 * - Consistent error handling and retry logic
 * - Audit trail of external service usage
 *
 * The integration harvester treats any folder under src/lib/integrations/
 * as an observed integration. If it's not declared in the registry, it will
 * be flagged as WARN (v1) or FAIL (v2).
 *
 * VIOLATION EXAMPLES (do NOT do this):
 * - Calling external APIs directly with fetch() from random files
 * - Using SDK packages without a wrapper under src/lib/integrations/
 * - Hardcoding API keys or using generic env vars like EXTERNAL_API_KEY
 *
 * COMPLIANT EXAMPLES:
 * - src/lib/integrations/stripe/client.ts wraps @stripe/stripe-node
 * - src/lib/integrations/resend/client.ts wraps resend package
 * - src/lib/integrations/fina-cis/api.ts wraps FINA CIS REST calls
 */
export const INTEGRATION_WRAPPER_ROOT = "src/lib/integrations"

// =============================================================================
// ENFORCEMENT ROADMAP
// =============================================================================

/**
 * Allowed file paths where Queue constructors may appear.
 * Anything else is treated as a governance violation in harvesters.
 */
export const ALLOWED_QUEUE_CONSTRUCTOR_PATHS = [
  "src/lib/regulatory-truth/workers/queues.ts",
  "src/lib/outbox/outbox-worker.ts",
  // harvest-queues.ts contains Queue patterns in regex strings/comments (false positive)
  "src/lib/system-registry/harvesters/harvest-queues.ts",
] as const

/**
 * ENFORCEMENT TIMELINE
 *
 * This documents the planned escalation of enforcement rules.
 * Changes to this timeline require team-platform approval.
 *
 * Sprint +0 (Current):
 * - HIGH missing owner = WARN
 * - Unknown integrations = WARN
 * - DeclaredNotObserved CRITICAL = FAIL
 * - DeclaredNotObserved HIGH = WARN
 * - CodeRef invalid CRITICAL = FAIL
 * - CodeRef invalid HIGH = WARN
 *
 * Sprint +2:
 * - HIGH missing owner = FAIL (escalate from WARN)
 * - LIB MUST_BE_DECLARED for CRITICAL/HIGH libs (not internal)
 *
 * Sprint +3:
 * - Unknown integrations = FAIL (unless explicitly ignored with issueLink + expiresAt)
 * - INTEGRATION type must be under src/lib/integrations/
 *
 * Sprint +4:
 * - MEDIUM missing owner = WARN
 * - All CRITICAL components must have docsRef
 *
 * POLICY INVARIANTS (never change):
 * - CRITICAL missing owner = FAIL (always)
 * - All ignores must have expiresAt (max 90 days)
 * - Governance file changes require CODEOWNERS approval
 */
export const ENFORCEMENT_ROADMAP = {
  "sprint+0": {
    HIGH_MISSING_OWNER: "WARN",
    UNKNOWN_INTEGRATIONS: "WARN",
    DECLARED_NOT_OBSERVED_CRITICAL: "FAIL",
    DECLARED_NOT_OBSERVED_HIGH: "WARN",
  },
  "sprint+2": {
    HIGH_MISSING_OWNER: "FAIL",
    LIB_MUST_BE_DECLARED_CRITICAL_HIGH: "FAIL",
  },
  "sprint+3": {
    UNKNOWN_INTEGRATIONS: "FAIL",
    INTEGRATION_MUST_BE_IN_WRAPPER_ROOT: "FAIL",
  },
} as const

/**
 * Internal lib policy.
 *
 * Libs marked internal=true:
 * - MUST still have owner + codeRef
 * - MAY skip docsRef requirement
 * - MUST NOT be depended on by external-facing modules (future enforcement)
 *
 * Criteria for internal vs product lib:
 * - Internal: utilities, helpers, shared types, test infrastructure
 * - Product: business logic, features, domain-specific functionality
 *
 * If in doubt, declare as product lib. It's easier to relax than tighten.
 */
export const INTERNAL_LIB_POLICY = {
  requiresOwner: true,
  requiresCodeRef: true,
  requiresDocsRef: false,
  maxDependentsForInternal: 0, // Future: internal libs should not be depended on by product libs
} as const
