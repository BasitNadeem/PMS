---
name: Linen & Terra
colors:
  surface: '#fff8f6'
  surface-dim: '#edd5cb'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff1eb'
  surface-container: '#ffeae1'
  surface-container-high: '#fbe3d9'
  surface-container-highest: '#f5ded4'
  on-surface: '#251913'
  on-surface-variant: '#584238'
  inverse-surface: '#3b2d27'
  inverse-on-surface: '#ffede6'
  outline: '#8b7267'
  outline-variant: '#dfc0b3'
  surface-tint: '#a23f00'
  primary: '#9e3e00'
  on-primary: '#ffffff'
  primary-container: '#c3510b'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb695'
  secondary: '#526351'
  on-secondary: '#ffffff'
  secondary-container: '#d2e5ce'
  on-secondary-container: '#566755'
  tertiary: '#615c47'
  on-tertiary: '#ffffff'
  tertiary-container: '#7b745e'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcc'
  primary-fixed-dim: '#ffb695'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7b2f00'
  secondary-fixed: '#d5e8d1'
  secondary-fixed-dim: '#b9ccb5'
  on-secondary-fixed: '#101f11'
  on-secondary-fixed-variant: '#3a4b3a'
  tertiary-fixed: '#ebe2c8'
  tertiary-fixed-dim: '#cec6ad'
  on-tertiary-fixed: '#1f1c0b'
  on-tertiary-fixed-variant: '#4c4733'
  background: '#fff8f6'
  on-background: '#251913'
  surface-variant: '#f5ded4'
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 40px
    fontWeight: '400'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Libre Caslon Text
    fontSize: 32px
    fontWeight: '400'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '400'
    lineHeight: '1.4'
  headline-sm:
    fontFamily: Libre Caslon Text
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.4'
  body-lg:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-lg:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-md:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 28px
    fontWeight: '400'
    lineHeight: '1.3'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 120px
---

## Brand & Style

The design system is centered on a **Boutique Resort Aesthetic**, evoking the tranquility of a high-end coastal retreat during the "golden hour." The target audience is discerning travelers seeking comfort and effortless luxury.

The visual style is a blend of **Glassmorphism** and **Tactile Minimalism**. It avoids the sterility of modern flat design by introducing organic textures, soft ambient lighting, and physical metaphors like rattan-inspired patterns and linen-pressed surfaces. The emotional response should be one of immediate relaxation, warmth, and hospitality. 

Key stylistic pillars include:
- **Naturalism:** Use of subtle botanical motifs and earthen materials.
- **Soft Diffusion:** Every shadow and blur should feel like sunlight filtered through a linen curtain.
- **Premium Tangibility:** Elements should look "tappable" and weighty, rather than purely digital.

## Colors

The palette is strictly terrestrial, drawing from the transition of day to dusk. 

- **Primary (Terracotta):** A vibrant, earthy burnt orange used for primary actions and highlights. It represents warmth and appetite.
- **Secondary (Sage):** A muted, calming green used for secondary indicators, category icons, and success states.
- **Tertiary (Warm Sand/Cream):** The foundation of the UI. This creamy white replaces pure white to reduce eye strain and enhance the "cozy" feel.
- **Neutral (Deep Cocoa):** Used for typography and iconography. We avoid pure blacks and grays to maintain the warm chromatic temperature of the design system.

Backgrounds utilize soft gradients transitioning from warm sand to a faint peach to simulate sunset lighting.

## Typography

This design system uses a high-contrast typographic pairing to balance heritage with modern utility.

**Headlines** utilize **Libre Caslon Text**. Its elegant serifs and classic proportions signal premium service. Letter spacing is slightly tightened in larger sizes to maintain a sophisticated "editorial" feel.

**Body and Labels** utilize **DM Sans**. This low-contrast, geometric sans-serif ensures maximum legibility for menu descriptions and pricing, even when placed over translucent glass layers.

- Use **Libre Caslon Text** for hotel names, section titles, and item names.
- Use **DM Sans** for descriptions, nutritional info, and functional labels.
- Labels for "In-Room Dining" or metadata should use the **Label-LG** style with uppercase tracking to create a sense of hierarchy.

## Layout & Spacing

The layout philosophy follows a **fluid-to-contained model**. On mobile devices, the design system utilizes a generous 20px side margin to allow the "linen" background to frame the content comfortably.

- **Grid:** A 12-column grid is used for desktop, while a 4-column grid is used for mobile.
- **Rhythm:** Spacing is predominantly based on 8px increments. However, "breathable" whitespace is encouraged—use the **lg** (40px) or **xl** (64px) units between major sections (e.g., between the header and the food categories).
- **Safe Areas:** Cards and glass containers should have a minimum of 24px internal padding (md) to ensure content never feels cramped against the edges.

## Elevation & Depth

Hierarchy is established through **Ambient Depth** rather than traditional drop shadows.

1.  **Background Layer:** A soft, textured surface resembling high-quality paper or linen.
2.  **Surface Layer (Glassmorphism):** Content containers use a semi-transparent cream tint (80-90% opacity) with a heavy backdrop-blur (20px-40px). This allows the warm background colors to bleed through while maintaining text contrast.
3.  **Interactive Layer:** Buttons and active states utilize "Golden Shadows"—extra-diffused shadows tinted with a hint of the primary terracotta color (#D45D1A) at low opacity. This creates an "inner glow" effect that makes components feel illuminated by natural light.
4.  **Floating Elements:** Search bars and "Track Order" buttons use a slightly higher elevation with a thin, low-opacity secondary color border to define their edges without looking "sharp."

## Shapes

The shape language is organic and soft. There are no sharp corners in this design system.

- **Standard Elements:** Use a 0.5rem (8px) radius for input fields and small cards.
- **Large Containers:** Use `rounded-lg` (16px) or `rounded-xl` (24px) for the primary glassmorphic sheets that hold menu content.
- **Interactive Elements:** Buttons utilize a highly rounded or pill-shaped aesthetic to emphasize comfort and ease of use.
- **Iconography:** Icons should feature rounded caps and slightly thicker strokes to match the soft visual weight of the serif typography.

## Components

### Buttons
- **Primary:** Filled with Terracotta (#D45D1A), white text, and a soft glow shadow.
- **Secondary:** Glassmorphic fill with a Sage (#7A8C78) border or text.
- **Large Tappable:** All buttons must have a minimum height of 56px to accommodate the "cozy/accessible" requirement.

### Cards
- Food item cards should use the glassmorphic style with a subtle 1px inner stroke in a lighter cream to catch the "light." 
- Featured items can include a subtle natural motif (like a faint palm leaf watermark) in the background.

### Input Fields
- Backgrounds should be a darker shade of sand (#E8DCC4) with no border, using an inset shadow to feel "pressed" into the linen surface. 
- Focus states shift the background to the primary color at 5% opacity.

### Chips & Selectors
- Pill-shaped with soft Sage backgrounds for "active" categories.
- Use a slight bounce animation on tap to reinforce the tactile nature of the UI.

### Lists
- Use generous vertical spacing (24px) between list items. 
- Separators should be thin, low-contrast lines in a warm brown, never pure gray.