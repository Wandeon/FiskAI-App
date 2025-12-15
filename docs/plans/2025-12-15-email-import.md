# Email Import Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable automatic bank statement import from Gmail and Outlook email accounts with Cloudflare R2 storage.

**Architecture:** Provider-agnostic OAuth 2.0 email integration (Gmail, Microsoft) that fetches attachments, deduplicates by content hash, stores in R2, and routes matching files to the existing ImportJob AI extraction pipeline.

**Tech Stack:** Next.js API routes, Prisma ORM, googleapis, @microsoft/microsoft-graph-client, @aws-sdk/client-s3 (R2), existing AES-256-GCM encryption

---

## Task 1: Add Email Provider Enums to Schema

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add enums after existing DuplicateResolution enum**

```prisma
enum EmailProvider {
  GMAIL
  MICROSOFT
}

enum EmailConnectionStatus {
  CONNECTED
  EXPIRED
  REVOKED
  ERROR
}

enum AttachmentStatus {
  PENDING
  IMPORTED
  SKIPPED
  FAILED
}
```

**Step 2: Run schema validation**

Run: `cd /home/admin/FiskAI && npx prisma validate`
Expected: "The schema is valid!"

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(email-import): add email provider enums"
```

---

## Task 2: Add EmailConnection Model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add EmailConnection model after PotentialDuplicate model**

```prisma
model EmailConnection {
  id                String                @id @default(cuid())
  companyId         String
  provider          EmailProvider
  emailAddress      String
  status            EmailConnectionStatus @default(CONNECTED)

  accessTokenEnc    String?
  refreshTokenEnc   String
  tokenExpiresAt    DateTime?
  scopes            String[]

  lastSyncAt        DateTime?
  syncCursor        String?
  lastError         String?

  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  company           Company               @relation(fields: [companyId], references: [id], onDelete: Cascade)
  importRules       EmailImportRule[]
  attachments       EmailAttachment[]

  @@unique([companyId, emailAddress])
  @@index([companyId])
  @@index([status])
}
```

**Step 2: Add relation to Company model**

Find in Company model and add after `potentialDuplicates`:
```prisma
  emailConnections      EmailConnection[]
```

**Step 3: Run schema validation**

Run: `cd /home/admin/FiskAI && npx prisma validate`
Expected: "The schema is valid!"

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(email-import): add EmailConnection model"
```

---

## Task 3: Add EmailImportRule Model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add EmailImportRule model after EmailConnection**

```prisma
model EmailImportRule {
  id                String           @id @default(cuid())
  connectionId      String
  companyId         String

  senderEmail       String?
  senderDomain      String?
  subjectContains   String?
  filenameContains  String?

  isActive          Boolean          @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  connection        EmailConnection  @relation(fields: [connectionId], references: [id], onDelete: Cascade)

  @@index([connectionId])
  @@index([companyId])
}
```

**Step 2: Run schema validation**

Run: `cd /home/admin/FiskAI && npx prisma validate`
Expected: "The schema is valid!"

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(email-import): add EmailImportRule model"
```

---

## Task 4: Add EmailAttachment Model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add EmailAttachment model after EmailImportRule**

```prisma
model EmailAttachment {
  id                    String            @id @default(cuid())
  companyId             String
  connectionId          String

  providerMessageId     String
  providerAttachmentId  String?
  contentHash           String

  receivedAt            DateTime
  senderEmail           String
  subject               String
  filename              String
  mimeType              String
  sizeBytes             Int

  r2Key                 String
  status                AttachmentStatus  @default(PENDING)
  importJobId           String?

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  connection            EmailConnection   @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  importJob             ImportJob?        @relation(fields: [importJobId], references: [id])

  @@unique([connectionId, contentHash])
  @@index([companyId])
  @@index([connectionId])
  @@index([status])
}
```

**Step 2: Add relation to ImportJob model**

Find ImportJob model and add after `invoice`:
```prisma
  emailAttachment   EmailAttachment?
```

**Step 3: Add relations to Company model**

Find in Company model and add:
```prisma
  emailImportRules      EmailImportRule[]
  emailAttachments      EmailAttachment[]
```

**Step 4: Run schema validation**

Run: `cd /home/admin/FiskAI && npx prisma validate`
Expected: "The schema is valid!"

**Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(email-import): add EmailAttachment model"
```

---

## Task 5: Push Schema Changes to Database

**Files:**
- None (database operation)

**Step 1: Push schema to database**

Run: `cd /home/admin/FiskAI && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

**Step 2: Generate Prisma client**

Run: `cd /home/admin/FiskAI && npx prisma generate`
Expected: "Generated Prisma Client"

**Step 3: Commit (if any generated files changed)**

```bash
git add -A
git commit -m "feat(email-import): sync database schema"
```

---

## Task 6: Create Email Provider Types

**Files:**
- Create: `src/lib/email-sync/types.ts`

**Step 1: Create types file**

```typescript
// src/lib/email-sync/types.ts

export interface TokenResult {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  scopes: string[]
}

export interface EmailMessage {
  id: string
  receivedAt: Date
  senderEmail: string
  subject: string
  attachments: EmailAttachmentInfo[]
}

export interface EmailAttachmentInfo {
  id: string
  filename: string
  mimeType: string
  sizeBytes: number
}

export interface MessageBatch {
  messages: EmailMessage[]
  nextCursor?: string
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/lib/email-sync/types.ts 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/email-sync/types.ts
git commit -m "feat(email-import): add email sync types"
```

---

## Task 7: Create Email Provider Interface

**Files:**
- Create: `src/lib/email-sync/provider.ts`

**Step 1: Create provider interface**

```typescript
// src/lib/email-sync/provider.ts

import type { TokenResult, MessageBatch } from './types'

export interface EmailSyncProvider {
  name: string

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(redirectUri: string, state: string): string

  /**
   * Exchange authorization code for tokens
   */
  exchangeCode(code: string, redirectUri: string): Promise<TokenResult>

  /**
   * Refresh expired access token
   */
  refreshToken(refreshToken: string): Promise<TokenResult>

  /**
   * Fetch messages with attachments since cursor
   */
  fetchMessages(accessToken: string, cursor?: string): Promise<MessageBatch>

  /**
   * Download attachment content
   */
  downloadAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string
  ): Promise<Buffer>

  /**
   * Revoke tokens on disconnect
   */
  revokeAccess(accessToken: string): Promise<void>
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/lib/email-sync/provider.ts 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/email-sync/provider.ts
git commit -m "feat(email-import): add email provider interface"
```

---

## Task 8: Install Gmail API Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install googleapis**

Run: `cd /home/admin/FiskAI && npm install googleapis`
Expected: "added X packages"

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(email-import): add googleapis dependency"
```

---

## Task 9: Create Gmail Provider Implementation

**Files:**
- Create: `src/lib/email-sync/providers/gmail.ts`

**Step 1: Create Gmail provider**

```typescript
// src/lib/email-sync/providers/gmail.ts

import { google } from 'googleapis'
import type { EmailSyncProvider } from '../provider'
import type { TokenResult, MessageBatch, EmailMessage } from '../types'

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
}

export const gmailProvider: EmailSyncProvider = {
  name: 'gmail',

  getAuthUrl(redirectUri: string, state: string): string {
    const oauth2Client = getOAuth2Client()
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      redirect_uri: redirectUri,
      state,
      prompt: 'consent',
    })
  },

  async exchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
    const oauth2Client = getOAuth2Client()
    oauth2Client.redirectUri = redirectUri

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received - user may need to revoke and reconnect')
    }

    return {
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expiry_date || Date.now() + 3600 * 1000),
      scopes: SCOPES,
    }
  },

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const { credentials } = await oauth2Client.refreshAccessToken()

    return {
      accessToken: credentials.access_token!,
      refreshToken: credentials.refresh_token || refreshToken,
      expiresAt: new Date(credentials.expiry_date || Date.now() + 3600 * 1000),
      scopes: SCOPES,
    }
  },

  async fetchMessages(accessToken: string, cursor?: string): Promise<MessageBatch> {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'has:attachment',
      maxResults: 50,
      pageToken: cursor,
    })

    const messages: EmailMessage[] = []

    for (const msg of response.data.messages || []) {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id!,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      })

      const headers = detail.data.payload?.headers || []
      const fromHeader = headers.find(h => h.name === 'From')?.value || ''
      const subjectHeader = headers.find(h => h.name === 'Subject')?.value || ''
      const dateHeader = headers.find(h => h.name === 'Date')?.value || ''

      // Extract email from "Name <email>" format
      const emailMatch = fromHeader.match(/<([^>]+)>/) || [null, fromHeader]
      const senderEmail = emailMatch[1] || fromHeader

      const attachments = (detail.data.payload?.parts || [])
        .filter(part => part.filename && part.body?.attachmentId)
        .map(part => ({
          id: part.body!.attachmentId!,
          filename: part.filename!,
          mimeType: part.mimeType || 'application/octet-stream',
          sizeBytes: part.body!.size || 0,
        }))

      if (attachments.length > 0) {
        messages.push({
          id: msg.id!,
          receivedAt: new Date(dateHeader || detail.data.internalDate || Date.now()),
          senderEmail,
          subject: subjectHeader,
          attachments,
        })
      }
    }

    return {
      messages,
      nextCursor: response.data.nextPageToken || undefined,
    }
  },

  async downloadAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string
  ): Promise<Buffer> {
    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ access_token: accessToken })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    const response = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    })

    const data = response.data.data
    if (!data) {
      throw new Error('No attachment data received')
    }

    // Gmail returns base64url encoded data
    return Buffer.from(data, 'base64url')
  },

  async revokeAccess(accessToken: string): Promise<void> {
    const oauth2Client = getOAuth2Client()
    await oauth2Client.revokeToken(accessToken)
  },
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/lib/email-sync/providers/gmail.ts 2>&1 | head -20`
Expected: No errors (or only unrelated existing errors)

**Step 3: Commit**

```bash
git add src/lib/email-sync/providers/gmail.ts
git commit -m "feat(email-import): implement Gmail provider"
```

---

## Task 10: Install Microsoft Graph Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Microsoft Graph client**

Run: `cd /home/admin/FiskAI && npm install @microsoft/microsoft-graph-client @azure/msal-node`
Expected: "added X packages"

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(email-import): add Microsoft Graph dependencies"
```

---

## Task 11: Create Microsoft Provider Implementation

**Files:**
- Create: `src/lib/email-sync/providers/microsoft.ts`

**Step 1: Create Microsoft provider**

```typescript
// src/lib/email-sync/providers/microsoft.ts

import { ConfidentialClientApplication } from '@azure/msal-node'
import { Client } from '@microsoft/microsoft-graph-client'
import type { EmailSyncProvider } from '../provider'
import type { TokenResult, MessageBatch, EmailMessage } from '../types'

const SCOPES = ['Mail.Read', 'offline_access']

function getMsalClient() {
  return new ConfidentialClientApplication({
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authority: 'https://login.microsoftonline.com/common',
    },
  })
}

export const microsoftProvider: EmailSyncProvider = {
  name: 'microsoft',

  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES.join(' '),
      state,
      prompt: 'consent',
    })
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
  },

  async exchangeCode(code: string, redirectUri: string): Promise<TokenResult> {
    const msalClient = getMsalClient()

    const result = await msalClient.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri,
    })

    if (!result) {
      throw new Error('Failed to exchange code for tokens')
    }

    // Get refresh token via token cache
    const accounts = await msalClient.getTokenCache().getAllAccounts()
    const account = accounts[0]

    // For refresh token, we need to use the silent flow later
    // Store the account info as the "refresh token"
    const refreshData = JSON.stringify({
      homeAccountId: account?.homeAccountId,
      tenantId: account?.tenantId,
    })

    return {
      accessToken: result.accessToken,
      refreshToken: refreshData,
      expiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
      scopes: SCOPES,
    }
  },

  async refreshToken(refreshTokenData: string): Promise<TokenResult> {
    const msalClient = getMsalClient()

    // Parse stored account data
    const { homeAccountId, tenantId } = JSON.parse(refreshTokenData)

    const result = await msalClient.acquireTokenSilent({
      scopes: SCOPES,
      account: {
        homeAccountId,
        tenantId,
        environment: 'login.microsoftonline.com',
        username: '',
        localAccountId: '',
      },
    })

    return {
      accessToken: result.accessToken,
      refreshToken: refreshTokenData,
      expiresAt: result.expiresOn || new Date(Date.now() + 3600 * 1000),
      scopes: SCOPES,
    }
  },

  async fetchMessages(accessToken: string, cursor?: string): Promise<MessageBatch> {
    const client = Client.init({
      authProvider: (done) => done(null, accessToken),
    })

    let request = client
      .api('/me/messages')
      .filter('hasAttachments eq true')
      .select('id,receivedDateTime,from,subject')
      .expand('attachments($select=id,name,contentType,size)')
      .top(50)

    if (cursor) {
      request = client.api(cursor)
    }

    const response = await request.get()

    const messages: EmailMessage[] = (response.value || []).map((msg: any) => ({
      id: msg.id,
      receivedAt: new Date(msg.receivedDateTime),
      senderEmail: msg.from?.emailAddress?.address || '',
      subject: msg.subject || '',
      attachments: (msg.attachments || []).map((att: any) => ({
        id: att.id,
        filename: att.name,
        mimeType: att.contentType || 'application/octet-stream',
        sizeBytes: att.size || 0,
      })),
    }))

    return {
      messages,
      nextCursor: response['@odata.nextLink'],
    }
  },

  async downloadAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string
  ): Promise<Buffer> {
    const client = Client.init({
      authProvider: (done) => done(null, accessToken),
    })

    const response = await client
      .api(`/me/messages/${messageId}/attachments/${attachmentId}`)
      .get()

    if (!response.contentBytes) {
      throw new Error('No attachment content received')
    }

    return Buffer.from(response.contentBytes, 'base64')
  },

  async revokeAccess(_accessToken: string): Promise<void> {
    // Microsoft doesn't have a simple revoke endpoint
    // User must revoke via https://account.microsoft.com/privacy/app-access
    // This is a no-op
  },
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/lib/email-sync/providers/microsoft.ts 2>&1 | head -20`
Expected: No errors (or only unrelated existing errors)

**Step 3: Commit**

```bash
git add src/lib/email-sync/providers/microsoft.ts
git commit -m "feat(email-import): implement Microsoft provider"
```

---

## Task 12: Create Provider Index

**Files:**
- Create: `src/lib/email-sync/providers/index.ts`

**Step 1: Create index file**

```typescript
// src/lib/email-sync/providers/index.ts

import type { EmailSyncProvider } from '../provider'
import { gmailProvider } from './gmail'
import { microsoftProvider } from './microsoft'

const providers: Record<string, EmailSyncProvider> = {
  gmail: gmailProvider,
  microsoft: microsoftProvider,
}

export function getEmailProvider(name: string): EmailSyncProvider {
  const provider = providers[name.toLowerCase()]

  if (!provider) {
    throw new Error(`Unknown email provider: ${name}`)
  }

  return provider
}

export function isEmailProviderConfigured(name: string): boolean {
  if (name === 'gmail' || name === 'GMAIL') {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  }

  if (name === 'microsoft' || name === 'MICROSOFT') {
    return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)
  }

  return false
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/lib/email-sync/providers/index.ts 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/email-sync/providers/index.ts
git commit -m "feat(email-import): add email provider index"
```

---

## Task 13: Create R2 Storage Client

**Files:**
- Create: `src/lib/r2-client.ts`

**Step 1: Install AWS S3 client**

Run: `cd /home/admin/FiskAI && npm install @aws-sdk/client-s3`
Expected: "added X packages"

**Step 2: Create R2 client**

```typescript
// src/lib/r2-client.ts

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME || 'fiskai-documents'

export async function uploadToR2(
  key: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  )
  return key
}

export async function downloadFromR2(key: string): Promise<Buffer> {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )

  const chunks: Uint8Array[] = []
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )
}

export function generateR2Key(
  companyId: string,
  contentHash: string,
  filename: string
): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const ext = filename.split('.').pop() || 'bin'

  return `attachments/${companyId}/${year}/${month}/${contentHash}.${ext}`
}
```

**Step 3: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/lib/r2-client.ts 2>&1 | head -20`
Expected: No errors

**Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/r2-client.ts
git commit -m "feat(email-import): add Cloudflare R2 client"
```

---

## Task 14: Create Email Connect API Endpoint

**Files:**
- Create: `src/app/api/email/connect/route.ts`

**Step 1: Create connect endpoint**

```typescript
// src/app/api/email/connect/route.ts

import { NextResponse } from 'next/server'
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { setTenantContext } from '@/lib/prisma-extensions'
import { getEmailProvider, isEmailProviderConfigured } from '@/lib/email-sync/providers'

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    setTenantContext({ companyId: company.id, userId: user.id! })

    const { provider: providerName } = await request.json()

    if (!providerName || !['GMAIL', 'MICROSOFT'].includes(providerName)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be GMAIL or MICROSOFT' },
        { status: 400 }
      )
    }

    if (!isEmailProviderConfigured(providerName)) {
      return NextResponse.json(
        { error: `${providerName} provider not configured` },
        { status: 503 }
      )
    }

    const provider = getEmailProvider(providerName)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.fiskai.hr'
    const redirectUri = `${baseUrl}/api/email/callback`

    // State contains provider and company info for callback
    const state = Buffer.from(
      JSON.stringify({ provider: providerName, companyId: company.id })
    ).toString('base64url')

    const authUrl = provider.getAuthUrl(redirectUri, state)

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('[email/connect] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Connection failed' },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/app/api/email/connect/route.ts 2>&1 | head -20`
Expected: No errors (or only unrelated existing errors)

**Step 3: Commit**

```bash
git add src/app/api/email/connect/route.ts
git commit -m "feat(email-import): add email connect endpoint"
```

---

## Task 15: Create Email Callback API Endpoint

**Files:**
- Create: `src/app/api/email/callback/route.ts`

**Step 1: Create callback endpoint**

```typescript
// src/app/api/email/callback/route.ts

import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getEmailProvider } from '@/lib/email-sync/providers'
import { encryptSecret } from '@/lib/secrets'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    console.error('[email/callback] OAuth error:', error)
    redirect('/settings/email?error=oauth_denied')
  }

  if (!code || !state) {
    redirect('/settings/email?error=missing_params')
  }

  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString())
    const { provider: providerName, companyId } = stateData

    if (!providerName || !companyId) {
      redirect('/settings/email?error=invalid_state')
    }

    const provider = getEmailProvider(providerName)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.fiskai.hr'
    const redirectUri = `${baseUrl}/api/email/callback`

    // Exchange code for tokens
    const tokens = await provider.exchangeCode(code, redirectUri)

    // Get user email address (for Gmail, from token info)
    let emailAddress = 'unknown@email.com'

    if (providerName === 'GMAIL') {
      // Fetch user profile to get email
      const { google } = await import('googleapis')
      const oauth2Client = new google.auth.OAuth2()
      oauth2Client.setCredentials({ access_token: tokens.accessToken })
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
      const userInfo = await oauth2.userinfo.get()
      emailAddress = userInfo.data.email || emailAddress
    } else if (providerName === 'MICROSOFT') {
      // Fetch user profile from Graph
      const { Client } = await import('@microsoft/microsoft-graph-client')
      const client = Client.init({
        authProvider: (done) => done(null, tokens.accessToken),
      })
      const user = await client.api('/me').select('mail,userPrincipalName').get()
      emailAddress = user.mail || user.userPrincipalName || emailAddress
    }

    // Create or update connection
    const providerEnum = providerName.toUpperCase() as 'GMAIL' | 'MICROSOFT'

    await db.emailConnection.upsert({
      where: {
        companyId_emailAddress: {
          companyId,
          emailAddress,
        },
      },
      create: {
        companyId,
        provider: providerEnum,
        emailAddress,
        status: 'CONNECTED',
        accessTokenEnc: tokens.accessToken ? encryptSecret(tokens.accessToken) : null,
        refreshTokenEnc: encryptSecret(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
      },
      update: {
        status: 'CONNECTED',
        accessTokenEnc: tokens.accessToken ? encryptSecret(tokens.accessToken) : null,
        refreshTokenEnc: encryptSecret(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        lastError: null,
      },
    })

    redirect('/settings/email?success=connected')
  } catch (error) {
    console.error('[email/callback] error:', error)
    redirect('/settings/email?error=callback_failed')
  }
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/app/api/email/callback/route.ts 2>&1 | head -20`
Expected: No errors (or only unrelated existing errors)

**Step 3: Commit**

```bash
git add src/app/api/email/callback/route.ts
git commit -m "feat(email-import): add email callback endpoint"
```

---

## Task 16: Create Email Disconnect API Endpoint

**Files:**
- Create: `src/app/api/email/[connectionId]/disconnect/route.ts`

**Step 1: Create disconnect endpoint**

```typescript
// src/app/api/email/[connectionId]/disconnect/route.ts

import { NextResponse } from 'next/server'
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import { getEmailProvider } from '@/lib/email-sync/providers'
import { decryptSecret } from '@/lib/secrets'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ connectionId: string }> }
) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    setTenantContext({ companyId: company.id, userId: user.id! })

    const { connectionId } = await params

    const connection = await db.emailConnection.findFirst({
      where: { id: connectionId, companyId: company.id },
    })

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    // Try to revoke access token
    try {
      if (connection.accessTokenEnc) {
        const provider = getEmailProvider(connection.provider)
        const accessToken = decryptSecret(connection.accessTokenEnc)
        await provider.revokeAccess(accessToken)
      }
    } catch (revokeError) {
      console.error('[email/disconnect] revoke error:', revokeError)
      // Continue with deletion even if revoke fails
    }

    // Update status to revoked (keep for history)
    await db.emailConnection.update({
      where: { id: connectionId },
      data: {
        status: 'REVOKED',
        accessTokenEnc: null,
        refreshTokenEnc: '',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[email/disconnect] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Disconnect failed' },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/app/api/email/*/disconnect/route.ts 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/email/
git commit -m "feat(email-import): add email disconnect endpoint"
```

---

## Task 17: Create Email Import Rules API

**Files:**
- Create: `src/app/api/email/rules/route.ts`

**Step 1: Create rules CRUD endpoint**

```typescript
// src/app/api/email/rules/route.ts

import { NextResponse } from 'next/server'
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'

export async function GET() {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    setTenantContext({ companyId: company.id, userId: user.id! })

    const rules = await db.emailImportRule.findMany({
      where: { companyId: company.id },
      include: {
        connection: {
          select: { emailAddress: true, provider: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('[email/rules] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch rules' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    setTenantContext({ companyId: company.id, userId: user.id! })

    const { connectionId, senderEmail, senderDomain, subjectContains, filenameContains } =
      await request.json()

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      )
    }

    // Verify connection belongs to company
    const connection = await db.emailConnection.findFirst({
      where: { id: connectionId, companyId: company.id },
    })

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    // Require at least one filter
    if (!senderEmail && !senderDomain && !subjectContains && !filenameContains) {
      return NextResponse.json(
        { error: 'At least one filter criterion is required' },
        { status: 400 }
      )
    }

    const rule = await db.emailImportRule.create({
      data: {
        connectionId,
        companyId: company.id,
        senderEmail: senderEmail || null,
        senderDomain: senderDomain || null,
        subjectContains: subjectContains || null,
        filenameContains: filenameContains || null,
      },
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('[email/rules] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to create rule' },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/app/api/email/rules/route.ts 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/email/rules/route.ts
git commit -m "feat(email-import): add email rules API"
```

---

## Task 18: Create Email Rule Update/Delete API

**Files:**
- Create: `src/app/api/email/rules/[id]/route.ts`

**Step 1: Create rule update/delete endpoint**

```typescript
// src/app/api/email/rules/[id]/route.ts

import { NextResponse } from 'next/server'
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    setTenantContext({ companyId: company.id, userId: user.id! })

    const { id } = await params

    const rule = await db.emailImportRule.findFirst({
      where: { id, companyId: company.id },
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    const { senderEmail, senderDomain, subjectContains, filenameContains, isActive } =
      await request.json()

    const updated = await db.emailImportRule.update({
      where: { id },
      data: {
        senderEmail: senderEmail ?? rule.senderEmail,
        senderDomain: senderDomain ?? rule.senderDomain,
        subjectContains: subjectContains ?? rule.subjectContains,
        filenameContains: filenameContains ?? rule.filenameContains,
        isActive: isActive ?? rule.isActive,
      },
    })

    return NextResponse.json({ rule: updated })
  } catch (error) {
    console.error('[email/rules] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)
    setTenantContext({ companyId: company.id, userId: user.id! })

    const { id } = await params

    const rule = await db.emailImportRule.findFirst({
      where: { id, companyId: company.id },
    })

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    await db.emailImportRule.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[email/rules] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/app/api/email/rules/*/route.ts 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/email/rules/
git commit -m "feat(email-import): add email rule update/delete API"
```

---

## Task 19: Create Email Sync Service

**Files:**
- Create: `src/lib/email-sync/sync-service.ts`

**Step 1: Create sync service**

```typescript
// src/lib/email-sync/sync-service.ts

import crypto from 'crypto'
import { db } from '@/lib/db'
import { getEmailProvider } from './providers'
import { decryptSecret, encryptSecret } from '@/lib/secrets'
import { uploadToR2, generateR2Key } from '@/lib/r2-client'
import type { EmailConnection, EmailImportRule } from '@prisma/client'
import type { EmailMessage, EmailAttachmentInfo } from './types'

interface SyncResult {
  connectionId: string
  messagesProcessed: number
  attachmentsSaved: number
  importJobsCreated: number
  errors: string[]
}

export async function syncEmailConnection(
  connection: EmailConnection & { importRules: EmailImportRule[] }
): Promise<SyncResult> {
  const result: SyncResult = {
    connectionId: connection.id,
    messagesProcessed: 0,
    attachmentsSaved: 0,
    importJobsCreated: 0,
    errors: [],
  }

  try {
    const provider = getEmailProvider(connection.provider)

    // Get valid access token
    let accessToken: string
    const now = new Date()

    if (connection.accessTokenEnc && connection.tokenExpiresAt && connection.tokenExpiresAt > now) {
      accessToken = decryptSecret(connection.accessTokenEnc)
    } else {
      // Refresh token
      const refreshToken = decryptSecret(connection.refreshTokenEnc)
      const tokens = await provider.refreshToken(refreshToken)

      accessToken = tokens.accessToken

      // Update stored tokens
      await db.emailConnection.update({
        where: { id: connection.id },
        data: {
          accessTokenEnc: encryptSecret(tokens.accessToken),
          refreshTokenEnc: encryptSecret(tokens.refreshToken),
          tokenExpiresAt: tokens.expiresAt,
        },
      })
    }

    // Fetch messages
    let cursor = connection.syncCursor || undefined
    let hasMore = true

    while (hasMore) {
      const batch = await provider.fetchMessages(accessToken, cursor)

      for (const message of batch.messages) {
        result.messagesProcessed++

        for (const attachment of message.attachments) {
          try {
            await processAttachment(
              connection,
              message,
              attachment,
              accessToken,
              provider,
              result
            )
          } catch (attError) {
            result.errors.push(
              `Failed to process ${attachment.filename}: ${attError instanceof Error ? attError.message : 'Unknown error'}`
            )
          }
        }
      }

      cursor = batch.nextCursor
      hasMore = !!batch.nextCursor

      // Update cursor after each batch
      await db.emailConnection.update({
        where: { id: connection.id },
        data: { syncCursor: cursor || null },
      })
    }

    // Update last sync time
    await db.emailConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Sync failed'
    result.errors.push(errorMessage)

    await db.emailConnection.update({
      where: { id: connection.id },
      data: {
        lastError: errorMessage,
        status: errorMessage.includes('token') ? 'EXPIRED' : 'ERROR',
      },
    })
  }

  return result
}

async function processAttachment(
  connection: EmailConnection & { importRules: EmailImportRule[] },
  message: EmailMessage,
  attachment: EmailAttachmentInfo,
  accessToken: string,
  provider: ReturnType<typeof getEmailProvider>,
  result: SyncResult
): Promise<void> {
  // Generate content hash for deduplication
  const contentHash = crypto
    .createHash('sha256')
    .update(`${message.id}:${attachment.id}:${attachment.filename}:${attachment.sizeBytes}`)
    .digest('hex')
    .slice(0, 32)

  // Check if already processed
  const existing = await db.emailAttachment.findUnique({
    where: {
      connectionId_contentHash: {
        connectionId: connection.id,
        contentHash,
      },
    },
  })

  if (existing) {
    return // Already processed
  }

  // Check if matches any import rules
  const matchesRule = connection.importRules.some((rule) => {
    if (!rule.isActive) return false

    if (rule.senderEmail && message.senderEmail.toLowerCase() !== rule.senderEmail.toLowerCase()) {
      return false
    }

    if (rule.senderDomain) {
      const domain = message.senderEmail.split('@')[1]?.toLowerCase()
      if (domain !== rule.senderDomain.toLowerCase()) return false
    }

    if (rule.subjectContains && !message.subject.toLowerCase().includes(rule.subjectContains.toLowerCase())) {
      return false
    }

    if (rule.filenameContains && !attachment.filename.toLowerCase().includes(rule.filenameContains.toLowerCase())) {
      return false
    }

    return true
  })

  // Download attachment
  const data = await provider.downloadAttachment(accessToken, message.id, attachment.id)

  // Upload to R2
  const r2Key = generateR2Key(connection.companyId, contentHash, attachment.filename)
  await uploadToR2(r2Key, data, attachment.mimeType)

  result.attachmentsSaved++

  // Create EmailAttachment record
  const emailAttachment = await db.emailAttachment.create({
    data: {
      companyId: connection.companyId,
      connectionId: connection.id,
      providerMessageId: message.id,
      providerAttachmentId: attachment.id,
      contentHash,
      receivedAt: message.receivedAt,
      senderEmail: message.senderEmail,
      subject: message.subject,
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      r2Key,
      status: matchesRule ? 'PENDING' : 'SKIPPED',
    },
  })

  // If matches rule, create ImportJob
  if (matchesRule) {
    // Determine document type from filename/mime
    const isPdf = attachment.mimeType === 'application/pdf' || attachment.filename.endsWith('.pdf')
    const isImage = attachment.mimeType.startsWith('image/')

    if (isPdf || isImage) {
      const importJob = await db.importJob.create({
        data: {
          companyId: connection.companyId,
          userId: 'system', // System-initiated
          fileChecksum: contentHash,
          originalName: attachment.filename,
          storagePath: r2Key,
          status: 'PENDING',
          documentType: 'BANK_STATEMENT', // Default, AI will refine
        },
      })

      await db.emailAttachment.update({
        where: { id: emailAttachment.id },
        data: {
          importJobId: importJob.id,
          status: 'IMPORTED',
        },
      })

      result.importJobsCreated++
    }
  }
}

export async function syncAllConnections(): Promise<SyncResult[]> {
  const connections = await db.emailConnection.findMany({
    where: {
      status: 'CONNECTED',
    },
    include: {
      importRules: true,
    },
  })

  const results: SyncResult[] = []

  for (const connection of connections) {
    const result = await syncEmailConnection(connection)
    results.push(result)
  }

  return results
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/lib/email-sync/sync-service.ts 2>&1 | head -20`
Expected: No errors (or only unrelated existing errors)

**Step 3: Commit**

```bash
git add src/lib/email-sync/sync-service.ts
git commit -m "feat(email-import): add email sync service"
```

---

## Task 20: Create Email Sync Cron Job

**Files:**
- Create: `src/app/api/cron/email-sync/route.ts`

**Step 1: Create cron endpoint**

```typescript
// src/app/api/cron/email-sync/route.ts

import { NextResponse } from 'next/server'
import { syncAllConnections } from '@/lib/email-sync/sync-service'

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[cron/email-sync] Starting email sync...')

    const results = await syncAllConnections()

    const summary = {
      connections: results.length,
      totalMessages: results.reduce((sum, r) => sum + r.messagesProcessed, 0),
      totalAttachments: results.reduce((sum, r) => sum + r.attachmentsSaved, 0),
      totalImportJobs: results.reduce((sum, r) => sum + r.importJobsCreated, 0),
      errors: results.flatMap((r) => r.errors),
    }

    console.log('[cron/email-sync] Completed:', summary)

    return NextResponse.json({ success: true, summary })
  } catch (error) {
    console.error('[cron/email-sync] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/app/api/cron/email-sync/route.ts 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/cron/email-sync/route.ts
git commit -m "feat(email-import): add email sync cron job"
```

---

## Task 21: Update Vercel Cron Config

**Files:**
- Modify: `vercel.json`

**Step 1: Add email-sync cron job**

```json
{
  "crons": [
    {
      "path": "/api/cron/bank-sync",
      "schedule": "0 5 * * *"
    },
    {
      "path": "/api/cron/email-sync",
      "schedule": "0 5 * * *"
    }
  ]
}
```

**Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat(email-import): add email-sync to vercel cron"
```

---

## Task 22: Create Email Settings Page

**Files:**
- Create: `src/app/(dashboard)/settings/email/page.tsx`

**Step 1: Create email settings page**

```typescript
// src/app/(dashboard)/settings/email/page.tsx

import { redirect } from 'next/navigation'
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { setTenantContext } from '@/lib/prisma-extensions'
import { EmailConnectionList } from './components/connection-list'
import { ConnectEmailButton } from './components/connect-button'

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>
}) {
  const user = await requireAuth()
  if (!user.id) redirect('/login')

  const company = await requireCompany(user.id)
  setTenantContext({ companyId: company.id, userId: user.id })

  const connections = await db.emailConnection.findMany({
    where: { companyId: company.id },
    include: {
      importRules: true,
      _count: { select: { attachments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const params = await searchParams

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Email Connections</h1>
          <p className="text-sm text-muted-foreground">
            Connect your email to automatically import bank statements
          </p>
        </div>
        <ConnectEmailButton />
      </div>

      {params.success === 'connected' && (
        <div className="rounded-md bg-green-50 p-4 text-green-800">
          Email connected successfully! Set up import rules below.
        </div>
      )}

      {params.error && (
        <div className="rounded-md bg-red-50 p-4 text-red-800">
          Connection failed: {params.error.replace(/_/g, ' ')}
        </div>
      )}

      <EmailConnectionList connections={connections} />
    </div>
  )
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/app/\\(dashboard\\)/settings/email/page.tsx 2>&1 | head -20`
Expected: No errors (or only unrelated existing errors)

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/email/
git commit -m "feat(email-import): add email settings page"
```

---

## Task 23: Create Connect Email Button Component

**Files:**
- Create: `src/app/(dashboard)/settings/email/components/connect-button.tsx`

**Step 1: Create connect button component**

```typescript
'use client'

// src/app/(dashboard)/settings/email/components/connect-button.tsx

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Mail, Plus } from 'lucide-react'

export function ConnectEmailButton() {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleConnect(provider: 'GMAIL' | 'MICROSOFT') {
    setLoading(provider)
    try {
      const response = await fetch('/api/email/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Connection failed')
      }

      // Redirect to OAuth
      window.location.href = data.authUrl
    } catch (error) {
      console.error('Connect error:', error)
      alert(error instanceof Error ? error.message : 'Connection failed')
      setLoading(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Connect Email
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleConnect('GMAIL')}
          disabled={loading === 'GMAIL'}
        >
          <Mail className="mr-2 h-4 w-4" />
          {loading === 'GMAIL' ? 'Connecting...' : 'Connect Gmail'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleConnect('MICROSOFT')}
          disabled={loading === 'MICROSOFT'}
        >
          <Mail className="mr-2 h-4 w-4" />
          {loading === 'MICROSOFT' ? 'Connecting...' : 'Connect Outlook'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/app/\\(dashboard\\)/settings/email/components/connect-button.tsx 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/email/components/
git commit -m "feat(email-import): add connect email button component"
```

---

## Task 24: Create Email Connection List Component

**Files:**
- Create: `src/app/(dashboard)/settings/email/components/connection-list.tsx`

**Step 1: Create connection list component**

```typescript
'use client'

// src/app/(dashboard)/settings/email/components/connection-list.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Mail, Trash2, RefreshCw } from 'lucide-react'
import type { EmailConnection, EmailImportRule } from '@prisma/client'
import { ImportRulesSection } from './import-rules'

type ConnectionWithRules = EmailConnection & {
  importRules: EmailImportRule[]
  _count: { attachments: number }
}

interface EmailConnectionListProps {
  connections: ConnectionWithRules[]
}

export function EmailConnectionList({ connections }: EmailConnectionListProps) {
  const router = useRouter()
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

  async function handleDisconnect(connectionId: string) {
    if (!confirm('Are you sure you want to disconnect this email account?')) {
      return
    }

    setDisconnecting(connectionId)
    try {
      const response = await fetch(`/api/email/${connectionId}/disconnect`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Disconnect failed')
      }

      router.refresh()
    } catch (error) {
      console.error('Disconnect error:', error)
      alert(error instanceof Error ? error.message : 'Disconnect failed')
    } finally {
      setDisconnecting(null)
    }
  }

  if (connections.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Mail className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No email accounts connected</p>
          <p className="text-sm text-muted-foreground">
            Connect Gmail or Outlook to automatically import bank statements
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {connections.map((connection) => (
        <Card key={connection.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base">{connection.emailAddress}</CardTitle>
                <CardDescription>
                  {connection.provider} - {connection._count.attachments} attachments
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={connection.status === 'CONNECTED' ? 'default' : 'destructive'}
              >
                {connection.status}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDisconnect(connection.id)}
                disabled={disconnecting === connection.id}
              >
                {disconnecting === connection.id ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              Last synced:{' '}
              {connection.lastSyncAt
                ? new Date(connection.lastSyncAt).toLocaleString()
                : 'Never'}
            </div>
            <ImportRulesSection
              connectionId={connection.id}
              rules={connection.importRules}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/app/\\(dashboard\\)/settings/email/components/connection-list.tsx 2>&1 | head -20`
Expected: No errors (may show import error for import-rules which we create next)

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/email/components/
git commit -m "feat(email-import): add email connection list component"
```

---

## Task 25: Create Import Rules Component

**Files:**
- Create: `src/app/(dashboard)/settings/email/components/import-rules.tsx`

**Step 1: Create import rules component**

```typescript
'use client'

// src/app/(dashboard)/settings/email/components/import-rules.tsx

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, X } from 'lucide-react'
import type { EmailImportRule } from '@prisma/client'

interface ImportRulesSectionProps {
  connectionId: string
  rules: EmailImportRule[]
}

export function ImportRulesSection({ connectionId, rules }: ImportRulesSectionProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    senderEmail: '',
    senderDomain: '',
    subjectContains: '',
    filenameContains: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/email/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, ...formData }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create rule')
      }

      setFormData({ senderEmail: '', senderDomain: '', subjectContains: '', filenameContains: '' })
      setShowForm(false)
      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create rule')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(ruleId: string) {
    setDeleting(ruleId)
    try {
      const response = await fetch(`/api/email/rules/${ruleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete rule')
      }

      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete rule')
    } finally {
      setDeleting(null)
    }
  }

  async function handleToggle(rule: EmailImportRule) {
    try {
      const response = await fetch(`/api/email/rules/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !rule.isActive }),
      })

      if (!response.ok) {
        throw new Error('Failed to update rule')
      }

      router.refresh()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update rule')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Import Rules</h4>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 p-3 border rounded-md bg-muted/50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="senderEmail">Sender Email</Label>
              <Input
                id="senderEmail"
                placeholder="statements@bank.com"
                value={formData.senderEmail}
                onChange={(e) => setFormData({ ...formData, senderEmail: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="senderDomain">Sender Domain</Label>
              <Input
                id="senderDomain"
                placeholder="bank.com"
                value={formData.senderDomain}
                onChange={(e) => setFormData({ ...formData, senderDomain: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="subjectContains">Subject Contains</Label>
              <Input
                id="subjectContains"
                placeholder="statement"
                value={formData.subjectContains}
                onChange={(e) => setFormData({ ...formData, subjectContains: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="filenameContains">Filename Contains</Label>
              <Input
                id="filenameContains"
                placeholder=".pdf"
                value={formData.filenameContains}
                onChange={(e) => setFormData({ ...formData, filenameContains: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving...' : 'Add Rule'}
          </Button>
        </form>
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No import rules configured. Add a rule to automatically import matching attachments.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between p-2 border rounded-md text-sm"
            >
              <div className="flex-1">
                {rule.senderEmail && <span className="mr-2">From: {rule.senderEmail}</span>}
                {rule.senderDomain && <span className="mr-2">Domain: @{rule.senderDomain}</span>}
                {rule.subjectContains && <span className="mr-2">Subject: *{rule.subjectContains}*</span>}
                {rule.filenameContains && <span>File: *{rule.filenameContains}*</span>}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={rule.isActive}
                  onCheckedChange={() => handleToggle(rule)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(rule.id)}
                  disabled={deleting === rule.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify file syntax**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit src/app/\\(dashboard\\)/settings/email/components/import-rules.tsx 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/email/components/
git commit -m "feat(email-import): add import rules component"
```

---

## Task 26: Update Environment Variables Documentation

**Files:**
- Modify: `.env.example`

**Step 1: Add email and R2 environment variables**

Add to `.env.example`:
```bash
# Email Import - Gmail (reuse existing Google OAuth if available)
# GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET already used for auth

# Email Import - Microsoft/Outlook
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# Cloudflare R2 Storage
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=fiskai-documents
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs(email-import): add environment variables to .env.example"
```

---

## Task 27: Run Full Build Verification

**Files:**
- None (verification only)

**Step 1: Run TypeScript check**

Run: `cd /home/admin/FiskAI && npx tsc --noEmit 2>&1 | head -50`
Expected: No new errors related to email-import

**Step 2: Run Prisma generate**

Run: `cd /home/admin/FiskAI && npx prisma generate`
Expected: "Generated Prisma Client"

**Step 3: Run build**

Run: `cd /home/admin/FiskAI && npm run build 2>&1 | tail -30`
Expected: Build succeeds

**Step 4: Commit any fixes if needed**

---

## Summary

This plan implements the Email Import feature with:

1. **Schema** (Tasks 1-5): EmailConnection, EmailImportRule, EmailAttachment models
2. **Provider Layer** (Tasks 6-12): Gmail and Microsoft OAuth providers with abstraction
3. **R2 Storage** (Task 13): Cloudflare R2 client for attachment storage
4. **API Endpoints** (Tasks 14-18): Connect, callback, disconnect, and rules CRUD
5. **Sync Service** (Tasks 19-20): Background sync with deduplication
6. **Cron Job** (Task 21): Daily 6 AM sync
7. **UI** (Tasks 22-25): Settings page with connection management and import rules
8. **Documentation** (Task 26): Environment variables

Total: 27 tasks
