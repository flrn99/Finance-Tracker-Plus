---
name: Flow!
description: A pastel-to-vivid personal finance tracker where every zone of the app carries its own saturated color identity.
colors:
  flow-green: "#A8FF3E"
  flow-green-active: "#7DD900"
  ink-black: "#020203"
  paper-white: "#f9f8f8"
  balance-purple: "#B026FF"
  balance-purple-deep: "#3B0764"
  income-green: "#00FF9C"
  income-green-deep: "#00432C"
  expense-red: "#FF4D4D"
  expense-red-deep: "#7F1D1D"
  entry-pink: "#FF66D9"
  entry-pink-deep: "#7A0A5C"
  insights-sky: "#0EA5E9"
  insights-sky-deep: "#082F49"
  aurora-violet: "#A78BFA"
  aurora-cyan: "#22D3EE"
  aurora-mint: "#34D399"
typography:
  display:
    fontFamily: "Righteous, sans-serif"
    fontSize: "2.4rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, 'Plus Jakarta Sans', sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    letterSpacing: "0.02em"
    textTransform: "uppercase"
  body:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontSize: "0.625rem"
    fontWeight: 700
    letterSpacing: "0.2em"
    textTransform: "uppercase"
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
  full: "9999px"
components:
  card-zone-balance:
    backgroundColor: "linear-gradient(145deg, #F5E8FF 0%, #E4C6FF 55%, #CE9CFF 100%)"
    textColor: "{colors.balance-purple-deep}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-zone-expense:
    backgroundColor: "linear-gradient(145deg, #FFEDEE 0%, #FFD3D6 55%, #FFB0B5 100%)"
    textColor: "{colors.expense-red-deep}"
    rounded: "{rounded.lg}"
    padding: "14px"
  card-zone-income:
    backgroundColor: "linear-gradient(145deg, #E3FFF4 0%, #BFFFE3 55%, #8FFFCB 100%)"
    textColor: "{colors.income-green-deep}"
    rounded: "{rounded.lg}"
    padding: "14px"
  button-primary:
    backgroundColor: "{colors.flow-green}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-dark:
    backgroundColor: "{colors.ink-black}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.lg}"
    padding: "16px"
  badge-active:
    backgroundColor: "{colors.flow-green}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
---

# Design System: Flow!

## 1. Overview

**Creative North Star: "The Zoned Voltage System"**

Flow! rejects the beige-and-navy finance-app default. Every functional zone of the app — Balance, Expense, Income, New Entry, Insights — owns its own saturated pastel-to-vivid gradient identity, so the interface reads like a set of charged, distinct rooms rather than one uniform dashboard. The mood is vívida, lúdica, directa (vivid, playful, direct): loud enough that a screenshot is instantly recognizable as Flow!, but never cluttered — each card carries exactly one gradient, one or two soft white "sheen" blobs, and dark, high-contrast type sitting directly on the color instead of on a neutral panel. This is a **Committed-to-Full-palette** color strategy: several named zone colors, each used deliberately and never mixed across zones, anchored by Flow Green (`#A8FF3E`) as the one color that crosses every zone — it marks primary actions, active nav state, and the lock screen, regardless of which zone the screen belongs to.

The system explicitly rejects the "sad corporate finance app" aesthetic — muted grays, spreadsheet-style tables, navy-and-white bank branding, timid single-accent restraint. Warmth and energy are carried by saturated hue, not by a cream/beige body background; the base surface is a near-white, low-chroma warm neutral (`hsl(40 25% 95%)`) that exists only to make the zone gradients pop, never as the star of the page.

**Key Characteristics:**
- Every card is a self-contained color zone: pastel-to-vivid diagonal gradient (145deg), 1-2 soft translucent white blobs for sheen, dark ink-toned text at full opacity sitting directly on the gradient.
- Flow Green (`#A8FF3E`) is the one cross-zone constant: primary buttons, active states, the lock screen's floating unlock button.
- Semantic temperature is fixed: green = income/positive, red = expense/negative, never inverted, never neutralized to gray.
- Floating chrome (bottom nav, avatar, dropdowns) is liquid glass: `backdrop-filter: blur(24px) saturate(1.8)` over a translucent card-color fill, never a flat opaque bar.
- The lock screen is the system's boldest moment: four animated, heavily blurred color blobs (violet, cyan, mint, Flow Green) behind a narrow floating card — an "aurora mesh" treatment reserved for that one screen.

## 2. Colors

The palette is organized by zone, not by a single brand ramp — each named group below is a deliberate, self-contained gradient family with its own deep-text pairing for contrast.

### Primary
- **Flow Green** (`#A8FF3E`): the one color that appears in every zone. Primary action buttons, active bottom-nav state, active-selection chips in menus, the lock screen's central unlock button and blob. Always paired with black text/icons on top — Flow Green is too light for white text to pass contrast.
- **Flow Green Active** (`#7DD900`): the pressed/darker variant used for the active nav-icon fill state when a plain green chip would be too loud against surrounding chrome.

### Secondary — Zone Accents
Each functional area of the app claims one of these as its exclusive identity; they are never used outside their zone.
- **Balance Purple** (`#B026FF`, gradient `#F5E8FF → #E4C6FF → #CE9CFF`, deep text `#3B0764`): the Balance hero card and its segmented spend meter.
- **Income Green** (`#00FF9C`, gradient `#E3FFF4 → #BFFFE3 → #8FFFCB`, deep text `#00432C`): the Income stat tile. Distinct from Flow Green — cooler, minty, reserved for the income context specifically.
- **Expense Red** (`#FF4D4D`, gradient `#FFEDEE → #FFD3D6 → #FFB0B5`, deep text `#7F1D1D`): the Expense stat tile and any negative-amount indicator.
- **Entry Pink** (`#FF66D9`, gradient `#FFEAFB → #FFD1F5 → #FF9FE8`, deep text `#7A0A5C`): the "New entry" launcher exclusively — the one card that invites input rather than reporting a number.
- **Insights Sky** (`#0EA5E9`, gradient `#E3F4FF → #BFE7FD → #A5DCFB`, deep text `#082F49`): the Insights hero, the AI score gauge, and the active-nav highlight when the user is on the Insights tab.

### Tertiary — Aurora (lock screen only)
- **Aurora Violet** (`#A78BFA`), **Aurora Cyan** (`#22D3EE`), **Aurora Mint** (`#34D399`): heavily blurred (60-65px) background blobs used only on the biometric lock screen, alongside Flow Green, to create the app's single most saturated "hero" moment. Not used anywhere else — their rarity is what makes the lock screen feel like an event.

### Neutral
- **Ink Black** (`#020203`): the "All transactions" launcher, primary dark buttons, and text/icons that need maximum contrast on a light zone card. Reads as near-black, not pure `#000`.
- **Paper White** (`#f9f8f8`): text on ink-black surfaces (period toggle, dark buttons).
- **Base surface** (`hsl(40 25% 95%)` light / `hsl(0 0% 8%)` dark): the page background — deliberately low-chroma so zone gradients read as the loudest thing on screen.
- **Card surface** (`hsl(40 30% 99%)` light / `hsl(0 0% 11%)` dark): neutral containers (transaction list rows, settings panels) that intentionally sit outside the zone-color system.

### Named Rules
**The Semantic Temperature Rule.** Green means income/positive, red means expense/negative. The exact hue can shift with a redesign; the meaning never inverts and never goes gray for "neutrality."

**The One Zone, One Color Rule.** A gradient family (Balance purple, Income green, Expense red, Entry pink, Insights sky) belongs to exactly one card type. Never borrow another zone's gradient to "match" a nearby card — the zone distinctness is the point.

## 3. Typography

**Display Font:** Righteous (with sans-serif fallback) — exposed as `font-serif` in Tailwind, despite the name.
**Title Font:** Geist at weight 800 (with Plus Jakarta Sans fallback) — exposed as the `.font-title` utility class.
**Body Font:** Plus Jakarta Sans (with system sans-serif fallback).

**Character:** A rounded, slightly playful geometric display face (Righteous) for the numbers that matter — balances, amounts — paired with a clean, high-legibility humanist sans (Plus Jakarta Sans) for everything else, plus a heavy uppercase grotesk (Geist) reserved for shouting page titles. The contrast between the bubbly display digits and the disciplined body text is deliberate: numbers get personality, everything supporting them stays quiet.

### Hierarchy
- **Display** (Righteous, ~2.4rem–2.6rem, weight 400, line-height 1, letter-spacing -0.01em): balance figures, hero amounts, the Insights score. Sits directly on a zone gradient, never on a neutral card.
- **Title** (Geist, weight 800, ~1.875rem/text-3xl, uppercase, letter-spacing 0.02em): page-level H2s ("Dashboard", "Categories") via `.font-title`. A `Brunson` display face is loaded via `@font-face` and reserved for this role in a pending rollout — until applied, Geist carries page titles.
- **Body** (Plus Jakarta Sans, 0.875rem/text-sm, weight 400-500, line-height 1.5): default UI copy, descriptions, captions.
- **Label** (Plus Jakarta Sans, 0.625rem-0.6875rem, weight 700, letter-spacing 0.15em-0.2em, uppercase): eyebrow-style micro-labels inside zone cards ("Total Balance", "Expenses", period captions).

### Named Rules
**The Numbers-Get-Personality Rule.** Righteous is reserved for figures the user cares about (balances, totals, the AI score). Body copy, labels, and descriptions stay in Plus Jakarta Sans — display type never leaks into paragraph text.

## 4. Elevation

Flow! is mostly flat-and-colorful rather than shadow-driven: zone cards carry no drop shadow at rest, relying on the gradient itself plus soft internal white "sheen" blobs (`rgba(255,255,255,0.28-0.4)`, large blurred circles positioned off-corner) for depth. Real elevation is reserved for **floating chrome that sits above content** — the bottom nav, the profile dropdown, the avatar button, modals — which uses a liquid-glass treatment: `backdrop-filter: blur(24px) saturate(1.8-1.8)` over a translucent card-color fill, plus a soft ambient shadow and a 1px hairline border for edge definition.

### Shadow Vocabulary
- **Floating chrome** (`box-shadow: 0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 hsl(var(--foreground)/0.06), inset 0 -1px 0 hsl(var(--background)/0.2)`): the bottom nav pill and similar floating glass surfaces. Ambient, not directional.
- **Dropdown / popover** (`box-shadow: 0 8px 32px rgba(0,0,0,0.25)`): profile menu and popups — deliberately heavier since these sit furthest above the page.
- **Small glass button** (`box-shadow: 0 2px 12px rgba(0,0,0,0.12), inset 0 1px 0 hsl(var(--foreground)/0.06)`): the avatar button and similarly small floating circular controls.
- **Toggle knob** (`inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 1px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)`): the income/expense segmented toggle track and its sliding knob — a tactile, physical-feeling inset highlight rather than an external shadow.

### Named Rules
**The Flat Zone, Floating Chrome Rule.** Content cards (zone heroes, tiles, list rows) are flat at rest — their depth comes from color and sheen blobs, not shadow. Shadow is reserved for chrome that must visually float above content: nav, dropdowns, modals, floating buttons.

## 5. Components

### Zone Cards (signature component)
The core visual unit of the app. A `rounded-3xl` (24px) container with `overflow: hidden`, filled with a 145deg pastel-to-vivid gradient specific to its zone, plus one or two large soft-blurred circles in translucent white (`rgba(255,255,255,0.4)`) and a tinted version of the zone's saturated color (`rgba(zone-color, 0.12-0.15)`) positioned off-corner (e.g. `-top-14 -right-10`) for sheen. Text and icons sit in the zone's "deep" color variant at full opacity directly on the gradient — never on a white inset panel. No border, no drop shadow at rest.
- **Corner Style:** 24px (`rounded-3xl`)
- **Background:** zone gradient (see Colors → Secondary)
- **Shadow Strategy:** none at rest — see Elevation → Flat Zone rule
- **Internal Padding:** 14-16px

### Buttons / Pills
- **Shape:** pill (`rounded-full`) for compact icon/toggle buttons; 16-24px radius (`rounded-2xl`/`rounded-3xl`) for full-width action buttons.
- **Primary:** Flow Green (`#A8FF3E`) fill, black text/icon, used for the strongest calls to action (confirm, save, active-selection state).
- **Dark:** Ink Black (`#020203`) fill, white/paper text — used for the secondary strong action (e.g. "All transactions").
- **Hover / Focus:** subtle `active:scale-95` / `active:scale-[0.96]` press feedback rather than color-shift hover (this is a touch-first mobile app).
- **Ghost / Glass:** `rgba(255,255,255,0.6)` circular fill for small icon buttons living inside a zone card (matches the zone's sheen blobs rather than a global neutral).

### Bottom Navigation (signature component)
A floating liquid-glass pill, not a docked bar: `border-radius: 999px`, `backdrop-filter: blur(24px) saturate(1.8)`, translucent card-color background (`hsl(var(--card)/0.55-0.75)`), 1px hairline border, floating with margin from the screen edges. Shrinks width/padding on scroll-down and expands back on scroll-up/idle, animated with `cubic-bezier(0.25,0.46,0.45,0.94)` over 0.4s. The active icon gets a soft rounded-pill background tint (Insights Sky at 18% opacity when on that tab, a neutral foreground tint otherwise) and a color shift on the icon itself.

### Category Swatches
A 2-column grid of Pantone-style cards: a solid color block (h-9) up top carrying glass-morphism edit/delete actions inset with `inset 0 1px 1px rgba(255,255,255,0.5)` highlights, with just the category name below on a neutral card base — the swatch, not a card gradient, carries the color here since the component's whole purpose is color selection.

### Lock Screen Aurora (signature component)
Four large, heavily blurred (60-65px `filter: blur()`) circular blobs — Flow Green, Aurora Cyan, Aurora Violet, Aurora Mint — placed off-screen-edge behind a narrow (`max-width: 310px`), tall-radius (`rounded-[2rem]`) floating card holding the PIN/biometric UI. This is the one screen where four saturated colors coexist at once; everywhere else the app holds to one zone color per surface.

## 6. Do's and Don'ts

### Do:
- **Do** give every new functional zone (a new card type, a new page hero) its own gradient family with a matching deep-text color — never reuse another zone's exact gradient.
- **Do** keep Flow Green (`#A8FF3E`) as the one cross-zone color for primary actions and active states, paired with black text/icons.
- **Do** use `rounded-3xl` (24px) for content cards and reserve `rounded-full` for pills, nav, and small circular controls.
- **Do** use `backdrop-filter: blur(24px) saturate(1.8)` for any chrome that floats above content (nav, dropdowns, modals) rather than a flat opaque fill.
- **Do** keep green = income/positive and red = expense/negative absolute; never substitute a neutral gray for either.

### Don't:
- **Don't** default to a cream/beige/paper body background "for warmth" — the base surface must stay a low-chroma near-white or near-black so zone gradients carry the color, per PRODUCT.md's anti-reference against corporate-apagado, gray-and-navy finance apps.
- **Don't** put a drop shadow on a zone card at rest — depth comes from the gradient and sheen blobs, not `box-shadow`. Shadows are for floating chrome only.
- **Don't** invert or neutralize the income/expense color coding, even for a "calmer" variant.
- **Don't** reuse the four-blob "aurora" treatment outside the lock screen — its rarity is what makes it read as an event.
- **Don't** let Righteous (display numbers) leak into body copy, or Plus Jakarta Sans carry a hero balance figure — the personality split between the two is deliberate.
