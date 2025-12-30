# FiskAI Scripts

Utility scripts for development, deployment, and maintenance.

## Environment Validation

### validate-env.sh

Validates environment files for placeholder values that should not be used in production.

**Usage:**

```bash
./scripts/validate-env.sh          # Validate .env
./scripts/validate-env.sh .env.production
```

**Exit codes:**
- 0 - No placeholder values found
- 1 - Placeholder values detected
- 2 - Environment file not found

See the script file for complete documentation.
