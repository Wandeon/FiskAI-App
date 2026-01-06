/* eslint-disable fisk-design-system/no-hardcoded-colors -- @design-override: Favicon SVG generation requires hardcoded hex colors. Favicons render outside the DOM/CSS context and cannot use CSS variables. */
// State-aware favicon manager
// Changes favicon color based on app state for premium UX

type FaviconState = "default" | "success" | "error" | "loading"

const FAVICON_COLORS: Record<FaviconState, string> = {
  default: "#06B6D4", // cyan-500
  success: "#F59E0B", // amber-500
  error: "#EF4444", // red-500
  loading: "#06B6D4", // cyan-500 (will animate)
}

// Generate SVG favicon with specified color
function generateFaviconSvg(color: string): string {
  return `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="8" width="14" height="48" rx="4" fill="${color}" />
  <rect x="28" y="8" width="28" height="14" rx="4" fill="${color}" />
  <rect x="28" y="26" width="18" height="14" rx="4" fill="${color}" />
</svg>`
}

// Convert SVG to data URL
function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22")
  return `data:image/svg+xml,${encoded}`
}

// Get or create favicon link element
function getFaviconElement(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement("link")
    link.rel = "icon"
    link.type = "image/svg+xml"
    document.head.appendChild(link)
  }
  return link
}

let currentState: FaviconState = "default"
let loadingInterval: NodeJS.Timeout | null = null

// Set favicon to a specific state
export function setFaviconState(state: FaviconState): void {
  if (typeof window === "undefined") return

  // Clear any existing loading animation
  if (loadingInterval) {
    clearInterval(loadingInterval)
    loadingInterval = null
  }

  currentState = state
  const link = getFaviconElement()

  if (state === "loading") {
    // Animate between cyan and lighter cyan for subtle pulse
    let toggle = false
    const updateLoadingFavicon = () => {
      const color = toggle ? "#06B6D4" : "#22D3EE" // cyan-500 / cyan-400
      link.href = svgToDataUrl(generateFaviconSvg(color))
      toggle = !toggle
    }
    updateLoadingFavicon()
    loadingInterval = setInterval(updateLoadingFavicon, 500)
  } else {
    const color = FAVICON_COLORS[state]
    link.href = svgToDataUrl(generateFaviconSvg(color))
  }
}

// Reset to default state
export function resetFavicon(): void {
  setFaviconState("default")
}

// Flash a state temporarily then return to previous/default
export function flashFavicon(state: FaviconState, durationMs = 2000): void {
  const previousState = currentState
  setFaviconState(state)
  setTimeout(() => {
    setFaviconState(previousState === state ? "default" : previousState)
  }, durationMs)
}

// Get current favicon state
export function getFaviconState(): FaviconState {
  return currentState
}
