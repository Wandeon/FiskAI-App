# Health Check Endpoints Quick Reference

## Endpoints

### 1. Basic Health Check
- **URL:** `/api/health`
- **Purpose:** Load balancer health checks
- **Returns:** 200 (healthy) or 503 (unhealthy)

**Checks:**
- Database connectivity
- Memory usage (<95%)

**Example Response:**
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

### 2. Readiness Probe
- **URL:** `/api/health/ready`
- **Purpose:** Kubernetes/Docker readiness checks
- **Returns:** 200 (ready) or 503 (not ready)

**Checks:**
- Database connectivity (<5000ms latency)
- Memory usage (<90%)
- Minimum uptime (5 seconds)

**Example Response:**
```json
{
  "status": "ready",
  "timestamp": "2025-12-15T12:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600,
  "checks": {
    "database": { "status": "ok", "latency": 5 },
    "memory": { "status": "ok", "message": "256MB / 512MB (50%)" },
    "uptime": { "status": "ok", "message": "3600s" }
  }
}
```

### 3. Status Information
- **URL:** `/api/status`
- **Purpose:** System status for monitoring dashboards
- **Returns:** Always 200

**Provides:**
- Version information
- Uptime statistics
- System information
- Memory statistics

**Example Response:**
```json
{
  "status": "operational",
  "timestamp": "2025-12-15T12:00:00.000Z",
  "version": "0.1.0",
  "environment": "production",
  "uptime": {
    "seconds": 86400,
    "formatted": "1d 0h 0m 0s"
  },
  "system": {
    "nodeVersion": "v20.10.0",
    "platform": "linux",
    "arch": "arm64"
  },
  "memory": {
    "heapUsedMB": 256,
    "heapTotalMB": 512,
    "heapUsagePercent": 50,
    "rssMB": 384
  }
}
```

## Key Differences

| Feature | /api/health | /api/health/ready | /api/status |
|---------|-------------|-------------------|-------------|
| Purpose | Load balancer | K8s readiness | Monitoring |
| DB Check | Yes | Yes (strict) | No |
| Memory Check | Yes (95%) | Yes (90%) | Info only |
| Uptime Check | No | Yes (5s min) | Info only |
| Can Return 503 | Yes | Yes | No |
| Response Time | <100ms | <200ms | <50ms |

## Security

All endpoints are **unauthenticated** by design:
- No sensitive data exposed
- No credentials or secrets
- Safe for public monitoring tools
- Standard industry practice for health checks

## Quick Test

```bash
# Health check
curl http://localhost:3000/api/health

# Readiness check
curl http://localhost:3000/api/health/ready

# Status info
curl http://localhost:3000/api/status
```

## See Also

See [MONITORING_ENDPOINTS.md](/MONITORING_ENDPOINTS.md) for complete documentation.
