# FiskAI Complete Module Matrix

## Every Scenario, Every Combination, Every Requirement

**Generated:** 2024-12-14
**Purpose:** Definitive guide for all Croatian business accounting scenarios

---

## Part 1: Legal Forms Deep Dive

### 1.1 All Croatian Business Types

| Legal Form          | Croatian Name                          | Min. Capital | Tax Regime   | Accounting Type | Our Code      |
| ------------------- | -------------------------------------- | ------------ | ------------ | --------------- | ------------- |
| Paušalni Obrt       | Paušalno oporezivanje                  | 0            | Flat-rate    | Single-entry    | `OBRT_PAUSAL` |
| Obrt (Dohodak)      | Obrt - realno oporezivanje             | 0            | Income tax   | Single-entry    | `OBRT_REAL`   |
| Obrt (PDV)          | Obrt u sustavu PDV-a                   | 0            | Income + VAT | Single-entry    | `OBRT_VAT`    |
| j.d.o.o.            | Jednostavno d.o.o.                     | 10 HRK       | Corporate    | Double-entry    | `JDOO`        |
| d.o.o.              | Društvo s ograničenom odgovornošću     | 20,000 HRK   | Corporate    | Double-entry    | `DOO`         |
| Slobodna djelatnost | Freelance / Liberal profession         | 0            | Income tax   | Single-entry    | `SLOBODNA` \* |
| OPG                 | Obiteljsko poljoprivredno gospodarstvo | 0            | Special      | Single-entry    | `OPG` \*      |

\*Not yet implemented in system

---

### 1.2 Paušalni Obrt - Complete Requirements

**Who qualifies:**

- Annual revenue ≤ 40,000 EUR
- No employees (owner only)
- Not VAT registered
- Simple service/trade businesses

**Tax treatment:**

- Flat-rate taxation on assumed income
- No need to track actual expenses (for tax purposes)
- Social contributions on assumed income base

**Required modules:**
| Module | Required? | Purpose |
|--------|-----------|---------|
| Invoicing | ✅ YES | Issue invoices to customers |
| KPR (Knjiga Prometa) | ✅ YES | Daily sales record for tax authority |
| PO-SD | ✅ YES | Annual tax return |
| Fiscalization | ⚠️ IF CASH | Required for cash/card payments |
| PDV | ❌ NO | Not in VAT system |
| KPI | ❌ NO | Not needed (flat-rate) |
| URA/IRA | ❌ NO | Not needed |
| JOPPD | ❌ NO | No employees allowed |
| Assets (DI) | ❌ NO | Not tracked for tax |
| Travel (Locco) | ⚠️ OPTIONAL | Personal benefit only |

**Tax calculation (2025 rates):**

```
Assumed Income Base = Revenue × 30% (or actual if lower)
Tax = Progressive rate on assumed income:
  - 0-12,000 EUR: 12%
  - 12,001-30,000 EUR: 20%
  - 30,001+ EUR: 30%

Social Contributions (on assumed income):
  - Pension (MIO I): 15%
  - Disability: 0.5%
  - Health (HZZO): 13.5%
  - Unemployment: 0.5%
  TOTAL: 29.5%
```

**Critical thresholds:**

- 40,000 EUR/year → Must register for VAT within 5 days
- 36,000 EUR/year → Warning (90% of threshold)

---

### 1.3 Obrt Dohodak (Real Income) - Complete Requirements

**Who qualifies:**

- Any revenue level
- Can have employees
- Can be VAT registered or not
- More complex businesses

**Tax treatment:**

- Income tax on actual profit (Revenue - Expenses)
- Must track all income and expenses
- Progressive tax rates apply

**Required modules:**
| Module | Required? | Purpose |
|--------|-----------|---------|
| Invoicing | ✅ YES | Issue invoices |
| KPI (Knjiga Primitaka/Izdataka) | ✅ YES | Income/Expense book |
| URA/IRA | ✅ YES | Invoice registers |
| Assets (DI) | ✅ YES | Depreciation affects profit |
| Fiscalization | ⚠️ IF CASH | Cash/card payments |
| PDV | ⚠️ IF VAT | If VAT registered |
| JOPPD | ⚠️ IF EMPLOYEES | Payroll reporting |
| KPR | ❌ NO | Not applicable |
| PO-SD | ❌ NO | Uses DOH form instead |
| Travel (Locco) | ⚠️ OPTIONAL | Tax deductible |

**Tax calculation:**

```
Taxable Income = Total Revenue - Deductible Expenses - Depreciation
Tax = Progressive rate:
  - 0-12,000 EUR: 12%
  - 12,001-30,000 EUR: 20%
  - 30,001+ EUR: 30%

Surtax (Prirez): City-dependent (0-18%)
```

---

### 1.4 d.o.o. / j.d.o.o. - Complete Requirements

**Key differences:**
| Aspect | j.d.o.o. | d.o.o. |
|--------|----------|--------|
| Minimum capital | 10 HRK | 20,000 HRK |
| Max partners | 3 | Unlimited |
| Must convert to d.o.o. | When capital reaches 20k | N/A |
| Complexity | Lower | Higher |

**Tax treatment:**

- Corporate tax (Porez na dobit): 10% (≤1M EUR) or 18% (>1M EUR)
- Dividend tax: 10% (when distributed to owner)
- Double-entry bookkeeping mandatory
- Full financial statements required

**Required modules:**
| Module | Required? | Purpose |
|--------|-----------|---------|
| Invoicing | ✅ YES | Issue invoices |
| URA/IRA | ✅ YES | Invoice registers (mandatory) |
| PDV | ✅ YES | VAT reporting (mandatory for d.o.o.) |
| Assets (DI) | ✅ YES | Asset register, depreciation |
| JOPPD | ⚠️ IF EMPLOYEES | Payroll reporting |
| Fiscalization | ⚠️ IF CASH | Cash/card payments |
| Travel (Locco) | ⚠️ OPTIONAL | Employee travel expenses |
| KPR | ❌ NO | Not applicable |
| PO-SD | ❌ NO | Uses PDO form instead |
| KPI | ❌ NO | Uses double-entry books |

**Corporate tax:**

```
Profit = Revenue - Expenses - Depreciation - Salaries - Contributions
Tax Rate:
  - ≤1,000,000 EUR profit: 10%
  - >1,000,000 EUR profit: 18%

Dividend distribution:
  - Additional 10% tax when paid to owner
  - Total effective rate: ~19% or ~26.2%
```

---

## Part 2: VAT (PDV) Scenarios

### 2.1 VAT Status Matrix

| Scenario        | VAT Status    | Invoice Requirements             | Reporting |
| --------------- | ------------- | -------------------------------- | --------- |
| Paušalni < 40k  | NOT IN SYSTEM | Must show "Nije u sustavu PDV-a" | None      |
| Paušalni > 40k  | MUST REGISTER | Full VAT invoice                 | PDV forms |
| Obrt voluntary  | IN SYSTEM     | Full VAT invoice                 | PDV forms |
| Obrt > 40k      | MUST REGISTER | Full VAT invoice                 | PDV forms |
| d.o.o. always   | IN SYSTEM     | Full VAT invoice                 | PDV forms |
| j.d.o.o. always | IN SYSTEM     | Full VAT invoice                 | PDV forms |

### 2.2 VAT Rates Detail

| Rate | Name          | Applies To                           |
| ---- | ------------- | ------------------------------------ |
| 25%  | Standard      | Most goods and services              |
| 13%  | Reduced       | Hospitality, newspapers, some food   |
| 5%   | Super-reduced | Bread, milk, books, medicines        |
| 0%   | Zero/Exempt   | Exports, financial services, medical |

### 2.3 VAT Reporting Requirements

**PDV-RR (Regular Return):**

- Monthly (if VAT > 300,000 HRK/year) or Quarterly
- Due: 20th of following month
- Contains: Output VAT, Input VAT, Net payable/refund

**PDV-S (Summary):**

- For intra-EU transactions
- Due: Same as PDV-RR
- Contains: EU sales and purchases

**ZP (Exempt Transactions):**

- When issuing exempt invoices
- Contains: Documentation of exemption basis

### 2.4 Invoice Requirements by VAT Status

**NOT in VAT system:**

```
Must include text:
"Porezni obveznik nije u sustavu PDV-a prema čl. 90. st. 2. Zakona o PDV-u"
OR
"Nije u sustavu PDV-a"

Cannot show:
- VAT breakdown
- VAT registration number
```

**IN VAT system:**

```
Must include:
- Seller VAT ID (HR + OIB)
- Buyer VAT ID (if B2B)
- VAT breakdown by rate
- Tax point date
- Sequential invoice number
```

---

## Part 3: Fiscalization Scenarios

### 3.1 When Fiscalization is Required

| Payment Method       | Fiscalization Required? | Notes              |
| -------------------- | ----------------------- | ------------------ |
| Cash (Gotovina)      | ✅ YES                  | Always             |
| Card (Kartica)       | ✅ YES                  | Always             |
| Bank Transfer        | ❌ NO                   | Invoice-based only |
| Mixed (partial cash) | ✅ YES                  | For cash portion   |
| Advance payment      | ✅ YES                  | If cash/card       |
| Credit (on account)  | ❌ NO                   | Until cash payment |

### 3.2 Fiscalization Flow

```
1. Create Invoice
   ↓
2. Calculate ZKI (Zaštitni Kod Izdavatelja)
   - RSA signature of: OIB + DateTime + InvoiceNo + PremiseCode + DeviceCode + Amount
   - Result: 32-character hex string
   ↓
3. Send to CIS (Tax Authority)
   - Include: Invoice data, ZKI, Payment method
   ↓
4. Receive JIR (Jedinstveni Identifikator Računa)
   - 36-character UUID from tax authority
   ↓
5. Print/Issue Invoice with:
   - ZKI code
   - JIR code
   - QR code (for verification)
```

### 3.3 Business Premises & Devices

**Each business must register:**

- Business Premises (Poslovni prostor): Physical locations
- Payment Devices (Naplatni uređaj): Cash registers, POS terminals

**Numbering format:**

```
Invoice: [PremiseCode]-[DeviceCode]-[SequentialNumber]
Example: OFFICE1-POS1-123
```

### 3.4 Fiscalization Providers

| Provider      | Type          | Certificate        | Notes                       |
| ------------- | ------------- | ------------------ | --------------------------- |
| Direct (FINA) | Direct to CIS | FINA cert required | Most control, complex setup |
| IE-Računi     | Intermediary  | Their cert         | Easier setup, monthly fee   |
| Moj-eRačun    | Intermediary  | Their cert         | Popular in Croatia          |
| Solo          | Intermediary  | Their cert         | Budget option               |

**Current implementation:** IE-Računi + Mock (for testing)

---

## Part 4: Employee & Payroll Scenarios

### 4.1 Employment Types

| Type               | Croatian             | JOPPD Required | Contributions     |
| ------------------ | -------------------- | -------------- | ----------------- |
| Full-time employee | Radnik na neodređeno | ✅ YES         | Full              |
| Fixed-term         | Radnik na određeno   | ✅ YES         | Full              |
| Part-time          | Nepuno radno vrijeme | ✅ YES         | Proportional      |
| Student contract   | Studentski ugovor    | ✅ YES         | Reduced           |
| Service contract   | Ugovor o djelu       | ✅ YES         | Different rates   |
| Author's contract  | Autorski ugovor      | ✅ YES         | Different rates   |
| Board member       | Član uprave          | ✅ YES         | Special rules     |
| Owner (no salary)  | Vlasnik bez plaće    | ❌ NO          | Through dividends |

### 4.2 Salary Calculation (Full Employee)

```
Gross Salary (Bruto plaća)
├── Employee Contributions (from gross):
│   ├── Pension Fund I (MIO I): 15%
│   └── Pension Fund II (MIO II): 5%
│   = 20% total employee contributions
│
├── Taxable Income = Gross - Employee Contributions - Personal Allowance
│   Personal Allowance (Osobni odbitak): 560 EUR/month base
│   + Dependents, disabilities, etc.
│
├── Income Tax (Porez na dohodak):
│   ├── 0 - 4,200 EUR/month: 20%
│   └── > 4,200 EUR/month: 30%
│
├── Surtax (Prirez): City-dependent (0-18%)
│
└── Net Salary = Gross - Contributions - Tax - Surtax

Employer Contributions (on top of gross):
├── Health Insurance (HZZO): 16.5%
└── Total employer cost = Gross × 1.165
```

### 4.3 JOPPD Form Structure

**Page A - Summary:**

- Employer information
- Period covered
- Total amounts
- Number of recipients

**Page B - Individual Recipients:**

- Each employee/contractor listed
- Personal data (OIB, name, address)
- Income type code
- Gross amount
- Contributions breakdown
- Tax calculated
- Net paid

**Submission:**

- Due: By 15th of following month
- Format: XML to ePorezna
- Penalty: Late submission fines

### 4.4 Non-Taxable Receipts (Through JOPPD)

| Type                  | Croatian          | Max Amount       | Reporting |
| --------------------- | ----------------- | ---------------- | --------- |
| Per diem (domestic)   | Dnevnica          | 26.54 EUR/day    | JOPPD     |
| Per diem (foreign)    | Inozemna dnevnica | Country-specific | JOPPD     |
| Mileage (private car) | Naknada za km     | 0.40 EUR/km      | JOPPD     |
| Christmas bonus       | Božićnica         | 663.61 EUR/year  | JOPPD     |
| Holiday bonus         | Regres            | 331.81 EUR/year  | JOPPD     |
| Child gift            | Dar djetetu       | 132.72 EUR/child | JOPPD     |
| Severance             | Otpremnina        | Complex rules    | JOPPD     |

---

## Part 5: Expense & Asset Scenarios

### 5.1 Expense Categories

| Category                | Deductible    | Requires      | Notes                   |
| ----------------------- | ------------- | ------------- | ----------------------- |
| Office rent             | 100%          | Invoice       | R-1 account entry       |
| Utilities               | 100%          | Invoice       | Gas, electricity, water |
| Office supplies         | 100%          | Receipt       | Stationery, consumables |
| Professional services   | 100%          | Invoice       | Accounting, legal       |
| Software subscriptions  | 100%          | Invoice       | SaaS, licenses          |
| Bank fees               | 100%          | Statement     | Monthly charges         |
| Travel (business)       | 100%          | Documentation | Tickets, hotels         |
| Meals (with clients)    | 50%           | Receipt       | Entertainment limit     |
| Meals (solo)            | 0%            | -             | Not deductible          |
| Gifts to clients        | Limited       | Invoice       | Annual limits apply     |
| Fines & penalties       | 0%            | -             | Never deductible        |
| Personal expenses       | 0%            | -             | Never deductible        |
| Vehicle (100% business) | 100%          | Logbook       | Must prove business use |
| Vehicle (mixed use)     | 50% or actual | Logbook       | Track business km       |
| Mobile phone            | 100% or split | Invoice       | Must prove business use |
| Home office             | Proportional  | Calculation   | Based on m² used        |

### 5.2 Fixed Assets (Dugotrajna Imovina)

**Classification:**
| Category | Useful Life | Depreciation Rate |
|----------|-------------|-------------------|
| Buildings | 20-40 years | 2.5-5% |
| Vehicles | 4-5 years | 20-25% |
| Equipment | 4-10 years | 10-25% |
| Computers | 2-4 years | 25-50% |
| Furniture | 5-10 years | 10-20% |
| Software | 2-5 years | 20-50% |
| Intangible assets | 5-10 years | 10-20% |

**Threshold:**

- Asset > 464.53 EUR → Must capitalize and depreciate
- Asset ≤ 464.53 EUR → Can expense immediately (sitni inventar)

**Depreciation methods:**

1. Straight-line (most common): Same amount each year
2. Declining balance: Higher in early years (tax advantageous)

**Example:**

```
Computer: 1,200 EUR
Useful life: 4 years
Annual depreciation: 1,200 / 4 = 300 EUR
Monthly depreciation: 300 / 12 = 25 EUR

Asset Register entry:
- Acquisition date: 2024-01-15
- Acquisition cost: 1,200 EUR
- Accumulated depreciation: 300 EUR (end of year 1)
- Net book value: 900 EUR (end of year 1)
```

### 5.3 Vehicle Scenarios

| Scenario                     | VAT Recovery | Expense Deduction | Notes                 |
| ---------------------------- | ------------ | ----------------- | --------------------- |
| 100% business vehicle        | 100% VAT     | 100% costs        | Requires logbook      |
| Mixed use (no logbook)       | 50% VAT      | 50% costs         | Safe harbor           |
| Mixed use (with logbook)     | Actual %     | Actual %          | Must track every trip |
| Leased vehicle               | As above     | Monthly payments  | Same rules apply      |
| Private vehicle for business | N/A          | 0.40 EUR/km       | Through JOPPD         |

---

## Part 6: Reporting Calendar

### 6.1 Monthly Deadlines

| Day  | What                        | Who                   | Form          |
| ---- | --------------------------- | --------------------- | ------------- |
| 15th | JOPPD submission            | Anyone with employees | XML           |
| 20th | PDV return (monthly filers) | VAT payers > 300k HRK | PDV-RR        |
| Last | Payroll payment             | All employers         | Bank transfer |

### 6.2 Quarterly Deadlines

| When   | What   | Who              | Form   |
| ------ | ------ | ---------------- | ------ |
| Jan 20 | Q4 PDV | Small VAT payers | PDV-RR |
| Apr 20 | Q1 PDV | Small VAT payers | PDV-RR |
| Jul 20 | Q2 PDV | Small VAT payers | PDV-RR |
| Oct 20 | Q3 PDV | Small VAT payers | PDV-RR |

### 6.3 Annual Deadlines

| When   | What                 | Who               | Form            |
| ------ | -------------------- | ----------------- | --------------- |
| Feb 28 | Annual PO-SD         | Paušalni obrt     | XML to ePorezna |
| Apr 30 | Annual DOH           | Obrt dohodak      | XML to ePorezna |
| Apr 30 | Annual PDO           | d.o.o. / j.d.o.o. | XML to ePorezna |
| Jun 30 | Financial statements | d.o.o. / j.d.o.o. | FINA submission |

---

## Part 7: Complete Scenario Matrix

### 7.1 Every Possible Combination

| #   | Legal Form | VAT Status | Cash Sales | Employees | Required Modules                                               |
| --- | ---------- | ---------- | ---------- | --------- | -------------------------------------------------------------- |
| 1   | Paušalni   | No         | No         | No        | Invoicing, KPR, PO-SD                                          |
| 2   | Paušalni   | No         | Yes        | No        | Invoicing, KPR, PO-SD, **Fiscalization**                       |
| 3   | Paušalni   | Yes\*      | No         | No        | Invoicing, KPR, PO-SD, **PDV**                                 |
| 4   | Paušalni   | Yes\*      | Yes        | No        | Invoicing, KPR, PO-SD, **PDV, Fiscalization**                  |
| 5   | Obrt Real  | No         | No         | No        | Invoicing, KPI, URA/IRA, Assets                                |
| 6   | Obrt Real  | No         | Yes        | No        | Invoicing, KPI, URA/IRA, Assets, **Fiscalization**             |
| 7   | Obrt Real  | No         | No         | Yes       | Invoicing, KPI, URA/IRA, Assets, **JOPPD**                     |
| 8   | Obrt Real  | No         | Yes        | Yes       | Invoicing, KPI, URA/IRA, Assets, **Fiscalization, JOPPD**      |
| 9   | Obrt Real  | Yes        | No         | No        | Invoicing, KPI, URA/IRA, Assets, **PDV**                       |
| 10  | Obrt Real  | Yes        | Yes        | No        | Invoicing, KPI, URA/IRA, Assets, **PDV, Fiscalization**        |
| 11  | Obrt Real  | Yes        | No         | Yes       | Invoicing, KPI, URA/IRA, Assets, **PDV, JOPPD**                |
| 12  | Obrt Real  | Yes        | Yes        | Yes       | Invoicing, KPI, URA/IRA, Assets, **PDV, Fiscalization, JOPPD** |
| 13  | j.d.o.o.   | Yes        | No         | No        | Invoicing, URA/IRA, Assets, PDV                                |
| 14  | j.d.o.o.   | Yes        | Yes        | No        | Invoicing, URA/IRA, Assets, PDV, **Fiscalization**             |
| 15  | j.d.o.o.   | Yes        | No         | Yes       | Invoicing, URA/IRA, Assets, PDV, **JOPPD**                     |
| 16  | j.d.o.o.   | Yes        | Yes        | Yes       | Invoicing, URA/IRA, Assets, PDV, **Fiscalization, JOPPD**      |
| 17  | d.o.o.     | Yes        | No         | No        | Invoicing, URA/IRA, Assets, PDV                                |
| 18  | d.o.o.     | Yes        | Yes        | No        | Invoicing, URA/IRA, Assets, PDV, **Fiscalization**             |
| 19  | d.o.o.     | Yes        | No         | Yes       | Invoicing, URA/IRA, Assets, PDV, **JOPPD**                     |
| 20  | d.o.o.     | Yes        | Yes        | Yes       | Invoicing, URA/IRA, Assets, PDV, **Fiscalization, JOPPD**      |

\*Paušalni with VAT = exceeded 40k threshold or voluntary registration

### 7.2 Optional Modules (All Scenarios)

| Module             | Benefit           | Who uses it                 |
| ------------------ | ----------------- | --------------------------- |
| Travel (Locco)     | Tax-deductible km | Anyone with business travel |
| Bank Integration   | Auto-matching     | Anyone wanting automation   |
| Document OCR       | Auto-extraction   | Anyone with paper receipts  |
| Multi-currency     | Foreign invoices  | Exporters, importers        |
| Recurring invoices | Automation        | Subscription businesses     |

---

## Part 8: Current Implementation Status

### 8.1 Module Readiness by Scenario

| Scenario # | Can We Serve? | Missing Modules                                |
| ---------- | ------------- | ---------------------------------------------- |
| 1          | ✅ YES        | None                                           |
| 2          | ⚠️ PARTIAL    | Fiscalization (60%)                            |
| 3          | ⚠️ PARTIAL    | PDV forms (40%)                                |
| 4          | ⚠️ PARTIAL    | PDV forms, Fiscalization                       |
| 5          | ❌ NO         | KPI, URA/IRA, Assets                           |
| 6          | ❌ NO         | KPI, URA/IRA, Assets, Fiscalization            |
| 7          | ❌ NO         | KPI, URA/IRA, Assets, JOPPD                    |
| 8          | ❌ NO         | KPI, URA/IRA, Assets, Fiscalization, JOPPD     |
| 9          | ❌ NO         | KPI, URA/IRA, Assets, PDV forms                |
| 10         | ❌ NO         | KPI, URA/IRA, Assets, PDV forms, Fiscalization |
| 11         | ❌ NO         | KPI, URA/IRA, Assets, PDV forms, JOPPD         |
| 12         | ❌ NO         | Everything except Invoicing                    |
| 13         | ❌ NO         | URA/IRA, Assets, PDV forms                     |
| 14         | ❌ NO         | URA/IRA, Assets, PDV forms, Fiscalization      |
| 15         | ❌ NO         | URA/IRA, Assets, PDV forms, JOPPD              |
| 16         | ❌ NO         | Everything except Invoicing                    |
| 17         | ❌ NO         | URA/IRA, Assets, PDV forms                     |
| 18         | ❌ NO         | URA/IRA, Assets, PDV forms, Fiscalization      |
| 19         | ❌ NO         | URA/IRA, Assets, PDV forms, JOPPD              |
| 20         | ❌ NO         | Everything except Invoicing                    |

### 8.2 Implementation Priority

**Tier 1 - Launch for Paušalni (Scenarios 1-2):**

- [x] Invoicing (80%)
- [x] KPR (100%)
- [x] PO-SD (100%)
- [ ] Fiscalization polish (60% → 90%)

**Tier 2 - Unlock Obrt Dohodak (Scenarios 5-12):**

- [ ] KPI (0% → 100%)
- [ ] URA/IRA (30% → 100%)
- [ ] Assets DI (0% → 100%)

**Tier 3 - Unlock d.o.o. (Scenarios 13-20):**

- [ ] PDV forms (40% → 100%)
- [ ] Full URA/IRA

**Tier 4 - Premium Features:**

- [ ] JOPPD (0% → 100%)
- [ ] Travel/Locco (0% → 100%)

---

## Part 9: Onboarding Decision Tree

```
START
  │
  ▼
┌─────────────────────────────────────┐
│ Q1: What is your legal form?        │
│ ○ Paušalni obrt                     │
│ ○ Obrt (dohodak)                    │
│ ○ j.d.o.o.                          │
│ ○ d.o.o.                            │
└─────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────┐
│ Q2: Are you in VAT system (PDV)?    │
│ ○ Yes                               │
│ ○ No                                │
│ ○ Not sure (we'll check revenue)    │
└─────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────┐
│ Q3: Do you accept cash or cards?    │
│ ○ Yes (gotovina/kartica)            │
│ ○ No (only bank transfers)          │
└─────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────┐
│ Q4: Do you have employees?          │
│ ○ Yes                               │
│ ○ No (owner only)                   │
│ ○ Planning to hire soon             │
└─────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────┐
│ Q5: Do you use a vehicle for work?  │
│ ○ Yes, company vehicle              │
│ ○ Yes, private vehicle              │
│ ○ No                                │
└─────────────────────────────────────┘
  │
  ▼
AUTO-CONFIGURE MODULES BASED ON ANSWERS
```

**Configuration Logic:**

```javascript
function configureModules(answers) {
  const modules = {
    invoicing: true, // Always
    kpr: answers.legalForm === "PAUSAL",
    kpi: ["OBRT_REAL", "OBRT_VAT"].includes(answers.legalForm),
    posd: answers.legalForm === "PAUSAL",
    pdv: answers.isVatPayer || ["DOO", "JDOO"].includes(answers.legalForm),
    uraIra: answers.legalForm !== "PAUSAL",
    fiscalization: answers.acceptsCash,
    joppd: answers.hasEmployees,
    assets: answers.legalForm !== "PAUSAL",
    travel: answers.usesVehicle,
  }

  return modules
}
```

---

## Part 10: Data Model Requirements

### 10.1 Missing Database Models

```prisma
// KPI - Income/Expense Book
model KPIEntry {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id])
  date          DateTime
  type          KPIType  // INCOME or EXPENSE
  documentType  String   // INVOICE, RECEIPT, BANK_STATEMENT
  documentId    String?  // Reference to source document
  description   String
  amount        Decimal
  paymentMethod String   // G, K, T, O
  category      String?
  createdAt     DateTime @default(now())
}

enum KPIType {
  INCOME
  EXPENSE
}

// Fixed Assets
model FixedAsset {
  id                String   @id @default(cuid())
  companyId         String
  company           Company  @relation(fields: [companyId], references: [id])
  name              String
  category          AssetCategory
  acquisitionDate   DateTime
  acquisitionCost   Decimal
  usefulLifeMonths  Int
  depreciationMethod DepreciationMethod
  salvageValue      Decimal  @default(0)
  disposalDate      DateTime?
  disposalAmount    Decimal?
  status            AssetStatus
  createdAt         DateTime @default(now())
  depreciationEntries DepreciationEntry[]
}

enum AssetCategory {
  BUILDING
  VEHICLE
  EQUIPMENT
  COMPUTER
  FURNITURE
  SOFTWARE
  INTANGIBLE
  OTHER
}

enum DepreciationMethod {
  STRAIGHT_LINE
  DECLINING_BALANCE
}

enum AssetStatus {
  ACTIVE
  DISPOSED
  FULLY_DEPRECIATED
}

model DepreciationEntry {
  id          String     @id @default(cuid())
  assetId     String
  asset       FixedAsset @relation(fields: [assetId], references: [id])
  period      DateTime   // Month/Year
  amount      Decimal
  accumulated Decimal
  netBookValue Decimal
  createdAt   DateTime   @default(now())
}

// Employee & Payroll
model Employee {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id])
  oib           String
  firstName     String
  lastName      String
  email         String?
  startDate     DateTime
  endDate       DateTime?
  contractType  ContractType
  workHours     Decimal  // Weekly hours
  grossSalary   Decimal
  bankAccount   String?
  status        EmployeeStatus
  createdAt     DateTime @default(now())
  payrolls      Payroll[]
}

enum ContractType {
  FULL_TIME
  PART_TIME
  FIXED_TERM
  STUDENT
  SERVICE
  AUTHOR
  BOARD_MEMBER
}

enum EmployeeStatus {
  ACTIVE
  ON_LEAVE
  TERMINATED
}

model Payroll {
  id                String   @id @default(cuid())
  companyId         String
  company           Company  @relation(fields: [companyId], references: [id])
  employeeId        String
  employee          Employee @relation(fields: [employeeId], references: [id])
  period            DateTime // Month/Year
  grossSalary       Decimal
  pensionI          Decimal  // 15%
  pensionII         Decimal  // 5%
  healthInsurance   Decimal  // Employer: 16.5%
  taxableIncome     Decimal
  incomeTax         Decimal
  surtax            Decimal
  netSalary         Decimal
  totalEmployerCost Decimal
  status            PayrollStatus
  joppdSubmitted    Boolean  @default(false)
  joppdSubmittedAt  DateTime?
  createdAt         DateTime @default(now())
}

enum PayrollStatus {
  DRAFT
  CALCULATED
  APPROVED
  PAID
}

// Travel Orders
model TravelOrder {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id])
  employeeId    String?
  employee      Employee? @relation(fields: [employeeId], references: [id])
  orderNumber   String
  destination   String
  purpose       String
  departureDate DateTime
  returnDate    DateTime
  vehicleType   VehicleType
  distanceKm    Decimal?
  perDiemDays   Decimal?
  perDiemRate   Decimal?
  mileageRate   Decimal? // 0.40 EUR/km
  totalAmount   Decimal
  status        TravelStatus
  createdAt     DateTime @default(now())
  expenses      TravelExpense[]
}

enum VehicleType {
  COMPANY_CAR
  PRIVATE_CAR
  PUBLIC_TRANSPORT
  PLANE
  OTHER
}

enum TravelStatus {
  DRAFT
  APPROVED
  COMPLETED
  CANCELLED
}

model TravelExpense {
  id            String      @id @default(cuid())
  travelOrderId String
  travelOrder   TravelOrder @relation(fields: [travelOrderId], references: [id])
  type          String      // ACCOMMODATION, TRANSPORT, MEALS, OTHER
  description   String
  amount        Decimal
  receiptUrl    String?
  createdAt     DateTime    @default(now())
}
```

---

## Part 11: API Endpoints Needed

### 11.1 KPI Module

```
POST   /api/kpi/entries          - Create entry
GET    /api/kpi/entries          - List entries (with filters)
GET    /api/kpi/entries/:id      - Get single entry
PUT    /api/kpi/entries/:id      - Update entry
DELETE /api/kpi/entries/:id      - Delete entry
GET    /api/kpi/report           - Generate KPI report
GET    /api/kpi/export/csv       - Export to CSV
GET    /api/kpi/export/xml       - Export to XML (tax format)
```

### 11.2 Assets Module

```
POST   /api/assets               - Create asset
GET    /api/assets               - List assets
GET    /api/assets/:id           - Get asset details
PUT    /api/assets/:id           - Update asset
DELETE /api/assets/:id           - Dispose asset
POST   /api/assets/:id/depreciate - Run depreciation
GET    /api/assets/report        - Asset register report
GET    /api/assets/depreciation  - Depreciation schedule
```

### 11.3 Payroll Module

```
POST   /api/employees            - Create employee
GET    /api/employees            - List employees
PUT    /api/employees/:id        - Update employee
POST   /api/payroll/calculate    - Calculate monthly payroll
GET    /api/payroll              - List payrolls
POST   /api/payroll/approve      - Approve payroll
POST   /api/payroll/pay          - Mark as paid
GET    /api/joppd/generate       - Generate JOPPD XML
POST   /api/joppd/submit         - Submit to ePorezna
```

### 11.4 Travel Module

```
POST   /api/travel/orders        - Create travel order
GET    /api/travel/orders        - List orders
PUT    /api/travel/orders/:id    - Update order
POST   /api/travel/orders/:id/approve - Approve
POST   /api/travel/orders/:id/expenses - Add expense
GET    /api/travel/report        - Monthly travel report
```

### 11.5 VAT Module

```
GET    /api/vat/summary          - VAT summary
GET    /api/vat/pdv-rr           - Generate PDV-RR form
GET    /api/vat/pdv-s            - Generate PDV-S form
GET    /api/vat/export/xml       - Export for ePorezna
```

### 11.6 URA/IRA Module

```
GET    /api/ura                  - Incoming invoice register
GET    /api/ira                  - Outgoing invoice register
GET    /api/ura/export           - Export URA
GET    /api/ira/export           - Export IRA
```

---

## Summary

This document covers **20 distinct business scenarios** across:

- 5 legal forms
- 2 VAT statuses
- 2 cash handling options
- 2 employee options

Current system can serve: **Scenario 1 only** (Paušalni, no VAT, no cash)
With fiscalization polish: **Scenarios 1-2**
Full market coverage requires: **All 20 scenarios**

**Development effort estimate:**

- KPI: 1-2 weeks
- URA/IRA: 1 week
- Assets: 2 weeks
- PDV forms: 2 weeks
- JOPPD: 3-4 weeks
- Travel: 2 weeks

**Total to full coverage: ~12 weeks of focused development**

---

## Part 12: Proposed Development Vision

This section outlines a strategic vision for the development of FiskAI, building upon the excellent foundation of the existing codebase and the comprehensive plan detailed in this document. The vision is based on five key pillars designed to ensure a high-quality, scalable, and market-leading product.

### Pillar 1: Foundational Excellence & Iterative Delivery

The existing codebase demonstrates a high standard of quality, security, and architectural design. This standard must be maintained and propagated as new modules are developed. Instead of a "big bang" approach, development should be iterative. Each module (KPI, Assets, JOPPD, etc.) should be treated as a mini-project: built, tested, and polished before moving to the next. This ensures a steady delivery of value and maintains application stability.

### Pillar 2: A Component-Driven, Accessible-First UI

The audit revealed opportunities to improve UI development. To accelerate the creation of the many new interfaces required, the project should formally adopt a "design system" approach.

- **Immediate Action:** Standardize on a headless UI library (e.g., **Radix UI** or **Headless UI**). All new complex components (modals, tables, dropdowns, forms) should be built using these accessible, unstyled primitives.
- **Benefit:** This will dramatically increase development speed, ensure WCAG-compliant accessibility out-of-the-box, and guarantee a consistent user experience across the entire application. It offloads the hardest parts of UI engineering, allowing the team to focus on business logic and styling.

### Pillar 3: Test-Driven Quality Assurance

The application's complexity will grow exponentially with each new module. To manage this, a rigorous, automated testing culture is not just recommended—it is essential.

- **Immediate Action:** Fix the `vitest` integration and add the `test` script to the CI pipeline.
- **Core Practice:** For every new feature, the detailed "Testing Checklist" in the implementation plans should be used as a blueprint for writing **automated tests**. This includes unit tests for business logic, integration tests for API endpoints, and end-to-end tests for critical user flows. A Test-Driven Development (TDD) or Behavior-Driven Development (BDD) approach would be highly beneficial here.

### Pillar 4: AI as a Core Differentiator

The "AI" in FiskAI should be a core part of the user experience, not a feature bolted on at the end. As each new module is built, we should ideate on where AI can provide the most value.

- **KPI Module:** AI can suggest expense categories based on the entry description.
- **Assets Module:** AI can suggest the depreciation category and useful life based on the asset name.
- **URA/IRA (Invoices):** AI can be used for OCR to automatically extract data from uploaded PDF invoices and receipts, pre-filling data entry forms.
  By integrating AI from the beginning, FiskAI will build a powerful, intelligent platform that stands out in the market.

### Pillar 5: Phased Market Expansion

The tiered implementation plan should be mirrored by a phased go-to-market strategy. This turns the development roadmap into a series of strategic business milestones.

- **Phase 1 (Current):** Perfect the `Paušalni obrt` offering (Tier 1). Launch with this focused niche to gather real-world user feedback and build a strong foundation.
- **Phase 2 (Q1-Q2):** Complete `Obrt Dohodak` features (Tier 2). This unlocks a significantly larger market segment. Launch a targeted marketing campaign to attract these new users.
- **Phase 3 (Q2-Q3):** Complete `d.o.o.` features (Tier 3). This achieves full market coverage for core accounting.
- **Phase 4 (Q4):** Focus on premium, high-value features like Payroll (JOPPD) and advanced reporting (Tier 4), which can be used to upsell existing customers.

By following these pillars, FiskAI can systematically evolve from its current MVP state into the comprehensive, AI-powered, and market-leading platform envisioned in this document, all while maintaining an exceptionally high standard of quality and stability.

---

## Part 13: Para-Fiscal & Administrative Layer

> **Critical Insight:** Clients don't just ask about taxes; they ask about membership fees, hidden contributions, and "what do I write on this payment slip?" To be a true "Single Source of Truth" and eliminate phone calls to accountants, this layer is essential.

### 13.1 Hidden Annual Obligations (Para-Fiscal Charges)

The tax matrix covers Porezna (Tax Authority) and HZZO/MIO (Health/Pension), but businesses have OTHER mandatory payments that cause confusion.

#### Turistička Članarina (Tourist Board Fee) - TZ-2

| Aspect          | Details                                              |
| --------------- | ---------------------------------------------------- |
| **Who pays**    | Almost everyone: Paušalni, Obrt, d.o.o.              |
| **Calculation** | Total Revenue × Rate (varies by location & activity) |
| **Form**        | TZ-2 (Annual)                                        |
| **Due date**    | January 31st for previous year                       |
| **Rate range**  | 0.01% - 0.15% depending on NKD code                  |

**Required data:**

- NKD Code (Nacionalna klasifikacija djelatnosti) - Activity classification
- County/City of business location
- Total annual revenue

**Common client question:** "Do I have to pay this? How much?"

**Implementation:**

```
Required fields in Company settings:
- nkdCode: String (e.g., "62.01" for software development)
- countyCode: String (e.g., "21" for Zagreb)

Calculation:
turistickaRate = lookupRate(nkdCode, countyCode)
turistickaClanarina = annualRevenue × turistickaRate
```

#### HOK Komorski Doprinos (Chamber of Trades)

| Aspect       | Details                                              |
| ------------ | ---------------------------------------------------- |
| **Who pays** | All Obrts (Paušalni & Dohodak) - MANDATORY           |
| **Amount**   | Fixed quarterly fee (~25 EUR/quarter, ~100 EUR/year) |
| **Payment**  | Quarterly                                            |
| **IBAN**     | HR12 2340 0091 1001 0623 7 (HOK)                     |

**Implementation:**

- Add quarterly reminder notification
- Generate payment slip with correct "Poziv na broj"
- Format: HR68 OIB-[QUARTER][YEAR]

**Common client question:** "What's this HOK thing? Do I have to pay it?"

#### HGK Članarina (Chamber of Economy)

| Aspect            | Details                                                    |
| ----------------- | ---------------------------------------------------------- |
| **Who pays**      | d.o.o. / j.d.o.o.                                          |
| **Status**        | Usually VOLUNTARY for small companies (Group 1) since 2022 |
| **Mandatory for** | Large companies (>50 employees or >10M EUR revenue)        |

**Implementation:**

- Default to OFF for small clients
- Allow opt-in if they want HGK benefits (networking, certificates)
- Show: "Based on your size, HGK membership is voluntary"

#### OKFŠ (Forestry Contribution - Općekorisne funkcije šuma)

| Aspect        | Details                                                   |
| ------------- | --------------------------------------------------------- |
| **Who pays**  | d.o.o./j.d.o.o. and Obrt Dohodak                          |
| **Threshold** | Revenue > ~7.5M HRK (~1M EUR) - rare for small businesses |
| **Rate**      | 0.0265% of revenue                                        |

**Implementation:**

- Simple threshold check
- Display: "Your revenue is under threshold. You are exempt from OKFŠ." (Peace of mind)

### 13.2 Para-Fiscal Obligations Matrix

| Obligation               | Paušalni    | Obrt Dohodak | j.d.o.o.    | d.o.o.      | Frequency | Status             |
| ------------------------ | ----------- | ------------ | ----------- | ----------- | --------- | ------------------ |
| Turistička članarina     | ✅ YES      | ✅ YES       | ✅ YES      | ✅ YES      | Annual    | ❌ NOT IMPLEMENTED |
| HOK (Chamber of Trades)  | ✅ YES      | ✅ YES       | ❌ NO       | ❌ NO       | Quarterly | ❌ NOT IMPLEMENTED |
| HGK (Chamber of Economy) | ❌ NO       | ❌ NO        | ⚠️ Optional | ⚠️ Optional | Annual    | ❌ NOT IMPLEMENTED |
| OKFŠ (Forestry)          | ❌ NO       | ⚠️ If >1M    | ⚠️ If >1M   | ⚠️ If >1M   | Annual    | ❌ NOT IMPLEMENTED |
| Spomenička renta         | ⚠️ Location | ⚠️ Location  | ⚠️ Location | ⚠️ Location | Annual    | ❌ NOT IMPLEMENTED |

---

## Part 14: Payment Execution Layer (Hub3 Barcodes)

> **The Problem:** Clients don't just want to know WHAT they owe; they want to PAY IT INSTANTLY with the correct reference number.

### 14.1 Why This Matters

The Tax Authority (Porezna) uses different "Poziv na broj" (Reference) formats for different payments:

- Income Tax: Different format
- VAT: Different format
- Pension contributions: Different format
- Health contributions: Different format

**If they pay with wrong reference → Tax Authority shows "DEBT" → Client panics → Calls accountant**

### 14.2 Payment Reference Formats (HR Model)

| Payment Type                  | Model | Poziv na broj Format | IBAN                       |
| ----------------------------- | ----- | -------------------- | -------------------------- |
| Income Tax (Porez na dohodak) | HR68  | OIB-[GGGG][MM][DD]   | HR12 1001 0051 8630 0016 0 |
| VAT (PDV)                     | HR68  | OIB-[GGGG][MM][DD]   | HR12 1001 0051 8630 0016 0 |
| Pension I (MIO I)             | HR68  | OIB-[GGGG][MM]       | HR12 1001 0051 8630 0016 0 |
| Pension II (MIO II)           | HR68  | OIB-[GGGG][MM]       | HR87 2407 0001 0071 2001 3 |
| Health (HZZO)                 | HR68  | OIB-[GGGG][MM]       | HR12 1001 0051 8630 0016 0 |
| HOK membership                | HR68  | OIB-[Q][GGGG]        | HR12 2340 0091 1001 0623 7 |
| Turistička zajednica          | HR67  | OIB-[GGGG]           | Varies by county           |

### 14.3 Hub3 2D Barcode Generation

**Hub3 Standard Fields:**

```
HRVHUB30
[Currency]
[Amount in cents, 15 digits, zero-padded]
[Sender Name]
[Sender Address]
[Sender City]
[Receiver Name]
[Receiver Address]
[Receiver City]
[Receiver IBAN]
[Model]
[Reference]
[Purpose Code]
[Description]
```

**Example for Monthly MIO I Payment:**

```
HRVHUB30
EUR
000000012500              // 125.00 EUR
IVAN HORVAT
ILICA 123
10000 ZAGREB
DRŽAVNI PRORAČUN RH
KATANČIĆEVA 5
10000 ZAGREB
HR1210010051863000160
HR68
12345678901-202412       // OIB-YYYYMM
OTHR
MIO I DOPRINOS 12/2024
```

### 14.4 Required Implementation

| Feature          | Description                                | Priority |
| ---------------- | ------------------------------------------ | -------- |
| Payment Calendar | Show upcoming payments with amounts        | HIGH     |
| Hub3 Generator   | Generate scannable barcode for any payment | HIGH     |
| One-Click Pay    | Open banking app with pre-filled payment   | MEDIUM   |
| Payment History  | Track what was paid, when, reference used  | HIGH     |
| Smart Reminders  | Notify 5 days before each deadline         | HIGH     |

### 14.5 Monthly Payment Schedule Generator

**For Paušalni Obrt:**

```
Monthly Obligations:
├── MIO I (Pension Fund I): [calculated] EUR
│   └── [Generate Hub3 Barcode]
├── MIO II (Pension Fund II): [calculated] EUR
│   └── [Generate Hub3 Barcode]
├── HZZO (Health Insurance): [calculated] EUR
│   └── [Generate Hub3 Barcode]
└── Total: [sum] EUR
    └── [Generate Combined Payment]

Quarterly Obligations:
├── HOK Membership: ~25 EUR
│   └── [Generate Hub3 Barcode]
└── Tax Advance: [calculated] EUR
    └── [Generate Hub3 Barcode]
```

---

## Part 15: Threshold Monitors ("Traffic Light" Dashboard)

> **Purpose:** Answer "Can I do X?" BEFORE they ask. Proactive alerts prevent surprises.

### 15.1 Critical Thresholds to Monitor

#### VAT Registration Threshold (Already Partially Implemented)

| Level       | Threshold           | Action                                                |
| ----------- | ------------------- | ----------------------------------------------------- |
| 🟢 Safe     | < 36,000 EUR        | "You're safely under the VAT threshold"               |
| 🟡 Warning  | 36,000 - 39,999 EUR | "You're approaching VAT threshold (90%). Plan ahead." |
| 🔴 Exceeded | ≥ 40,000 EUR        | "VAT threshold exceeded! Register within 5 days."     |

#### Paušalni Tax Bracket Monitor (NEW)

| Bracket | Income Range        | Quarterly Tax | Monthly Contributions |
| ------- | ------------------- | ------------- | --------------------- |
| 1       | 0 - 12,000 EUR      | Base rate     | Lower base            |
| 2       | 12,001 - 30,000 EUR | +66% increase | Higher base           |
| 3       | 30,001 - 40,000 EUR | +50% increase | Highest base          |

**Alert Example:**

> "You have entered Bracket 2 with invoice #47. Your quarterly tax will increase from X EUR to Y EUR starting next quarter. This is normal - you're growing!"

#### Cash Payment Limit (B2B)

| Limit     | Amount  | Consequence                        |
| --------- | ------- | ---------------------------------- |
| Legal max | 700 EUR | Fines for both parties if exceeded |

**Alert Example:**

> ⚠️ "This cash expense (850 EUR) exceeds the 700 EUR B2B cash limit. Consider bank transfer to avoid penalties."

#### Distance Selling / OSS Threshold (EU Digital Sales)

| Limit   | Amount     | Trigger                            |
| ------- | ---------- | ---------------------------------- |
| EU-wide | 10,000 EUR | Cross-border sales to EU consumers |

**When exceeded:**

- Must register for OSS (One-Stop-Shop)
- Charge destination country VAT rates
- File quarterly OSS returns

**Alert Example:**

> "Your EU consumer sales have reached 8,500 EUR. At 10,000 EUR, you must register for OSS. We can help you prepare."

#### Fiscalization Transaction Limits

| Scenario                | Limit          | Note                                |
| ----------------------- | -------------- | ----------------------------------- |
| Single cash transaction | No legal limit | But unusual patterns trigger audits |
| Daily cash deposits     | 10,000+ EUR    | Bank reports to authorities         |

### 15.2 Dashboard Implementation

```
┌─────────────────────────────────────────────────────────────┐
│  📊 THRESHOLD MONITOR                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  VAT Threshold (40,000 EUR)                                │
│  ████████████████████░░░░░░░░░░  32,450 EUR (81%)  🟢      │
│  Remaining: 7,550 EUR                                       │
│                                                             │
│  Tax Bracket                                                │
│  Currently: Bracket 1 (0-12,000 EUR)                       │
│  ████████████████████████████░░  11,200 EUR (93%)  🟡      │
│  800 EUR until Bracket 2                                    │
│                                                             │
│  EU Sales (OSS Threshold: 10,000 EUR)                      │
│  ████░░░░░░░░░░░░░░░░░░░░░░░░░░  1,250 EUR (12%)   🟢      │
│                                                             │
│  Cash Payments This Month                                   │
│  No B2B cash payments over 700 EUR                    ✅    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 16: Education & Document Storage

> **Goal:** Embed answers directly in UI context. Be the "Single Source of Truth."

### 16.1 Contextual Help Tooltips

| Field/Feature                 | Tooltip Content                                                       |
| ----------------------------- | --------------------------------------------------------------------- |
| Reprezentacija (Client meals) | "Only 50% deductible. Write client's name & company on receipt back." |
| Locco Travel                  | "Must attach: odometer reading, trip purpose, destination."           |
| Home Office Expense           | "Calculate: (Office m² ÷ Total m²) × Utility cost"                    |
| Vehicle Expense               | "Keep logbook for 100% deduction, or claim 50% without proof."        |
| Cash Expense >500 EUR         | "Ensure you have proper documentation. >700 EUR B2B = illegal."       |
| Dar (Gift to client)          | "Max 160 HRK per gift. Must record recipient name."                   |
| Depreciation                  | "Assets >3,500 HRK (464 EUR) must be depreciated over useful life."   |

### 16.2 Document Vault (Regulatory Documents)

Clients constantly lose important documents. Store them in-app:

| Document Type                      | Description                   | Who Needs It    |
| ---------------------------------- | ----------------------------- | --------------- |
| Rješenje o paušalnom porezu        | Tax ruling for paušalni       | Paušalni        |
| Rješenje o upisu u obrtni registar | Trade registration            | All Obrts       |
| MIO/HZZO prijava                   | Social insurance registration | Everyone        |
| Izvadak iz sudskog registra        | Court registry extract        | d.o.o./j.d.o.o. |
| OIB potvrda                        | OIB certificate               | Everyone        |
| FINA certifikat                    | Fiscalization certificate     | If fiscalizing  |
| PDV prijava                        | VAT registration              | VAT payers      |
| NKD klasifikacija                  | Activity classification       | Everyone        |

**Features:**

- Upload/download official documents
- Expiry tracking (certificates)
- Quick access when needed for applications/banks

### 16.3 Knowledge Base Integration

| Section     | Content Type                                 |
| ----------- | -------------------------------------------- |
| FAQ         | "Do I need to pay turistička članarina?"     |
| Guides      | "How to claim home office expenses"          |
| Calculators | "Estimate my quarterly tax"                  |
| Deadlines   | "When is PO-SD due?"                         |
| Forms       | Downloadable blank forms (TZ-2, JOPPD, etc.) |

---

## Part 17: Updated Implementation Priority

### 17.1 Complete Module List (Including Para-Fiscal)

| Module                   | Category    | Paušalni | Obrt | d.o.o. | Status | Effort  |
| ------------------------ | ----------- | -------- | ---- | ------ | ------ | ------- |
| Invoicing                | Core        | ✅       | ✅   | ✅     | 80%    | -       |
| Fiscalization            | Core        | ⚠️       | ⚠️   | ⚠️     | 60%    | 1 week  |
| KPR                      | Track       | ✅       | ❌   | ❌     | 100%   | Done    |
| KPI                      | Track       | ❌       | ✅   | ❌     | 0%     | 2 weeks |
| PO-SD                    | Report      | ✅       | ❌   | ❌     | 100%   | Done    |
| PDV Forms                | Report      | ❌       | ⚠️   | ✅     | 40%    | 2 weeks |
| JOPPD                    | Report      | ❌       | ⚠️   | ⚠️     | 0%     | 4 weeks |
| URA/IRA                  | Report      | ❌       | ✅   | ✅     | 30%    | 1 week  |
| Assets (DI)              | Track       | ❌       | ✅   | ✅     | 0%     | 2 weeks |
| Travel/Locco             | Track       | ⚠️       | ⚠️   | ⚠️     | 0%     | 2 weeks |
| **Turistička članarina** | Para-fiscal | ✅       | ✅   | ✅     | 0%     | 3 days  |
| **HOK membership**       | Para-fiscal | ✅       | ✅   | ❌     | 0%     | 2 days  |
| **HGK membership**       | Para-fiscal | ❌       | ❌   | ⚠️     | 0%     | 1 day   |
| **Payment Hub3**         | Utility     | ✅       | ✅   | ✅     | 0%     | 1 week  |
| **Threshold Monitor**    | Utility     | ✅       | ✅   | ✅     | 40%    | 3 days  |
| **Document Vault**       | Utility     | ✅       | ✅   | ✅     | 0%     | 1 week  |
| **Contextual Help**      | UX          | ✅       | ✅   | ✅     | 0%     | 1 week  |

### 17.2 Revised Development Roadmap

**Phase 1: Perfect Paušalni (2 weeks)**

- [ ] Fiscalization polish (FINA cert or IE-Računi production)
- [ ] Payment Hub3 generator (MIO, HZZO, Tax)
- [ ] HOK membership reminders
- [ ] Turistička članarina calculator
- [ ] Threshold monitor (VAT + Bracket)
- [ ] Contextual help tooltips

**Phase 2: Unlock Obrt Dohodak (4 weeks)**

- [ ] KPI (Knjiga Primitaka/Izdataka)
- [ ] URA/IRA report generators
- [ ] Assets (DI) module
- [ ] Document vault

**Phase 3: Full d.o.o. Support (4 weeks)**

- [ ] Complete PDV forms (PDV-RR, PDV-S, ZP)
- [ ] HGK membership handling
- [ ] Enhanced URA/IRA

**Phase 4: Premium Features (6 weeks)**

- [ ] JOPPD (Payroll)
- [ ] Travel/Locco module
- [ ] OSS threshold monitoring
- [ ] Advanced analytics

### 17.3 Quick Wins (Can Do This Week)

| Feature                          | Effort  | Impact                     |
| -------------------------------- | ------- | -------------------------- |
| Add NKD code to company settings | 1 hour  | Enables TZ calculation     |
| Hub3 barcode generator utility   | 1 day   | Huge UX improvement        |
| HOK payment reminder             | 2 hours | Prevents missed payments   |
| Cash limit warning (>700 EUR)    | 2 hours | Prevents legal issues      |
| Bracket jump notification        | 4 hours | Reduces surprise tax bills |

---

## Part 18: Database Schema Additions

### 18.1 Para-Fiscal Tracking

```prisma
// Add to Company model
model Company {
  // ... existing fields ...

  // Para-fiscal data
  nkdCode           String?   // Activity classification (e.g., "62.01")
  nkdDescription    String?   // "Computer programming"
  countyCode        String?   // Location for TZ rate lookup
  hokMember         Boolean   @default(true)  // For Obrts
  hgkMember         Boolean   @default(false) // Optional for d.o.o.

  // Relationships
  paraFiscalPayments ParaFiscalPayment[]
  documentVault      StoredDocument[]
}

model ParaFiscalPayment {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id])
  type          ParaFiscalType
  year          Int
  quarter       Int?     // For quarterly payments
  amount        Decimal
  dueDate       DateTime
  paidDate      DateTime?
  reference     String   // Poziv na broj
  status        PaymentStatus
  createdAt     DateTime @default(now())
}

enum ParaFiscalType {
  TURISTICKA_ZAJEDNICA
  HOK_CLANARINA
  HGK_CLANARINA
  OKFS
  SPOMENICKA_RENTA
}

enum PaymentStatus {
  PENDING
  PAID
  OVERDUE
}

model StoredDocument {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id])
  type          DocumentType
  name          String
  description   String?
  fileUrl       String
  expiresAt     DateTime?  // For certificates
  uploadedAt    DateTime   @default(now())
  uploadedBy    String
}

enum DocumentType {
  RJESENJE_PAUSALNI
  RJESENJE_OBRT
  MIO_PRIJAVA
  HZZO_PRIJAVA
  SUDSKI_IZVADAK
  OIB_POTVRDA
  FINA_CERTIFIKAT
  PDV_PRIJAVA
  NKD_KLASIFIKACIJA
  OTHER
}

// Threshold alerts
model ThresholdAlert {
  id            String   @id @default(cuid())
  companyId     String
  company       Company  @relation(fields: [companyId], references: [id])
  type          ThresholdType
  currentValue  Decimal
  thresholdValue Decimal
  percentage    Decimal
  level         AlertLevel  // GREEN, YELLOW, RED
  message       String
  acknowledgedAt DateTime?
  createdAt     DateTime @default(now())
}

enum ThresholdType {
  VAT_REGISTRATION
  TAX_BRACKET
  OSS_EU_SALES
  CASH_PAYMENT_LIMIT
}

enum AlertLevel {
  GREEN
  YELLOW
  RED
}
```

---

## Summary: From Accounting Software to Virtual CFO

| Layer                    | Purpose                     | Status |
| ------------------------ | --------------------------- | ------ |
| **Core Accounting**      | Invoices, Expenses, Reports | 70%    |
| **Tax Compliance**       | PDV, PO-SD, JOPPD           | 50%    |
| **Para-Fiscal**          | TZ, HOK, HGK, OKFŠ          | 0%     |
| **Payment Execution**    | Hub3 barcodes, references   | 0%     |
| **Threshold Monitoring** | Proactive alerts            | 40%    |
| **Document Management**  | Regulatory doc storage      | 0%     |
| **Education**            | Contextual help, guides     | 0%     |

**With these additions, FiskAI becomes:**

- ✅ Their accountant (books, taxes)
- ✅ Their CFO (cash flow, planning)
- ✅ Their compliance officer (deadlines, limits)
- ✅ Their administrative assistant (payments, documents)

**Total development to "Virtual CFO" status: ~16 weeks**
