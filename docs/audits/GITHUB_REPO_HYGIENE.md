# GitHub Repository Hygiene Plan

**Created:** 2026-01-22
**Updated:** 2026-01-22
**Status:** Completed
**Organization:** Wandeon

---

## 1. Repository Architecture (Final)

The FiskAI platform uses **3 canonical repositories**:

| Repo Name               | Visibility | Purpose                                    | Domain         | Status |
| ----------------------- | ---------- | ------------------------------------------ | -------------- | ------ |
| **FiskAI-App**          | Public     | Next.js application (accounting/ERP)       | app.fiskai.hr  | Active |
| **fiskai-intelligence** | Private    | Intelligence API + workers + regulatory DB | iapi.fiskai.hr | Active |
| **fiskai-marketing**    | Public     | Marketing static site                      | fiskai.hr      | Active |

### Archived Repository

| Repo Name      | Status                    | Reason                                               |
| -------------- | ------------------------- | ---------------------------------------------------- |
| fiskai-workers | **ARCHIVED** (2026-01-22) | Legacy name; workers merged into fiskai-intelligence |

---

## 2. Canonical Repositories

### FiskAI-App (this repository)

- **Purpose:** Accounting/ERP web application
- **URL:** `https://github.com/Wandeon/FiskAI-App`
- **Domain:** `app.fiskai.hr`
- **Contains:**
  - Next.js 15 application
  - Client/Staff/Admin portals
  - API routes and server actions
  - Core database schema (Prisma)
  - Intelligence API client (HTTP only)
- **Does NOT contain:**
  - Regulatory truth processing (→ fiskai-intelligence)
  - Background workers (→ fiskai-intelligence)
  - NN Mirror parsing (→ fiskai-intelligence)
  - Regulatory database schema (→ fiskai-intelligence)

### fiskai-intelligence

- **Purpose:** Intelligence API + regulatory processing backend
- **URL:** `https://github.com/Wandeon/fiskai-intelligence`
- **Domain:** `iapi.fiskai.hr`
- **Contains:**
  - Rule resolution API
  - NN Mirror parsing
  - Document processing
  - AI/LLM integrations
  - 15 BullMQ workers
  - Regulatory database schema
  - Evidence processing
  - Queue management
- **Status:** Canonical; consolidated from separate workers repo

### fiskai-marketing

- **Purpose:** Marketing static site and landing pages
- **URL:** `https://github.com/Wandeon/fiskai-marketing`
- **Domain:** `fiskai.hr`
- **Contains:**
  - Static landing pages
  - Public guides (vodici)
  - SEO content
- **Status:** Canonical, no changes needed

---

## 3. Actions Completed

### Repository Archive (Done)

- [x] **Archived fiskai-workers** (2026-01-22)
  - Repo is now read-only
  - Workers consolidated into fiskai-intelligence
  - Legacy code preserved for reference

### Code Updates (Done in this PR)

- [x] Updated CLAUDE.md to reference 3-repo architecture
- [x] Updated README.md to reference 3-repo architecture
- [x] Removed REGULATORY_DATABASE_URL from Dockerfile
- [x] Removed regulatory artifact checks from CI
- [x] Added check-no-regulatory.ts to CI pipeline

---

## 4. Remaining Manual Actions

### GitHub UI Actions (For User)

- [ ] **Rename FiskAI → FiskAI-App**
  - Go to: https://github.com/Wandeon/FiskAI/settings
  - Scroll to "Danger Zone" → "Rename"
  - Enter: `FiskAI-App`
  - Update local remotes: `git remote set-url origin https://github.com/Wandeon/FiskAI-App.git`

- [ ] **Add Repository Topics**
      | Repo | Topics |
      |------|--------|
      | FiskAI-App | `accounting`, `invoicing`, `saas`, `croatia`, `nextjs`, `erp` |
      | fiskai-intelligence | `intelligence`, `regulatory`, `api`, `rule-resolution`, `workers` |
      | fiskai-marketing | `marketing`, `landing-page`, `static-site` |

- [ ] **Update Repository Descriptions**
      | Repo | Description |
      |------|-------------|
      | FiskAI-App | "FiskAI Accounting Application - Croatian AI-powered invoicing and bookkeeping SaaS" |
      | fiskai-intelligence | "FiskAI Intelligence API - regulatory rule resolution, workers, and document processing" |
      | fiskai-marketing | "FiskAI Marketing Site - landing pages for fiskai.hr" |

---

## 5. Repository Relationship Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FiskAI Platform                          │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
    ┌───────────────────┐         ┌───────────────────┐
    │    FiskAI-App     │         │fiskai-intelligence│
    │   (app.fiskai.hr) │  HTTPS  │  (iapi.fiskai.hr) │
    │                   │────────▶│                   │
    │ - Web UI          │         │ - Rule API        │
    │ - API routes      │         │ - NN Mirror       │
    │ - Core DB (Prisma)│         │ - Doc parsing     │
    │ - Server actions  │         │ - 15 workers      │
    │                   │         │ - Regulatory DB   │
    └───────────────────┘         └───────────────────┘
              │
              │
              ▼
    ┌───────────────────┐
    │ fiskai-marketing  │
    │   (fiskai.hr)     │
    │                   │
    │ - Landing pages   │
    │ - Marketing       │
    │ - SEO content     │
    └───────────────────┘

    ┌───────────────────┐
    │  fiskai-workers   │  ← ARCHIVED (2026-01-22)
    │   (deprecated)    │    Merged into fiskai-intelligence
    └───────────────────┘
```

---

## 6. Verification Checklist

After completing rename:

- [ ] `gh repo view Wandeon/FiskAI-App` returns valid repo
- [ ] `gh repo view Wandeon/FiskAI` redirects to FiskAI-App
- [ ] CI workflows pass with new repo name
- [ ] Docker images build to `ghcr.io/wandeon/fiskai-app`
- [ ] Coolify deployment still works
- [ ] Local development works with updated remote
- [ ] `gh repo view Wandeon/fiskai-workers --json isArchived` returns `true`

---

## Summary

**Completed Actions:**

1. Archived `fiskai-workers` repository (legacy)
2. Updated documentation to 3-repo architecture
3. Cleaned CI/CD of regulatory artifact references
4. Added boundary guardrails to CI

**Remaining Actions (User):**

1. Rename `FiskAI` → `FiskAI-App` via GitHub UI
2. Add topics to all 3 repos
3. Update repository descriptions

**Final Architecture:** 3 canonical repos (FiskAI-App, fiskai-intelligence, fiskai-marketing)
