# System Status Operator Guide

## Overview

The System Status page (`/admin.fiskai.hr/system-status`) provides a real-time view of system health for non-technical operators.

## Headline States

| State | Color | Meaning | Action |
|-------|-------|---------|--------|
| **OK** | Green | All systems healthy | No action needed |
| **ATTENTION** | Yellow | Non-critical issues | Review when convenient |
| **ACTION_REQUIRED** | Red | Critical issues | Immediate attention required |

## Daily Ritual

1. Open the System Status page at the start of each workday
2. Check the headline status:
   - If **OK**: Proceed with normal work
   - If **ATTENTION**: Review top items, prioritize as needed
   - If **ACTION_REQUIRED**: Address critical items before other work
3. Click "Refresh Now" to get the latest status

## Understanding the Dashboard

### Counters
- **Critical/High/Medium/Low**: Issues by severity
- **Observed**: Integrations actively monitored
- **Declared**: Integrations we expect to exist

### Top Priority Items
Lists the most urgent issues with:
- What's wrong
- Why it matters
- What to do next
- Who owns it

### Recent Changes
Timeline of status changes since last check.

### Refresh Details
- **Quality**: FULL (complete check) or DEGRADED (partial check due to errors)
- **Last Status**: SUCCESS or FAILED
- **Last Error**: Details if refresh failed

## Troubleshooting

### Refresh stuck "in progress"
Wait up to 2 minutes. If still stuck, the lock will auto-expire and you can retry.

### Degraded quality
Some checks failed. Review errors in Refresh Details. Critical issues are still captured.

### Cannot access page
Confirm you have ADMIN role. Contact platform administrator if needed.
