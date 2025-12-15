# Monitoring and Health Check Endpoints

This document describes the monitoring and health check endpoints available in FiskAI.

## Overview

FiskAI provides three monitoring endpoints designed for different use cases:

1. **`/api/health`** - Basic health check for load balancers
2. **`/api/health/ready`** - Readiness probe for Kubernetes/Docker
3. **`/api/status`** - System status information for monitoring

All endpoints are **unauthenticated** to allow load balancers, orchestration tools, and monitoring systems to access them.

---

## 1. Health Check Endpoint

**URL:** `/api/health`
**Method:** `GET`
**Authentication:** None required
**Purpose:** Quick health check for load balancers and monitoring tools

### Response Format

**Success (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-15T12:00:00.000Z",
  "checks": {
    "database": {
      "status": "up",
      "latencyMs": 5
    },
    "app": {
      "status": "up"
    }
  },
  "version": "0.1.0"
}
```

**Unhealthy (503 Service Unavailable):**
```json
{
  "status": "unhealthy",
  "timestamp": "2025-12-15T12:00:00.000Z",
  "checks": {
    "database": {
      "status": "down",
      "latencyMs": 1523,
      "message": "Connection timeout"
    },
    "app": {
      "status": "up"
    }
  },
  "version": "0.1.0"
}
```

### Checks Performed

1. **Database Connectivity** - Verifies database connection with a simple query
2. **App Functionality** - Checks memory usage (<95% threshold)

### Status Codes

- `200 OK` - Application is healthy
- `503 Service Unavailable` - Application is unhealthy

---

## 2. Readiness Probe Endpoint

**URL:** `/api/health/ready`
**Method:** `GET`
**Authentication:** None required
**Purpose:** Kubernetes/Docker readiness probe (stricter than health check)

### Response Format

**Ready (200 OK):**
```json
{
  "status": "ready",
  "timestamp": "2025-12-15T12:00:00.000Z",
  "version": "0.1.0",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "ok",
      "latency": 5
    },
    "memory": {
      "status": "ok",
      "message": "256MB / 512MB (50%)"
    },
    "uptime": {
      "status": "ok",
      "message": "3600s"
    }
  }
}
```

**Not Ready (503 Service Unavailable):**
```json
{
  "status": "not_ready",
  "timestamp": "2025-12-15T12:00:00.000Z",
  "version": "0.1.0",
  "uptime": 2,
  "checks": {
    "database": {
      "status": "ok",
      "latency": 3
    },
    "memory": {
      "status": "ok",
      "message": "128MB / 512MB (25%)"
    },
    "uptime": {
      "status": "failed",
      "message": "App still initializing"
    }
  }
}
```

### Checks Performed

1. **Database Connectivity** - Verifies connection and checks latency (<5000ms)
2. **Memory Usage** - Checks heap usage (<90% for ready, >90% fails)
3. **Uptime** - Ensures app has been running for at least 5 seconds

### Differences from Health Endpoint

The readiness endpoint is **more strict**:
- Database latency must be <5000ms (health doesn't check latency threshold)
- Memory threshold is 90% (vs 95% in health)
- Requires minimum 5 seconds uptime before being ready
- Differentiates between "degraded" (80-90% memory) and "failed" (>90%)

### Status Codes

- `200 OK` - Application is ready to receive traffic
- `503 Service Unavailable` - Application is not ready

### Kubernetes Configuration Example

```yaml
readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3

livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

---

## 3. Status Information Endpoint

**URL:** `/api/status`
**Method:** `GET`
**Authentication:** None required
**Purpose:** System information for monitoring dashboards

### Response Format

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

### Information Provided

1. **Status** - Always returns "operational"
2. **Version** - Application version from environment or package.json
3. **Environment** - Current environment (development, production, etc.)
4. **Uptime** - Process uptime in seconds and human-readable format
5. **System** - Node.js version, platform, and architecture
6. **Memory** - Current memory usage statistics

### Security Notes

- Does **NOT** expose sensitive information
- Does **NOT** include database connection strings
- Does **NOT** include API keys or secrets
- Does **NOT** include internal IP addresses
- Safe to expose to monitoring tools

---

## Security Considerations

### Why These Endpoints Don't Require Authentication

1. **Load Balancer Access** - Load balancers need unauthenticated access to route traffic
2. **Orchestration Tools** - Kubernetes/Docker need to check readiness without credentials
3. **Monitoring Systems** - External monitoring needs simple, fast access
4. **Standard Practice** - Industry standard for health check endpoints

### What's Protected

- No sensitive configuration data is exposed
- No database credentials or connection strings
- No API keys or secrets
- No user data or business logic

### What's Exposed (Safe)

- Application version (for tracking deployments)
- System uptime (for monitoring availability)
- Memory usage (for capacity planning)
- Health status (for traffic routing)

---

## Usage Examples

### Check if Application is Healthy

```bash
curl http://localhost:3000/api/health
```

### Check if Application is Ready for Traffic

```bash
curl http://localhost:3000/api/health/ready
```

### Get System Status Information

```bash
curl http://localhost:3000/api/status
```

### Monitor Health with Script

```bash
#!/bin/bash
HEALTH_URL="http://localhost:3000/api/health"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL")

if [ "$STATUS" -eq 200 ]; then
  echo "Application is healthy"
  exit 0
else
  echo "Application is unhealthy (HTTP $STATUS)"
  exit 1
fi
```

### Docker Compose Health Check

```yaml
services:
  app:
    image: fiskai:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

## Response Time Guidelines

- **Health Endpoint:** Should respond in <100ms under normal load
- **Readiness Endpoint:** Should respond in <200ms under normal load
- **Status Endpoint:** Should respond in <50ms (no database queries)

If response times exceed these guidelines, investigate:
1. Database connection pool settings
2. Network latency
3. System resource constraints
4. Application performance issues

---

## Monitoring Best Practices

1. **Use `/api/health` for load balancer checks** - Fast, simple, tells you if app is up
2. **Use `/api/health/ready` for Kubernetes probes** - More thorough, prevents premature traffic
3. **Use `/api/status` for dashboards** - Rich information for monitoring tools
4. **Set appropriate timeouts** - Don't wait too long for health checks
5. **Monitor response times** - Slow health checks indicate problems
6. **Alert on failures** - Set up notifications when health checks fail

---

## Troubleshooting

### Health Check Returns 503

1. Check database connectivity
2. Verify database credentials in environment variables
3. Check if database is accepting connections
4. Review application logs for errors
5. Check memory usage (may be >95%)

### Readiness Check Never Becomes Ready

1. Check if app is still initializing (<5s uptime)
2. Verify database latency is <5000ms
3. Check memory usage is <90%
4. Review application startup logs

### Status Endpoint Shows High Memory Usage

1. Check for memory leaks in application code
2. Review connection pool settings
3. Check for large data processing operations
4. Consider scaling up resources
5. Enable heap profiling to identify issues

---

## Version Information

- **Implementation Date:** 2025-12-15
- **API Version:** v1
- **Next.js Version:** 15.x
- **Node.js Requirement:** 18.15+
