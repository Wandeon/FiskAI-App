# News Fetching Cron Job Setup

## Overview

The news fetching system requires a scheduled cron job to automatically fetch and process news from configured sources. This document describes how to set up the cron job in Coolify.

## Prerequisites

1. Application deployed and running in Coolify
2. Database migrations completed (news_sources and news_items tables exist)
3. News sources seeded (via `npm run seed:news-sources`)
4. `CRON_SECRET` environment variable set in Coolify

## Cron Job Configuration

### Schedule

The cron job should run **every 6 hours** to fetch news from all active sources and process pending items.

**Cron Expression:** `0 */6 * * *`

This translates to:

- Minute: 0 (at the top of the hour)
- Hour: Every 6 hours (0, 6, 12, 18)
- Day of Month: Every day
- Month: Every month
- Day of Week: Every day

### Coolify Setup

1. **Navigate to your application** in Coolify dashboard

2. **Go to the Scheduled Tasks section**

3. **Create a new scheduled task** with the following settings:
   - **Name:** `Fetch News`
   - **Schedule:** `0 */6 * * *`
   - **Command:**
     ```bash
     curl -X GET \
       -H "Authorization: Bearer ${CRON_SECRET}" \
       https://your-domain.com/api/cron/fetch-news
     ```

   Replace `your-domain.com` with your actual domain.

4. **Save the scheduled task**

## Environment Variables

Ensure the following environment variable is set in your Coolify application:

```bash
CRON_SECRET=your-secure-random-secret-here
```

To generate a secure secret:

```bash
openssl rand -base64 32
```

## What the Cron Job Does

When triggered, the `/api/cron/fetch-news` endpoint performs the following:

1. **Fetches news** from all active sources (RSS feeds and web scraping)
2. **Inserts new items** into the database (skips duplicates)
3. **Processes up to 10 pending items** with AI:
   - Generates Croatian summaries
   - Categorizes content (tax, VAT, compliance, etc.)
   - Assigns relevance scores
4. **Returns a summary** of the work completed

## Monitoring

### Check Cron Job Status

In Coolify, you can:

- View the execution history in the Scheduled Tasks section
- Check logs for each execution
- Monitor for failures and errors

### Manual Trigger

To manually trigger the news fetch (useful for testing):

```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-domain.com/api/cron/fetch-news
```

### Response Format

Successful response:

```json
{
  "success": true,
  "timestamp": "2025-12-16T10:00:00.000Z",
  "fetched": {
    "total": 15,
    "inserted": 12,
    "skipped": 3,
    "errors": 0,
    "sources": [...]
  },
  "processed": {
    "total": 10,
    "errors": 0,
    "pending": 0
  }
}
```

Error response:

```json
{
  "error": "Unauthorized"
}
```

## Troubleshooting

### Cron Job Fails with 401 Unauthorized

**Cause:** CRON_SECRET mismatch or not set

**Solution:**

1. Verify CRON_SECRET is set in Coolify environment variables
2. Ensure the curl command uses the correct secret
3. Restart the application after updating environment variables

### No New Items Fetched

**Possible causes:**

1. RSS feeds haven't updated
2. All items already exist in database (duplicates)
3. Network issues accessing source URLs

**Solution:**

- Check the response JSON for specific source errors
- Verify source URLs are still valid
- Check application logs for detailed error messages

### AI Processing Fails

**Possible causes:**

1. OpenAI API key not set or invalid
2. Rate limiting on OpenAI API
3. Malformed content from sources

**Solution:**

- Verify `OPENAI_API_KEY` is set in environment variables
- Check OpenAI usage dashboard for rate limits
- Review application logs for specific AI errors

## Initial Setup Steps

After deploying the application:

1. **Run database migrations:**

   ```bash
   npx drizzle-kit migrate
   ```

2. **Seed news sources:**

   ```bash
   npm run db:seed-news
   ```

3. **Set up cron job** in Coolify (as described above)

4. **Test manually:**

   ```bash
   curl -X GET \
     -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://your-domain.com/api/cron/fetch-news
   ```

5. **Monitor first scheduled execution** in Coolify logs

## Adjusting Schedule

If you need to change the fetch frequency:

- **More frequent (every 3 hours):** `0 */3 * * *`
- **Less frequent (twice daily):** `0 0,12 * * *`
- **Daily at midnight:** `0 0 * * *`

## Notes

- The endpoint has a 5-minute timeout (`maxDuration = 300`)
- Processing is limited to 10 items per run to avoid timeouts
- A 1-second delay is added between AI processing calls to avoid rate limiting
- The endpoint uses `force-dynamic` to prevent caching
