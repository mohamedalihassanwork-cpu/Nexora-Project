---
name: Nexora Digital Commerce
colors:
  surface: '#FFFFFF'
  surface-dim: '#d3d9f8'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f2ff'
  surface-container: '#ebedff'
  surface-container-high: '#e3e7ff'
  surface-container-highest: '#dce1ff'
  on-surface: '#141a32'
  on-surface-variant: '#434656'
  inverse-surface: '#292f48'
  inverse-on-surface: '#eff0ff'
  outline: '#737687'
  outline-variant: '#c3c5d8'
  surface-tint: '#004fe5'
  primary: '#004ad8'
  on-primary: '#ffffff'
  primary-container: '#2563ff'
  on-primary-container: '#f7f6ff'
  inverse-primary: '#b6c4ff'
  secondary: '#6629e6'
  on-secondary: '#ffffff'
  secondary-container: '#7f4bff'
  on-secondary-container: '#fcf6ff'
  tertiary: '#005d94'
  on-tertiary: '#ffffff'
  tertiary-container: '#0076bb'
  on-tertiary-container: '#f3f7ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164f'
  on-primary-fixed-variant: '#003baf'
  secondary-fixed: '#e8ddff'
  secondary-fixed-dim: '#cebdff'
  on-secondary-fixed: '#21005e'
  on-secondary-fixed-variant: '#5200ce'
  tertiary-fixed: '#cfe5ff'
  tertiary-fixed-dim: '#98cbff'
  on-tertiary-fixed: '#001d33'
  on-tertiary-fixed-variant: '#004a77'
  background: '#faf8ff'
  on-background: '#141a32'
  surface-variant: '#dce1ff'
  brand-cyan: '#00A3FF'
  brand-blue: '#2563FF'
  brand-indigo: '#5B4DFF'
  brand-violet: '#7038F0'
  brand-magenta: '#C45CFF'
  deep-blue: '#0047B8'
  ink-navy: '#0A1128'
  canvas: '#FAFBFF'
  border-hairline: '#E3E8F5'
  text-muted: '#5B6786'
  status-success: '#12A150'
  status-warning: '#E8A300'
  status-danger: '#D92D4A'
  status-neutral: '#6B7488'
typography:
  display:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 44px
  display-mobile:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 34px
  headline-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 30px
  headline-sm:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-md:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-sm:
    fontFamily: IBM Plex Sans Arabic
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 18px
  mono-code:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  mono-price:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-tablet: 1.5rem
  gutter-desktop: 2rem
  margin: 1rem
  margin-tablet: 1.5rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is tailored for an Arabic-first, RTL-native digital goods marketplace and store management platform. It operates at the intersection of high-velocity digital inventory trading (game credits, digital keys, software subscriptions) and manual transaction verification (bank transfers, mobile wallets, cash-in networks).

### Personality & Values
- **Calm Authority & Reassurance:** High-stakes manual payment verification under strict countdown timers requires an interface that eliminates visual noise, panic, and ambiguity.
- **Precision & Accountability:** Financial ledgers, item serial distributions, and store metrics use strict tabular and monospace clarity. The system treats transactions as immutable records.
- **Modern Middle Eastern Tech Aesthetic:** Fluid geometric shapes, energetic electric blue-to-violet gradient accents derived from folded ribbon dynamics, set against an airy, high-contrast canvas.

### Visual Style
A modern corporate-minimalist aesthetic combined with micro-glass flourishes and vibrant chromatic accents. Surfaces are crisp, clean, and predominantly flat with structural `#E3E8F5` borders, punctuated by soft blue-ambient backdrops (`rgba(37, 99, 255, 0.08)`) and high-energy brand gradient accents on primary actions.

## Colors

The color architecture enforces a strict division between **Brand Identity** and **Operational/Financial Semantics**.

### Core Palette
- **Primary (`#2563FF`):** Brand Blue drives primary interactive controls, main calls to action, active navigation states, and default focus highlights.
- **Secondary (`#7038F0`):** Brand Violet designates special flags, high-tier inventory tags, and secondary action highlights.
- **Tertiary (`#00A3FF`):** Brand Cyan provides luminous contrast in gradients, active progress indicators, and interactive links over dark backgrounds.
- **Neutral (`#0A1128`):** Ink Navy functions as the foundation for high-contrast typography, icons, and grounded structural frames.

### Functional Canvas & Structure
- **Canvas (`#FAFBFF`):** Cool, ultra-light tinted off-white background preventing glare while supporting clear separation from white container surfaces.
- **Surface (`#FFFFFF`):** High-clarity pure white used for cards, transaction modules, modals, and sheets.
- **Border (`#E3E8F5`):** Structural hairlines defining visual containment without reliance on heavy shadows.
- **Muted Text (`#5B6786`):** Secondary metadata, instructions, field guidelines, and audit subtitles.

### Semantic State System
Every status indicator requires unambiguous 3-way reinforcement: color, icon, and clear Arabic copy.
- **Success (`#12A150`):** Approved transfers, delivered digital keys, open stores, WhatsApp direct actions.
- **Warning (`#E8A300`):** Pending admin review, low inventory thresholds, countdown timers between 2 and 5 minutes.
- **Danger (`#D92D4A`):** Rejected receipts, expired reservation sessions, countdown under 30 seconds, negative wallet balances, and destructive actions.
- **Neutral (`#6B7488`):** Cancelled, archived, or offline store states.

## Typography

The typographic hierarchy accommodates Arabic script characteristics—requiring taller ascenders, deeper descenders, and open counters—while isolating Latin technical identifiers.

### Hierarchy & Family Roles
- **Arabic Body & Headlines (`IBM Plex Sans Arabic`):** Designed for crisp geometric legibility at low screen resolutions. Light weights are prohibited to ensure readability under outdoor sunlight.
- **Tabular Figures & Digital Goods Data (`JetBrains Mono`):** Dedicated to transaction hashes, activation license keys, voucher PINs, order IDs, and banking account numbers.

### Strict Bidirectional (BiDi) Guidelines
1. **Isolated LTR Wrappers:** All digital credentials, phone numbers, IBANs, and serial keys must sit in strictly isolated containers with `dir="ltr"` and `text-align: left`.
2. **Financial Formats:** Currency figures must render with tabular monospace numerals followed by the Arabic currency symbol (e.g., `1,250.00 ج.م` or `350.00 ر.س`).
3. **Form Fields:** Inputs for phone numbers and voucher serials default to LTR alignment while placeholder copy remains aligned RTL until user input begins.

## Layout & Spacing

A mobile-first 4px base rhythm drives consistent element distribution across both customer storefronts and merchant administrative dashboards.

### Responsive Breakpoints & Grids
- **Mobile (< 640px):** 4-column fluid layout with `16px` (`margin`) outer margins and `16px` (`gutter`) column gaps. Product showcases render in a dense 2-column card arrangement. Minimum touch target height is `44px`.
- **Tablet (640px – 1024px):** 8-column layout with `24px` margins and gutters. Catalogs expand into a 3-column grid; admin views introduce collapsible split panels.
- **Desktop (> 1024px):** 12-column layout with max-width capped at `1280px` for storefronts, while merchant control panels operate full-width with a `260px` fixed RTL right-hand sidebar navigation.

### RTL Grid Flow
Column sequencing and grid items flow natively from right to left (`flex-direction: row-reverse` or standard native HTML `dir="rtl"`). Offsets, sticky action bars, and summary sidebars anchor to the left side of desktop viewports to mirror standard reading progression.

## Elevation & Depth

Visual hierarchy uses crisp boundary lines and subtle, blue-tinted ambient glows rather than dense dropshadows.

### Elevation Levels
- **Level 0 (Flat):** Base canvas (`#FAFBFF`) and flush nested containers. No shadow; structure relies exclusively on a `1px` border of `#E3E8F5`.
- **Level 1 (Card / Resting Surface):** White surface cards (`#FFFFFF`) with `1px` border of `#E3E8F5` and a soft ambient glow: `box-shadow: 0 2px 8px -2px rgba(37, 99, 255, 0.05)`.
- **Level 2 (Interactive Hover & Active Cards):** Elevated product cards and active dropdowns: `box-shadow: 0 8px 24px -4px rgba(37, 99, 255, 0.08)`.
- **Level 3 (Sticky Action Bars & Modals):** Bottom sheets, mobile transaction confirmation bars, and modal overlays: `box-shadow: 0 16px 36px -6px rgba(10, 17, 40, 0.12)`.

### Focus Elevation
All active and keyboard-navigated interactive elements display an unbroken `2px` focus ring in Brand Blue (`#2563FF`) with a `2px` white offset gap.

## Shapes

The design system incorporates balanced, approachable curvature that softens data-heavy workflows without feeling childish.

### Border Radii Definitions
- **Default Component Radius (`12px` / `0.75rem`):** Applied to form inputs, input groups, standard buttons, digital code display boxes, and standard cards.
- **Large Container Radius (`16px` / `1rem`):** Applied to modal dialogs, bottom sheets, checkout payment method containers, and dashboard analytical widgets.
- **Full Radius (Pill / `999px`):** Applied strictly to status tags, category filtering chips, avatar frames, copy-code action buttons, and segmented selection tabs.

## Components

### Buttons
- **Primary CTA:** Solid background of Brand Blue (`#2563FF`) or the Brand Ribbon Gradient (`linear-gradient(135deg, #00A3FF 0%, #2563FF 50%, #7038F0 100%)`) with white text and `12px` border radius. Active/pressed state shifts to Deep Blue (`#0047B8`).
- **Secondary / Outline:** Transparent fill, `1px` solid `#E3E8F5`, `#0A1128` text. Hover adds a tint of `#FAFBFF`.
- **WhatsApp Instant Action:** Dedicated `#12A150` fill with white label and icon, used exclusively for direct manual proof submission.
- **Destructive:** Light `#D92D4A` red background tint (`#FEE2E2`) with `#D92D4A` label for cancellations; solid `#D92D4A` with confirmation dialog for irreversible actions.

### Form Inputs & Manual Payment Uploaders
- **Text Inputs:** Height of `48px`, `12px` radius, background `#FFFFFF`, `1px` border `#E3E8F5`. Text is `#0A1128` with placeholder in `#5B6786`. On focus, border transitions to `#2563FF` with a subtle blue ring.
- **Receipt Proof Upload Field:** Dashed `2px` border in `#E3E8F5`, rounded `16px`. Displays clear camera/file icons, explicit size limits in Arabic, and an image preview state with a deletion trigger.

### Status Badges & Chips
- **Geometry:** Pill-shaped (`999px`), padding `4px 12px`, font size `12px`, weight `500`.
- **Structure:** Always contains a `6px` solid status dot or mini-icon + localized status string.
  - *Delivered / Approved:* Light green surface (`#E8F7ED`), text & dot `#12A150`.
  - *Under Review / Pending:* Light amber surface (`#FEF7E6`), text & dot `#E8A300`.
  - *Rejected / Expired:* Light red surface (`#FDE8EB`), text & dot `#D92D4A`.
  - *Customer Support Flag:* Light violet surface (`#F2EBFE`), text & dot `#7038F0`.

### Cards & Code Blocks
- **Digital License Vault Card:** Features a masked serial number block with an isolated LTR wrapper, monospace typography, and a single-click "نسخ" (Copy) button with instant visual feedback.
- **Countdown Banner Card:** High-visibility banner during checkout lockouts. Features a non-flashy, calm tabular timer countdown that transitions from `#2563FF` (standard) to `#E8A300` (<2 min) and `#D92D4A` (<30 sec).

### Directional Icons in RTL
- **Flipped Icons:** Chevrons, back arrows, navigation progress steps, and breadcrumb carets must mirror along the Y-axis (`scaleX(-1)`).
- **Static Icons:** Clocks, locks, checkmarks, WhatsApp badges, search magnifiers, and download symbols remain unflipped.