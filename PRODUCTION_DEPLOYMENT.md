# ARC Investment Factory - Production Deployment

## Deployment Status: ✅ COMPLETE

**Date:** January 12, 2026
**Platform:** Digital Ocean
**Region:** NYC1

---

## Production URLs

| Service | URL |
|---------|-----|
| **Web UI** | http://159.203.86.246 |
| **API Health** | http://159.203.86.246/api/health |
| **API Ideas** | http://159.203.86.246/api/ideas |
| **API Research** | http://159.203.86.246/api/research |
| **API Runs** | http://159.203.86.246/api/runs |

---

## Infrastructure

### Droplet
- **Name:** arc-prod
- **IP:** 159.203.86.246
- **Size:** s-4vcpu-8gb
- **OS:** Ubuntu 22.04 LTS
- **Region:** NYC1

### Managed PostgreSQL
- **Name:** arc-db-prod
- **Host:** arc-db-prod-do-user-27055479-0.g.db.ondigitalocean.com
- **Port:** 25060
- **Database:** defaultdb
- **User:** doadmin
- **SSL:** Required

---

## Services

| Service | Port | Status | Process Manager |
|---------|------|--------|-----------------|
| arc-api | 3001 | ✅ Online | PM2 |
| arc-web | 3000 | ✅ Online | PM2 |
| arc-worker | - | ✅ Online | PM2 |
| nginx | 80 | ✅ Running | systemd |
| postgresql | 25060 | ✅ Online | DO Managed |

---

## Scheduled Jobs

| Job | Schedule | Timezone |
|-----|----------|----------|
| daily_discovery (Lane A) | 06:00 Mon-Fri | America/Sao_Paulo |
| daily_lane_b (Lane B) | 08:00 Mon-Fri | America/Sao_Paulo |
| weekly_qa_report | 18:00 Friday | America/Sao_Paulo |
| weekly_ic_bundle | 19:00 Friday | America/Sao_Paulo |

---

## Database Tables

| Table | Description |
|-------|-------------|
| ideas | Investment ideas from Lane A |
| research_packets | Deep research from Lane B |
| evidence | Supporting evidence for ideas |
| novelty_state | Novelty tracking per ticker |
| style_mix_state | Style allocation tracking |
| rejection_history | Rejection shadow records |
| runs | Audit trail of DAG executions |
| security_master | Global universe of securities |
| documents | Source documents |
| document_chunks | Document chunks for retrieval |
| decisions | Human decisions on ideas |
| outcomes | Outcome tracking |
| watchlist | User watchlist |
| prompt_templates | LLM prompt templates |

---

## UI Pages

1. **Home** - Dashboard with Lane A/B overview
2. **Inbox** - Lane A output with Promote/Reject buttons
3. **Research Queue** - Lane B input (promoted ideas)
4. **Packets** - Completed research packets
5. **Memory** - Rejection shadows and reappearance deltas
6. **QA Report** - Weekly quality assurance metrics
7. **Run History** - Audit trail
8. **Settings** - System configuration (locked + configurable params)

---

## Management Commands

```bash
# SSH to server
ssh -i ~/.ssh/arc_deploy_key root@159.203.86.246

# View service status
pm2 status

# View logs
pm2 logs arc-api
pm2 logs arc-web
pm2 logs arc-worker

# Restart services
pm2 restart all

# Run Lane A manually
cd /opt/arc && node packages/worker/dist/cli.js discovery

# Run Lane B manually
cd /opt/arc && node packages/worker/dist/cli.js lane-b

# Database access
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -p 25060 -U doadmin -d defaultdb
```

---

## Environment Variables

All environment variables are configured in `/opt/arc/.env.production`:

- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `ANTHROPIC_API_KEY` - Anthropic API key
- `POLYGON_API_KEY` - Polygon.io API key
- `FMP_API_KEY` - Financial Modeling Prep API key
- `FRED_API_KEY` - FRED API key
- `REDDIT_CLIENT_ID` - Reddit API client ID
- `REDDIT_CLIENT_SECRET` - Reddit API client secret

---

## Auto-Restart Configuration

- PM2 is configured to auto-start on system boot
- Services are saved with `pm2 save`
- Systemd service: `pm2-root.service`

---

## Monitoring

- **Nginx access logs:** `/var/log/nginx/access.log`
- **Nginx error logs:** `/var/log/nginx/error.log`
- **PM2 logs:** `~/.pm2/logs/`

---

## Security Notes

1. Database requires SSL connection
2. API keys stored in `.env.production` (not in git)
3. Nginx configured with security headers
4. SSH key authentication only

---

## Next Steps

1. Configure custom domain and SSL certificate
2. Set up monitoring (Prometheus/Grafana)
3. Configure backup automation
4. Set up alerting for job failures
