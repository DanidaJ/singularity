# Singularity Production Deployment

This repository is configured to deploy `Singularity` to:

- Domain: `singularity.danidajay.com`
- Container image: `ghcr.io/danidaj/singularity:latest`
- VPS app path: `/root/singularity`

## 1. GitHub Secrets Required

Set these repository secrets:

- `GHCR_PAT` (PAT with `read:packages` and `write:packages`)
- `VPS_HOST`
- `VPS_USERNAME`
- `VPS_SSH_KEY`

## 2. VPS One-Time Setup

On the VPS:

1. Create app directory:
   - `mkdir -p /root/singularity`
2. Put `docker-compose.prod.yml` in `/root/singularity`.
3. Create `/root/singularity/.env` (you can copy from `.env.example`).
4. Put `singularity.conf` in your Nginx `conf.d` (or mounted equivalent).
5. Ensure Docker + Docker Compose plugin are installed.

## 3. Domain / Reverse Proxy

Point `singularity.danidajay.com` to your VPS IP in DNS.

This setup uses:

- App container: `singularity-client:3000` (Docker network DNS)
- Nginx vhost file: `singularity.conf` with HTTPS + proxy rules

## 4. Deploy Trigger

Deployment runs from GitHub Actions when:

- You push to `production`, or
- You trigger `workflow_dispatch` manually.

Workflow path:

- `.github/workflows/deploy-production.yml`
