# Clean n8n Migration: VPS-02 → VPS-00

**Status:** DRAFT
**Date:** 2026-01-13
**Follows:** ADR-010 safety rules (no binaries from compromised system, rotate all secrets)

---

## Current State

### VPS-02 (Compromised)

| Item           | Value                                                          |
| -------------- | -------------------------------------------------------------- |
| Database       | SQLite (1.4GB at `/home/node/.n8n/database.sqlite`)            |
| Workflows      | 49 total (10 active)                                           |
| Credentials    | 42 stored credentials                                          |
| Encryption Key | `i0ePJAmWkOYqODgL5IyOXkdd860dkaBS` (COMPROMISED - must rotate) |
| Container      | `automation-stack-n8n` custom build with ImageMagick           |

### VPS-00 (Target)

| Item              | Value                                                            |
| ----------------- | ---------------------------------------------------------------- |
| Tailscale IP      | 100.97.156.41                                                    |
| Docker            | v28.4.0 installed                                                |
| Disk              | 419GB available                                                  |
| Memory            | 7.8GB (swap heavy - monitor)                                     |
| Existing services | Wyoming Whisper, voice-chat, artemi-postgres, eventicro-postgres |

---

## Active Workflows (Must Restore)

| Workflow                           | Purpose                    |
| ---------------------------------- | -------------------------- |
| Artemi Xmas - Booking to Code & QR | Christmas event booking    |
| CMC 3 - Rating                     | CMC rating system          |
| CMC 6 - Track                      | CMC tracking               |
| ChatBot                            | Chatbot service            |
| GenAI 1a Auto                      | GenAI automation           |
| GenAI 1b Manu                      | GenAI manual triggers      |
| GenAI 3 FB                         | GenAI Facebook integration |
| IM PA - 2 Embedding                | Embedding service          |
| Mail Scheduler                     | Email scheduling           |
| Stripe                             | Payment processing         |

---

## Credentials Requiring Re-creation

All 42 credentials must be re-created with fresh secrets (ADR-010 requirement):

| Credential               | Type                       | Action                  |
| ------------------------ | -------------------------- | ----------------------- |
| Assembly AI              | httpHeaderAuth             | Rotate API key          |
| DeepSeek account         | deepSeekApi                | Rotate API key          |
| Facebook Graph (App)     | facebookGraphAppApi        | Rotate OAuth            |
| Facebook Graph (x2)      | facebookGraphApi           | Rotate OAuth            |
| Google Calendar          | googleCalendarOAuth2Api    | Re-authenticate         |
| Google Gemini            | googlePalmApi              | Rotate API key          |
| Google STT API (x2)      | httpHeaderAuth             | Rotate API key          |
| Google Search (x2)       | googleSearchCredentialsApi | Rotate API key          |
| Google Service Account   | googleApi                  | Rotate JSON key         |
| Hunter                   | hunterApi                  | Rotate API key          |
| IMAP account             | imap                       | New password            |
| Info Artemi / Kupon Mail | smtp                       | Rotate SMTP credentials |
| LlamaParse API           | httpHeaderAuth             | Rotate API key          |
| Mailgun (x2)             | mailgunApi / httpBasicAuth | Rotate API key          |
| Microsoft Outlook        | microsoftOutlookOAuth2Api  | Re-authenticate         |
| Microsoft To Do          | microsoftToDoOAuth2Api     | Re-authenticate         |
| NextCloud                | nextCloudOAuth2Api         | New OAuth               |
| Ollama                   | ollamaApi                  | Update endpoint         |
| Reddit                   | redditOAuth2Api            | Re-authenticate         |
| SerpApi / Seper          | serpApi / httpHeaderAuth   | Rotate API keys         |
| Slack (x3)               | slackApi / slackOAuth2Api  | Re-authenticate         |
| Supabase (x3)            | supabaseApi                | NEW keys after rebuild  |
| WordPress                | wordpressApi               | Rotate credentials      |
| X (Twitter)              | twitterOAuth2Api           | Re-authenticate         |
| n8n account              | n8nApi                     | New instance key        |

---

## Migration Options

### Option A: Workflow JSON Export (RECOMMENDED)

**Risk: LOW** | **Effort: HIGH**

```
┌─────────────────┐     JSON only      ┌─────────────────┐
│   VPS-02 n8n    │───────────────────►│   VPS-00 n8n    │
│  (compromised)  │   (no secrets)     │    (fresh)      │
└─────────────────┘                    └─────────────────┘
         │                                      │
    Export via API                        Fresh install
    Workflows only                     New encryption key
                                    Manual credential entry
```

**Pros:**

- No binary/database transfer from compromised system
- Forces credential rotation (required by ADR-010)
- Clean cryptographic state (new encryption key)

**Cons:**

- Manual re-entry of 42 credentials
- Must re-authenticate OAuth flows

### Option B: SQLite Database Copy (NOT RECOMMENDED)

**Risk: MEDIUM-HIGH** | **Effort: LOW**

Transfers SQLite file with execution history. Violates "no binaries from compromised system" principle. Could contain malicious payloads in execution data fields.

**Verdict: REJECTED** per ADR-010

### Option C: PostgreSQL Migration + Credential Re-entry (HYBRID)

**Risk: LOW-MEDIUM** | **Effort: MEDIUM**

Export workflow JSON, but also export workflow metadata from SQLite for reference. Fresh PostgreSQL on VPS-00 (better than SQLite for production).

---

## Recommended Procedure (Option A)

### Phase 1: Export from VPS-02

**1.1 Export workflows via n8n API**

```bash
# On VPS-02, get all workflows
curl -s http://127.0.0.1:5678/api/v1/workflows \
  -H "X-N8N-API-KEY: $(docker exec n8n cat /home/node/.n8n/config | jq -r '.encryptionKey')" \
  | jq '.data' > /tmp/n8n-workflows-export.json
```

**1.2 Alternative: Use n8n UI**

- Open n8n at https://nn.genai.hr (or via Tailscale)
- Settings → Export → All workflows
- Downloads as JSON (credentials excluded by design)

**1.3 Document credential requirements**
For each active workflow, note which credentials it uses (already listed above).

### Phase 2: Deploy Fresh n8n on VPS-00

**2.1 Create n8n directory structure**

```bash
ssh admin@100.97.156.41 "mkdir -p ~/n8n-stack"
```

**2.2 Create docker-compose.yml**

```yaml
version: "3.8"

services:
  n8n-postgres:
    image: postgres:16-alpine
    container_name: n8n-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: n8n
      POSTGRES_USER: n8n
      POSTGRES_PASSWORD: ${N8N_DB_PASSWORD}
    volumes:
      - n8n_postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U n8n"]
      interval: 10s
      timeout: 5s
      retries: 5

  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    environment:
      - N8N_HOST=nn.genai.hr
      - N8N_PROTOCOL=https
      - N8N_PORT=5678
      - NODE_ENV=production
      - WEBHOOK_URL=https://nn.genai.hr/
      - GENERIC_TIMEZONE=Europe/Zagreb
      - TZ=Europe/Zagreb
      # PostgreSQL (not SQLite)
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=n8n-postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=${N8N_DB_PASSWORD}
      # New encryption key (rotate from compromised)
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
    ports:
      - "100.97.156.41:5678:5678" # Tailscale only
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      n8n-postgres:
        condition: service_healthy

volumes:
  n8n_postgres_data:
  n8n_data:
```

**2.3 Generate new secrets**

```bash
# Generate new encryption key (32 chars)
openssl rand -base64 24 | tr -d '/+=' | head -c 32

# Generate DB password
openssl rand -base64 24 | tr -d '/+='
```

**2.4 Create .env file** (store in password manager)

```bash
N8N_ENCRYPTION_KEY=<new-32-char-key>
N8N_DB_PASSWORD=<new-db-password>
```

**2.5 Start n8n**

```bash
cd ~/n8n-stack
docker compose up -d
```

### Phase 3: Import and Configure

**3.1 Import workflows**

- Access n8n at http://100.97.156.41:5678 (Tailscale)
- Settings → Import → Upload JSON
- Workflows will show credential errors (expected)

**3.2 Create credentials**
For each credential type:

1. Create new credential in n8n
2. Enter fresh API key/OAuth (from password manager after rotation)
3. Assign to relevant workflows

**3.3 Test each active workflow**

- Run manual test for each of the 10 active workflows
- Verify integrations work with new credentials

### Phase 4: DNS/Proxy Update

**4.1 Update Caddy on VPS-01**
Change nn.genai.hr to point to VPS-00:

```
nn.genai.hr {
    reverse_proxy 100.97.156.41:5678
}
```

**4.2 Verify external access**

```bash
curl -s https://nn.genai.hr/healthz
```

---

## Security Checklist

- [ ] Fresh n8n installation (no files from VPS-02)
- [ ] New encryption key generated
- [ ] PostgreSQL instead of SQLite
- [ ] All credentials re-created with rotated secrets
- [ ] Binding to Tailscale IP only (not 0.0.0.0)
- [ ] No privileged containers
- [ ] OAuth apps re-authenticated
- [ ] Active workflows tested
- [ ] DNS updated to VPS-00
- [ ] Old VPS-02 n8n containers stopped

---

## Rollback Plan

If migration fails:

1. VPS-02 n8n remains running until VPS-00 verified
2. Keep DNS pointing to VPS-02 during testing
3. Only switch DNS after VPS-00 confirmed working
4. VPS-02 n8n can be restored from current state if needed (before reimage)

---

## Timeline Estimate

| Phase                       | Duration       |
| --------------------------- | -------------- |
| Export workflows            | 15 min         |
| Deploy fresh n8n            | 30 min         |
| Rotate & create credentials | 2-3 hours      |
| Test active workflows       | 1-2 hours      |
| DNS cutover                 | 15 min         |
| **Total**                   | **~4-5 hours** |

---

## Post-Migration

After successful migration:

1. Update incident documentation
2. Add VPS-00 n8n to monitoring
3. Stop VPS-02 n8n containers
4. Proceed with VPS-02 reimage as planned
