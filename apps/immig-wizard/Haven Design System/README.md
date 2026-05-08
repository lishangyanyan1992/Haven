# Haven Design System

## About Haven

Haven helps global talent navigate the U.S. immigration system — from H-1B and F-1/OPT visas to green cards, job changes, layoffs, priority dates, and family- or employment-based pathways. The product serves both individuals going through the process and the companies sponsoring them.

**Sources used to build this design system:**
- No external codebase or Figma was provided — this design system was created from scratch based on the brand description.
- Design direction: "Calm Clarity" — a trusted guide through complexity.

---

## Products

| Product | Description |
|---|---|
| **Marketing Site** | Public-facing site explaining Haven's services, pricing, and value proposition |
| **Web App (Dashboard/Portal)** | The core product — a dashboard where individuals and employers track visa status, documents, timelines, and tasks |

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Calm and reassuring** — immigration is stressful; Haven's copy actively reduces anxiety
- **Human, not legal** — explains complex topics in plain language without dumbing things down
- **Empowering** — frames processes as achievable with the right guide
- **First-person plural** — "We'll handle that." "Your next step is…" Not cold or transactional
- **No jargon without explanation** — terms like "priority date" or "I-140" are explained in context

### Casing
- **Headlines**: Title Case for primary headlines; sentence case for body, CTAs, and UI labels
- **UI labels**: sentence case throughout (e.g. "Upload document", not "Upload Document")
- **Status labels**: ALL CAPS with letter-spacing (e.g. "APPROVED", "IN PROGRESS")

### Emoji
- **Not used** — tone is professional and warm; emoji would undermine trust

### Copy Examples
- "Your H-1B is in good hands." (reassuring, possessive)
- "Let's figure out your next step." (collaborative, plain)
- "Priority date: October 2021 — you're closer than you think." (data + hope)
- "We'll remind you before every deadline." (proactive, caring)

---

## VISUAL FOUNDATIONS

### Color
- **Primary**: Forest green (`#1E5241`) — stability, growth, sanctuary. The brand anchor.
- **Accent**: Warm amber (`#C98928`) — opportunity, warmth, forward momentum. Used sparingly.
- **Backgrounds**: Warm off-white (`#FAF9F7`) and cream (`#F5F3EF`) — never pure white; always slightly warm.
- **Text**: Near-black warm `#18150F` for primary; stepped warm grays for hierarchy.
- **Status colors**: Muted semantic tones (success green, warning amber, error red, info blue) — never neon.

### Typography
- **Display**: Cormorant Garamond — a refined editorial serif. Used for all headline sizes. Light weight (300) for large headlines; regular/medium for smaller heads.
- **Body**: DM Sans — clean optical-size sans-serif. Highly legible at small sizes; friendly at large sizes.
- **Mono**: DM Mono — used for case numbers, dates, reference IDs, code snippets.
- **Pairing principle**: Large serif headlines + small sans body = editorial authority + clarity.
- **Label treatment**: ALL CAPS, widest letter-spacing, medium weight — used for section labels, status tags, eyebrow text.

### Spacing
- 4px base unit. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96.
- Dense UI elements use 8–16px internal padding; cards use 24–32px.
- Section spacing on marketing pages: 80–96px between major sections.

### Backgrounds
- **Marketing**: Warm off-white base; occasional cream section alternation. No full-bleed photography (reserved for future). Subtle geometric line texture possible but optional.
- **App**: White surfaces on warm-gray canvas. No gradients in the app.
- **No aggressive gradients** — if used, very subtle (cream → white), never colored gradients.

### Borders & Radius
- Cards: `border-radius: 12px`, `border: 1px solid var(--neutral-200)`
- Inputs: `border-radius: 8px`
- Badges/pills: `border-radius: 9999px`
- Buttons: `border-radius: 8px`
- No purely cosmetic borders (borders exist for separation, not decoration)

### Shadows
- Warm-tinted shadows using green-900 at low opacity — never cool/blue shadows
- Cards: `shadow-sm` by default; `shadow-md` on hover
- Modals/overlays: `shadow-xl`
- No inner shadows

### Cards
- White background, 1px `neutral-200` border, 12px radius, `shadow-sm`
- On hover: `shadow-md`, border brightens slightly
- No colored left-border accent cards

### Animation & Transitions
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` — ease-out spring. Feels calm, not snappy.
- **Duration**: 120ms for micro (hover), 200ms for standard, 350ms for larger transitions
- **Entrances**: gentle fade-up (translateY 8px → 0, opacity 0 → 1)
- **No bounces, no elastic effects** — calm, measured
- **Hover states**: color deepens slightly + shadow lifts. No scaling on most elements.
- **Button press**: subtle scale(0.98) + darken

### Iconography
See ICONOGRAPHY section in this README. Lucide icons via CDN.

### Imagery
- **Color vibe**: Warm, slightly desaturated. Think editorial photography — not stock.
- **No clip art, no vector illustrations** (reserved for future brand investment)
- Placeholder blocks use warm neutral fills

---

## ICONOGRAPHY

Haven uses **Lucide Icons** — a clean, consistent stroke-based icon set.

- **Style**: 1.5px stroke weight, rounded line caps, 24×24px default size
- **Usage in app**: Navigation, status indicators, action buttons
- **CDN**: `https://unpkg.com/lucide@latest/dist/umd/lucide.min.js`
- **Color**: Icon color matches surrounding text color; never decorative standalone color
- **No emoji as icons** — Lucide handles all iconography needs
- No custom icon font; no PNG icons

Key icons used:
- `file-text` — documents
- `clock` — timelines / priority dates  
- `check-circle` — completed steps
- `alert-circle` — warnings
- `user` — profile
- `building` — employer
- `calendar` — deadlines
- `arrow-right` — CTAs
- `shield` — case protection / security

---

## File Index

```
README.md                  ← You are here
SKILL.md                   ← Agent skill definition
colors_and_type.css        ← CSS variables: colors, type, spacing, shadows
assets/
  logo.svg                 ← Haven wordmark (SVG)
  logo-icon.svg            ← Haven icon mark
preview/
  colors-primary.html      ← Primary green scale
  colors-neutral.html      ← Warm neutral scale
  colors-semantic.html     ← Status / semantic colors
  type-display.html        ← Cormorant Garamond display specimens
  type-body.html           ← DM Sans body scale
  type-labels.html         ← Labels, mono, captions
  spacing-tokens.html      ← Spacing scale tokens
  spacing-radii-shadows.html ← Border radii + shadow system
  components-buttons.html  ← Button variants and states
  components-inputs.html   ← Form inputs and selects
  components-badges.html   ← Status badges and tags
  components-cards.html    ← Card variants
  components-nav.html      ← Navigation patterns
ui_kits/
  marketing/               ← Marketing site UI kit
    index.html             ← Interactive marketing site prototype
  app/                     ← Web app / dashboard UI kit
    index.html             ← Interactive app prototype
```
