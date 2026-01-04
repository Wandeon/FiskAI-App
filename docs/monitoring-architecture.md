# Monitoring Architecture

## Overview

FiskAI implements a three-tier monitoring strategy with specialized endpoints for different use cases.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Load Balancer                            │
│                    (AWS ALB, GCP LB, etc.)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                 Health Check: /api/health
                 Every 30s, timeout 10s
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                     Kubernetes Cluster                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      Pod: FiskAI                         │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │           Container: fiskai:latest                │  │   │
│  │  │                                                    │  │   │
│  │  │  ┌──────────────────────────────────────────────┐ │  │   │
│  │  │  │         Health Check Endpoints               │ │  │   │
│  │  │  │                                              │ │  │   │
│  │  │  │  GET /api/health         (Liveness)         │ │  │   │
│  │  │  │  ├─ Database connectivity                   │ │  │   │
│  │  │  │  └─ Memory check (<95%)                     │ │  │   │
│  │  │  │                                              │ │  │   │
│  │  │  │  GET /api/health/ready   (Readiness)        │ │  │   │
│  │  │  │  ├─ Database latency (<5000ms)              │ │  │   │
│  │  │  │  ├─ Memory check (<90%)                     │ │  │   │
│  │  │  │  └─ Uptime check (>5s)                      │ │  │   │
│  │  │  │                                              │ │  │   │
│  │  │  │  GET /api/status         (Monitoring)       │ │  │   │
│  │  │  │  ├─ Version info                            │ │  │   │
│  │  │  │  ├─ Uptime statistics                       │ │  │   │
│  │  │  │  └─ System metrics                          │ │  │   │
│  │  │  └──────────────────────────────────────────────┘ │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
              Readiness Probe: /api/health/ready
              Every 5s, timeout 3s
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                    Monitoring System                             │
│                (Prometheus, Datadog, etc.)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
               Status Scrape: /api/status
               Every 60s, timeout 5s
                             │
                             ▼
                   ┌──────────────────┐
                   │ Metrics Database │
                   └──────────────────┘
```

## Endpoint Purposes

### 1. `/api/health` - Liveness Probe

**Used by:** Load balancers, Kubernetes liveness probes

**Purpose:** Determine if the application process is alive and functioning

**Behavior:**

- Returns 200 if healthy
- Returns 503 if unhealthy
- Fast response (<100ms)
- Basic checks only

**When it fails:**

- Database is unreachable
- Memory usage >95%
- Application crash

**Action on failure:** Restart the container/pod

### 2. `/api/health/ready` - Readiness Probe

**Used by:** Kubernetes readiness probes, Docker orchestration

**Purpose:** Determine if the application is ready to receive traffic

**Behavior:**

- Returns 200 if ready
- Returns 503 if not ready
- More strict than health
- Comprehensive checks

**When it fails:**

- Database latency >5000ms
- Memory usage >90%
- Application uptime <5s

**Action on failure:** Remove from load balancer rotation, but don't restart

### 3. `/api/status` - Monitoring Endpoint

**Used by:** Monitoring dashboards, status pages, operations teams

**Purpose:** Provide system information for monitoring and debugging

**Behavior:**

- Always returns 200
- No database queries
- Very fast response (<50ms)
- Rich information

**Information provided:**

- Application version
- Environment (dev/prod)
- Uptime (seconds + formatted)
- Node.js version
- Platform/architecture
- Memory statistics

**Action on data:** Display in dashboards, track trends, alert on anomalies

## Response Flow

```
┌─────────────────┐
│  HTTP Request   │
│  GET /api/...   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   withApiLogging Middleware         │
│   (Logs request and response)       │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Endpoint Handler                  │
│   (route.ts)                        │
└────────┬────────────────────────────┘
         │
         ├─ /api/health
         │  ├─ checkDatabaseHealth()
         │  ├─ Check memory usage
         │  └─ Return 200 or 503
         │
         ├─ /api/health/ready
         │  ├─ db.$queryRaw`SELECT 1`
         │  ├─ Check DB latency
         │  ├─ Check memory (<90%)
         │  ├─ Check uptime (>5s)
         │  └─ Return 200 or 503
         │
         └─ /api/status
            ├─ process.uptime()
            ├─ process.memoryUsage()
            ├─ Get version info
            └─ Return 200 (always)
```

## Database Health Check Flow

```
┌─────────────────────────────────┐
│  checkDatabaseHealth()          │
│  (from system-health.ts)        │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  db.$queryRaw`SELECT 1`         │
└────────┬────────────────────────┘
         │
         ├─ Success
         │  ├─ Measure latency
         │  ├─ Get DB version
         │  └─ Return { connected: true, pingTime, version }
         │
         └─ Error
            ├─ Log error
            └─ Return { connected: false }
```

## Monitoring Strategy

### Level 1: Load Balancer

```
Load Balancer
  └─> /api/health every 30s
      ├─ Healthy (200) → Route traffic
      └─ Unhealthy (503) → Stop routing, mark instance down
```

### Level 2: Orchestration (Kubernetes)

```
Kubernetes
  ├─> Liveness Probe: /api/health every 10s
  │   └─ Failed 3 times → Restart container
  │
  └─> Readiness Probe: /api/health/ready every 5s
      ├─ Ready (200) → Add to service
      └─ Not Ready (503) → Remove from service (don't restart)
```

### Level 3: Monitoring System

```
Monitoring System (Prometheus/Datadog)
  └─> /api/status every 60s
      ├─ Track uptime trends
      ├─ Monitor memory usage
      ├─ Track version deployments
      └─ Alert on anomalies
```

## Error Scenarios

### Scenario 1: Database Down

```
Event: PostgreSQL stops responding

/api/health
  └─> checkDatabaseHealth() fails
      └─> Returns 503 with { database: { status: "down" } }

/api/health/ready
  └─> db.$queryRaw fails
      └─> Returns 503 with { database: { status: "failed" } }

/api/status
  └─> No database check
      └─> Returns 200 (still provides system info)

Result:
  ├─ Load balancer stops routing traffic
  ├─ Kubernetes removes pod from service
  └─ Monitoring alerts operations team
```

### Scenario 2: High Memory Usage

```
Event: Memory usage reaches 92%

/api/health
  └─> Memory check: 92% < 95%
      └─> Returns 200 (still healthy)

/api/health/ready
  └─> Memory check: 92% > 90%
      └─> Returns 503 (not ready)

/api/status
  └─> Reports memory stats
      └─> { heapUsagePercent: 92 }

Result:
  ├─ Load balancer keeps routing (still healthy)
  ├─ Kubernetes removes from service (not ready)
  └─ Monitoring shows high memory usage trend
```

### Scenario 3: Slow Database

```
Event: Database queries taking 6000ms

/api/health
  └─> Database connects eventually
      └─> Returns 200 (connected)

/api/health/ready
  └─> Database latency: 6000ms > 5000ms
      └─> Returns 503 (too slow)

/api/status
  └─> No database check
      └─> Returns 200

Result:
  ├─ Load balancer keeps routing (DB works)
  ├─ Kubernetes removes from service (too slow)
  └─ Monitoring shows degraded performance
```

## Best Practices

### 1. Load Balancer Configuration

- Use `/api/health` for target health checks
- Set timeout to 5-10 seconds
- Check every 30 seconds
- Mark unhealthy after 2-3 failures
- Mark healthy after 1 success

### 2. Kubernetes Configuration

- Use `/api/health` for liveness probe
- Use `/api/health/ready` for readiness probe
- Set different thresholds for each
- Allow 30+ seconds for startup
- Don't restart too aggressively

### 3. Monitoring Configuration

- Scrape `/api/status` for metrics
- Check every 60 seconds
- Store time-series data
- Set up alerts for:
  - Uptime resets (unexpected restarts)
  - Memory trends (approaching limits)
  - Version changes (track deployments)

### 4. Development vs Production

```
Development:
  ├─ Looser health check intervals
  ├─ Higher timeout values
  └─ More verbose logging

Production:
  ├─ Strict health check intervals
  ├─ Lower timeout values
  ├─ Multiple replicas for redundancy
  └─ Automated alerting on failures
```

## Security Considerations

### What's Safe to Expose

- Health status (up/down)
- Version number
- Uptime statistics
- Memory percentages
- Node.js version
- Platform information

### What's NOT Exposed

- Database credentials
- Connection strings
- API keys or secrets
- Internal IP addresses
- User data
- Business logic
- Detailed error messages (in production)

### Why No Authentication?

1. Load balancers need fast, simple access
2. Orchestration tools don't support auth headers
3. Monitoring systems need reliable access
4. Standard industry practice
5. No sensitive data exposed

## Troubleshooting Guide

### Health Check Returns 503

1. Check database connectivity
   ```bash
   psql $DATABASE_URL -c "SELECT 1"
   ```
2. Check application logs
   ```bash
   kubectl logs -f deployment/fiskai
   ```
3. Check memory usage
   ```bash
   kubectl top pod -l app=fiskai
   ```

### Readiness Check Never Passes

1. Check if still initializing (<5s uptime)
2. Verify database latency
3. Check memory usage (<90%)
4. Review startup logs

### Status Endpoint Not Responding

1. Check if application is running
2. Verify port 3000 is accessible
3. Check for network issues
4. Review application logs

## Metrics to Track

### Uptime Metrics

- Total application uptime
- Time since last restart
- Restart frequency
- Deployment timestamps

### Performance Metrics

- Health check response time
- Database connection latency
- Memory usage trends
- CPU usage patterns

### Reliability Metrics

- Health check success rate
- Readiness check success rate
- Time to become ready after start
- Mean time between failures (MTBF)

## Integration Examples

### Prometheus Configuration

```yaml
scrape_configs:
  - job_name: "fiskai-status"
    scrape_interval: 60s
    scrape_timeout: 5s
    metrics_path: "/api/status"
    static_configs:
      - targets: ["fiskai:3000"]
```

### Datadog Check

```python
def check_fiskai_health(self):
    response = requests.get('http://fiskai:3000/api/health')
    if response.status_code == 200:
        self.service_check('fiskai.health', AgentCheck.OK)
    else:
        self.service_check('fiskai.health', AgentCheck.CRITICAL)
```

### Grafana Dashboard Query

```promql
# Uptime over time
fiskai_uptime_seconds

# Memory usage percentage
fiskai_memory_heap_usage_percent

# Health check status (1=healthy, 0=unhealthy)
fiskai_health_status
```
