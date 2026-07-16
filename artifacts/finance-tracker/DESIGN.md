---
name: Flow!
description: A personal finance tracker that stays quiet on neutral editorial surfaces until a number or a signature moment earns the right to be loud.
colors:
  flow-green: "#A8FF3E"
  flow-green-active: "#7DD900"
  expense-ink: "#7F1D1D"
  expense-ink-dark: "#FFA3A3"
  income-ink: "#00432C"
  income-ink-dark: "#6EE7B7"
  entry-accent: "#FF66D9"
  aurora-lime: "#A8FF3E"
  aurora-cyan: "#22D3EE"
  aurora-violet: "#A78BFA"
  aurora-mint: "#34D399"
  expense-violet: "#8B5CF6"
  expense-lilac: "#C084FC"
  expense-fuchsia: "#D946EF"
  expense-orchid: "#E879F9"
  expense-pink: "#EC4899"
  expense-cherry: "#F43F5E"
  expense-blush: "#FB7185"
  expense-red: "#EF4444"
  income-lime: "#84CC16"
  income-green: "#22C55E"
  income-teal: "#14B8A6"
  income-cyan: "#06B6D4"
  income-sky: "#0EA5E9"
  income-blue: "#3B82F6"
  income-indigo: "#6366F1"
  income-grape: "#A855F7"
  other-neutral: "#9CA3AF"
typography:
  display:
    fontFamily: "Righteous, sans-serif"
    fontSize: "3.1rem"
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
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.2em"
    textTransform: "uppercase"
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.flow-green}"
    textColor: "#020203"
    rounded: "{rounded.full}"
    padding: "10px 16px"
  button-dark:
    backgroundColor: "hsl(var(--foreground))"
    textColor: "hsl(var(--background))"
    rounded: "{rounded.md}"
    padding: "16px"
  toggle-active-expense:
    backgroundColor: "#FF4D4D"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
  toggle-active-income:
    backgroundColor: "#00A870"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
  category-pill-active:
    backgroundColor: "{colors.expense-red}"
    textColor: "#020203"
    rounded: "{rounded.full}"
    padding: "8px 14px"
  treemap-tile:
    backgroundColor: "{colors.expense-red}"
    textColor: "#f9f8f8"
    rounded: "14px"
    padding: "8px"
---

# Design System: Flow!

## 1. Overview

**Creative North Star: "The Quiet Voltage System"**

Flow! used to put a saturated gradient behind every card — Balance, Expense, Income, Insights each lived in its own pastel-to-vivid zone. That system has been retired. The current interface is deliberately quiet at rest: pages are unstyled neutral surfaces (no card chrome, no gradients, no drop shadows on content), numbers sit directly on the page background, and rows are separated by hairline borders instead of boxes. Voltage — saturated, vivid color — is not gone, it's been concentrated into the moments that earn it: the number itself (Righteous display type, never the container around it), the category treemap (flat pure hues, the loudest color surface in the app), the biometric lock screen's aurora mesh, and Flow Green as the one action color that crosses every screen. This is a **Restrained-base, Committed-moments** strategy: most of the UI is Restrained (neutral surface + one accent), but two or three signature surfaces per screen are allowed to go fully Committed.

This is a real departure from PRODUCT.md's original framing ("colores saturados y luminosos como identidad central, no un acento aislado") — the base UI today *is* closer to an isolated-accent model than the original brief called for. The counter-argument that's held up through many rounds of user iteration: the identity now lives in a few unmistakable, high-craft moments (the lock screen, the treemap, the Righteous numbers) rather than being smeared across every surface, and the user has consistently chosen this direction when shown both. If a future redesign wants to pull back toward "saturated everywhere," that's a legitimate, explicit reversal to flag — not something to silently reintroduce one card at a time.

The system still explicitly rejects the "sad corporate finance app" aesthetic — muted grays, spreadsheet tables, navy-and-white bank branding. Quiet is not the same as timid: line weight, type scale, and color-when-it-shows-up all stay confident.

**Key Characteristics:**
- Content surfaces are flat and borderless at rest: no card background, no drop shadow, no gradient. Sections separate with a `border-y`/`border-b` hairline (`hsl(var(--border))`) or plain vertical rhythm, never a boxed container.
- Righteous (the "numbers get personality" display face) is the one place saturated color and display type meet: hero balances, the treemap's hero percentage, deltas.
- Color as data, not decoration: category colors, income/expense deltas, and toggle states are the only places hue carries meaning outside the two signature moments below.
- Two signature "loud" surfaces, deliberately rare: the biometric lock screen's four-color static aurora mesh, and the dashboard's category treemap (flat, fully saturated tiles).
- Floating chrome (bottom nav) is the one surviving piece of liquid glass: `backdrop-filter: blur(24px) saturate(1.8)` over a translucent card-color fill.
- Flow Green (`#A8FF3E`) is the one color present on every screen: primary actions, active nav state, the lock screen's aurora and unlock button.

## 2. Colors

The palette has two layers: a small set of cross-app constants, and two 8-color category ramps (expense, income) that the user assigns per-category and that the treemap/pills render at full saturation.

### Primary
- **Flow Green** (`#A8FF3E`): the one color on every screen. Primary buttons, active nav icon, the lock screen's brightest aurora corner. Always paired with near-black text (`#020203`) — Flow Green fails contrast under white.
- **Flow Green Active** (`#7DD900`): pressed/darker state for the same role when a flat `#A8FF3E` chip would compete with surrounding chrome.

### Secondary — Expense category ramp (warm→cool, sin naranjas ni amarillos)
Eight colors, tier-500 saturation (matched to the income ramp's tier on purpose), running violet → red. Assigned by the user per-category via the Categories color picker; rendered flat (no gradient) with white text on the treemap.
- **Violet** (`#8B5CF6`) · **Lilac** (`#C084FC`) · **Fuchsia** (`#D946EF`) · **Orchid** (`#E879F9`) · **Pink** (`#EC4899`) · **Cherry** (`#F43F5E`) · **Blush** (`#FB7185`) · **Red** (`#EF4444`)
- Orange and yellow are explicitly excluded from this ramp — a prior version ran fuchsia→yellow and the user asked to replace the warm tail with more red/purple/pink instead.

### Secondary — Income category ramp (cool, lime→grape)
- **Lime** (`#84CC16`) · **Green** (`#22C55E`) · **Teal** (`#14B8A6`) · **Cyan** (`#06B6D4`) · **Sky** (`#0EA5E9`) · **Blue** (`#3B82F6`) · **Indigo** (`#6366F1`) · **Grape** (`#A855F7`)
- These need *more* legibility help under white text than expense does (5 of 8 fail 3:1 contrast at flat value, vs. 3 of 8 for expense) — see the Named Rule below.

### Tertiary — Aurora (lock screen only)
- **Aurora Lime** (`#A8FF3E`), **Aurora Cyan** (`#22D3EE`), **Aurora Violet** (`#A78BFA`), **Aurora Mint** (`#34D399`): four large **static** radial-gradient mesh corners (not blurred moving blobs anymore — a static mesh reads just as bold and costs far less to render), deliberately overlapping so no plain background shows between them. Exclusive to the biometric lock screen.

### Neutral
- **Background / Foreground** (`hsl(var(--background))` / `hsl(var(--foreground))`, `40 25% 95%` / `0 0% 12%` light, pure near-black/near-white in dark): the entire app surface. No card layer sits between content and this background on most pages — that's the point of the "quiet" base.
- **Border** (`hsl(var(--border))`): the only structural device most pages use instead of a card — a 1px hairline between sections (nav items, the entry launcher row, month headers in the transaction ledger).
- **Muted foreground** (`hsl(var(--muted-foreground))`): secondary text, timestamps, category amounts in the treemap legend.
- **Other / uncategorized** (`#9CA3AF`): the treemap's "+N more" aggregate bucket only — deliberately never named "Other" in the label (a real category can already be named that; reusing the word produced a duplicate-looking bug).

### Named Rules
**The Semantic Temperature Rule.** Green means income/positive, red means expense/negative. The exact hue can shift; the meaning never inverts, never goes gray.

**The Numbers-Only Voltage Rule.** Saturated color on a content surface is earned by being a *number* (Righteous display type) or a *category swatch* (treemap, pills, legend dots) — never a decorative card background. If you're about to add a gradient behind a card "for energy," that's the old system; don't.

**The Shadow-Not-Gradient Rule for legibility.** When white text needs to sit on an arbitrary saturated category color, the fix is a single soft `text-shadow: 0 1px 4px rgba(0,0,0,.45)` applied uniformly — never a per-color gradient (tried and reverted: it made colors read "less pure") and never a 4-direction stroke-style shadow (tried and reverted: reads as a cheap sticker outline at large display sizes).

## 3. Typography

**Display Font:** Righteous (sans-serif fallback) — exposed as `font-serif` in Tailwind despite the name.
**Title Font:** Geist at weight 800 (Plus Jakarta Sans fallback) — the `.font-title` utility.
**Body Font:** Plus Jakarta Sans (system sans-serif fallback).

**Character:** The same pairing as before, doing more work now that display type is the *primary* carrier of personality rather than one voice among gradient cards: a rounded, slightly playful geometric face (Righteous) for the figures that matter, a clean humanist sans (Plus Jakarta Sans) for everything supporting them, and a heavy uppercase grotesk (Geist) reserved for page titles.

### Hierarchy
- **Display** (Righteous, ~3.1rem on the dashboard balance / down to ~9px–68px on treemap tiles where size is computed from `sqrt(tile area)` in JS, weight 400, line-height 1): balance figures, the treemap's hero percentage. Sits directly on the page background or on a flat category color — never on a neutral card.
- **Title** (Geist, weight 800, ~1.875rem, uppercase, letter-spacing 0.02em): page-level H2s via `.font-title`. A `Brunson` face is loaded and reserved for this role in a pending rollout; Geist carries it until then.
- **Body** (Plus Jakarta Sans, 0.875rem, weight 400–500, line-height 1.5): UI copy, descriptions, list rows.
- **Label** (Plus Jakarta Sans, 0.625–0.6875rem, weight 700–800, letter-spacing 0.14–0.2em, uppercase): section eyebrows ("Balance · This month"), treemap category-name labels, month headers in the transaction ledger.

### Named Rules
**The Numbers-Get-Personality Rule.** Righteous is reserved for figures the user cares about. Body copy, labels, and category names stay in Plus Jakarta Sans, even inside the treemap where the category label sits right next to a Righteous number — display type never carries a name, only a value.

## 4. Elevation

Flow! is flat almost everywhere now — this is a bigger claim than the old system's "flat-and-colorful" since content cards themselves are gone, not just their shadows. There is no card layer between content and page background on the dashboard, transaction ledger, or category grid; sections separate with hairlines, not boxes. The two exceptions: floating chrome that must visually sit above content, and the lock screen's card, which gets a genuine animated glow because it's the app's one intentionally theatrical surface.

### Shadow Vocabulary
- **Floating chrome** (`box-shadow: 0 4px 24px rgba(0,0,0,0.12), inset 0 1px 0 hsl(var(--foreground)/0.06), inset 0 -1px 0 hsl(var(--background)/0.2)`): the bottom nav pill. Ambient, not directional.
- **Dropdown / popover** (`box-shadow: 0 8px 32px rgba(0,0,0,0.25)`): profile menu and popups.
- **Lock screen card glow** (`@keyframes ff-card-glow` cycling `box-shadow` color through Flow Green → Cyan → Violet → Mint over 16s): the one animated shadow in the app, reserved for the lock screen card specifically. Frozen to a static ambient shadow under `prefers-reduced-motion`.
- **Text shadow for treemap legibility** (`0 1px 4px rgba(0,0,0,.45)`): not an elevation shadow, but the app's only other sanctioned shadow use — see Colors → Named Rules.

### Named Rules
**The Hairline, Not Card Rule.** Where the old system would have reached for a card + shadow to separate content, the current system reaches for a `border-b`/`border-y` hairline first. A card is now the exception (the lock screen), not the default container.

## 5. Components

### Category Treemap (signature component)
The dashboard's spending-by-category chart: a hand-rolled squarify treemap (Bruls/Huizing/van Wijk), not a chart library. Tile area is proportional to spend; categories beyond a 6-tile cap collapse into a gray "+N more" bucket. Text hierarchy is inverted from a typical chart: the **percentage is the hero number** (Righteous, up to 68px, scales with `sqrt(tile area)` computed in JS — CSS container query units were tried first and silently failed to scale on the target Android WebView), the category name is a small uppercase label above it. Tiles are flat, fully saturated category color with white text and the uniform soft text-shadow (see Named Rules). No gradient, no per-tile contrast branching.
- **Corner Style:** 14px
- **Background:** the category's raw hex, unmodified
- **Text:** always white, `text-shadow: 0 1px 4px rgba(0,0,0,.45)`
- **Motion:** staggered grow-in (`opacity`/`scale`, spring easing, 40ms stagger per tile), retriggered on type toggle; respects `prefers-reduced-motion`

### EntrySheet (signature component)
The single full-screen sheet used for both creating and editing a transaction (a prior version had three separate UIs for this — now one). Circular numeric keypad, category pills in a horizontal scroll row, flat Expense/Income toggle. In edit mode, adds a date chip and a muted trash-icon button next to Save; never adds a second "Other"-style delete confirmation inline — that's a separate small popup, reserved for binary yes/no decisions.
- **Toggle:** flat pill, sliding colored thumb (`#FF4D4D` expense / `#00A870` income), no glass
- **Category pill (selected):** filled with the category's raw color, text color chosen for contrast (`readableTextColor` in `lib/utils.ts`)
- **Keypad key:** circular, transparent at rest, tinted background flash on press (rgba of the active type's color)

### Buttons / Pills
- **Shape:** pill (`rounded-full`) for toggles and compact actions; 16px (`rounded-2xl`) for full-width action buttons.
- **Primary:** Flow Green fill, near-black text — the strongest call to action (save, confirm, primary nav).
- **Dark:** `bg-foreground`/`text-background` (theme-aware, not a fixed hex) — the secondary strong action, e.g. "All transactions."
- **Press feedback:** `active:scale-95`/`active:scale-[0.96]`, no hover color-shift — touch-first, no meaningful hover surface.

### Bottom Navigation (signature component, unchanged)
Floating liquid-glass pill: `border-radius: 999px`, `backdrop-filter: blur(24px) saturate(1.8)`, translucent card-color fill, hairline border. The one surviving glass surface in the app.

### Category Swatches
A 2-column grid of solid color blocks (Pantone-style) with glass edit/delete actions inset on the color, category name below on a plain neutral row. In the create/edit form, colors render as tinted pills (`background: color+"1F"`, text in the raw color, ring when selected) — the only place a category's raw hue gets a translucent tint instead of full saturation.

### Lock Screen Aurora (signature component)
Four large **static** radial-gradient mesh corners (Flow Green, Cyan, Violet, Mint), deliberately overlapping so no plain background shows through, behind a narrow floating card with an animated glow (see Elevation). Replaced an earlier version using four blurred, independently-animated moving blobs — the static mesh reads equally bold for a fraction of the render cost.

## 6. Do's and Don'ts

### Do:
- **Do** default every new page/section to a flat, borderless surface — hairlines between sections, not cards.
- **Do** let Righteous carry the loudest color in any given screen; keep everything else (labels, body, category names) in Plus Jakarta Sans regardless of how saturated its background is.
- **Do** keep Flow Green (`#A8FF3E`) as the one cross-app action color, paired with near-black text.
- **Do** use a single soft `text-shadow` (never a gradient, never a 4-direction stroke) when white text needs to sit on an arbitrary saturated color.
- **Do** keep green = income/positive and red = expense/negative absolute.

### Don't:
- **Don't** put a gradient or tint behind a content card "for energy" — that's the retired system. If a surface needs to feel alive, that's Righteous type or a category color doing real work, not decoration.
- **Don't** reuse the aurora mesh (Flow Green/Cyan/Violet/Mint) outside the lock screen.
- **Don't** name a treemap's aggregate/overflow bucket "Other" — a real user category can already have that name; use a count-based label instead (`+N more`).
- **Don't** invert or neutralize the income/expense color coding.
- **Don't** default to a cream/beige body background "for warmth" — background stays a low-chroma near-white/near-black per PRODUCT.md's anti-reference against corporate-apagado finance apps.
