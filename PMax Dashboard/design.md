# Initiative PMax Dashboard — Design System

Source of truth derived from initiative.com branding. Apply these tokens and rules to every new feature in `index.html`.

---

## Color Tokens

All defined in `:root` as CSS custom properties.

| Token | Hex | Use |
|---|---|---|
| `--black` | `#000000` | Primary text, borders, topbar background |
| `--white` | `#FFFFFF` | Card/panel backgrounds, table backgrounds |
| `--off-white` | `#F5F2EE` | Page background (matches initiative.com `#F5F2EE`) |
| `--charcoal` | `#161616` | Sidebar background |
| `--dark-gray` | `#2B2B2B` | Hover states |
| `--mid-gray` | `#777777` | Labels, secondary text, chart axes |
| `--light-gray` | `#E6E6E2` | Borders, dividers, chart gridlines |
| `--soft-gray` | `#F0F0EC` | Table row hover, badge backgrounds |
| `--ink-blue` | `#5EC7EB` | Initiative primary — sidebar focus rings, active accents |
| `--secondary` | `#FFFF99` | Initiative secondary — use sparingly for callouts |
| **Data semantic** | | **Never use for brand; use only for data meaning** |
| `--growth` | `#00A676` | Positive ROAS, good performance |
| `--attention` | `#FFB000` | Mid-tier ROAS, pending states |
| `--risk` | `#E53935` | Poor ROAS, wasted spend, zombie alerts |
| `--info` | `#2196F3` | Initiative accent/link — info badges, clicks KPI |
| **Channel colours** | | **Data-only; tied to ad network type** |
| `--shop` | `#2F6BFF` | Shopping channel |
| `--video` | `#E53935` | Video channel |
| `--display` | `#FFB000` | Display channel |
| `--search` | `#00A676` | Search / Other channel |

---

## Typography

### Typefaces

| Role | Family | CSS var | Where |
|---|---|---|---|
| Display / headings | League Gothic | `var(--display)` | `.sec-hdr`, `.ph h2`, major labels |
| UI / body | Poppins | `var(--ui)` | All body text, buttons, dropdowns |
| Data / numbers | JetBrains Mono | `var(--mono)` | `.mc` table cells, numeric KPI values |

Both League Gothic and Poppins are loaded from Google Fonts. Aldine 721 BT Roman is the commercial font used on initiative.com but is not available via CDN — Poppins is the approved fallback.

### Type Scale

| Element | Size | Weight | Font | Transform |
|---|---|---|---|---|
| Section header (`.sec-hdr`) | 18px | 400 | `--display` | uppercase, 0.14em spacing |
| Panel heading (`.ph h2`) | 15px | 400 | `--display` | uppercase, 0.12em spacing |
| KPI label (`.kl`) | 10px | 700 | `--ui` | uppercase, 0.1em spacing |
| KPI value (`.kv`) | 36px | 800 | `--ui` | — |
| KPI subtext (`.ks`) | 11px | 400 | `--ui` | — |
| Nav tab | 10px | 700 | `--ui` | uppercase, 0.1em spacing |
| Table header (`th`) | 9px | 700 | `--ui` | uppercase, 0.08em spacing |
| Table cell (`td`) | 12px | 400 | `--ui` | — |
| Numeric cell (`.mc`) | 11px | 400 | `--mono` | — |

---

## Spacing & Geometry

- **Base unit**: 4px
- **Page padding** (`--page-pad`): 32px
- **Section gap** (`--sec-gap`): 28px
- **Card gap** (`--card-gap`): 16px
- **Card padding** (`--card-pad`): 24px
- **Border radius**: **8px** on cards (`.kpi`), panels (`.panel`), and interactive controls. The topbar, sidebar, and table rows remain sharp (0px) — they are structural chrome.

---

## Layout Structure

```
┌─────────────────────────────────────┐
│  TOPBAR (black, full width, 64px)   │
├──────────┬──────────────────────────┤
│          │  NAV TABS (white, 48px)  │
│ SIDEBAR  ├──────────────────────────┤
│(charcoal │  MAIN AREA               │
│  260px)  │  (off-white, scrollable) │
│          │                          │
└──────────┴──────────────────────────┘
```

- Sidebar (`grid-row: 2/4`) contains: Client dropdown → Campaign dropdown → Zombie count → footer
- Main area uses `.page` divs toggled `.on`/off via `nav()` — never show two pages simultaneously
- Within a page, use `.g2` / `.g3` / `.g4` grid helpers for multi-column panels

---

## Components

### KPI Card
```html
<div class="kpi" style="--kc: var(--growth)">
  <div class="kl">Label</div>
  <div class="kv">$12.4K</div>
  <div class="ks">Supporting stat</div>
</div>
```
The `--kc` custom property controls the 3px top accent bar. Use semantic color tokens only.

### Panel
```html
<div class="panel">
  <div class="ph">
    <h2>Panel Title</h2>
    <span class="badge">Subtitle or count</span>
  </div>
  <!-- content -->
</div>
```

### Data Table
Wrap in `<div class="sw">` (scrollable, max-height 460px). Column headers are sticky. Use `.mc` for numeric cells, `.tr` for right-align, `.rh`/`.rm`/`.rl` for ROAS colour coding.

### Inner Tabs (within a panel)
```html
<div class="tbar">
  <div class="itab on" onclick="itab('pane-id', this)">Tab A</div>
  <div class="itab" onclick="itab('pane-id-2', this)">Tab B</div>
</div>
<div class="tpane on" id="tp-pane-id">…</div>
<div class="tpane" id="tp-pane-id-2">…</div>
```

### Chart.js defaults
Always pass `responsive: true, maintainAspectRatio: false`. Use the pre-defined axis option objects:
- `axOpts` — standard x/y axes with Poppins 9px labels and `--light-gray` gridlines
- `legendOpts` — bottom legend with Poppins 10px labels

Wrap canvas in `<div class="cw" style="height:Npx">` to control chart height. Always call `dc('chartId')` before creating a new Chart instance to destroy any existing one.

---

## Do / Don't

| Do | Don't |
|---|---|
| Use `--display` (League Gothic) for section and panel headings | Use bold Poppins as a heading substitute |
| Use `--info: #2196F3` for informational/link-type accents | Use `#2F6BFF` — that was the pre-brand value |
| Use `--ink-blue: #5EC7EB` for brand-primary interactive accents | Use it for data meaning (it's not semantic) |
| Add `border-radius: 8px` to new cards and panels | Add border-radius to topbar, sidebar, or table rows |
| Keep the dark topbar and sidebar — it's intentional chrome | Switch to a fully light layout — the contrast is functional |
| Destroy charts with `dc()` before re-rendering | Create a second Chart.js instance on the same canvas |
