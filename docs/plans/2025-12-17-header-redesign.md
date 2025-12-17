# Header Redesign: Portal Navigation

**Date:** 2025-12-17
**Status:** Approved for implementation

## Overview

Redesign the marketing header to match the hero's dark cockpit aesthetic. Replace the clunky two-row dropdown navigation with a sleek single-row header and an immersive "portal" overlay for deep navigation.

## Design Decisions

| Decision            | Choice                                                 |
| ------------------- | ------------------------------------------------------ |
| Navigation approach | Hybrid: flat links + "Istraži" full-screen overlay     |
| Overlay style       | Portal effect with parallax, 3D tilt, aurora gradients |
| Scroll behavior     | Transparent → Dark frosted glass                       |

---

## Section 1: Header Structure

**Single row layout (~60px height):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  FiskAI [beta]     Alati  Vijesti  Cijene  │  [Istraži ◇]  [Započni →] │
└─────────────────────────────────────────────────────────────────────┘
```

**Elements:**

- **Logo**: "FiskAI" + subtle beta badge, light text on dark
- **Flat nav links**: Only 3 direct links - `Alati`, `Vijesti`, `Cijene`
  - No dropdowns, clean text links with glow hover effect
- **"Istraži" button**: Portal trigger, outlined with animated border gradient
  - Small grid/compass icon that rotates on hover
- **"Započni" CTA**: Primary button, cyan gradient matching hero

**Removed from header:**

- "Prijava" button (moved to overlay)
- All dropdown menus
- Second navigation row
- "Fiskalizacija 2.0" badge

---

## Section 2: Visual Styling & Scroll Behavior

### Initial State (on hero)

```css
.header-initial {
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
```

- Logo and links: `text-white/90`
- Fully transparent, hero shows through

### Scrolled State (after ~100px)

```css
.header-scrolled {
  background: rgba(15, 23, 42, 0.85); /* slate-900 */
  backdrop-filter: blur(20px) saturate(1.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
}
```

- Smooth 300ms transition
- Blur creates depth, saturate makes colors pop
- Shadow adds "floating" feel

### Hover Effects

**Links:**

- Text brightens to `text-white`
- Cyan glow: `text-shadow: 0 0 20px rgba(34, 211, 238, 0.5)`
- Animated underline draws left-to-right

**"Istraži" button:**

- Animated gradient border (cyan → blue → indigo, rotating)
- Subtle pulse on idle

**"Započni" CTA:**

- Gradient: `from-cyan-500 to-blue-600`
- Glow: `shadow-lg shadow-cyan-500/25`
- Hover: scale 1.02 + brighter shadow

---

## Section 3: Portal Overlay

### Opening Animation (300-400ms)

1. Background dims: `bg-black/60` + blur on page content
2. Overlay slides up from bottom with parallax
3. Aurora gradient fades in (animated blobs like hero, more subtle)
4. Content items stagger in with fade + rise (50ms delay each)

### Overlay Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│  ✕ Close                                    [⌘K Pretraži...]          │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   PROIZVOD           ALATI              BAZA ZNANJA                    │
│   ┌──────────┐      ┌──────────┐       ┌──────────┐                    │
│   │ ✦ Card   │      │ 📊 Card  │       │ 📖 Card  │                    │
│   └──────────┘      └──────────┘       └──────────┘                    │
│      ...              ...                 ...                          │
│                                                                        │
│   ─────────────────────────────────────────────────────────────────    │
│   [Prijava]                           [Započni besplatno →]            │
└────────────────────────────────────────────────────────────────────────┘
```

### 3D Card Tilt Effect

- Cards respond to mouse position
- Subtle rotation: max ±5deg
- Light reflection shifts across surface
- Cyan border glow intensifies on hover

### Aurora Background

- 2-3 blurred gradient orbs (cyan, blue, indigo)
- Slow movement: 15-20s animation loops
- Opacity: 20-30% (content stays readable)

---

## Section 4: Content Organization

### Three-Column Layout

```
PROIZVOD                    ALATI                      BAZA ZNANJA
─────────────────────────────────────────────────────────────────────
Mogućnosti                  Svi alati →                Vodiči →
Sigurnost                   ────────────               ────────────
Status sustava              PDV prag kalkulator        Paušalni obrt
Prijeđi na FiskAI           PO-SD kalkulator           Obrt na dohodak
                            Generator uplatnica        D.O.O. / J.D.O.O.
                            Kalendar rokova            Freelancer
                            OIB validator              Posebni oblici

                                                       Usporedbe →
                                                       ────────────
                                                       Počinjem solo
                                                       Dodatni prihod
                                                       Osnivam firmu
                                                       Preko 60k praga

BRZI PRISTUP                RESURSI
─────────────────────────────────────────────────────────────────────
Vijesti                     Kako da... →
Cijene                      Rječnik →
Kontakt                     Službeni izvori
Fiskalizacija 2.0 (●)       Metodologija
                            Urednička politika
```

### Visual Treatment

- Category headers: `text-xs uppercase tracking-wide text-cyan-400`
- Section links (→): Larger, lead to index pages
- Individual items: `text-white/70` → `text-white` on hover
- Dividers: `border-white/10`
- "Fiskalizacija 2.0": Red/orange pulse dot for attention

### Footer Row

- Left: "Prijava" as text link
- Right: "Započni besplatno" primary CTA

---

## Section 5: Mobile Experience

### Mobile Header

```
┌─────────────────────────────────────────┐
│  FiskAI [beta]          [◇]  [Započni] │
└─────────────────────────────────────────┘
```

- Grid icon replaces "Istraži" text
- Same transparent → dark glass scroll behavior

### Mobile Overlay

- Full-screen takeover, opens from bottom with spring animation
- Search bar prominent at top
- Accordion sections for categories
- Large touch targets (min 48px)
- Categories default collapsed except "Alati"
- Sticky footer: Prijava + Započni
- Swipe down to close

### Performance

- Use `transform` and `opacity` only (GPU accelerated)
- `will-change: transform` on overlay
- `prefers-reduced-motion`: instant transitions

---

## Implementation Files

| File                                            | Purpose                         |
| ----------------------------------------------- | ------------------------------- |
| `src/components/marketing/MarketingHeader.tsx`  | Main header component (rewrite) |
| `src/components/marketing/PortalNavigation.tsx` | Full-screen overlay (new)       |
| `src/components/marketing/PortalCard.tsx`       | 3D tilt card component (new)    |
| `src/components/marketing/AuroraBackground.tsx` | Animated gradient blobs (new)   |

---

## Success Criteria

1. Header matches hero's dark aesthetic seamlessly
2. All existing pages remain accessible via portal
3. "Wow" factor: 3D tilt, aurora gradients, smooth animations
4. Mobile experience feels native
5. Performance: 60fps animations, no layout shift
