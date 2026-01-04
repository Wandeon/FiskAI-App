# VPS-01 Infrastructure Notes

## Server Specifications

| Property         | Value                              |
| ---------------- | ---------------------------------- |
| **Hostname**     | VPS-01                             |
| **Architecture** | ARM64 (aarch64)                    |
| **NOT**          | x86_64                             |
| **Purpose**      | FiskAI production deployment       |
| **Status**       | Requires cleanup before deployment |

## ARM64 Considerations

### Why This Matters

ARM64 is a different CPU architecture than the traditional x86_64 used in most servers. This affects:

1. **Docker Images**: Must use ARM-compatible images
2. **Native Dependencies**: Some npm packages with C/C++ bindings need ARM builds
3. **Build Process**: Cross-compilation may be needed from x86 dev machines

### Compatibility Status

| Component      | ARM64 Support | Notes                     |
| -------------- | ------------- | ------------------------- |
| Node.js        | ✅ Full       | Official ARM64 builds     |
| Next.js        | ✅ Full       | Pure JavaScript           |
| React          | ✅ Full       | Pure JavaScript           |
| PostgreSQL     | ✅ Full       | Official ARM64 images     |
| Coolify        | ✅ Full       | Supports Raspberry Pi/ARM |
| Docker         | ✅ Full       | Native ARM64 support      |
| Prisma         | ✅ Full       | ARM64 binaries available  |
| Sharp (images) | ✅ Full       | ARM64 binaries available  |

### Docker Image Selection

Always specify multi-arch or ARM64 images:

```yaml
# Good - multi-arch image
services:
  app:
    image: node:20-alpine
    platform: linux/arm64

  db:
    image: postgres:16-alpine
    platform: linux/arm64
```

### Dockerfile Best Practices

```dockerfile
# Specify platform explicitly
FROM --platform=linux/arm64 node:20-alpine

# Use Alpine for smaller images
# Most npm packages work fine on Alpine ARM64

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

CMD ["npm", "start"]
```

### Potential Issues

1. **Native Modules**: Some older npm packages may not have ARM64 prebuilt binaries
   - Solution: Let npm compile from source (needs build tools in Docker)

2. **Memory Usage**: ARM instances may have different memory characteristics
   - Monitor and tune Node.js memory settings if needed

3. **Build Times**: First builds may be slower if compiling native modules
   - Use multi-stage builds to cache dependencies

### Build Configuration

For Next.js on ARM64:

```javascript
// next.config.js
module.exports = {
  output: "standalone", // Smaller deployment
  experimental: {
    // ARM64 optimizations if needed
  },
}
```

## Pre-Deployment Cleanup Tasks

Before deploying FiskAI to VPS-01:

- [ ] Audit existing containers/services
- [ ] Remove unused Docker images
- [ ] Free up disk space
- [ ] Update system packages
- [ ] Install Coolify
- [ ] Configure Cloudflare DNS
- [ ] Set up SSL certificates
- [ ] Configure firewall rules
- [ ] Set up monitoring

## Recommended Stack for ARM64

```
┌─────────────────────────────────────────────────────────────┐
│                    VPS-01 (ARM64)                            │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │                   Coolify                            │    │
│  │            (Docker-based PaaS)                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Docker Containers                       │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────┐   │    │
│  │  │   FiskAI    │  │  PostgreSQL │  │   Redis    │   │    │
│  │  │  (Next.js)  │  │    (DB)     │  │  (cache)   │   │    │
│  │  │   ARM64     │  │   ARM64     │  │   ARM64    │   │    │
│  │  └─────────────┘  └─────────────┘  └────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Performance Expectations

ARM64 servers generally offer:

- Good single-thread performance
- Excellent power efficiency
- Competitive multi-core performance
- Lower costs than equivalent x86

For a SaaS application like FiskAI, ARM64 is an excellent choice.

## Monitoring

Set up monitoring for:

- CPU usage (ARM metrics)
- Memory usage
- Disk I/O
- Network traffic
- Container health
- PostgreSQL performance

Recommended: Coolify built-in monitoring + Cloudflare Analytics
