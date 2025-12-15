# Accessibility Audit

Evaluated key flows for WCAG 2.1 AA alignment (language metadata, form semantics, color usage, focus management).

## Findings
1. **Incorrect document language** – Root layout sets `<html lang="en">` (`src/app/layout.tsx:12-18`) even though the UI copy is Croatian (`Prijava`, `Novi E-Račun`, etc.). Screen readers will mispronounce labels. Set `lang="hr"` (or make it dynamic per locale) to ensure proper pronunciation and spell checking.
2. **Inputs lack ARIA metadata** – `Input` component (`src/components/ui/input.tsx:8-22`) toggles border color for errors but never sets `aria-invalid`, nor links the helper text via `aria-describedby`. Keyboard/screen-reader users therefore do not know which fields are invalid. Add these attributes and ensure ids are unique so error text is announced.
3. **Unlabeled select element** – The buyer dropdown on the new invoice form (`src/app/(dashboard)/e-invoices/new/page.tsx:101-118`) renders `<label className="text-sm font-medium">` without `htmlFor`, and the `<select>` lacks an `id`, so assistive tech cannot map the label. Assign ids and connect labels to form controls.
4. **Tables missing captions and scope** – The invoices table (`src/app/(dashboard)/e-invoices/page.tsx:31-88`) lacks a `<caption>` describing the data and does not set `scope="col"`/`scope="row"`. This makes navigating rows/columns difficult for screen readers. Add a caption summarizing the table contents and scope attributes for headers.
5. **Status indicators rely on color alone** – Dashboard status chips (e.g., PDV obveznik) use green/yellow icons only (`src/app/(dashboard)/dashboard/page.tsx:62-83`). Users with color-vision deficiencies cannot distinguish states. Include text labels (e.g., “PDV: Da/Ne”) and consider adding icons with distinct shapes or patterns.
6. **No focus management or announcements after actions** – Forms such as login/register (`src/app/(auth)/login/page.tsx:37-85`) render inline error divs without `role="alert"`/`aria-live`, so errors are not announced. Add live regions and move focus to the first invalid field on submit failure.

## Recommendations
- Localize the `<html lang>` attribute and text direction per locale.
- Update form components to set `aria-*` attributes automatically when errors are present and connect labels/ids consistently.
- Provide captions/scope attributes for data tables and ensure complex tables remain navigable on mobile.
- Supplement color coding with icons/text to describe status changes.
- Add a shared alert/toast component with `role="status"` (success) and `role="alert"` (errors) plus focus trapping for modals.
