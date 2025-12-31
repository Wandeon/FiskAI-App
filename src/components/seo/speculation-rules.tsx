/**
 * Speculation Rules API Component
 *
 * Enables hover-based prerendering for KB and marketing pages
 * to make navigation instant. Uses the Speculation Rules API
 * which is supported in Chromium-based browsers.
 *
 * @see https://developer.chrome.com/docs/web-platform/prerender-pages
 */
export function SpeculationRules() {
  const rules = {
    prerender: [
      {
        where: {
          and: [
            { href_matches: "/*" },
            { not: { href_matches: "/app/*" } },
            { not: { href_matches: "/staff/*" } },
            { not: { href_matches: "/admin/*" } },
            { not: { href_matches: "/api/*" } },
            { not: { href_matches: "/tools/*" } },
            { not: { selector_matches: "[href*='?']" } },
          ],
        },
        eagerness: "moderate",
      },
    ],
    prefetch: [
      {
        where: {
          href_matches: ["/vodic/*", "/pojmovnik/*", "/faq/*", "/vijesti/*"],
        },
        eagerness: "moderate",
      },
    ],
  }

  return (
    <script type="speculationrules" dangerouslySetInnerHTML={{ __html: JSON.stringify(rules) }} />
  )
}
