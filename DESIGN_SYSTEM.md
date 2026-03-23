# Haven Design System

**Atmosphere profile:** Variance 6 · Motion 4 · Density 3
*Calm, specific, human — premium AI-native SaaS for H-1B visa holders.*

---

## 1. Philosophy

Haven is the knowledgeable friend in the room: steady, uncluttered, and warm without being
corporate. Every design decision should reinforce trust and reduce anxiety.

**Core tenets (adapted from Stitch-Skill / Taste-Skill):**
- **Single accent** — one saturated colour maximum, saturation capped below 80%
- **Diffused elevation** — soft box-shadows, never harsh drop shadows
- **Typographic restraint** — meaningful hierarchy, not decorative noise
- **Motion at 4/10** — CSS transitions only; no scroll-triggered choreography on functional views
- **Premium restraint** — whitespace over decoration; cards only when elevation communicates hierarchy

**Anti-patterns — never use:**
- Purple / blue AI gradients or neon glow effects
- Gradient text
- Pure `#000000` black (use `--haven-ink` instead)
- Oversaturated colours or multiple accent colours
- Generic "AI-dashboard" 3-column card soup
- Startup-cliché microcopy ("Supercharge", "Unlock", "Seamless")
- Emoji in UI copy
- Custom cursors
- Placeholder/fake data in production views

---

## 2. Colour Palette

All tokens live in `:root` in `globals.css` and are mapped into Tailwind via `tailwind.config.ts`.

### Ink (text / interactive primary)

| Token | Hex | Usage |
|-------|-----|-------|
| `--haven-ink` | `#2c3630` | Primary text, default button bg, headings |
| `--haven-ink-mid` | `#4a5c54` | Secondary text, ghost button text, labels |
| `--haven-ink-light` | `#7a8e86` | Tertiary text, captions, disabled states |

### Sage (accent — single accent rule applies)

| Token | Hex | Usage |
|-------|-----|-------|
| `--haven-sage` | `#8ba89a` | Accent buttons, active dots, progress fills |
| `--haven-sage-strong` | `#7a9989` | Sage hover states |
| `--haven-sage-mid` | `#b8cec6` | Borders on sage surfaces, ghost hover bg |
| `--haven-sage-light` | `#e8f0ed` | Ghost button bg, feature card bg, tag bg |

### Surfaces

| Token | Hex | Usage |
|-------|-----|-------|
| `--haven-cream` | `#fdfaf6` | Page background, primary button text on ink |
| `--haven-white` | `#ffffff` | Card surface, icon container bg |
| `--haven-sand` | `#f4efe8` | Alt card surface, pending tag bg |

### Semantic: Sky (informational)

| Token | Hex | Usage |
|-------|-----|-------|
| `--haven-sky` | `#aecad8` | Info accents |
| `--haven-sky-mid` | `#c8dce8` | Info card border |
| `--haven-sky-light` | `#eaf4f8` | Info card bg, community story cards |
| `--haven-sky-ink` | `#3a6e84` | Info card text |

### Semantic: Blush (warning / urgent)

| Token | Hex | Usage |
|-------|-----|-------|
| `--haven-blush` | `#e8c4b4` | Warning border / dot |
| `--haven-blush-light` | `#faf0eb` | Warning card bg |
| `--haven-blush-ink` | `#8c4c35` | Warning card text |

### Semantic: Success

| Token | Hex | Usage |
|-------|-----|-------|
| `--haven-success-light` | `#eaf8f2` | Success card bg |
| `--haven-success-ink` | `#2a6e50` | Success card text |

### Borders

```css
--color-border:        rgba(44, 54, 48, 0.08)   /* default hairline */
--color-border-mid:    rgba(44, 54, 48, 0.14)   /* inner dividers */
--color-border-strong: rgba(44, 54, 48, 0.24)   /* emphasis borders */
```

### Dark-section override (e.g. CTA card on `--haven-ink` bg)

Use `cream` button variant for primary CTA and `ghost-light` for secondary.
Never use `accent` or `ghost` on ink-coloured backgrounds — contrast fails.

---

## 3. Typography

Fonts loaded from Google Fonts. **Never substitute Inter** — it lacks the premium
editorial register that DM Serif Display provides.

```css
--font-display: "DM Serif Display", Georgia, serif;   /* editorial, display only */
--font-body:    "DM Sans", -apple-system, sans-serif; /* all UI text */
--font-mono:    "JetBrains Mono", "Fira Code", monospace;
```

### Type scale (CSS utility classes in `globals.css`)

| Class | Font | Size | Weight | Line-height | Notes |
|-------|------|------|--------|-------------|-------|
| `.text-display` | display | `clamp(2.5rem, 6vw, 4.5rem)` | 400 | 1.08 | Heroes only; `em` children get `--haven-sage` italic |
| `.text-h1` | body | `clamp(1.75rem, 3.5vw, 2.25rem)` | 500 | 1.2 | Section headers |
| `.text-h2` | body | `20px` | 500 | 1.3 | Card titles |
| `.text-h3` | body | `16px` | 500 | 1.4 | Sub-card titles, step labels |
| `.text-body` | body | `15px` | 400 | 1.65 | Paragraph text; colour `--color-text-secondary` |
| `.text-body-sm` | body | `13px` | 400 | 1.6 | Nav links, supporting copy |
| `.text-caption` | body | `12px` | 400 | 1.5 | Meta, timestamps, footer |
| `.text-label` | body | `11px` | 600 | 1.4 | ALL-CAPS section eyebrows; letter-spacing 0.08em |

**Letter-spacing:** Tighten display headers (`-0.02em`), neutral on body, loose on
labels (`+0.08em`). Never loosen body text.

**Line-length cap:** Body paragraphs max `60ch`; never allow text to span full-width
containers on desktop.

---

## 4. Spacing Scale

Based on a `4px` base unit. Tailwind spacing is remapped to match:

| Token | Value | Tailwind |
|-------|-------|---------|
| `--space-1` | 4px | `p-1` |
| `--space-2` | 8px | `p-2` |
| `--space-3` | 12px | `p-3` |
| `--space-4` | 16px | `p-4` |
| `--space-5` | 24px | `p-5` |
| `--space-6` | 32px | `p-6` |
| `--space-7` | 48px | `p-7` |
| `--space-8` | 64px | `p-8` |
| `--space-9` | 96px | `p-9` |
| `--space-10` | 128px | `p-10` |

Card padding: `p-6` (24px) standard, `p-8` (32px) on feature/hero cards.
Section vertical padding: `py-16` mobile, `lg:py-20` desktop.

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Tags, badges, small indicators |
| `--radius-md` | 8px | Inputs, compact chips |
| `--radius-lg` | 12px | Standard cards (tight content) |
| `--radius-xl` | 16px | Feature cards, panels |
| `--radius-2xl` | 20px | Hero cards, CTA blocks, modal containers |
| `--radius-full` | 9999px | Buttons, avatars, pills |

All buttons use `rounded-full` (pill shape). Never use sharp corners on interactive elements.

---

## 6. Elevation & Shadows

Haven uses **diffusion shadows** — wide-spread, low-opacity. Never harsh drop shadows.

```css
/* Standard card lift */
box-shadow: 0 4px 24px -4px rgba(44, 54, 48, 0.06);

/* Subtle hover lift */
box-shadow: 0 8px 32px -8px rgba(44, 54, 48, 0.10);

/* Inset refraction (for glass/light surfaces) */
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
```

Use `border + background-color` instead of shadow for flat card differentiation.
Only add shadow when you need to communicate z-axis elevation.

---

## 7. Components

### Buttons (`src/components/ui/button.tsx`)

All buttons: `rounded-full`, `min-h-11` (44px touch target), `font-medium`.

| Variant | Background | Text | Border | Use when |
|---------|-----------|------|--------|----------|
| `default` | `--haven-ink` | `--haven-cream` | `--haven-ink` | Primary action on light backgrounds |
| `accent` | `--haven-sage` | `white` | `--haven-sage` | Secondary emphasis on light backgrounds |
| `outline` | transparent | `--haven-ink` | `--haven-ink` | Tertiary action, adjacent to `default` |
| `ghost` | `--haven-sage-light` | `--haven-ink-mid` | transparent | Low-emphasis on light backgrounds |
| `cream` | `--haven-cream` | `--haven-ink` | `--haven-cream` | **Primary action on dark/ink backgrounds** |
| `ghost-light` | `rgba(253,250,246,0.1)` | `--haven-cream` | `rgba(253,250,246,0.3)` | **Secondary action on dark/ink backgrounds** |
| `destructive` | `--haven-blush-light` | `--haven-blush-ink` | `--haven-blush` | Destructive / danger |

**Sizes:**

| Size | Min-height | Padding | Font |
|------|-----------|---------|------|
| `sm` | 36px | `px-3.5 py-1.5` | 13px |
| `default` | 44px | `px-5 py-2.5` | 14px |
| `lg` | 48px | `px-7 py-3` | 15px |

**Tactile feedback** (add to all interactive elements):
```css
/* CSS */
:active { transform: translateY(1px) scale(0.98); }

/* Tailwind */
active:translate-y-px active:scale-[0.98]
```

### Tags / Badges

```css
.tag          /* base: inline-flex, 12px, 500 weight, radius-sm */
.tag-visa     /* sage-light bg, ink-mid text */
.tag-community /* sky-light bg, sky-ink text */
.tag-active   /* success-light bg, success-ink text */
.tag-pending  /* sand bg, ink-mid text */
.tag-urgent   /* blush-light bg, blush-ink text */
```

### Avatars

```css
.avatar          /* base: inline-flex, circle */
.avatar-community /* sky-light bg */
.avatar-sm        /* 28×28px, 11px text */
.avatar-md        /* 36×36px, 13px text */
.avatar-lg        /* 48×48px, 16px text */
```

### Cards

**Decision tree:**
1. Is this content elevated above the page? → Add `bg-[--haven-white]` + soft border
2. Does it need to stand out from adjacent cards? → Add diffusion shadow
3. Is it a feature card (scannable grid)? → `bg-[--haven-sand]` or `bg-[--haven-sky-light]`, no shadow
4. Is it a CTA or dashboard hero? → `bg-[--haven-ink]` with cream/ghost-light buttons

Avoid stacking both border AND shadow on the same element — pick one signal.

### Form Fields

- Labels: `.field-label` — above the input, never floating/inside
- Helper text: `.field-helper` — below the input, optional
- Errors: inline below the input, `--haven-blush-ink` colour
- Input gap: `gap-2` between label and input
- All inputs: `min-h-11` (44px) for touch compliance

### Timeline

```css
.timeline           /* flex-col container */
.timeline-item      /* row: track + content */
.timeline-track     /* 20px wide, relative-positioned for connector line */
.timeline-dot       /* 10px circle */
.timeline-dot-done  /* --haven-sage fill */
.timeline-dot-active /* 12px, --haven-ink fill, 4px ring */
.timeline-dot-pending /* transparent, border */
.timeline-dot-urgent /* --haven-blush fill, blush ring */
.timeline-content   /* flex-1, pb-5 */
```

---

## 8. Layout

### Containers

```css
.content-container       /* max-w-[720px], px-8, centered */
.content-container-wide  /* max-w-[1080px], px-8, centered */
```

Mobile override at `≤768px`: padding drops to `px-4`.

### App Shell (authenticated pages)

```
max-w-[1720px] mx-auto
flex flex-col gap-4 p-3
lg:flex-row lg:gap-5 lg:p-5
```

- **Sidebar** (`aside`): `w-full` mobile → `w-[270px] flex-shrink-0` desktop; `sticky top-5`, `h-[calc(100vh-40px)]`
- **Main** (`main`): `flex-1 min-w-0 overflow-hidden rounded-[28px]`

### Grid patterns

| Use | Classes |
|-----|---------|
| 2-col auth split | `lg:grid-cols-2` |
| 3-col features | `lg:grid-cols-3` |
| Asymmetric how-it-works | `lg:grid-cols-[0.9fr_1.1fr]` |
| Dashboard actions | `xl:grid-cols-[1.1fr_0.9fr]` |
| Hero (content + preview) | `lg:grid-cols-[1.05fr_0.95fr]` |

**Never** hardcode pixel widths in grid columns unless critically necessary.

### Responsive breakpoints

Tailwind defaults apply. Key Haven conventions:
- Mobile-first: design for single-column first, expand at `lg` (1024px)
- Use `min-h-[100dvh]` (not `h-screen`) for full-height sections
- Touch targets: `min-h-11` (44px) on all interactive elements

---

## 9. Motion & Animation

**Intensity: 4/10** — purposeful, not decorative.

| Effect | Implementation | When |
|--------|---------------|------|
| Entrance | `haven-fade-up` 0.35s ease-out | Cards and sections entering viewport on first load |
| Stagger | `animation-delay: calc(var(--index) * 50ms)` | Lists of 3–5 sibling elements |
| Hover lift | `hover:-translate-y-0.5 transition-transform duration-150` | Cards that are clickable |
| Press feedback | `active:translate-y-px active:scale-[0.98]` | All buttons |
| Pulse | `haven-pulse` 2s ease-in-out infinite | Urgent status indicators only |
| Transitions | `transition-colors duration-150` | Button colour changes |

**Rules:**
- Transform and opacity only — never animate layout properties (width, height, padding)
- No scroll-triggered animations on functional/data views (dashboard, forms)
- `prefers-reduced-motion`: all animations collapse to `0.01ms`
- Spring physics reserved for future gesture-driven interactions only

```css
/* Easing reference */
--ease-out-smooth: cubic-bezier(0.16, 1, 0.3, 1);   /* Expo out — snappy decel */
--ease-in-out:     cubic-bezier(0.4, 0, 0.2, 1);     /* Standard transition */
```

---

## 10. Background & Texture

The page background is not a flat colour — it carries a subtle ambient gradient and
an ultra-light grid texture:

```css
body {
  background:
    radial-gradient(circle at top left,  rgba(139, 168, 154, 0.12), transparent 30%),
    radial-gradient(circle at top right, rgba(174, 202, 216, 0.12), transparent 25%),
    var(--color-bg);
}

body::before {
  /* 48px grid overlay — opacity ~2.5%, fades to transparent at 72% */
  background-image:
    linear-gradient(rgba(44,54,48,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(44,54,48,0.025) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(180deg, rgba(0,0,0,0.28), transparent 72%);
}
```

This texture only appears at the top of the page. Do not add grain filters on
scrollable content — this causes performance issues.

---

## 11. Iconography

**Library:** Lucide React (already installed).

| Context | Size | Colour |
|---------|------|--------|
| Section feature icons | `h-5 w-5` | `--haven-ink` |
| Card eyebrow icons | `h-5 w-5` | semantic (sky-ink, blush-ink, etc.) |
| Navigation icons | `h-4 w-4` | `--haven-ink-mid` |
| Sidebar / shell icons | `h-4 w-4` | matches nav state |

Icon containers: `h-11 w-11 rounded-xl bg-[--haven-white] flex items-center justify-center`

Consider migrating to **Phosphor React** (Bold weight) for richer expressiveness when
Lucide defaults feel too generic.

---

## 12. Copy & Voice

- **Tone:** Knowledgeable friend — direct, warm, never clinical or corporate
- **Active voice:** "See your timeline" not "Your timeline can be viewed"
- **Specificity over comfort:** "48 days, 3 actions" beats "You're on track"
- **No startup clichés:** Never use: Unlock, Supercharge, Seamless, Best-in-class, Game-changing
- **No AI-speak:** Never use: Leverage, Utilize, Synergy, Empower
- **Numbers:** Use real/organic-looking data — no round numbers like "10,000 users"
- **Error messages:** Specific and actionable — never "Something went wrong"

---

## 13. Accessibility Baseline

- **Touch targets:** `min-h-11` (44px) on all interactive elements
- **Focus rings:** `box-shadow: 0 0 0 3px rgba(139,168,154,0.4)` via `:focus-visible`
- **Colour contrast:** All text/bg combinations must meet WCAG AA (4.5:1 normal, 3:1 large)
- **No `color: inherit` outside `@layer base`** — unlayered rules beat utility classes in the cascade
- **Semantic HTML:** `<nav>`, `<main>`, `<aside>`, `<article>`, `<section>` over `<div>` where meaningful
- **Alt text:** All `<img>` tags; SVG icons that convey meaning need `aria-label`
- **`prefers-reduced-motion`:** Collapse all animation to `0.01ms`

---

## 14. CSS Architecture

```
globals.css
├── @import (Google Fonts, Tailwind)
├── @config / @source (Tailwind v4)
├── :root { CSS custom properties }
├── @theme inline { Tailwind theme bridge }
├── @layer base { element resets — a, button, input }
├── body / html global styles
├── Utility classes: .text-*, .content-container*, .field-*, .page-intro
├── Component classes: .tag*, .avatar*, .timeline*, .countdown-bar*, .step-dot*
├── @keyframes: haven-fade-up, haven-pulse
└── @media: mobile padding, prefers-reduced-motion
```

**Critical rule:** All element-level resets (`a { color: inherit }`, etc.) MUST live inside
`@layer base`. Placing them outside a layer gives them higher cascade priority than
`@layer utilities`, silently breaking Tailwind utility classes on anchor elements.

---

## 15. File Structure Reference

```
src/
├── app/
│   ├── globals.css              ← Design tokens, type scale, component classes
│   ├── page.tsx                 ← Landing page
│   ├── login/page.tsx           ← Auth — two-column split
│   ├── register/page.tsx        ← Auth — two-column split
│   ├── onboarding/
│   │   ├── page.tsx             ← Server wrapper
│   │   └── OnboardingFlow.tsx   ← "use client" stepper
│   ├── dashboard/page.tsx       ← Protected — server component
│   └── community/
│       ├── page.tsx             ← Protected — server component
│       └── CommunityComposer.tsx ← "use client"
├── components/
│   ├── ui/button.tsx            ← buttonVariants (CVA)
│   └── app/
│       ├── app-shell.tsx        ← Authenticated layout shell + sidebar
│       └── haven-brand.tsx      ← Logo / wordmark component
├── lib/
│   ├── repositories/mock-data.ts ← Fallback data when Supabase unavailable
│   └── utils.ts                 ← cn() helper
└── proxy.ts                     ← Auth middleware (protects /dashboard, /community, /onboarding)
```

---

*Last updated: 2026-03-23 — reflects taste-skill Stitch/Soft-Skill/Redesign-Skill principles.*
