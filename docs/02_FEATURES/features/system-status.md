# Feature: System Status Page

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 16

## Purpose

The System Status Page provides a public-facing status dashboard that displays real-time system health information, performance metrics, and monitoring endpoints for FiskAI. It serves as a transparency tool for users to check platform availability and health, while also exposing monitoring API endpoints for load balancers, orchestration tools, and external monitoring systems.

## User Entry Points

| Type    | Path     | Evidence                                    |
| ------- | -------- | ------------------------------------------- |
| Page    | /status  | `src/app/(marketing)/status/page.tsx:1`     |
| Link    | Footer   | `src/app/(marketing)/layout.tsx:106`        |
| Link    | Footer   | `src/app/(marketing)/layout.tsx:133`        |
| Link    | Security | `src/app/(marketing)/security/page.tsx:110` |
| Link    | Terms    | `src/app/(marketing)/terms/page.tsx:119`    |
| Sitemap | /status  | `src/app/sitemap.ts:13`                     |

## Core Flow

1. User navigates to /status via footer link, security page, or direct URL → `src/app/(marketing)/status/page.tsx:9`
2. System fetches detailed health information using getDetailedHealth() → `src/app/(marketing)/status/page.tsx:14`
3. Page displays overall system status (healthy/degraded/unhealthy) with color-coded indicator → `src/app/(marketing)/status/page.tsx:41-65`
4. System metrics panel shows counts for users, companies, invoices, expenses, and contacts → `src/app/(marketing)/status/page.tsx:68-94`
5. Health checks panel displays status of individual system components (database, API, disk space) → `src/app/(marketing)/status/page.tsx:96-117`
6. API endpoints section lists available monitoring endpoints for programmatic access → `src/app/(marketing)/status/page.tsx:126-142`

## Key Modules

| Module          | Purpose                                            | Location                              |
| --------------- | -------------------------------------------------- | ------------------------------------- |
| StatusPage      | Public status dashboard with system health display | `src/app/(marketing)/status/page.tsx` |
| SystemHealthLib | Core health checking and metrics collection        | `src/lib/monitoring/system-health.ts` |
| HealthAPI       | Basic health check endpoint for load balancers     | `src/app/api/health/route.ts`         |
| ReadinessAPI    | Readiness probe for Kubernetes/Docker              | `src/app/api/health/ready/route.ts`   |
| StatusAPI       | System status information endpoint                 | `src/app/api/status/route.ts`         |

## Current Implementation

### Status Page UI

The status page displays comprehensive system information in Croatian:

**Overall Status Card** → `src/app/(marketing)/status/page.tsx:41-65`:

- **Title**: "Status sustava" (System Status)
- **Status Badge**: Color-coded - Green (Zdrav/OK), Yellow (Delimično ometen/POZOR), Red (Nedostupan/KRITIČNO)
- **Timestamp**: Last updated time formatted in Croatian locale (hr-HR) → `src/app/(marketing)/status/page.tsx:19-27`
- **Visual Feedback**: Background color changes based on health status

**System Metrics Panel** → `src/app/(marketing)/status/page.tsx:68-94`:

- Users count → `src/lib/monitoring/system-health.ts:244`
- Companies count → `src/lib/monitoring/system-health.ts:245`
- Invoices count → `src/lib/monitoring/system-health.ts:246`
- Expenses count → `src/lib/monitoring/system-health.ts:247`
- Contacts count → `src/lib/monitoring/system-health.ts:248`

**Health Checks Panel** → `src/app/(marketing)/status/page.tsx:96-117`:

- Database connectivity check → `src/lib/monitoring/system-health.ts:41-69`
- API functionality check → `src/lib/monitoring/system-health.ts:72-96`
- Disk space check → `src/lib/monitoring/system-health.ts:99-128`
- Status indicators: "PROŠLO" (passed), "UPOZORENJE" (warning), "NEPROŠLO" (failed)

**Monitoring API Documentation** → `src/app/(marketing)/status/page.tsx:126-142`:

- Lists available endpoints: `/api/health`, `/api/health?detailed=true`, `/api/exports/company`
- Provides code samples for developers and monitoring tools

### Health Check System

The system implements comprehensive health monitoring → `src/lib/monitoring/system-health.ts:1-306`:

**Database Health Check** → `src/lib/monitoring/system-health.ts:150-172`:

- Tests database connectivity with `SELECT 1` query
- Measures ping time in milliseconds
- Retrieves database version information
- Returns connected status and performance metrics

**Disk Space Check** → `src/lib/monitoring/system-health.ts:185-231`:

- Uses Node.js fs.statfs() for modern environments (Node 18.15+)
- Falls back to `df` command for older systems
- Monitors usage percentage with thresholds:
  - Warning: >80% used → `src/lib/monitoring/system-health.ts:107-109`
  - Failed: >90% used → `src/lib/monitoring/system-health.ts:104-106`

**System Metrics Collection** → `src/lib/monitoring/system-health.ts:236-268`:

- Counts database entities in parallel using Promise.all
- Collects user, company, invoice, expense, and contact counts
- Logs metrics for monitoring purposes
- Timestamp-stamped for tracking

**Overall Health Assessment** → `src/lib/monitoring/system-health.ts:36-145`:

- Aggregates individual check results
- Determines overall status (healthy/degraded/unhealthy)
- Degraded if any warnings exist
- Unhealthy if any checks fail

### Monitoring API Endpoints

**1. Basic Health Check** → `src/app/api/health/route.ts:1-74`:

- **Path**: `/api/health`
- **Purpose**: Load balancer health checks
- **Authentication**: None required (by design for infrastructure)
- **Response Codes**: 200 (healthy), 503 (unhealthy)
- **Checks**:
  - Database connectivity with latency measurement → `src/app/api/health/route.ts:17-41`
  - Memory usage (<95% threshold) → `src/app/api/health/route.ts:44-62`
- **Response Format**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2025-12-15T12:00:00.000Z",
    "checks": {
      "database": { "status": "up", "latencyMs": 5 },
      "app": { "status": "up" }
    },
    "version": "0.1.0"
  }
  ```

**2. Readiness Probe** → `src/app/api/health/ready/route.ts:1-108`:

- **Path**: `/api/health/ready`
- **Purpose**: Kubernetes/Docker readiness checks
- **Authentication**: None required
- **Response Codes**: 200 (ready), 503 (not ready)
- **Stricter Checks**:
  - Database latency must be <5000ms → `src/app/api/health/ready/route.ts:32-38`
  - Memory threshold at 90% (vs 95% in health) → `src/app/api/health/ready/route.ts:62-78`
  - Minimum uptime of 5 seconds required → `src/app/api/health/ready/route.ts:84-95`
- **Use Case**: Ensures app is fully initialized before receiving traffic

**3. Status Information** → `src/app/api/status/route.ts:1-53`:

- **Path**: `/api/status`
- **Purpose**: System status for monitoring dashboards
- **Authentication**: None required
- **Always Returns**: 200 OK (never fails)
- **Information Provided**:
  - Application version from environment → `src/app/api/status/route.ts:35`
  - Node.js environment (development/production) → `src/app/api/status/route.ts:36`
  - Process uptime (seconds and formatted) → `src/app/api/status/route.ts:12-40`
  - System info (Node version, platform, architecture) → `src/app/api/status/route.ts:41-45`
  - Memory statistics (heap usage, RSS) → `src/app/api/status/route.ts:13-51`

### Security & Access Control

**Public Access by Design** → `MONITORING_ENDPOINTS.md:229-235`:

- All monitoring endpoints are intentionally unauthenticated
- Load balancers need unauthenticated access to route traffic
- Kubernetes/Docker orchestration tools require credential-free checks
- External monitoring systems need simple, fast access
- Industry standard practice for health check endpoints

**No Sensitive Data Exposure** → `MONITORING_ENDPOINTS.md:238-249`:

- No database credentials or connection strings
- No API keys or secrets
- No user data or business logic
- No internal IP addresses
- Only safe operational metrics exposed

## Business Context

### Transparency & Trust

FiskAI prioritizes transparency with users:

- **Public Status Dashboard**: Users can check system health anytime → `src/app/(marketing)/status/page.tsx:32`
- **Real-time Updates**: Timestamp shows when status was last checked → `src/app/(marketing)/status/page.tsx:63`
- **Clear Communication**: Color-coded status indicators (green/yellow/red) → `src/app/(marketing)/status/page.tsx:41-60`
- **Accessibility**: Linked from footer of all marketing pages → `src/app/(marketing)/layout.tsx:106,133`

### Operational Excellence

The status page supports operational requirements:

- **Monitoring Integration**: API endpoints for external monitoring tools → `MONITORING_ENDPOINTS.md:1-332`
- **Load Balancer Support**: Fast health checks (<100ms target) → `MONITORING_ENDPOINTS.md:306`
- **Container Orchestration**: Kubernetes readiness/liveness probes → `MONITORING_ENDPOINTS.md:152-171`
- **Incident Response**: Quick visibility into system health for support team

### Croatian Market Localization

All UI text is in Croatian → `src/app/(marketing)/status/page.tsx:32-142`:

- "Status sustava" (System Status)
- "Metrike sustava" (System Metrics)
- "Provjere zdravlja" (Health Checks)
- "API endpointi za nadgledanje" (Monitoring API Endpoints)
- "Korisnici/Tvrtke/Računi/Troškovi/Kontakti" (Users/Companies/Invoices/Expenses/Contacts)

## Data

### Database Queries

Health checks query the following Prisma models → `src/lib/monitoring/system-health.ts:236-268`:

- `db.user.count()` - Total registered users
- `db.company.count()` - Total companies in system
- `db.eInvoice.count()` - Total e-invoices created
- `db.expense.count()` - Total expenses recorded
- `db.contact.count()` - Total contacts stored
- `db.$queryRaw` - Direct database connectivity test → `src/lib/monitoring/system-health.ts:154`

### No User Data

The status page and monitoring APIs do NOT expose:

- Individual user information
- Company names or details
- Specific invoice or expense data
- Contact information
- Financial data

Only aggregate counts are shown → `MONITORING_ENDPOINTS.md:217-224`

## Dependencies

- **Depends on**:
  - [[database]] - Requires database connectivity for health checks
  - [[marketing-layout]] - Uses marketing site layout and footer
  - [[monitoring-lib]] - System health checking library

- **Depended by**:
  - [[security-page]] - Links to status page
  - [[terms-page]] - References status page
  - [[marketing-footer]] - Contains status page link

## Integrations

### Infrastructure Integration

**Load Balancers** → `MONITORING_ENDPOINTS.md:320`:

- Use `/api/health` for traffic routing decisions
- Fast response time requirement (<100ms)
- 200 = route traffic, 503 = remove from pool

**Kubernetes/Docker** → `MONITORING_ENDPOINTS.md:152-171`:

- Readiness probe: `/api/health/ready`
- Liveness probe: `/api/health`
- Health check configuration in deployment manifests

**Monitoring Systems**:

- External uptime monitors can poll `/api/health`
- Dashboards can fetch `/api/status` for metrics
- Alert systems can trigger on 503 responses

### Internal Integration

**Marketing Site** → `src/app/(marketing)/layout.tsx:1-139`:

- Footer navigation includes status page link
- Consistent layout and branding
- Accessible to both logged-in and anonymous users

**Security Documentation** → `src/app/(marketing)/security/page.tsx:110`:

- Links to status page from "Status sustava" section
- Part of transparency and trust initiatives

## Configuration

### Environment Variables

**Optional Variables** → `src/app/api/status/route.ts:35`:

- `APP_VERSION` - Application version number (defaults to package.json version)
- `npm_package_version` - Fallback version from package.json
- `NODE_ENV` - Environment name (development/production)

**Database Configuration**:

- Uses existing Prisma database configuration
- No additional configuration needed

### Response Time Guidelines

**Performance Targets** → `MONITORING_ENDPOINTS.md:306-309`:

- Health endpoint: <100ms response time
- Readiness endpoint: <200ms response time
- Status endpoint: <50ms response time (no database queries)

### Health Check Thresholds

**Memory Usage** → `src/app/api/health/route.ts:50,53`:

- Health check: >95% = unhealthy
- Readiness probe: >90% = not ready
- Readiness probe: >80% = degraded

**Database Latency** → `src/app/api/health/ready/route.ts:32`:

- Readiness probe: >5000ms = failed

**Disk Space** → `src/lib/monitoring/system-health.ts:104-109`:

- > 90% used = failed
- > 80% used = warning

**Minimum Uptime** → `src/app/api/health/ready/route.ts:84`:

- Readiness probe: <5 seconds = not ready

## Verification Checklist

- [x] /status page is publicly accessible without authentication
- [x] Status page displays overall system health with color coding
- [x] System metrics panel shows all entity counts
- [x] Health checks panel displays all component statuses
- [x] Timestamp is formatted in Croatian locale (hr-HR)
- [x] Footer links to /status from all marketing pages
- [x] /api/health endpoint returns 200 when healthy
- [x] /api/health endpoint returns 503 when unhealthy
- [x] /api/health/ready implements stricter checks than /api/health
- [x] /api/status endpoint always returns 200 with system info
- [x] Database connectivity check works correctly
- [x] Memory usage check enforces thresholds
- [x] Disk space check monitors usage percentage
- [x] No sensitive data exposed in any endpoint
- [x] All UI text is in Croatian
- [x] Sitemap includes /status page

## Evidence Links

1. `src/app/(marketing)/status/page.tsx:1-134` - Main status page implementation
2. `src/lib/monitoring/system-health.ts:1-306` - Core health checking and metrics library
3. `src/app/api/health/route.ts:1-74` - Basic health check endpoint
4. `src/app/api/health/ready/route.ts:1-108` - Readiness probe endpoint
5. `src/app/api/status/route.ts:1-53` - System status information endpoint
6. `src/app/(marketing)/layout.tsx:106` - Footer navigation link to status
7. `src/app/(marketing)/layout.tsx:133` - Footer bottom link to status
8. `src/app/(marketing)/security/page.tsx:110` - Security page status link
9. `src/app/(marketing)/terms/page.tsx:119` - Terms page status reference
10. `src/app/sitemap.ts:13` - Sitemap entry for /status
11. `MONITORING_ENDPOINTS.md:1-332` - Complete monitoring endpoints documentation
12. `src/app/api/health/README.md:1-122` - Health check endpoints quick reference
13. `docs/02_FEATURES/FEATURE_REGISTRY.md:136` - Feature registry entry F104
14. `docs/monitoring-architecture.md` - Overall monitoring architecture documentation
15. `QUICK_START_MONITORING.md` - Quick start guide for monitoring setup
16. `scripts/test-health-endpoints.sh` - Test script for health endpoints
