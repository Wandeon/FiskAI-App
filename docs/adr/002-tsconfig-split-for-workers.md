# ADR-002: TypeScript Configuration Split for Worker Processes

## Status

Accepted

## Date

2026-01-01

## Context

FiskAI uses Next.js 15 as its primary framework, which requires specific TypeScript configuration settings for optimal build performance and module resolution. However, the application also includes standalone worker processes for the Regulatory Truth Layer (RTL) that run outside the Next.js runtime.

The Next.js application requires:

- `moduleResolution: "bundler"` - Next.js 15 bundler mode
- `module: "esnext"` - ES modules for client/server bundles
- `jsx: "preserve"` - Let Next.js handle JSX transformation
- `noEmit: true` - Next.js handles compilation

The RTL workers require:

- `moduleResolution: "node"` - Standard Node.js resolution
- `module: "commonjs"` - Native Node.js module format
- `outDir` - Workers need compiled output for Docker

Attempting to use a single configuration creates conflicts:

1. Workers fail with `bundler` moduleResolution when running directly with Node.js
2. Next.js warns about incompatible settings if using `node` moduleResolution
3. Path aliases behave differently between the two resolution strategies

## Decision

Maintain two TypeScript configuration files:

1. **`tsconfig.json`** - Primary configuration for Next.js application
   - Used by: Next.js build, IDE, ESLint
   - Scope: All application code

2. **`tsconfig.workers.json`** - Worker-specific configuration
   - Extends `tsconfig.json` for shared settings
   - Overrides module settings for Node.js compatibility
   - Scope: `src/lib/regulatory-truth/workers/**/*`
   - Used by: Docker worker builds, standalone script execution

### Configuration Relationship

```
tsconfig.json (base)
    ├── Next.js application
    ├── IDE support
    ├── ESLint
    └── tsconfig.workers.json (extends)
            └── RTL worker processes
```

## Consequences

### Positive

- Each runtime environment gets optimal TypeScript settings
- Workers compile and run correctly in Docker
- IDE maintains consistent experience via base config
- Path aliases work correctly in both contexts
- Clear separation of concerns

### Negative

- Two configuration files to maintain
- Potential confusion for new developers
- Need to remember which config to use when running workers

### Mitigations

- `tsconfig.workers.json` explicitly documents its purpose via naming
- Worker build scripts reference the correct config
- This ADR documents the rationale

## Alternatives Considered

### 1. Single tsconfig with project references

**Rejected**: TypeScript project references add complexity and don't solve the moduleResolution conflict. Next.js doesn't support project references well.

### 2. Migrate workers to ESM

**Rejected**: Would require significant refactoring of worker scripts and dependencies. Some worker dependencies don't support ESM fully.

### 3. Use tsx/ts-node for workers

**Rejected**: Adds runtime dependency and complexity to Docker containers. Compiled JavaScript is more reliable for production workers.

## Related

- [ADR-001: DDD Clean Architecture](001-ddd-clean-architecture.md)
- Worker documentation: `docs/01_ARCHITECTURE/REGULATORY_TRUTH_LAYER.md`
