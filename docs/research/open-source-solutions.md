# Open Source Invoicing & ERP Solutions - Research

## Purpose

Evaluate open-source projects we can learn from, potentially fork, or use as reference implementations for FiskAI. Focus on TypeScript/React projects where possible.

---

## Top Candidates

### 1. IDURAR ERP/CRM

**GitHub**: [github.com/idurar/idurar-erp-crm](https://github.com/idurar/idurar-erp-crm)
**Stars**: 5.3k
**License**: Free for personal/commercial use

**Tech Stack**:

- Backend: Node.js + Express.js
- Database: MongoDB
- Frontend: React.js + Ant Design + Redux

**Features**:

- Invoice management
- Quote management
- Expense tracking
- Client management
- Product catalog
- Basic accounting
- Multi-currency support

**Pros**:

- MERN stack (JavaScript throughout)
- Active development
- Good UI with Ant Design
- Docker support
- Multi-tenant capable

**Cons**:

- MongoDB (we want PostgreSQL for financial data)
- No European e-invoicing compliance
- No Croatian localization

**What We Can Learn**:

- Invoice UI/UX patterns
- PDF generation approach
- Multi-tenant architecture
- Dashboard design

---

### 2. Invoice Ninja

**GitHub**: [github.com/invoiceninja/invoiceninja](https://github.com/invoiceninja/invoiceninja)
**Stars**: 9.3k
**License**: Elastic License (source-available)

**Tech Stack**:

- Backend: Laravel (PHP)
- Frontend: Flutter (mobile), React (web admin)
- Database: MySQL/PostgreSQL

**Features**:

- Full invoicing suite
- Quote and proposal system
- Expense tracking
- Time tracking
- Client portal
- Payment gateway integrations
- Multi-company support
- API-first architecture
- White-label option

**Pros**:

- Most feature-complete open solution
- React admin portal (TypeScript)
- Excellent API
- Mobile apps
- Payment integrations

**Cons**:

- PHP backend (we want Node.js/TypeScript)
- Complex codebase
- Elastic License restrictions

**What We Can Learn**:

- Feature completeness benchmark
- Client portal design
- Payment integration patterns
- API structure
- Mobile app approach (React Native)

**React UI Repo**: [github.com/invoiceninja/ui](https://github.com/invoiceninja/ui) - TypeScript/React

---

### 3. Lago

**GitHub**: [github.com/getlago/lago](https://github.com/getlago/lago)
**Stars**: 7k+
**License**: MIT (open source)

**Tech Stack**:

- Backend: Ruby on Rails
- Frontend: React + TypeScript
- Database: PostgreSQL
- GraphQL API

**Features**:

- Usage-based billing
- Subscription management
- Metering and events
- Invoice generation
- Payment orchestration
- Webhook system

**Pros**:

- Modern architecture
- TypeScript React frontend
- PostgreSQL
- GraphQL (type-safe)
- Event-driven billing
- Good for SaaS businesses

**Cons**:

- Ruby backend (not TypeScript)
- Focused on SaaS billing, not traditional invoicing
- No e-invoicing compliance

**What We Can Learn**:

- Event-driven architecture
- GraphQL schema design
- React TypeScript patterns
- Subscription billing logic
- Webhook implementation

**Frontend Repo**: [github.com/getlago/lago-front](https://github.com/getlago/lago-front) - TypeScript/React

---

### 4. Crater / InvoiceShelf

**GitHub**: [github.com/crater-invoice-inc/crater](https://github.com/crater-invoice-inc/crater)
**GitHub**: [github.com/InvoiceShelf/InvoiceShelf](https://github.com/InvoiceShelf/InvoiceShelf)
**License**: AGPL-3.0

**Tech Stack**:

- Backend: Laravel (PHP)
- Frontend: Vue.js
- Mobile: React Native
- Database: MySQL

**Features**:

- Invoice & estimate creation
- Expense tracking
- Payment tracking
- Custom fields
- Tax management
- Multi-company
- Mobile apps

**Pros**:

- Clean, simple design
- React Native mobile (can reference)
- Good for small businesses

**Cons**:

- PHP/Vue.js (not our stack)
- Less feature-rich than Invoice Ninja

**What We Can Learn**:

- Simple, focused UX
- Mobile app patterns (React Native)
- Small business workflow

---

### 5. ERPNext

**GitHub**: [github.com/frappe/erpnext](https://github.com/frappe/erpnext)
**Stars**: 18k+
**License**: GPL-3.0

**Tech Stack**:

- Backend: Python (Frappe framework)
- Frontend: JavaScript
- Database: MariaDB

**Features**:

- Full ERP suite
- Accounting
- Inventory
- Manufacturing
- HR/Payroll
- CRM
- E-commerce

**Pros**:

- Most comprehensive ERP
- Well-documented
- Large community
- Croatian community exists

**Cons**:

- Python/MariaDB (not our stack)
- Very complex
- Steep learning curve

**What We Can Learn**:

- Full accounting workflows
- Croatian accounting requirements
- Chart of accounts structure
- Financial reporting

---

### 6. Metasfresh

**GitHub**: [github.com/metasfresh/metasfresh](https://github.com/metasfresh/metasfresh)
**Stars**: 1.5k+
**License**: GPL-2.0

**Tech Stack**:

- Backend: Java
- Frontend: React + Redux
- Database: PostgreSQL

**Features**:

- Full ERP
- Manufacturing focus
- B2B commerce
- Warehouse management

**Pros**:

- React frontend
- PostgreSQL
- German/EU focused (similar compliance needs)

**Cons**:

- Java backend (not TypeScript)
- Very enterprise-focused

---

## Comparison Matrix

| Project       | Stack Match       | Features  | E-Invoice | Learning Value    |
| ------------- | ----------------- | --------- | --------- | ----------------- |
| IDURAR        | High (MERN)       | Medium    | No        | High              |
| Invoice Ninja | Medium (React UI) | High      | No        | Very High         |
| Lago          | Medium (React/TS) | Medium    | No        | High              |
| Crater        | Low               | Medium    | No        | Medium            |
| ERPNext       | Low               | Very High | Partial   | High (accounting) |
| Metasfresh    | Medium            | High      | Partial   | Medium            |

## Recommended Approach

### Reference Implementations to Study

1. **Invoice Ninja** - Feature benchmark, API design, client portal
2. **IDURAR** - MERN patterns, dashboard UI
3. **Lago** - React/TypeScript frontend, GraphQL, events

### Code to Potentially Reuse

1. **Lago Frontend** - MIT licensed React/TypeScript components
2. **IDURAR** - Invoice templates, PDF generation approach
3. **OpenPEPPOL** - UBL validation schemas

### Key Patterns to Implement

From these projects, we should adopt:

1. **API-First Architecture** (Invoice Ninja)
   - All features accessible via API
   - Frontend is just one client

2. **Event-Driven Design** (Lago)
   - Invoice events for audit trail
   - Webhook system for integrations

3. **Multi-Tenant Core** (IDURAR, Invoice Ninja)
   - Company isolation
   - User roles per company

4. **Modular Structure** (ERPNext)
   - Separate modules (invoicing, accounting, etc.)
   - Each module self-contained

## GitHub Resources

### UBL / PEPPOL

- [OpenPEPPOL/peppol-bis-invoice-3](https://github.com/OpenPEPPOL/peppol-bis-invoice-3) - Official PEPPOL BIS 3.0 specs
- UBL 2.1 XML schemas and validation rules

### PDF Generation

- [pdfkit](https://github.com/foliojs/pdfkit) - PDF generation for Node.js
- [react-pdf](https://github.com/diegomura/react-pdf) - React PDF rendering

### Croatian Specific

- Search for "fiskalizacija" on GitHub for existing implementations
- OIB validation libraries

## Conclusion

While no single open-source project matches our exact needs (TypeScript + Next.js + Croatian compliance), we can:

1. **Study** Invoice Ninja for feature completeness
2. **Reference** Lago for modern React/TypeScript patterns
3. **Borrow** IDURAR for Node.js patterns
4. **Build** Croatian e-invoicing layer ourselves (no good open source exists)

The biggest gap in all projects is **EN 16931 / PEPPOL compliance** and **Croatian fiscalization** - this is where FiskAI adds unique value.
