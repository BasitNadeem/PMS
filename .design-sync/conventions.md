# @pms/ui — design conventions

Shared UI primitives for the PMS (property-management system). Two components today: `Button` and `Badge`. This is a **Tailwind-utility** design system — components are styled with Tailwind classes, and you compose layouts with Tailwind classes too.

## Setup

No provider or theme wrapper is required. Import components directly and render them — they carry their own styling:

```tsx
import { Button, Badge } from "@pms/ui";

<Button variant="primary" size="md">Check in guest</Button>
<Badge variant="success">Paid</Badge>
```

The design-system stylesheet must be loaded on the page (it ships with the bundle). Nothing else to wire up.

## Styling idiom — Tailwind utility classes

Style layout and one-off elements with **Tailwind utility classes** (`flex`, `gap-3`, `rounded-lg`, `text-sm`, `p-4`, `bg-white`, `text-gray-700`, …). Components accept a `className` prop that is merged (via `tailwind-merge`) over their defaults, so you can override:

```tsx
<Button variant="secondary" className="w-full">Save draft</Button>
```

**Brand color scale** — the primary brand color is a warm terracotta, exposed as a Tailwind `brand-*` scale:

| Token | Hex | Use |
|---|---|---|
| `brand-600` | `#E0532B` | primary buttons, brand accents (default) |
| `brand-700` | `#C2431F` | primary hover / pressed |
| `brand-800` | `#9E3417` | deepest brand tone |
| `brand-500` | `#E86A45` | lighter brand tint |

Use `bg-brand-600` / `text-brand-600` / `hover:bg-brand-700` for anything brand-colored. Neutrals use the default Tailwind gray scale (`gray-100`, `gray-700`, `gray-900`). Status colors follow Tailwind's `green`/`amber`/`red`/`blue` families — see Badge below.

**Intended brand font:** Hanken Grotesk (falls back to the system sans stack; the font is not currently bundled, so previews render in the system font).

## Components

### Button
```tsx
<Button variant="primary" size="md" onClick={handleSave}>Post payment</Button>
```
- `variant`: `"primary"` (brand terracotta), `"secondary"` (gray), `"ghost"` (transparent, hover gray), `"destructive"` (red). Default `primary`.
- `size`: `"sm" | "md" | "lg"`. Default `md`.
- Also accepts `type`, `disabled`, `onClick`, `className`, and standard button attributes. Disabled dims to 60% and blocks pointer events.

### Badge
```tsx
<Badge variant="success">Checked in</Badge>
```
- `variant`: `"default"` (gray), `"success"` (green), `"warning"` (amber), `"danger"` (red), `"info"` (blue). Default `default`.
- Small pill for status. Each tone carries fixed semantic meaning — use `success`/`warning`/`danger`/`info` by meaning, not decoration. Common PMS mapping: Confirmed → `info`, Checked in → `success`, Tentative/Pending → `warning`, No-show/Overdue → `danger`, Draft/Checked out → `default`.

## Where the truth lives

- Component styling and the full utility vocabulary: read `_ds_bundle.css` (the compiled Tailwind for this DS).
- Per-component API and usage: each component's `.d.ts` (props contract) and `.prompt.md` (usage) under `components/general/<Name>/`.

## A small on-brand example

```tsx
import { Button, Badge } from "@pms/ui";

function FolioHeader() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-900">Folio #10473</span>
        <Badge variant="danger">Overdue</Badge>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm">Discard</Button>
        <Button variant="primary" size="sm">Post payment</Button>
      </div>
    </div>
  );
}
```
