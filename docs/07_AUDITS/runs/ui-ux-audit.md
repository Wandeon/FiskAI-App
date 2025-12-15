# FiskAI UI/UX Audit

Goal: evaluate the current web experience (Next.js app) and suggest concrete improvements so Croatian accountants can accomplish their end-to-end tasks (authenticate, onboard a company, manage contacts, create/send e-invoices) with minimal friction and clear guidance.

## Method
Reviewed the implemented routes/components in `src/app` plus shared layout (`Header`, `Sidebar`) to map every screen, field and empty state. For each touchpoint we listed expected user goals, key information needed to advance, missing affordances, and actionable enhancements.

## Global Shell (Header + Sidebar)
- **Company context missing:** Header only shows the logged-in email (`src/components/layout/header.tsx:16-24`), so users juggling multiple companies cannot tell which tenant is active nor switch it. Add a prominent company switcher (with search) plus status badges (e.g., onboarding complete, provider connected).
- **Action feedback:** No global toast system, meaning server-action successes/errors (e.g., save contact, send invoice) rely on inline form state. Introduce a non-blocking notification layer so every action provides immediate confirmation and nudge toward the next logical step.
- **Navigation depth:** Sidebar (`src/components/layout/sidebar.tsx:7-34`) advertises Contacts/Products/Settings but there are no implemented routes yet. Until modules exist, hide or disable the links to avoid dead ends; when enabled, indicate unread items/tasks counts.
- **Responsive behavior:** Shell is desktop-focused (fixed `w-64` sidebar, static header). Implement collapsible navigation for tablets/phones and keep primary CTAs accessible via floating action buttons (FAB) on smaller devices.

## Authentication (Login & Register)
- **Missing recovery path:** Login form stops at email/password (`src/app/(auth)/login/page.tsx:37-78`); there is no “Forgot password?”, passwordless option, or contact support link. Add recovery CTA beneath the password field and surface help text when Auth errors occur repeatedly.
- **SSO discoverability:** Google provider is configured server-side, yet no button appears in the UI. Show branded OAuth buttons alongside the native form to shorten onboarding for busy founders.
- **Context & trust:** Provide short marketing copy (security badges, privacy note, support contact) inside the card so new accountants feel safe entering credentials.
- **Registration guardrails:** Register form lacks password strength meter or inline explanation of the policy defined in `registerSchema` (`src/app/(auth)/register/page.tsx:79-100`). Display the rules upfront, validate in real time, and require acceptance of terms/GDPR consent before submission.

## Onboarding (Company creation)
- **Single long form without progress:** The onboarding screen is a blank form (`src/app/(dashboard)/onboarding/page.tsx:44-152`) that does not explain why data is needed. Split into a progressive 3-step wizard (Company basics → Tax info → Communication + preview) with a progress bar and autosave.
- **No contextual helpers:** Fields such as OIB, VAT payer, IBAN provide no helper text or validation on blur. Add inline tooltips (e.g., “OIB must be 11 digits; we’ll verify checksum automatically”), masked inputs, and prefill ISO country code.
- **Lack of next-step guidance:** After submission the user is redirected silently to `/dashboard`. Show a confirmation screen summarizing the new company, highlighting next tasks (“Add your first contact”, “Connect e-invoice provider”).
- **Invite teammates:** Most SMEs collaborate with accountants; offer an optional “Invite accountant/email” input so they can add colleagues before leaving onboarding.

## Dashboard
- **Limited insight:** Dashboard only displays two counts and the OIB (`src/app/(dashboard)/dashboard/page.tsx:27-60`). Expand into cards that answer “What requires my attention right now?”: drafts awaiting send, invoices overdue, contacts missing OIB, setup checklists.
- **Action shortcuts:** Provide CTA buttons on cards (e.g., “Create invoice”, “Add contact”) and show provider connection status with direct links to configure missing items (`company.eInvoiceProvider` data at lines 62-83).
- **Timeline & announcements:** Include a chronological feed (recent invoices, contact updates, system alerts) plus contextual education (e.g., Fiskalizacija 2.0 deadlines) so the page becomes the nerve center.

## E-Invoices List
- **No filtering/search:** `getEInvoices()` powers a static table (`src/app/(dashboard)/e-invoices/page.tsx:22-91`). Introduce filters for direction, status, date range and a search box for invoice number/customer. Persist selections per user.
- **Missing batch actions:** Users often need to send, export or archive multiple invoices. Add checkboxes, bulk action bar, and quick actions per row (Send, Download PDF/XML, Duplicate).
- **Status explanation:** Badges currently show raw enums (e.g., `PENDING_FISCALIZATION`). Provide human labels, tooltips describing what each status means, and highlight blockers (e.g., “Needs provider connection”).
- **Empty state onboarding:** Replace the generic empty message (lines 24-30) with an illustrated panel explaining the 3 steps to issue an invoice and link to add contacts/products before starting.

## New E-Invoice Form
- **Needs stepwise structure:** Long form mixes buyer info, numbering, lines, totals in one scroll (`src/app/(dashboard)/e-invoices/new/page.tsx:87-254`). Convert to a multi-step composer with a sticky summary sidebar so users always see totals, due date, and payment instructions.
- **Buyer selection pain:** Dropdown simply lists contacts alphabetically (lines 101-118). Add typeahead search, contact preview (address, VAT status), and inline “Add new contact” modal so users stay in flow.
- **Missing numbering helpers:** `invoiceNumber` input is blank (121-125). Auto-suggest the next sequence per company (e.g., `2025-0004`), allow templates, and warn before duplicates.
- **Line item ergonomics:** Manually typing units and VAT each time is error-prone (lines 149-223). Integrate products/services picker with price/vat defaults, allow drag-and-drop ordering, and show inline calculations (net/vat per row) plus comments/discounts fields.
- **Payment & attachments:** There’s no section to add payment instructions, notes, or attachments even though XML may include them. Provide fields for payment terms, bank accounts (pull from company), custom footer, and file uploads for supporting documents.
- **Send/preview flow:** Submitting always saves as draft (`Button` label lines 244-250). Offer secondary actions: preview PDF/XML, “Save & send now”, and “Schedule send”. After success, show an explicit confirmation page with next steps (download, share link).

## Future Contacts/Settings Modules
- Contacts/actions exist server-side but lack UI pages. When implementing, lead with:
  - Segmented tabs for customers vs suppliers, quick import from Excel, duplicate detection.
  - Detailed profile panels showing outstanding invoices, communication history, and quick actions (issue invoice, send reminder).
- Settings should expose a checklist (company profile, bank accounts, provider API keys) with validation states and inline docs.

## Cross-cutting Enhancements
1. **Guided tours + checklists:** Provide contextual tours (hotspots) for first-time users and persistent “Getting started” checklist to surface required steps.
2. **Feedback loops:** Confirm every destructive action with modal summaries, show toasts/snackbars for success/error, and log events for future analytics.
3. **Accessibility & localization:** Ensure all form controls have labels/help text, focus states, keyboard support, and support bilingual labels (HR + EN) with a language switcher.
4. **Data visualization:** For accountants, charts of revenue, VAT owed, and cash due dates quickly answer “what’s next?” Build small multiples on the dashboard once enough data exists.
5. **Mobile parity:** Prioritize responsive redesign so invoice approval and quick actions can be completed on phones (e.g., bottom navigation, simplified tables with accordions).

## Next Steps
- Prioritize flows that unblock revenue (onboarding → first invoice). Prototype the new multi-step onboarding and invoice composer in Figma, test with 2-3 target users, then iterate.
- Implement a shared `useToast` + `Banner` component for consistent feedback and retrofit existing actions gradually.
- Add analytics/tracking (e.g., PostHog) to observe where users drop off (registration vs onboarding vs invoice creation) and validate the impact of improvements.
