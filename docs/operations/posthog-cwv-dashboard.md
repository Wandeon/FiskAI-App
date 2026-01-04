# PostHog Core Web Vitals Dashboard Specification

## Dashboard: "Performance SLOs"

### Insight 1: CWV Trends by Route Group

**Type:** Line chart
**Event:** `web_vital`
**Breakdown:** `route_group`
**Filter:** `name` = `LCP` OR `CLS` OR `INP`
**Date range:** Last 30 days
**Granularity:** Daily

### Insight 2: LCP Distribution (p50, p75, p95)

**Type:** Bar chart
**Event:** `web_vital`
**Filter:** `name` = `LCP`
**Aggregation:** Percentiles (50, 75, 95)
**Breakdown:** `route_group`

### Insight 3: CWV Rating Distribution

**Type:** Pie chart
**Event:** `web_vital`
**Filter:** `name` = `LCP`
**Breakdown:** `rating` (good, needs-improvement, poor)

### Insight 4: TTFB by Route Group

**Type:** Line chart
**Event:** `web_vital`
**Filter:** `name` = `TTFB`
**Breakdown:** `route_group`
**Aggregation:** p75

### Insight 5: Deploy Markers

**Type:** Annotations
**Source:** Manual or CI/CD integration
**Purpose:** Correlate performance changes with releases

## Alerts (PostHog Actions)

| Alert           | Condition                  | Action             |
| --------------- | -------------------------- | ------------------ |
| LCP Regression  | LCP p75 > 3000ms for 30min | Slack notification |
| CLS Spike       | CLS p75 > 0.15 for 30min   | Slack notification |
| INP Degradation | INP p75 > 300ms for 30min  | Slack notification |

## Implementation

1. Create dashboard in PostHog UI
2. Add 5 insights as specified above
3. Configure alerts under Actions > Webhooks
4. Link Slack webhook for notifications
