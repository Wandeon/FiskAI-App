# OPERATION SHATTER — Audit Report (Croatian d.o.o. hostile month)

**Worktree evidence:** `audit/operation-shatter/evidence/git-worktree-list-2026-01-02.txt`

**Run metadata (latest evidence bundle):**

```
startedAt: 2026-01-02T12:23:31.036Z
DATABASE_URL: postgresql://fiskai:fiskai_secret_2025@localhost:5434/fiskai_shatter?schema=public
deterministicMode: true
actor.userId: cmjwuhszn0000y1wa5e9tikrq
actor.companyId: cmjwuht2p0001y1waapq8r3ph
source: audit/operation-shatter/evidence/shatter-evidence.json
```

**Phase 0 inventory:** `audit/operation-shatter/PHASE0_INVENTORY.md`

## Hardening Gates (H1–H5)

**H1 Deterministic Money (no floats): PASS**
Evidence (grep): `audit/operation-shatter/evidence/h1-money-grep-2026-01-02.txt`  
Evidence (tests pass): `audit/operation-shatter/evidence/gates-vitest-2026-01-02-pass5.txt`  
Key tests: `src/lib/vat/__tests__/money-determinism.test.ts`, `src/lib/vat/__tests__/input-vat-determinism.test.ts`, `src/lib/payroll/__tests__/director-salary-determinism.test.ts`

**H2 Audit Log includes UPDATE before-state + correlationId: PASS**
Middleware: `src/lib/prisma-extensions.ts` (`auditBeforeState` + `queueAuditLog()`), `src/lib/context.ts` (requestId), `src/lib/audit-context.ts` (actor/reason)  
Proof test: `src/lib/audit/__tests__/audit-correlation.test.ts` (PASS in `audit/operation-shatter/evidence/gates-vitest-2026-01-02-pass5.txt`)  
Sample UPDATE event (before/after + correlationId): `audit/operation-shatter/evidence/h2-sample-update-shatter-s3.json` (AuditLog `id=cmjwtpi64002imowa4vtz4584`, `entity=InvoiceSequence`)

**H3 Immutability at boundaries (fiscal invoices, JOPPD, locked period): PASS**
Enforcement: `src/lib/prisma-extensions.ts` (`enforceInvoiceImmutability`, `enforceJoppd*Immutability`, `assertPeriodUnlocked`, `logBlockedMutationAttempt`)  
Proof test: `src/lib/audit/__tests__/immutability-blocked.test.ts` (PASS in `audit/operation-shatter/evidence/gates-vitest-2026-01-02-pass5.txt`)  
Scenario proof (blocked sabotage attempts + explicit errors): `audit/operation-shatter/evidence/shatter-run-2026-01-02-pass11.txt` (correlationIds `SHATTER-S1`, `SHATTER-S4`)

**H4 Reproducible artifacts + checksums + metadata: PASS**
Wrappers: `src/lib/pdf/generate-invoice-pdf-artifact.ts`, `src/lib/joppd/joppd-service.ts`, `src/lib/reports/pdv-xml-artifact.ts`  
Determinism tests: `src/lib/pdf/__tests__/invoice-pdf-artifact-determinism.test.ts`, `src/lib/joppd/__tests__/joppd-xml-artifact-determinism.test.ts`, `src/lib/reports/__tests__/pdv-xml-artifact-determinism.test.ts` (PASS in `audit/operation-shatter/evidence/gates-vitest-2026-01-02-pass5.txt`)  
Scenario assertions: `audit/operation-shatter/evidence/shatter-evidence.json` includes `H4.Invoice1 PDF checksum reproducible`, `H4.JOPPD XML checksum reproducible for same payout inputs`, `H4.PDV XML checksum reproducible`.

**H5 Test Harness Runner exists (E2E hostile month): PASS**
Runner: `scripts/operation-shatter.ts`  
Successful execution output: `audit/operation-shatter/evidence/shatter-run-2026-01-02-pass11.txt`  
Evidence bundle JSON: `audit/operation-shatter/evidence/shatter-evidence.json`

## A) Summary Table (PASS/FAIL)

| CorrelationId | Step                                             | Result | One-line reason                                                                                                                | Primary evidence                                                                                                               |
| ------------- | ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `SHATTER-S1`  | `S1.Invoice1 create + PDF`                       | PASS   | VAT 0% + reverse-charge note present + deterministic PDF checksum                                                              | `audit/operation-shatter/evidence/shatter-evidence.json`, `audit/operation-shatter/evidence/shatter-run-2026-01-02-pass11.txt` |
| `SHATTER-S1`  | `S1.Invoice2 fiscalize + sabotage + credit note` | PASS   | Fiscalize mock success; post-fiscal sabotage blocked without mutation; credit note created as separate record                  | `audit/operation-shatter/evidence/shatter-evidence.json`, `audit/operation-shatter/evidence/shatter-run-2026-01-02-pass11.txt` |
| `SHATTER-S2`  | `S2.Expense→Asset→MonthClose→Lock`               | PASS   | Expense becomes asset candidate; depreciation 104.16 posted; period locks and blocks tamper update                             | `audit/operation-shatter/evidence/shatter-evidence.json`, `audit/operation-shatter/evidence/shatter-run-2026-01-02-pass11.txt` |
| `SHATTER-S3`  | `S3.Import + AutoMatch`                          | PASS   | Matcher produces PARTIAL/PAID statuses; overpayment stored; bank fee categorized                                               | `audit/operation-shatter/evidence/shatter-evidence.json`, `audit/operation-shatter/evidence/shatter-run-2026-01-02-pass11.txt` |
| `SHATTER-S4`  | `S4.Payroll→JOPPD→PDV`                           | PASS   | Payroll snapshot pins rule versions; JOPPD sign/submit mocked success; signed/submitted sabotage blocked; PDV totals validated | `audit/operation-shatter/evidence/shatter-evidence.json`, `audit/operation-shatter/evidence/shatter-run-2026-01-02-pass11.txt` |

## B) Critical Failures (if any)

None in the latest end-to-end run (`audit/operation-shatter/evidence/shatter-evidence.json` shows `fails=0` across `SHATTER-S1..S4`).

## C) Evidence Bundle

**Commands used**

```
DATABASE_URL='postgresql://fiskai:fiskai_secret_2025@localhost:5434/fiskai_shatter?schema=public' npx vitest run | tee audit/operation-shatter/evidence/gates-vitest-2026-01-02-pass5.txt
DATABASE_URL='postgresql://fiskai:fiskai_secret_2025@localhost:5434/fiskai_shatter?schema=public' npx tsx scripts/operation-shatter.ts | tee audit/operation-shatter/evidence/shatter-run-2026-01-02-pass11.txt
DATABASE_URL='postgresql://fiskai:fiskai_secret_2025@localhost:5434/fiskai_shatter?schema=public' npx tsx scripts/dump-audit-sample-update.ts --correlationId SHATTER-S3 --out audit/operation-shatter/evidence/h2-sample-update-shatter-s3.json --check
```

**DB entity IDs created (by scenario; from `audit/operation-shatter/evidence/shatter-evidence.json`)**

```json
{
  "SHATTER-S1": {
    "Contact": ["cmjwuht450004y1wahn3wgum3", "cmjwuhuj0000my1wa2y7133fe"],
    "EInvoice": [
      "cmjwuhtb3000cy1wand8hmwut",
      "cmjwuhul6000qy1wad9tbh2yp",
      "cmjwuhut1000yy1waif8n1kxc"
    ],
    "Artifact": ["cmjwuhtw7000gy1wa331d7nu0", "cmjwuhu9c000jy1waz6ad5fsy"]
  },
  "SHATTER-S2": {
    "Contact": ["cmjwuhuuk0013y1wal3cuyn5k"],
    "ExpenseCategory": ["cmjwuhuup0014y1waf0txy5ka"],
    "Expense": ["cmjwuhuv10017y1waff8qtmve"],
    "ExpenseLine": ["cmjwuhuwg001ay1wak4oz1gjl"],
    "UraInput": ["cmjwuhux9001cy1wa1frucqyb"],
    "FixedAssetCandidate": ["cmjwuhuxu001ey1wamsiqiluj"],
    "FixedAsset": ["cmjwuhuz2001fy1waz72vlk4g"],
    "DepreciationSchedule": ["cmjwuhv1b001hy1wah52frs8i"]
  },
  "SHATTER-S3": {
    "BankAccount": ["cmjwuhvaz002gy1wabcg1sgps"],
    "Contact": ["cmjwuhvb9002hy1wayri7as55"],
    "EInvoice": ["cmjwuhvec002oy1wanqhk2qd7", "cmjwuhvfm002sy1wa4d30qb4h"],
    "UnappliedPayment": ["cmjwuhvld0038y1warpz4qwvo"],
    "Expense": ["cmjwuhvk90033y1waa9a152dc"],
    "BankTransaction": [
      "cmjwuhvi30030y1wa8ge3ntw2",
      "cmjwuhvi3002yy1waopb3382n",
      "cmjwuhvi3002zy1wai95vshw4"
    ]
  },
  "SHATTER-S4": {
    "RuleVersion": [
      "cmjwuhvwx003fy1wa30q02duz",
      "cmjwuhvxw003hy1war7pdtc9z",
      "cmjwuhvyf003jy1waxwklges6",
      "cmjwuhvz4003ly1wa7tfnhi8q"
    ],
    "Payout": ["8ed9135f-589a-4807-9e7e-703045bc59c4"],
    "PayoutLine": ["d3d99f2c-6576-4955-bd66-469a9ff8ba98"],
    "CalculationSnapshot": ["515e8872-6fb4-41e6-b333-032e4baadd81"],
    "JoppdSubmission": [
      "0752f8dd-ca8e-47a2-a854-105a359819fa",
      "9382924a-1342-4887-a955-6f8959a49d52"
    ],
    "Artifact": [
      "cmjwuhw71003oy1wax3g86aaq",
      "cmjwuhwdz003wy1waw7cujyqi",
      "cmjwuhwez003zy1wa6pmgvru7"
    ]
  }
}
```

**Audit log IDs per correlationId (from `audit/operation-shatter/evidence/shatter-evidence.json`)**

```json
{
  "SHATTER-S1": [
    "cmjwuht5v0005y1wa305falaq",
    "cmjwuht8w0009y1wak2my2ass",
    "cmjwuht9b000ay1wanor2k0et",
    "cmjwuht9u000by1wae0as81xh",
    "cmjwuhtc8000ey1wadzpsp0s9",
    "cmjwuhtwr000iy1wapbiwlia0",
    "cmjwuhtwm000hy1waxkktdyh5",
    "cmjwuhu9v000ly1wagzc51k11",
    "cmjwuhu9n000ky1wa21f7sv19",
    "cmjwuhujc000ny1wae98v3r63",
    "cmjwuhuk1000py1wa6pmu6atx",
    "cmjwuhunj000ty1wab0adkbr3",
    "cmjwuhup5000uy1wa02caqsd8",
    "cmjwuhuqn000vy1wa0qk67nef",
    "cmjwuhus6000xy1wa7h4jvq8i",
    "cmjwuhutv0011y1waxbz5sv5r"
  ],
  "SHATTER-S2": [
    "cmjwuhuur0015y1waqsguvckg",
    "cmjwuhuux0016y1wad21422qm",
    "cmjwuhuvo0018y1wajrefblry",
    "cmjwuhuwv001by1wa27pogz0n",
    "cmjwuhuxk001dy1wa8z2b4gdp",
    "cmjwuhv2x0026y1wargh1mb01",
    "cmjwuhv530029y1wazfhomlax",
    "cmjwuhv4y0028y1wanu884g47",
    "cmjwuhv97002ey1wa0wm3m6rt",
    "cmjwuhv93002dy1wa6hm3nje3",
    "cmjwuhva3002fy1waghbgaapx"
  ],
  "SHATTER-S3": [
    "cmjwuhvbd002iy1wa9h32fzhc",
    "cmjwuhvbn002jy1waupo5al2o",
    "cmjwuhvcs002ly1waztqu2z77",
    "cmjwuhvds002ny1wa9wxed68h",
    "cmjwuhvew002qy1wa8042xdbn",
    "cmjwuhvg8002uy1wam9klqdf8",
    "cmjwuhvhj002xy1wa3md8s7lo",
    "cmjwuhvk40032y1wavaa0xxbf",
    "cmjwuhvko0034y1wa1xkl6o5q",
    "cmjwuhvme003ay1wajb5tyj6i",
    "cmjwuhvmp003by1wao8ykf2ud",
    "cmjwuhvmw003cy1wa7r9g0kji",
    "cmjwuhvqf003dy1wa5bxa4397",
    "cmjwuhvr7003ey1wa9t11f432"
  ],
  "SHATTER-S4": [
    "cmjwuhw7g003qy1waipxr9odi",
    "cmjwuhw7b003py1wa6qb40tdr",
    "cmjwuhw9l003ty1wassljwqc6",
    "cmjwuhw9i003sy1wa4mobxe4x",
    "cmjwuhwbs003uy1wa6qvc4f2v",
    "cmjwuhwc3003vy1way218kdyx",
    "cmjwuhwe8003yy1wacrkdnji9",
    "cmjwuhwe5003xy1waavio9cny",
    "cmjwuhwf60040y1wanx33l2wc",
    "cmjwuhwf90041y1watvmq11g9"
  ]
}
```

**Artifacts (checksums + storage keys; from `audit/operation-shatter/evidence/shatter-evidence.json`)**

```json
{
  "SHATTER-S1": [
    {
      "id": "cmjwuhtw7000gy1wa331d7nu0",
      "type": "PDF",
      "fileName": "racun-1-1-1.pdf",
      "checksum": "9aab3a9e4e644214de81ab8b7446fbc0bddd6ae3edde58c3a451312a48135c18",
      "storageKey": "attachments/cmjwuht2p0001y1waapq8r3ph/2000/01/c2f1a771_9aab3a9e4e644214de81ab8b7446fbc0bddd6ae3edde58c3a451312a48135c18.pdf",
      "generatorVersion": "invoice-pdf@1",
      "inputHash": "b2110d9de223e5f6bd3a8345d4c6322b854af38d7bf8e46eb8ddf144bebc9555"
    },
    {
      "id": "cmjwuhu9c000jy1waz6ad5fsy",
      "type": "PDF",
      "fileName": "racun-1-1-1.pdf",
      "checksum": "9aab3a9e4e644214de81ab8b7446fbc0bddd6ae3edde58c3a451312a48135c18",
      "storageKey": "attachments/cmjwuht2p0001y1waapq8r3ph/2000/01/c2f1a771_9aab3a9e4e644214de81ab8b7446fbc0bddd6ae3edde58c3a451312a48135c18.pdf",
      "generatorVersion": "invoice-pdf@1",
      "inputHash": "b2110d9de223e5f6bd3a8345d4c6322b854af38d7bf8e46eb8ddf144bebc9555"
    }
  ],
  "SHATTER-S4": [
    {
      "id": "cmjwuhw71003oy1wax3g86aaq",
      "type": "XML",
      "fileName": "joppd-39168380555-2026-02-8ed9135f-589a-4807-9e7e-703045bc59c4.xml",
      "checksum": "0a5fc771a441eb277f9f6264d50ebb5e818065a0897977942da9613f82267ff8",
      "storageKey": "attachments/cmjwuht2p0001y1waapq8r3ph/2000/01/a492c3f6_0a5fc771a441eb277f9f6264d50ebb5e818065a0897977942da9613f82267ff8.xml",
      "generatorVersion": "joppd-xml@1",
      "inputHash": "e0686f727736fb33e8e236eb6c292bd1ed336c965391638880f95e7471030bba"
    },
    {
      "id": "cmjwuhwdz003wy1waw7cujyqi",
      "type": "XML",
      "fileName": "PDV-39168380555-2026-01.xml",
      "checksum": "76bc51347f51fde41e923dbdf32b951c5150c60642b2accfccf2706d5606a2ec",
      "storageKey": "attachments/cmjwuht2p0001y1waapq8r3ph/2000/01/0561bd19_76bc51347f51fde41e923dbdf32b951c5150c60642b2accfccf2706d5606a2ec.xml",
      "generatorVersion": "pdv-xml@1",
      "inputHash": "64c1f7ca791e1e06fbb421b39462219bd5cdc255fd69948227e5f1e0c5dfcf67"
    },
    {
      "id": "cmjwuhwez003zy1wa6pmgvru7",
      "type": "XML",
      "fileName": "PDV-39168380555-2026-01.xml",
      "checksum": "76bc51347f51fde41e923dbdf32b951c5150c60642b2accfccf2706d5606a2ec",
      "storageKey": "attachments/cmjwuht2p0001y1waapq8r3ph/2000/01/0561bd19_76bc51347f51fde41e923dbdf32b951c5150c60642b2accfccf2706d5606a2ec.xml",
      "generatorVersion": "pdv-xml@1",
      "inputHash": "64c1f7ca791e1e06fbb421b39462219bd5cdc255fd69948227e5f1e0c5dfcf67"
    }
  ]
}
```

## D) Regression Tests Added

```json
[
  {
    "file": "src/lib/vat/__tests__/money-determinism.test.ts",
    "asserts": "Decimal determinism + rounding stability (no float artifacts)"
  },
  {
    "file": "src/lib/vat/__tests__/input-vat-determinism.test.ts",
    "asserts": "VAT input determinism + deductibility without JS number coercion"
  },
  {
    "file": "src/lib/regulatory-truth/dsl/__tests__/applies-when-decimal-amount.test.ts",
    "asserts": "DSL compares decimal-string amounts deterministically"
  },
  {
    "file": "src/lib/banking/import/__tests__/import-parsed-determinism.test.ts",
    "asserts": "Parsed bank import creates deterministic BankTransaction records"
  },
  {
    "file": "src/lib/fixed-assets/__tests__/asset-candidates-determinism.test.ts",
    "asserts": "Asset-candidate thresholding stays deterministic"
  },
  {
    "file": "src/lib/payroll/__tests__/director-salary-determinism.test.ts",
    "asserts": "Director payroll computation is deterministic"
  },
  {
    "file": "src/lib/audit/__tests__/audit-correlation.test.ts",
    "asserts": "UPDATE audit log includes before/after + correlationId"
  },
  {
    "file": "src/lib/audit/__tests__/immutability-blocked.test.ts",
    "asserts": "Blocked mutations for fiscal invoices, JOPPD, locked periods are rejected and logged"
  },
  {
    "file": "src/lib/audit/__tests__/invoice-payment-mutable.test.ts",
    "asserts": "paidAmount/paymentStatus remain mutable post-issue without breaking invoice immutability"
  },
  {
    "file": "src/lib/next/__tests__/safe-revalidate.test.ts",
    "asserts": "safeRevalidatePath() prevents Next-only crashes in backend services"
  },
  {
    "file": "src/lib/assets/__tests__/tenant-depreciation-schedule.test.ts",
    "asserts": "Tenant isolation does not inject companyId into depreciation schedule/entry writes"
  },
  {
    "file": "src/lib/assets/__tests__/depreciation-period-alignment.test.ts",
    "asserts": "Monthly depreciation aligns to calendar month boundaries for month close"
  }
]
```
