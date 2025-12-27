# Security Credentials Rotation Checklist

## Credentials Requiring Rotation

All credentials below were exposed in git history and must be rotated:

### Database
- [ ] POSTGRES_PASSWORD - Rotate in Coolify, update docker-compose

### Authentication
- [ ] NEXTAUTH_SECRET - Generate new: `openssl rand -base64 32`

### API Keys
- [ ] RESEND_API_KEY - Rotate in Resend dashboard
- [ ] CLOUDFLARE_DNS_API_TOKEN - Rotate in Cloudflare dashboard
- [ ] COOLIFY_API_TOKEN - Rotate in Coolify settings
- [ ] DEEPSEEK_API_KEY - Rotate in DeepSeek dashboard
- [ ] OLLAMA_API_KEY - Rotate if using cloud Ollama

### Encryption
- [ ] FISCAL_CERT_KEY - Generate new: `openssl rand -hex 32`
- [ ] EINVOICE_KEY_SECRET - Generate new secret
- [ ] CRON_SECRET - Generate new: `openssl rand -hex 32`

## Rotation Process

1. Generate new credentials
2. Update in Coolify environment variables
3. Redeploy application
4. Verify application works with new credentials
5. Revoke old credentials in respective dashboards

## Post-Rotation Verification

- [ ] Application starts successfully
- [ ] Database connections work
- [ ] Email sending works (Resend)
- [ ] Cron jobs authenticate correctly
- [ ] E-invoice signing works
