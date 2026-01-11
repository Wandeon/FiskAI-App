# Backfill V1 Pre-Merge Snapshot

> Baseline measurements before merging PR #1401
> Timestamp: 2026-01-11T17:30:00Z

## Git State

```
HEAD: 4e6b8058418ea5b432e9bf962c8477b3cf82acb2
Branch: feat/backfill-discovery
PR: #1401 (pending merge)
```

## Docker Workers

| Container                      | Image                                 | Status         | Uptime   |
| ------------------------------ | ------------------------------------- | -------------- | -------- |
| fiskai-worker-sentinel         | fiskai-worker-sentinel:latest         | Up             | 11 hours |
| fiskai-worker-extractor        | fiskai-worker-extractor:latest        | Up             | 27 hours |
| fiskai-worker-ocr              | fiskai-worker-ocr:latest              | Up             | 27 hours |
| fiskai-worker-composer         | fiskai-worker-composer:latest         | Up             | 27 hours |
| fiskai-worker-reviewer         | fiskai-worker-reviewer:latest         | Up             | 27 hours |
| fiskai-worker-arbiter          | fiskai-worker-arbiter:latest          | Up             | 27 hours |
| fiskai-worker-releaser         | fiskai-worker-releaser:latest         | Up             | 27 hours |
| fiskai-worker-scheduler        | fiskai-worker-scheduler:latest        | Up             | 27 hours |
| fiskai-worker-einvoice-inbound | fiskai-worker-einvoice-inbound:latest | **Restarting** | N/A      |

## Redis State

| Metric      | Value     |
| ----------- | --------- |
| Memory Used | 4.56 GB   |
| Memory Peak | 4.57 GB   |
| Memory Max  | 8.00 GB   |
| Total Keys  | 6,992,320 |

## Queue Depths (BullMQ)

| Queue      | Job Count |
| ---------- | --------- |
| review     | 4,297,673 |
| extract    | 2,145,290 |
| arbiter    | 419,045   |
| compose    | 129,029   |
| release    | 1,005     |
| deadletter | 215       |
| sentinel   | 13        |

## Database Counts

### core.DiscoveredItem

| Status    | Count     |
| --------- | --------- |
| PROCESSED | 1,306     |
| SKIPPED   | 488       |
| FETCHED   | 445       |
| FAILED    | 63        |
| PENDING   | 44        |
| **Total** | **2,346** |

### regulatory.Evidence

| contentClass | Count   |
| ------------ | ------- |
| HTML         | 297     |
| PDF_TEXT     | 57      |
| PDF_SCANNED  | 55      |
| XLSX         | 27      |
| DOC          | 2       |
| **Total**    | **438** |

### BackfillRun

| Count                            |
| -------------------------------- |
| **0** (table does not exist yet) |

## Observations

1. **Queue Backlog:** Massive pre-existing backlog (~6.4M jobs). Backfill must be careful not to worsen this.
2. **Redis Memory:** At 57% capacity (4.56G/8G). Monitor during backfill.
3. **Worker Health:** All RTL workers running normally except einvoice-inbound (unrelated issue).

---

**Next Step:** Merge PR when CI green, then apply migration.
