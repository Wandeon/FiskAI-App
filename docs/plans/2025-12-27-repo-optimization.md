# Repository Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up the FiskAI repository by removing legacy files, migrating unique code, fixing security issues, and recovering ~6.2GB of disk space.

**Architecture:** This plan follows a phased approach: (1) Security fixes first, (2) Safe deletions, (3) Code migrations, (4) Worktree cleanup, (5) API authentication fixes. Each phase is independent and can be committed separately.

**Tech Stack:** Next.js 15, TypeScript, Prisma, NextAuth v5, Git worktrees

---

## Phase 1: Security Fixes (CRITICAL)

### Task 1.1: Add Authentication to Regulatory Trigger Endpoint

**Files:**
- Modify: `src/app/api/regulatory/trigger/route.ts`

**Step 1: Read current implementation**

```bash
cat src/app/api/regulatory/trigger/route.ts
```

**Step 2: Add authentication check**

Replace the route handler to require admin authentication:

```typescript
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { triggerPipeline } from "@/lib/regulatory-truth/scheduler/scheduler.service"

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const phases = body.phases || ["sentinel", "extract", "compose", "review", "release"]

    const result = await triggerPipeline(phases)

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      status: "queued",
      message: `Pipeline triggered for phases: ${phases.join(", ")}`,
    })
  } catch (error) {
    console.error("Pipeline trigger error:", error)
    return NextResponse.json(
      { error: "Failed to trigger pipeline" },
      { status: 500 }
    )
  }
}
```

**Step 3: Verify the change**

```bash
grep -n "getCurrentUser" src/app/api/regulatory/trigger/route.ts
```

Expected: Line showing import and usage of getCurrentUser

**Step 4: Commit**

```bash
git add src/app/api/regulatory/trigger/route.ts
git commit -m "security: add authentication to regulatory trigger endpoint"
```

---

### Task 1.2: Add Authentication to Truth Health Endpoint

**Files:**
- Modify: `src/app/api/admin/regulatory-truth/truth-health/route.ts`

**Step 1: Read current implementation**

```bash
head -30 src/app/api/admin/regulatory-truth/truth-health/route.ts
```

**Step 2: Add authentication check to both GET and POST**

Add after imports:

```typescript
import { getCurrentUser } from "@/lib/auth-utils"
```

Add at start of GET handler:

```typescript
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // ... rest of existing code
}
```

Add at start of POST handler:

```typescript
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // ... rest of existing code
}
```

**Step 3: Verify the change**

```bash
grep -n "getCurrentUser\|systemRole" src/app/api/admin/regulatory-truth/truth-health/route.ts
```

Expected: Lines showing auth checks in both handlers

**Step 4: Commit**

```bash
git add src/app/api/admin/regulatory-truth/truth-health/route.ts
git commit -m "security: add authentication to truth-health endpoint"
```

---

### Task 1.3: Fix News Admin Endpoints Authentication (4 files)

**Files:**
- Modify: `src/app/api/admin/news/cron/trigger/route.ts`
- Modify: `src/app/api/admin/news/posts/route.ts`
- Modify: `src/app/api/admin/news/posts/[id]/route.ts`
- Modify: `src/app/api/admin/news/posts/[id]/reprocess/route.ts`

**Step 1: Create auth helper for news routes**

All 4 files currently use cookie-based auth. Replace with proper NextAuth:

For each file, replace:
```typescript
// TODO: Replace with proper auth when available
const authCookie = cookies().get("fiskai_admin_auth")
if (!authCookie || authCookie.value !== "authenticated") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

With:
```typescript
import { getCurrentUser } from "@/lib/auth-utils"

// At start of handler:
const user = await getCurrentUser()
if (!user || user.systemRole !== "ADMIN") {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

**Step 2: Update each file**

```bash
# File 1: cron/trigger
sed -i 's/import { cookies } from "next\/headers"/import { getCurrentUser } from "@\/lib\/auth-utils"/' src/app/api/admin/news/cron/trigger/route.ts

# Repeat pattern for other 3 files
```

**Step 3: Verify changes**

```bash
grep -l "getCurrentUser" src/app/api/admin/news/*/route.ts src/app/api/admin/news/*/*/route.ts
```

Expected: All 4 files listed

**Step 4: Commit**

```bash
git add src/app/api/admin/news/
git commit -m "security: replace cookie auth with NextAuth in news admin endpoints"
```

---

## Phase 2: Safe Deletions (No Migration Required)

### Task 2.1: Remove Ghost Regulatory API Directory

**Files:**
- Delete: `src/app/api/admin/regulatory/` (empty directory)

**Step 1: Verify directory is empty/unused**

```bash
find src/app/api/admin/regulatory -type f -name "*.ts" 2>/dev/null | wc -l
```

Expected: 0 (no TypeScript files)

**Step 2: Delete the directory**

```bash
rm -rf src/app/api/admin/regulatory/
```

**Step 3: Verify deletion**

```bash
ls src/app/api/admin/regulatory 2>&1
```

Expected: "No such file or directory"

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove empty regulatory API directory"
```

---

### Task 2.2: Remove Empty Audit Artifact Files

**Files:**
- Delete: `docs/regulatory-truth/audit-artifacts/2025-12-23/regulatory_sources_priority.txt`
- Delete: `docs/regulatory-truth/audit-artifacts/2025-12-22/regulatory_metrics_response.txt`
- Delete: `docs/regulatory-truth/audit-artifacts/2025-12-22/regulatory_status_response.txt`
- Delete: `docs/regulatory-truth/audit-artifacts/2025-12-22/regulatory_status_response.exitcode`
- Delete: `docs/regulatory-truth/audit-artifacts/2025-12-22/regulatory_metrics_response.exitcode`

**Step 1: Verify files are empty**

```bash
wc -c docs/regulatory-truth/audit-artifacts/2025-12-23/regulatory_sources_priority.txt \
      docs/regulatory-truth/audit-artifacts/2025-12-22/regulatory_*.txt \
      docs/regulatory-truth/audit-artifacts/2025-12-22/*.exitcode 2>/dev/null
```

Expected: All showing 0 or very small byte counts

**Step 2: Delete empty files**

```bash
rm -f docs/regulatory-truth/audit-artifacts/2025-12-23/regulatory_sources_priority.txt
rm -f docs/regulatory-truth/audit-artifacts/2025-12-22/regulatory_metrics_response.txt
rm -f docs/regulatory-truth/audit-artifacts/2025-12-22/regulatory_status_response.txt
rm -f docs/regulatory-truth/audit-artifacts/2025-12-22/*.exitcode
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove empty audit artifact files"
```

---

### Task 2.3: Remove Unused Husky Hook Stubs

**Files:**
- Delete: `.husky/_/applypatch-msg`
- Delete: `.husky/_/commit-msg`
- Delete: `.husky/_/post-applypatch`
- Delete: `.husky/_/post-checkout`
- Delete: `.husky/_/post-commit`
- Delete: `.husky/_/post-merge`
- Delete: `.husky/_/post-rewrite`
- Delete: `.husky/_/pre-applypatch`
- Delete: `.husky/_/pre-auto-gc`
- Delete: `.husky/_/pre-commit` (in _/ subdirectory, not the main one)
- Delete: `.husky/_/pre-merge-commit`
- Delete: `.husky/_/prepare-commit-msg`
- Delete: `.husky/_/pre-push`
- Delete: `.husky/_/pre-rebase`

**Step 1: Keep only essential husky files**

```bash
# List what we're keeping
ls -la .husky/pre-commit .husky/_/h .husky/_/husky.sh
```

**Step 2: Remove stub hooks**

```bash
cd .husky/_/
rm -f applypatch-msg commit-msg post-applypatch post-checkout post-commit \
      post-merge post-rewrite pre-applypatch pre-auto-gc pre-commit \
      pre-merge-commit prepare-commit-msg pre-push pre-rebase
cd ../..
```

**Step 3: Verify only essential files remain**

```bash
ls .husky/_/
```

Expected: Only `h`, `husky.sh`, and `.gitignore`

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused husky hook stubs"
```

---

### Task 2.4: Clean .next Build Cache

**Step 1: Check cache size**

```bash
du -sh .next/ 2>/dev/null || echo "No .next directory"
```

**Step 2: Remove cache (will regenerate on next build)**

```bash
rm -rf .next/
```

**Step 3: Verify removal**

```bash
ls .next/ 2>&1
```

Expected: "No such file or directory"

**Note:** Do NOT commit this - .next is already gitignored

---

## Phase 3: Code Migrations

### Task 3.1: Migrate Vijesti (News) Routes from admin-old to (admin)

**Files:**
- Create: `src/app/(admin)/news/page.tsx`
- Create: `src/app/(admin)/news/[id]/page.tsx`
- Create: `src/components/admin/news/PostEditorClient.tsx`
- Reference: `src/app/admin-old/vijesti/page.tsx`
- Reference: `src/app/admin-old/vijesti/[id]/page.tsx`
- Reference: `src/app/admin-old/vijesti/[id]/PostEditorClient.tsx`

**Step 1: Create news directory structure**

```bash
mkdir -p src/app/\(admin\)/news/\[id\]
mkdir -p src/components/admin/news
```

**Step 2: Copy and adapt vijesti page**

```bash
# Read original
cat src/app/admin-old/vijesti/page.tsx
```

**Step 3: Create new news list page**

Create `src/app/(admin)/news/page.tsx`:

```typescript
import { db } from "@/lib/db"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { hr } from "date-fns/locale"

export default async function NewsAdminPage() {
  const posts = await db.newsPost.findMany({
    orderBy: { publishedAt: "desc" },
    take: 50,
  })

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Upravljanje vijestima</h1>
        <Link
          href="/news/new"
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
        >
          Nova vijest
        </Link>
      </div>

      <div className="bg-card rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4">Naslov</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Objavljeno</th>
              <th className="text-left p-4">Akcije</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post) => (
              <tr key={post.id} className="border-b">
                <td className="p-4">{post.title}</td>
                <td className="p-4">
                  <span className={post.status === "PUBLISHED" ? "text-green-600" : "text-yellow-600"}>
                    {post.status}
                  </span>
                </td>
                <td className="p-4">
                  {post.publishedAt
                    ? formatDistanceToNow(post.publishedAt, { addSuffix: true, locale: hr })
                    : "-"}
                </td>
                <td className="p-4">
                  <Link href={`/news/${post.id}`} className="text-primary hover:underline">
                    Uredi
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

**Step 4: Copy PostEditorClient component**

```bash
cp src/app/admin-old/vijesti/\[id\]/PostEditorClient.tsx src/components/admin/news/PostEditorClient.tsx
```

**Step 5: Create news detail/edit page**

Create `src/app/(admin)/news/[id]/page.tsx`:

```typescript
import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import { PostEditorClient } from "@/components/admin/news/PostEditorClient"

interface Props {
  params: { id: string }
}

export default async function NewsEditPage({ params }: Props) {
  const post = await db.newsPost.findUnique({
    where: { id: params.id },
  })

  if (!post) {
    notFound()
  }

  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Uredi vijest</h1>
      <PostEditorClient post={post} />
    </div>
  )
}
```

**Step 6: Add news link to admin sidebar**

Modify `src/components/admin/admin-sidebar.tsx` to add news link:

```typescript
// Add to navigation items:
{
  name: "Vijesti",
  href: "/news",
  icon: NewspaperIcon,
}
```

**Step 7: Verify new routes work**

```bash
# Check files exist
ls -la src/app/\(admin\)/news/
ls -la src/app/\(admin\)/news/\[id\]/
ls -la src/components/admin/news/
```

**Step 8: Commit**

```bash
git add src/app/\(admin\)/news/ src/components/admin/news/
git commit -m "feat: migrate news management from admin-old to (admin)"
```

---

### Task 3.2: Migrate einvoice Demo Pages to e-invoice

**Files:**
- Modify: `src/app/(marketing)/alati/oib-validator/page.tsx`
- Modify: `src/app/(marketing)/alati/e-racun/page.tsx`

**Step 1: Check current imports in oib-validator**

```bash
grep "einvoice" src/app/\(marketing\)/alati/oib-validator/page.tsx
```

**Step 2: Update oib-validator imports**

Replace:
```typescript
import { validateOIB } from "@/lib/einvoice/validators"
```

With:
```typescript
// OIB validation is a simple utility - extract or inline
function validateOIB(oib: string): boolean {
  if (!/^\d{11}$/.test(oib)) return false

  let sum = 10
  for (let i = 0; i < 10; i++) {
    sum = (sum + parseInt(oib[i])) % 10
    if (sum === 0) sum = 10
    sum = (sum * 2) % 11
  }

  const checkDigit = (11 - sum) % 10
  return checkDigit === parseInt(oib[10])
}
```

**Step 3: Check current imports in e-racun**

```bash
grep "einvoice" src/app/\(marketing\)/alati/e-racun/page.tsx
```

**Step 4: Update e-racun imports**

Replace:
```typescript
import { generateUBLInvoice, validateInvoice, validateOIB } from "@/lib/einvoice"
import type { EInvoice, InvoiceLine, TaxCategory } from "@/lib/einvoice"
```

With imports from e-invoice or inline the demo logic:
```typescript
// For demo purposes, use simplified inline implementations
// The production e-invoice module has different type signatures
```

**Step 5: Verify no more einvoice imports**

```bash
grep -r "lib/einvoice" src/ --include="*.tsx" --include="*.ts" | grep -v "lib/e-invoice"
```

Expected: No results

**Step 6: Commit**

```bash
git add src/app/\(marketing\)/alati/
git commit -m "refactor: migrate demo pages from einvoice to standalone utilities"
```

---

### Task 3.3: Delete Legacy admin-old Directory

**Prerequisite:** Task 3.1 must be complete and verified

**Files:**
- Delete: `src/app/admin-old/` (entire directory)

**Step 1: Final verification that news is migrated**

```bash
ls src/app/\(admin\)/news/page.tsx
ls src/components/admin/news/PostEditorClient.tsx
```

Expected: Both files exist

**Step 2: Delete admin-old**

```bash
rm -rf src/app/admin-old/
```

**Step 3: Verify no references remain**

```bash
grep -r "admin-old" src/ --include="*.tsx" --include="*.ts" 2>/dev/null
```

Expected: No results

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove legacy admin-old directory after news migration"
```

---

### Task 3.4: Delete Legacy einvoice Library

**Prerequisite:** Task 3.2 must be complete and verified

**Files:**
- Delete: `src/lib/einvoice/` (entire directory)

**Step 1: Final verification that no imports remain**

```bash
grep -r "from.*lib/einvoice" src/ --include="*.tsx" --include="*.ts" 2>/dev/null
```

Expected: No results

**Step 2: Delete einvoice**

```bash
rm -rf src/lib/einvoice/
```

**Step 3: Verify deletion**

```bash
ls src/lib/einvoice 2>&1
```

Expected: "No such file or directory"

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated einvoice library (replaced by e-invoice)"
```

---

## Phase 4: Worktree Cleanup

### Task 4.1: Handle e2e-43f074c Worktree

**Note:** This worktree has uncommitted audit work that should be preserved

**Step 1: Check worktree status**

```bash
cd /home/admin/FiskAI
git worktree list
```

**Step 2: Commit uncommitted work in worktree**

```bash
cd /home/admin/FiskAI/.worktrees/e2e-43f074c
git status
git add -A
git commit -m "docs: preserve e2e audit artifacts and diagnostic scripts"
```

**Step 3: Unlock and remove worktree**

```bash
cd /home/admin/FiskAI
git worktree unlock .worktrees/e2e-43f074c 2>/dev/null || true
git worktree remove .worktrees/e2e-43f074c
```

**Step 4: Verify removal**

```bash
git worktree list
du -sh .worktrees/ 2>/dev/null || echo "Worktrees directory cleaned"
```

Expected: e2e-43f074c no longer listed, ~2GB recovered

---

## Phase 5: Documentation Updates

### Task 5.1: Update .gitignore for Build Caches

**Files:**
- Modify: `.gitignore`

**Step 1: Add tsbuildinfo to gitignore**

```bash
echo "*.tsbuildinfo" >> .gitignore
```

**Step 2: Remove any tracked tsbuildinfo files**

```bash
git rm --cached *.tsbuildinfo 2>/dev/null || true
git rm --cached tsconfig.tsbuildinfo 2>/dev/null || true
git rm --cached tsconfig.workers.tsbuildinfo 2>/dev/null || true
```

**Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: add tsbuildinfo to gitignore"
```

---

### Task 5.2: Create Security Rotation Checklist

**Files:**
- Create: `docs/07_AUDITS/SECURITY_ROTATION_CHECKLIST.md`

**Step 1: Create checklist document**

```markdown
# Security Credentials Rotation Checklist

## Credentials Requiring Rotation

All credentials below were exposed in git history and must be rotated:

### Database
- [ ] POSTGRES_PASSWORD - Rotate in Coolify, update docker-compose

### Authentication
- [ ] NEXTAUTH_SECRET - Generate new: `openssl rand -base64 32`

### API Keys
- [ ] RESEND_API_KEY - Rotate in Resend dashboard
- [ ] CLOUDFLARE_DNS_API_TOKEN - Rotate in Cloudflare dashboard
- [ ] COOLIFY_API_TOKEN - Rotate in Coolify settings
- [ ] DEEPSEEK_API_KEY - Rotate in DeepSeek dashboard
- [ ] OLLAMA_API_KEY - Rotate if using cloud Ollama

### Encryption
- [ ] FISCAL_CERT_KEY - Generate new: `openssl rand -hex 32`
- [ ] EINVOICE_KEY_SECRET - Generate new secret
- [ ] CRON_SECRET - Generate new: `openssl rand -hex 32`

## Rotation Process

1. Generate new credentials
2. Update in Coolify environment variables
3. Redeploy application
4. Verify application works with new credentials
5. Revoke old credentials in respective dashboards

## Post-Rotation Verification

- [ ] Application starts successfully
- [ ] Database connections work
- [ ] Email sending works (Resend)
- [ ] Cron jobs authenticate correctly
- [ ] E-invoice signing works
```

**Step 2: Save the file**

**Step 3: Commit**

```bash
git add docs/07_AUDITS/SECURITY_ROTATION_CHECKLIST.md
git commit -m "docs: add security credentials rotation checklist"
```

---

## Phase 6: Final Verification

### Task 6.1: Run Build Verification

**Step 1: Install dependencies**

```bash
npm install
```

**Step 2: Run type check**

```bash
npm run type-check 2>&1 | head -50
```

Expected: No type errors related to removed files

**Step 3: Run linter**

```bash
npm run lint 2>&1 | head -50
```

Expected: No errors related to removed files

**Step 4: Run build**

```bash
npm run build 2>&1 | tail -20
```

Expected: Build succeeds

---

### Task 6.2: Create Summary Commit

**Step 1: Check all changes**

```bash
git status
git log --oneline -10
```

**Step 2: Create PR-ready branch summary**

```bash
git log --oneline main..HEAD
```

---

## Summary of Changes

### Files Removed
- `src/app/api/admin/regulatory/` (ghost directory)
- `src/app/admin-old/` (legacy admin, after migration)
- `src/lib/einvoice/` (deprecated library)
- Empty audit artifact files (5 files)
- Unused Husky hooks (13 files)
- `.worktrees/e2e-43f074c/` (2GB worktree)
- `.next/` cache (4.2GB)

### Files Created
- `src/app/(admin)/news/page.tsx`
- `src/app/(admin)/news/[id]/page.tsx`
- `src/components/admin/news/PostEditorClient.tsx`
- `docs/07_AUDITS/SECURITY_ROTATION_CHECKLIST.md`

### Files Modified
- `src/app/api/regulatory/trigger/route.ts` (added auth)
- `src/app/api/admin/regulatory-truth/truth-health/route.ts` (added auth)
- `src/app/api/admin/news/*/route.ts` (4 files, fixed auth)
- `src/app/(marketing)/alati/oib-validator/page.tsx` (migrated imports)
- `src/app/(marketing)/alati/e-racun/page.tsx` (migrated imports)
- `src/components/admin/admin-sidebar.tsx` (added news link)
- `.gitignore` (added tsbuildinfo)

### Disk Space Recovered
- ~6.2GB total (worktree + .next cache + removed files)
