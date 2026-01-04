# Coolify Deployment Guide

Goal: host FiskAI on VPS-01 (ARM64) using Coolify so every Git push can trigger automated builds and deployments.

## Prerequisites

- ARM64 VPS with Ubuntu 22.04+, 4 vCPUs, 8 GB RAM, 100 GB SSD minimum.
- Root SSH access.
- Docker & Docker Compose already installed (Coolify installer checks this).
- DNS records ready (e.g., `coolify.erp.example.com` for Coolify dashboard, `erp.example.com` for FiskAI).
- GitHub personal access token (PAT) with `repo` + `workflow` scopes for Coolify to pull code.
- `.env` file prepared with the values defined in `.env.example` (POSTGRES, NEXTAUTH, EINVOICE_KEY_SECRET, etc.).

## Installation Steps

1. **System prep**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install curl ca-certificates -y
   ```
2. **Run Coolify installer** (official script from Coollabs):
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```

   - Script installs Docker dependencies (if missing), pulls Coolify image, and sets up the `coolify` systemd service.
   - Once complete, Coolify listens on port `8000` (HTTP). Use `https://<server-ip>:8000` to finish onboarding.
3. **Initial onboarding**
   - Navigate to the Coolify URL, create the admin account, and set the root domain (e.g., `coolify.erp.example.com`).
   - Configure email/SMTP if desired.
4. **Secure access**
   - Point DNS `coolify.erp.example.com` to the VPS IP.
   - In Coolify, enable HTTPS (Let’s Encrypt) for the dashboard.

## Deploying FiskAI

1. **Create PostgreSQL service**
   - In Coolify, add a new managed database → PostgreSQL 16 (ARM64 architecture).
   - Note credentials and connection URL (use them to populate `DATABASE_URL`).
2. **Create an application**
   - Choose “Git Repository” → GitHub → connect using the PAT.
   - Select the `FiskAI` repo and `main` branch.
   - Build config:
     - Build pack: “Dockerfile”.
     - Dockerfile path: `Dockerfile`.
     - Build context: `.`.
     - Set environment variables from `.env.example` (DATABASE_URL from the managed DB, NEXTAUTH settings, EINVOICE_KEY_SECRET, etc.).
   - Resources: set CPU/RAM according to VPS capacity (e.g., 1 vCPU / 1.5 GB RAM for app container).
3. **Configure services**
   - If using Coolify’s managed Postgres, set “Depends on” to ensure DB starts before app.
   - Define health checks using `/` endpoint (expect 307 redirect until logged in).
4. **Domains & HTTPS**
   - Assign `erp.example.com` to the application.
   - Enable HTTPS via Let's Encrypt inside Coolify.
5. **Auto-deploy**
   - Turn on “Auto-deploy on Git push”.
   - Optional: restrict to tags or branches (e.g., only `main`).

## Post-Deployment Checklist

- Run `npx prisma migrate deploy` inside the Coolify console after first deployment to apply DB schema.
- Verify environment variables via Coolify dashboard (no secrets in git).
- Enable backups for Postgres (Coolify’s schedule or external snapshot).
- Connect monitoring/alerts (Coolify has built-in metrics; also set up external ping).

## Maintenance Commands

- Restart Coolify service: `sudo systemctl restart coolify`
- View logs: `docker logs -f coolify`
- Update Coolify: rerun the installer script; it performs rolling upgrade.

## Notes

- Installer requires outbound internet access; if network is restricted, fetch the script manually and transfer via SCP.
- For GitHub webhooks, ensure port 6001 is reachable or configure polling mode under project settings.
- Keep PATs in Coolify’s secret store; rotate regularly.
