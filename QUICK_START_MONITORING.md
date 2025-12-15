# Quick Start: Monitoring Endpoints

## Test the Endpoints

### 1. Health Check
```bash
curl http://localhost:3000/api/health | jq
```

**Expected Response:**
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

### 2. Readiness Check
```bash
curl http://localhost:3000/api/health/ready | jq
```

**Expected Response:**
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

### 3. Status Information
```bash
curl http://localhost:3000/api/status | jq
```

**Expected Response:**
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

## Run the Test Script

```bash
./scripts/test-health-endpoints.sh
```

## Which Endpoint to Use?

- **Load Balancer Health Checks:** Use `/api/health`
- **Kubernetes Liveness Probe:** Use `/api/health`
- **Kubernetes Readiness Probe:** Use `/api/health/ready`
- **Monitoring Dashboard:** Use `/api/status`
- **Status Page:** Use `/api/status`

## Next Steps

1. Read `/home/admin/FiskAI/MONITORING_ENDPOINTS.md` for full documentation
2. Review `/home/admin/FiskAI/docs/monitoring-architecture.md` for architecture details
3. Check deployment configs in `/home/admin/FiskAI/docs/deployment/`
